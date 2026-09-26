/*
 * Receiver firmware (Nordic nRF52840 Dongle).
 *
 * Receives ring packets over Enhanced ShockBurst, turns them into cursor
 * motion with the pointer engine, and sends it to the computer as a USB
 * mouse (1000 reports/s). The USB serial port carries settings and telemetry
 * for the test app.
 *
 * Several rings can be powered at once; one drives the cursor. By default the
 * first ring that moves takes over when the current one is idle or silent;
 * the "ring" command can pin a specific one.
 */
#include <stdlib.h>
#include <string.h>

#include <zephyr/drivers/gpio.h>
#include <zephyr/kernel.h>
#include <zephyr/sys/atomic.h>
#include <zephyr/sys/util.h>

#include <esb.h>

#include "cfg_store.h"
#include "fw_version.h"
#include "link_packet.h"
#include "pointer_engine.h"
#include "proto.h"
#include "radio.h"
#include "usb_io.h"

#define MAX_RINGS 4
#define RING_SILENT_MS 1000       /* no packets for this long = gone */
#define RING_FORGET_MS 60000      /* drop from the list after this long */

static const struct gpio_dt_spec led_link = GPIO_DT_SPEC_GET(DT_ALIAS(led0), gpios);
static const struct gpio_dt_spec led_red = GPIO_DT_SPEC_GET(DT_ALIAS(led1), gpios);

/* ------------------------------------------------------------------ */
/* Radio -> motion thread                                              */

struct rx_item {
	uint8_t data[LINK_PACKET_SIZE];
	uint8_t len;
	int8_t rssi_dbm;
};

K_MSGQ_DEFINE(rx_queue, sizeof(struct rx_item), 32, 4);
static atomic_t rx_queue_drops;

static void esb_event(const struct esb_evt *evt)
{
	if (evt->evt_id != ESB_EVENT_RX_RECEIVED) {
		return;
	}
	struct esb_payload pl;

	while (esb_read_rx_payload(&pl) == 0) {
		struct rx_item it;

		if (pl.length > sizeof(it.data)) {
			continue;
		}
		memcpy(it.data, pl.data, pl.length);
		it.len = pl.length;
		it.rssi_dbm = (int8_t)-pl.rssi; /* ESB reports the magnitude */
		if (k_msgq_put(&rx_queue, &it, K_NO_WAIT) != 0) {
			atomic_inc(&rx_queue_drops);
		}
	}
}

/* ------------------------------------------------------------------ */
/* Rings                                                               */

struct ring_slot {
	bool used;
	uint32_t id;
	struct link_track track;
	uint32_t last_rx_ms;
	uint32_t last_moving_ms;   /* last packet without the idle flag */
	uint8_t flags;
	uint8_t fw_version;
	uint8_t last_fail8;
	uint32_t tx_fails;         /* unwrapped from the ring's 8-bit counter */
	int8_t rssi_dbm;
	bool bias_valid;           /* remembered while another ring is active */
	float bias[3];
};

/* Owned by the motion thread; the command thread reads it under ring_lock. */
static struct k_spinlock ring_lock;
static struct ring_slot rings[MAX_RINGS];
static int active = -1;
static uint32_t pinned_id; /* 0 = automatic */

static struct pe_state engine;
static uint32_t engine_cfg_gen;

static struct ring_slot *find_or_add(uint32_t id, uint32_t now)
{
	int free_slot = -1, oldest = -1;

	for (int i = 0; i < MAX_RINGS; i++) {
		if (rings[i].used && rings[i].id == id) {
			return &rings[i];
		}
		if (!rings[i].used && free_slot < 0) {
			free_slot = i;
		}
		if (rings[i].used && i != active &&
		    (oldest < 0 || rings[i].last_rx_ms < rings[oldest].last_rx_ms)) {
			oldest = i;
		}
	}
	int i = free_slot >= 0 ? free_slot : oldest;

	if (i < 0) {
		return NULL;
	}
	memset(&rings[i], 0, sizeof(rings[i]));
	rings[i].used = true;
	rings[i].id = id;
	rings[i].last_rx_ms = now;
	link_track_reset(&rings[i].track);
	return &rings[i];
}

static bool slot_available(const struct ring_slot *s, uint32_t now)
{
	return s->used && now - s->last_rx_ms < RING_SILENT_MS;
}

static void activate(int idx)
{
	if (idx == active) {
		return;
	}
	if (active >= 0) {
		/* Remember what we learned about the outgoing ring's sensor. */
		rings[active].bias_valid = pe_get_bias(&engine, rings[active].bias);
	}
	active = idx;
	if (idx >= 0 && rings[idx].bias_valid) {
		pe_set_bias(&engine, rings[idx].bias);
	} else {
		pe_reset_bias(&engine);
	}
	pe_reset_motion(&engine);
}

/* Decide which ring drives the cursor after a packet from `s`. */
static void choose_active(struct ring_slot *s, uint32_t now)
{
	int idx = (int)(s - rings);

	if (pinned_id != 0) {
		if (s->id == pinned_id) {
			activate(idx);
		} else if (idx == active) {
			activate(-1); /* pinned to another ring: this one must not drive */
		}
		return;
	}
	if (idx == active) {
		return;
	}
	if (active < 0) {
		activate(idx);
		return;
	}

	const struct ring_slot *a = &rings[active];

	if (!slot_available(a, now)) {
		activate(idx);   /* current ring went silent (off, or plugged in) */
	} else if ((a->flags & LINK_FLAG_IDLE) && !(s->flags & LINK_FLAG_IDLE)) {
		activate(idx);   /* current ring is resting and this one moves */
	}
}

static void engine_sync_config(void)
{
	if (cfg_store_generation() != engine_cfg_gen) {
		struct pe_config c;

		cfg_store_get(&c, &engine_cfg_gen);
		pe_set_config(&engine, &c);
	}
	if (proto_take_rezero_request()) {
		pe_reset_bias(&engine);
	}
}

static void handle_packet(const struct rx_item *it)
{
	struct link_packet p;
	uint32_t now = k_uptime_get_32();

	if (!link_packet_decode(it->data, it->len, &p)) {
		return;
	}

	k_spinlock_key_t key = k_spin_lock(&ring_lock);
	struct ring_slot *s = find_or_add(p.device_id, now);

	if (s == NULL) {
		k_spin_unlock(&ring_lock, key);
		return;
	}
	s->last_rx_ms = now;
	s->flags = p.flags;
	s->fw_version = p.fw_version;
	s->rssi_dbm = it->rssi_dbm;
	if (s->track.valid) {
		s->tx_fails += (uint8_t)(p.tx_fail_count - s->last_fail8);
	}
	s->last_fail8 = p.tx_fail_count;
	if (!(p.flags & LINK_FLAG_IDLE)) {
		s->last_moving_ms = now;
	}

	int32_t dg[3];
	uint32_t dc;
	enum link_result res = link_track_process(&s->track, &p, dg, &dc);

	choose_active(s, now);
	bool is_active = (int)(s - rings) == active;
	struct proto_link_info li = {
		.device_id = s->id,
		.rx_packets = s->track.packets,
		.lost_packets = s->track.lost_packets,
		.tx_fails = s->tx_fails,
		.rssi_dbm = s->rssi_dbm,
		.flags = s->flags,
		.mode = 'R',
	};
	k_spin_unlock(&ring_lock, key);

	if (!is_active) {
		return;
	}
	proto_telem_link(&li);

	engine_sync_config();
	if (res == LINK_RESYNC) {
		pe_reset_motion(&engine);
		return;
	}
	if (dc == 0) {
		return;
	}

	struct pe_output out;

	pe_update(&engine, dg, dc, p.accel, &out);
	usb_io_move(out.dx, out.dy);
	proto_telem_update(&engine, &out, dc, p.accel);
}

static void motion_thread_fn(void *p1, void *p2, void *p3)
{
	ARG_UNUSED(p1);
	ARG_UNUSED(p2);
	ARG_UNUSED(p3);
	struct rx_item it;

	for (;;) {
		k_msgq_get(&rx_queue, &it, K_FOREVER);
		handle_packet(&it);
	}
}

K_THREAD_DEFINE(motion_thread, 3072, motion_thread_fn, NULL, NULL, NULL, K_PRIO_COOP(5),
		K_FP_REGS, SYS_FOREVER_MS);

/* ------------------------------------------------------------------ */
/* Commands                                                            */

static void print_rings(void)
{
	uint32_t now = k_uptime_get_32();
	struct ring_slot copy[MAX_RINGS];
	int act;
	uint32_t pin;
	k_spinlock_key_t key = k_spin_lock(&ring_lock);

	memcpy(copy, rings, sizeof(copy));
	act = active;
	pin = pinned_id;
	k_spin_unlock(&ring_lock, key);

	for (int i = 0; i < MAX_RINGS; i++) {
		const struct ring_slot *s = &copy[i];

		if (!s->used || now - s->last_rx_ms > RING_FORGET_MS) {
			continue;
		}
		const char *state = now - s->last_rx_ms >= RING_SILENT_MS ? "silent"
				    : (s->flags & LINK_FLAG_IMU_ERROR) ? "imu-error"
				    : (s->flags & LINK_FLAG_IDLE)      ? "idle"
								       : "moving";

		proto_printf("I,ring,%08x,%s,%s,rssi,%d,fw,%u,lost,%u,of,%u\n", s->id,
			     i == act ? "active" : "standby", state, s->rssi_dbm, s->fw_version,
			     s->track.lost_packets, s->track.packets);
	}
	proto_printf("I,rings,mode,%s,%08x,queue_drops,%u\n", pin ? "pinned" : "auto", pin,
		     (unsigned int)atomic_get(&rx_queue_drops));
	proto_printf("OK,rings\n");
}

static bool receiver_cmd(int argc, char **argv)
{
	if (strcmp(argv[0], "help") == 0) {
		proto_printf("I,help,receiver commands: rings ring,<id> ring,auto\n");
		return true;
	}
	if (strcmp(argv[0], "rings") == 0) {
		print_rings();
		return true;
	}
	if (strcmp(argv[0], "ring") == 0 && argc == 2) {
		uint32_t id = 0;

		if (strcmp(argv[1], "auto") != 0) {
			char *end;

			id = (uint32_t)strtoul(argv[1], &end, 16);
			if (*end != '\0' || id == 0) {
				proto_printf("ERR,ring,give an id from 'rings' or auto\n");
				return true;
			}
		}
		k_spinlock_key_t key = k_spin_lock(&ring_lock);

		pinned_id = id;
		k_spin_unlock(&ring_lock, key);
		proto_printf("OK,ring,%s\n", argv[1]);
		return true;
	}
	return false;
}

static const struct proto_hooks hooks = {
	.role = "receiver",
	.extra_cmd = receiver_cmd,
};

/* ------------------------------------------------------------------ */
/* LEDs: green = a ring is moving the cursor, red blink = no ring       */

static void status_thread_fn(void *p1, void *p2, void *p3)
{
	ARG_UNUSED(p1);
	ARG_UNUSED(p2);
	ARG_UNUSED(p3);
	int tick = 0;

	for (;;) {
		k_msleep(100);
		tick++;

		uint32_t now = k_uptime_get_32();
		bool have_ring = false;
		k_spinlock_key_t key = k_spin_lock(&ring_lock);

		if (active >= 0 && slot_available(&rings[active], now)) {
			have_ring = true;
		}
		k_spin_unlock(&ring_lock, key);

		gpio_pin_set_dt(&led_link, have_ring);
		gpio_pin_set_dt(&led_red, !have_ring && (tick % 20) == 0);
	}
}

K_THREAD_DEFINE(status_thread, 1024, status_thread_fn, NULL, NULL, NULL, K_PRIO_PREEMPT(10),
		0, SYS_FOREVER_MS);

int main(void)
{
	gpio_pin_configure_dt(&led_link, GPIO_OUTPUT_INACTIVE);
	gpio_pin_configure_dt(&led_red, GPIO_OUTPUT_INACTIVE);

	cfg_store_init();
	struct pe_config c;

	cfg_store_get(&c, &engine_cfg_gen);
	pe_init(&engine, &c);

	proto_init(&hooks);
	(void)usb_io_init(proto_handle_line);

	int err = radio_init(ESB_MODE_PRX, esb_event);

	err = err ? err : esb_start_rx();
	if (err) {
		/* Radio failed: solid red. The serial port still works. */
		gpio_pin_set_dt(&led_red, 1);
		return 0;
	}

	k_thread_start(motion_thread);
	k_thread_start(status_thread);
	return 0;
}
