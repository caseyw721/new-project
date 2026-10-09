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
#include <math.h>
#include <stdlib.h>
#include <string.h>

#include <zephyr/drivers/gpio.h>
#include <zephyr/kernel.h>
#include <zephyr/settings/settings.h>
#include <zephyr/sys/atomic.h>
#include <zephyr/sys/reboot.h>
#include <zephyr/sys/util.h>

#include <esb.h>
#include <hal/nrf_power.h>

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
	uint32_t t_us; /* when the radio handed it over (receiver clock, wraps in 71 min) */
};

/* `raw,1`: every packet from every ring as an R line (see PROTOCOL.md), for recording two rings at once */
static atomic_t raw_on;

#define BOOTLOADER_UF2_MAGIC 0x57 /* GPREGRET value: a UF2 bootloader (Makerdiary dongle) opens its drive */

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
		it.t_us = k_cyc_to_us_floor32(k_cycle_get_32());
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
	float accel_mag;           /* |accel| of the last packet (raw LSB) and when it arrived, for the jerk */
	uint32_t accel_us;
	bool accel_valid;
	uint32_t jerk_ms;          /* when |accel| last changed faster than the clicker threshold */
	float jerk;                /* how fast (peak within the window, LSB per ms) */
};

/* Owned by the motion thread; the command thread reads it under ring_lock. */
static struct k_spinlock ring_lock;
static struct ring_slot rings[MAX_RINGS];
static int active = -1;
static uint32_t pinned_id; /* 0 = automatic */

/* The pin is kept in flash ("rx/ring"), so a replugged receiver comes back pinned to the pointer ring. */
static int rx_settings_set(const char *name, size_t len, settings_read_cb read_cb, void *cb_arg)
{
	const char *next;
	uint32_t id;

	if (!settings_name_steq(name, "ring", &next) || next != NULL) {
		return -ENOENT;
	}
	if (len != sizeof(id) || read_cb(cb_arg, &id, sizeof(id)) != (ssize_t)sizeof(id)) {
		return 0;
	}
	k_spinlock_key_t key = k_spin_lock(&ring_lock);

	pinned_id = id;
	k_spin_unlock(&ring_lock, key);
	return 0;
}

SETTINGS_STATIC_HANDLER_DEFINE(rx, "rx", NULL, rx_settings_set, NULL, NULL);

static struct pe_state engine;
static uint32_t engine_cfg_gen;

/* ------------------------------------------------------------------ */
/* Thumb click                                                         */
/*
 * A tap of the thumb tip on the index fingertip is a shock on both rings
 * within a few milliseconds: |accel| changes by thousands of LSB per
 * millisecond (recorded 2026-10-07: pointer ring median 6300 LSB/ms, thumb
 * ring 2500), while ordinary pointing changes it by under 250. Hand swings
 * can be just as sharp at their onset, so a shock only counts as a tap when
 * the pointer ring was nearly still in the 400 to 150 ms before it (taps
 * come after the hand has settled on the target; swing shocks come mid-move,
 * 100+ degrees into the motion). The pointer finger curls 10-20 degrees in
 * the 100 ms before contact, so the click is posted after the cursor is
 * moved back to where it pointed before the pinch began, and motion is
 * ignored while the fingers open again. The ring that drives the cursor is
 * the pointer; any other ring is a clicker.
 */
#define TAP_WINDOW_MS 50         /* the two shocks must both fall within this */
#define TAP_QUIET_FROM_MS 400    /* the pointer ring's rotation in [now-400, now-150) ms ... */
#define TAP_QUIET_TO_MS 150
#define TAP_REFRACTORY_MS 600    /* the fingers opening again is not a second tap */
#define HIST_LEN 512             /* ms of motion remembered (power of two) */
/* Tunable live with `tapcfg,<quiet deg>,<rewind ms>,<hold ms>,<pointer jerk>,<clicker jerk>` (not saved). */
static float tap_jerk_pointer = 1000.0f; /* |accel| change on the pointer ring, LSB per ms */
static float tap_jerk_clicker = 300.0f;  /* on a clicker ring */
static float tap_quiet_max_deg = 20.0f;  /* rotation in the quiet window must stay under this for a shock to be a tap */
static uint32_t tap_rewind_ms = 150;     /* motion before the pointer ring's shock that is undone */
static uint32_t tap_hold_ms = 350;       /* motion ignored after the click (fingers opening) */

static atomic_t tap_on = ATOMIC_INIT(1);
static int32_t hist_x[HIST_LEN], hist_y[HIST_LEN]; /* cursor motion sent, per millisecond */
static uint16_t hist_rot[HIST_LEN];                /* pointer ring rotation, centidegrees per millisecond */
static uint32_t hist_ms;         /* slot hist_ms & (HIST_LEN - 1) holds that millisecond */
static bool holding;
static uint32_t hold_until_ms;
static uint32_t last_click_ms;

struct tap_hit {
	bool fire;
	float pointer_jerk, clicker_jerk;
	int32_t dt_ms;               /* clicker shock minus pointer shock */
	uint32_t pointer_jerk_ms;
	float quiet_deg;             /* pointer rotation in the quiet window */
};

/* Motion thread only. */
static void hist_advance(uint32_t now)
{
	if (now - hist_ms >= HIST_LEN) {
		memset(hist_x, 0, sizeof(hist_x));
		memset(hist_y, 0, sizeof(hist_y));
		memset(hist_rot, 0, sizeof(hist_rot));
		hist_ms = now;
		return;
	}
	while (hist_ms != now) {
		hist_ms++;
		hist_x[hist_ms & (HIST_LEN - 1)] = 0;
		hist_y[hist_ms & (HIST_LEN - 1)] = 0;
		hist_rot[hist_ms & (HIST_LEN - 1)] = 0;
	}
}

static void record_rotation(const struct pe_output *out, uint32_t now)
{
	float deg = sqrtf(out->dangle_deg[0] * out->dangle_deg[0] + out->dangle_deg[1] * out->dangle_deg[1] +
			  out->dangle_deg[2] * out->dangle_deg[2]);
	hist_advance(now); /* clears the slot for `now` first: before 2026-10-09 the stale value from 512 ms ago was
			    * read back in, so the "quiet" rotation grew for as long as the hand kept moving and every
			    * tap was refused after the first minute */
	uint32_t k = now & (HIST_LEN - 1);
	uint32_t v = hist_rot[k] + (uint32_t)(deg * 100.0f + 0.5f);

	hist_rot[k] = (uint16_t)MIN(v, UINT16_MAX);
}

static float rotation_between(uint32_t from_ms_ago, uint32_t to_ms_ago, uint32_t now)
{
	uint32_t sum = 0;

	hist_advance(now);
	for (uint32_t i = to_ms_ago; i < from_ms_ago && i < HIST_LEN; i++) {
		sum += hist_rot[(now - i) & (HIST_LEN - 1)];
	}
	return (float)sum / 100.0f;
}

static void send_motion(int32_t dx, int32_t dy, uint32_t now)
{
	if (holding) {
		if ((int32_t)(hold_until_ms - now) > 0) {
			return;      /* fingers opening after a click */
		}
		holding = false;
	}
	hist_advance(now);
	hist_x[now & (HIST_LEN - 1)] += dx;
	hist_y[now & (HIST_LEN - 1)] += dy;
	usb_io_move(dx, dy);
}

/* Undo the cursor motion sent in the last `ms` milliseconds; reports what was undone. */
static void rewind_motion(uint32_t ms, uint32_t now, int32_t *undone_x, int32_t *undone_y)
{
	int32_t sx = 0, sy = 0;

	hist_advance(now);
	ms = MIN(ms, HIST_LEN);
	for (uint32_t i = 0; i < ms; i++) {
		uint32_t k = (now - i) & (HIST_LEN - 1);

		sx += hist_x[k];
		sy += hist_y[k];
		hist_x[k] = 0;
		hist_y[k] = 0;
	}
	usb_io_move(-sx, -sy);
	*undone_x = sx;
	*undone_y = sy;
}

/* Per packet, under ring_lock: how fast |accel| is changing. */
static void jerk_update(struct ring_slot *s, const int16_t a[3], uint32_t t_us, uint32_t now)
{
	float mag = sqrtf((float)a[0] * a[0] + (float)a[1] * a[1] + (float)a[2] * a[2]);

	if (s->accel_valid) {
		float dt_ms = MAX((float)(t_us - s->accel_us) / 1000.0f, 0.5f);
		float jerk = fabsf(mag - s->accel_mag) / dt_ms;

		if (jerk > tap_jerk_clicker) {
			if (now - s->jerk_ms > TAP_WINDOW_MS) {
				s->jerk_ms = now;  /* the first sample of a new shock */
				s->jerk = jerk;
			} else {
				s->jerk = MAX(s->jerk, jerk);
			}
		}
	}
	s->accel_mag = mag;
	s->accel_us = t_us;
	s->accel_valid = true;
}

/* Under ring_lock: a pointer-ring shock and a clicker-ring shock inside one window, after a quiet spell = a tap. */
static struct tap_hit tap_check(uint32_t now)
{
	struct tap_hit hit = {.fire = false};

	if (!atomic_get(&tap_on) || active < 0 || now - last_click_ms < TAP_REFRACTORY_MS) {
		return hit;
	}
	struct ring_slot *a = &rings[active];

	if (a->jerk_ms == 0 || now - a->jerk_ms > TAP_WINDOW_MS || a->jerk < tap_jerk_pointer) {
		return hit;
	}
	for (int i = 0; i < MAX_RINGS; i++) {
		struct ring_slot *o = &rings[i];

		if (i == active || !o->used || o->jerk_ms == 0 || now - o->jerk_ms > TAP_WINDOW_MS) {
			continue;
		}
		hit.pointer_jerk = a->jerk;
		hit.clicker_jerk = o->jerk;
		hit.dt_ms = (int32_t)(o->jerk_ms - a->jerk_ms);
		hit.pointer_jerk_ms = a->jerk_ms;
		hit.quiet_deg = rotation_between(TAP_QUIET_FROM_MS + (now - a->jerk_ms),
						 TAP_QUIET_TO_MS + (now - a->jerk_ms), now);
		hit.fire = hit.quiet_deg < tap_quiet_max_deg;
		a->jerk_ms = o->jerk_ms = 0;
		if (hit.fire) {
			last_click_ms = now;
		} else {
			proto_printf("I,tap,no,%d,%d,%d,quiet,%d\n", (int)hit.pointer_jerk, (int)hit.clicker_jerk,
				     (int)hit.dt_ms, (int)hit.quiet_deg);
		}
		return hit;
	}
	return hit;
}

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
	jerk_update(s, p.accel, it->t_us, now);
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
	struct tap_hit tap = tap_check(now);
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

	if (tap.fire) {
		int32_t ux, uy;

		holding = true;
		hold_until_ms = now + tap_hold_ms;
		rewind_motion(tap_rewind_ms + (now - tap.pointer_jerk_ms), now, &ux, &uy);
		usb_io_click(1);
		proto_printf("I,tap,%d,%d,%d,quiet,%d,rewind,%d,%d\n", (int)tap.pointer_jerk, (int)tap.clicker_jerk,
			     (int)tap.dt_ms, (int)tap.quiet_deg, (int)ux, (int)uy);
	}
	if (atomic_get(&raw_on) && res == LINK_MOTION) {
		proto_printf("R,%04x,%u,%u,%d,%d,%d,%d,%d,%d\n", (unsigned int)(p.device_id & 0xffffu),
			     it->t_us, dc, dg[0], dg[1], dg[2], p.accel[0], p.accel[1], p.accel[2]);
	}
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
	record_rotation(&out, now);
	send_motion(out.dx, out.dy, now);
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
		proto_printf("I,help,receiver commands: rings ring,<id> ring,auto raw,0|1 tap,0|1 tapcfg[,quiet,rewind,hold,pjerk,cjerk] bootloader\n");
		return true;
	}
	if (strcmp(argv[0], "tap") == 0 && argc == 2) {
		atomic_set(&tap_on, strcmp(argv[1], "0") != 0);
		proto_printf("OK,tap,%d\n", (int)atomic_get(&tap_on));
		return true;
	}
	if (strcmp(argv[0], "tapcfg") == 0) {
		if (argc == 6) {
			tap_quiet_max_deg = strtof(argv[1], NULL);
			tap_rewind_ms = MIN((uint32_t)strtoul(argv[2], NULL, 10), HIST_LEN);
			tap_hold_ms = (uint32_t)strtoul(argv[3], NULL, 10);
			tap_jerk_pointer = strtof(argv[4], NULL);
			tap_jerk_clicker = strtof(argv[5], NULL);
		} else if (argc != 1) {
			proto_printf("ERR,tapcfg,give quiet_deg,rewind_ms,hold_ms,pointer_jerk,clicker_jerk\n");
			return true;
		}
		proto_printf("OK,tapcfg,%d,%u,%u,%d,%d\n", (int)tap_quiet_max_deg, (unsigned int)tap_rewind_ms,
			     (unsigned int)tap_hold_ms, (int)tap_jerk_pointer, (int)tap_jerk_clicker);
		return true;
	}
	if (strcmp(argv[0], "raw") == 0 && argc == 2) {
		atomic_set(&raw_on, strcmp(argv[1], "0") != 0);
		proto_printf("OK,raw,%d\n", (int)atomic_get(&raw_on));
		return true;
	}
	if (strcmp(argv[0], "bootloader") == 0 && argc == 1) {
		/* Restart into the UF2 drive, as holding the button while plugging in does (Makerdiary dongle) */
		proto_printf("OK,bootloader\n");
		k_msleep(50);
		nrf_power_gpregret_set(NRF_POWER, 0, BOOTLOADER_UF2_MAGIC);
		sys_reboot(SYS_REBOOT_WARM);
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
		int err = settings_save_one("rx/ring", &id, sizeof(id));

		if (err) {
			proto_printf("ERR,ring,save,%d\n", err);
		}
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
	(void)settings_load_subtree("rx"); /* the pinned ring */
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
