/*
 * Ring firmware (Seeed XIAO nRF52840 Sense).
 *
 * Radio mode (normal): read every IMU sample the moment it is ready and send
 * it to the receiver immediately over Enhanced ShockBurst (~1666 packets/s).
 *
 * Wired mode (plugged into a computer's USB port): act as a USB mouse
 * directly. Same motion processing as the receiver, no radio. Used as the
 * "fastest possible" reference in lag tests.
 *
 * Idle mode (radio, after 30 s lying still): poll the IMU at ~52 Hz and send a
 * heartbeat 4 times per second. Any movement wakes it within ~20 ms.
 */
#include <stdlib.h>
#include <string.h>

#include <zephyr/drivers/gpio.h>
#include <zephyr/drivers/hwinfo.h>
#include <zephyr/kernel.h>
#include <zephyr/sys/atomic.h>
#include <zephyr/sys/util.h>

#include <esb.h>

#include "cfg_store.h"
#include "fw_version.h"
#include "imu.h"
#include "link_packet.h"
#include "pointer_engine.h"
#include "proto.h"
#include "radio.h"
#include "usb_io.h"

/* ---- tuning of the ring's own power management ---- */
#define BLOCK_SAMPLES 166          /* ~100 ms at 1666 Hz */
#define STILL_PP_LSB 143           /* 5 deg/s peak-to-peak within a block */
#define IDLE_AFTER_BLOCKS 300      /* 30 s of still blocks */
#define IDLE_POLL_US 19208         /* 32 IMU samples: 32 / 1666 Hz */
#define IDLE_HEARTBEAT_POLLS 13    /* ~250 ms */
#define WAKE_GYRO_LSB 143          /* 5 deg/s away from the resting value */
#define WAKE_ACCEL_LSB 820         /* 0.1 g away from the resting value */
#define TX_STUCK_US 5000           /* recover if a TX event never arrives */
#define IMU_RETRY_MS 1000

/* ---- LEDs (active-low, polarity handled by devicetree) ---- */
static const struct gpio_dt_spec led_red = GPIO_DT_SPEC_GET(DT_ALIAS(led0), gpios);
static const struct gpio_dt_spec led_green = GPIO_DT_SPEC_GET(DT_ALIAS(led1), gpios);
static const struct gpio_dt_spec led_blue = GPIO_DT_SPEC_GET(DT_ALIAS(led2), gpios);

enum ring_mode { MODE_RADIO, MODE_IDLE, MODE_WIRED };

static atomic_t mode = ATOMIC_INIT(MODE_RADIO);
static atomic_t imu_ok;
static atomic_t tx_busy;
static atomic_t tx_ok_count;
static atomic_t tx_fail_count;
static uint32_t tx_start_cyc;

K_SEM_DEFINE(drdy_sem, 0, 1);

/* Cumulative state sent in every packet. Only the motion thread touches it. */
static struct link_packet pkt;

/* ------------------------------------------------------------------ */
/* Radio                                                               */

static void esb_event(const struct esb_evt *evt)
{
	switch (evt->evt_id) {
	case ESB_EVENT_TX_SUCCESS:
		atomic_inc(&tx_ok_count);
		break;
	case ESB_EVENT_TX_FAILED:
		atomic_inc(&tx_fail_count);
		break;
	case ESB_EVENT_RX_RECEIVED: {
		/* The receiver never sends payloads back; drain just in case. */
		struct esb_payload rx;

		while (esb_read_rx_payload(&rx) == 0) {
		}
		break;
	}
	default:
		break;
	}
	atomic_set(&tx_busy, 0);
}

/* Send the current cumulative state if the radio is free. If it is still busy
 * with the previous packet, skip: the next sample's packet carries everything.
 */
static void send_packet(void)
{
	if (atomic_get(&tx_busy)) {
		uint32_t busy_us = k_cyc_to_us_floor32(k_cycle_get_32() - tx_start_cyc);

		if (busy_us < TX_STUCK_US) {
			return;
		}
		/* Should never happen; don't let one lost event stop the ring. */
		atomic_set(&tx_busy, 0);
	}

	struct esb_payload pl = {
		.pipe = 0,
		.length = LINK_PACKET_SIZE,
		.noack = false,
	};

	pkt.seq++;
	pkt.tx_fail_count = (uint8_t)atomic_get(&tx_fail_count);
	link_packet_encode(&pkt, pl.data);

	/* A failed packet stays at the head of the ESB queue; drop it so the
	 * fresh one goes out now.
	 */
	(void)esb_flush_tx();
	tx_start_cyc = k_cycle_get_32();
	atomic_set(&tx_busy, 1);
	if (esb_write_payload(&pl) != 0) {
		atomic_set(&tx_busy, 0);
	}
}

/* ------------------------------------------------------------------ */
/* Wired mode: run the pointer engine here                             */

static struct pe_state engine;
static uint32_t engine_cfg_gen;

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

static void wired_process(const int16_t g[3], const int16_t a[3])
{
	int32_t dg[3] = {g[0], g[1], g[2]};
	struct pe_output out;

	engine_sync_config();
	pe_update(&engine, dg, 1, a, &out);
	usb_io_move(out.dx, out.dy);
	proto_telem_update(&engine, &out, 1, a);
}

/* ------------------------------------------------------------------ */
/* Motion thread                                                       */

static void add_samples(const int16_t g[3], const int16_t a[3], uint32_t n)
{
	for (int i = 0; i < 3; i++) {
		/* wrap-around on purpose; unsigned math avoids signed overflow */
		pkt.gyro_sum[i] = (int32_t)((uint32_t)pkt.gyro_sum[i] +
					    (uint32_t)((int32_t)g[i] * (int32_t)n));
		pkt.accel[i] = a[i];
	}
	pkt.sample_count += n;
}

struct still_block {
	int16_t min[3], max[3];
	int n;
};

static void block_reset(struct still_block *b)
{
	for (int i = 0; i < 3; i++) {
		b->min[i] = INT16_MAX;
		b->max[i] = INT16_MIN;
	}
	b->n = 0;
}

/* Returns true at the end of a block if the block was still. */
static bool block_add(struct still_block *b, const int16_t g[3], bool *done)
{
	for (int i = 0; i < 3; i++) {
		b->min[i] = MIN(b->min[i], g[i]);
		b->max[i] = MAX(b->max[i], g[i]);
	}
	*done = ++b->n >= BLOCK_SAMPLES;
	if (!*done) {
		return false;
	}
	bool still = true;

	for (int i = 0; i < 3; i++) {
		if (b->max[i] - b->min[i] > STILL_PP_LSB) {
			still = false;
		}
	}
	block_reset(b);
	return still;
}

static bool try_imu_init(void)
{
	int err = imu_init(&drdy_sem);

	atomic_set(&imu_ok, err == 0);
	if (err) {
		pkt.flags |= LINK_FLAG_IMU_ERROR;
	} else {
		pkt.flags &= (uint8_t)~LINK_FLAG_IMU_ERROR;
	}
	return err == 0;
}

static void motion_thread_fn(void *p1, void *p2, void *p3)
{
	ARG_UNUSED(p1);
	ARG_UNUSED(p2);
	ARG_UNUSED(p3);

	struct still_block blk;
	int still_blocks = 0;
	int16_t g[3], a[3];
	int16_t rest_g[3] = {0}, rest_a[3] = {0};
	int heartbeat = 0;
	uint32_t idle_last_cyc = 0;
	uint64_t idle_frac = 0; /* sub-sample remainder, in (samples * 1e6) units */
	int missed = 0;

	block_reset(&blk);

	while (!try_imu_init()) {
		/* Keep telling the receiver we're alive but broken. */
		send_packet();
		k_msleep(IMU_RETRY_MS);
	}

	for (;;) {
		bool wired = usb_io_hid_active();
		int cur = atomic_get(&mode);

		if (wired && cur != MODE_WIRED) {
			pe_reset_motion(&engine);
			pkt.flags &= (uint8_t)~LINK_FLAG_IDLE;
			imu_drdy_irq_enable(true);
			atomic_set(&mode, MODE_WIRED);
			cur = MODE_WIRED;
		} else if (!wired && cur == MODE_WIRED) {
			atomic_set(&mode, MODE_RADIO);
			still_blocks = 0;
			cur = MODE_RADIO;
		}

		if (cur == MODE_IDLE) {
			/* Slow polling: nothing is waiting on data-ready. */
			k_usleep(IDLE_POLL_US);
			uint32_t now = k_cycle_get_32();
			uint64_t us = k_cyc_to_us_floor64(now - idle_last_cyc);

			idle_last_cyc = now;
			idle_frac += us * (uint64_t)IMU_ODR_HZ;
			uint32_t n = (uint32_t)(idle_frac / 1000000u);

			idle_frac -= (uint64_t)n * 1000000u;

			if (imu_read(g, a) != 0) {
				pkt.flags |= LINK_FLAG_IMU_ERROR;
				continue;
			}
			pkt.flags &= (uint8_t)~LINK_FLAG_IMU_ERROR;
			if (n > 0) {
				add_samples(g, a, n);
			}

			bool moved = false;

			for (int i = 0; i < 3; i++) {
				if (abs(g[i] - rest_g[i]) > WAKE_GYRO_LSB ||
				    abs(a[i] - rest_a[i]) > WAKE_ACCEL_LSB) {
					moved = true;
				}
				rest_g[i] += (int16_t)((g[i] - rest_g[i]) / 8);
			}

			if (moved) {
				atomic_set(&mode, MODE_RADIO);
				pkt.flags &= (uint8_t)~LINK_FLAG_IDLE;
				still_blocks = 0;
				block_reset(&blk);
				imu_drdy_irq_enable(true);
				send_packet();
			} else if (++heartbeat >= IDLE_HEARTBEAT_POLLS) {
				heartbeat = 0;
				send_packet();
			}
			continue;
		}

		/* Active: wait for the IMU's data-ready signal. */
		if (k_sem_take(&drdy_sem, K_MSEC(3)) != 0 && !imu_drdy_pending()) {
			/* No data for 3 ms (normal is 0.6 ms). */
			if (++missed > 300) {
				missed = 0;
				(void)try_imu_init();
			}
			continue;
		}
		missed = 0;

		if (imu_read(g, a) != 0) {
			pkt.flags |= LINK_FLAG_IMU_ERROR;
			continue;
		}
		pkt.flags &= (uint8_t)~LINK_FLAG_IMU_ERROR;
		add_samples(g, a, 1);

		if (cur == MODE_WIRED) {
			wired_process(g, a);
			continue;
		}

		send_packet();

		bool done;
		bool still = block_add(&blk, g, &done);

		if (done) {
			still_blocks = still ? still_blocks + 1 : 0;
			if (still_blocks >= IDLE_AFTER_BLOCKS) {
				imu_drdy_irq_enable(false);
				memcpy(rest_g, g, sizeof(rest_g));
				memcpy(rest_a, a, sizeof(rest_a));
				idle_last_cyc = k_cycle_get_32();
				idle_frac = 0;
				heartbeat = 0;
				pkt.flags |= LINK_FLAG_IDLE;
				atomic_set(&mode, MODE_IDLE);
				send_packet();
			}
		}
	}
}

K_THREAD_DEFINE(motion_thread, 3072, motion_thread_fn, NULL, NULL, NULL, K_PRIO_COOP(5),
		K_FP_REGS, SYS_FOREVER_MS);

/* ------------------------------------------------------------------ */
/* Status LEDs and link statistics                                     */

static void led_pulse(const struct gpio_dt_spec *led, int ms)
{
	gpio_pin_set_dt(led, 1);
	k_msleep(ms);
	gpio_pin_set_dt(led, 0);
}

static void status_thread_fn(void *p1, void *p2, void *p3)
{
	ARG_UNUSED(p1);
	ARG_UNUSED(p2);
	ARG_UNUSED(p3);
	atomic_val_t last_ok = 0;
	int tick = 0;

	for (;;) {
		k_msleep(250);
		tick++;

		int m = atomic_get(&mode);

		if (m == MODE_WIRED) {
			struct proto_link_info li = {
				.device_id = pkt.device_id,
				.flags = pkt.flags,
				.mode = 'W',
			};

			proto_telem_link(&li);
		}

		if (!atomic_get(&imu_ok)) {
			if (tick % 4 == 0) {
				led_pulse(&led_red, 100);
			}
			continue;
		}
		if (tick % 8 != 0) {
			continue; /* one short blink every 2 s at most: saves battery */
		}
		atomic_val_t ok = atomic_get(&tx_ok_count);

		switch (m) {
		case MODE_WIRED:
			led_pulse(&led_green, 20);
			break;
		case MODE_RADIO:
			led_pulse(ok != last_ok ? &led_blue : &led_red, 20);
			break;
		default:
			break; /* idle: dark */
		}
		last_ok = ok;
	}
}

K_THREAD_DEFINE(status_thread, 1024, status_thread_fn, NULL, NULL, NULL, K_PRIO_PREEMPT(10),
		0, SYS_FOREVER_MS);

/* ------------------------------------------------------------------ */

static bool ring_cmd(int argc, char **argv)
{
	if (strcmp(argv[0], "help") == 0) {
		proto_printf("I,help,ring commands: info\n");
		return true;
	}
	if (strcmp(argv[0], "info") == 0 && argc == 1) {
		static const char *const names[] = {"radio", "idle", "wired"};
		int m = atomic_get(&mode);

		proto_printf("I,info,id,%08x,mode,%s,imu,%s,tx_ok,%u,tx_fail,%u\n", pkt.device_id,
			     names[m], atomic_get(&imu_ok) ? "ok" : "error",
			     (unsigned int)atomic_get(&tx_ok_count),
			     (unsigned int)atomic_get(&tx_fail_count));
		proto_printf("OK,info\n");
		return true;
	}
	return false;
}

static const struct proto_hooks hooks = {
	.role = "ring",
	.extra_cmd = ring_cmd,
};

static uint32_t read_device_id(void)
{
	uint8_t id[8] = {0};
	ssize_t n = hwinfo_get_device_id(id, sizeof(id));
	uint32_t v = 0;

	for (ssize_t i = 0; i < n; i++) {
		v = (v << 8 | v >> 24) ^ id[i];
	}
	return v;
}

/*
 * XIAO nRF52840: P0.14 switches the battery-voltage divider that feeds P0.31.
 * Seeed's guidance is to keep P0.14 LOW; otherwise P0.31 can see the full
 * battery voltage while charging, which is above the chip's rated input.
 * Driving it LOW costs ~3 uA through the divider.
 */
static void protect_vbat_sense_pin(void)
{
	const struct device *gpio0 = DEVICE_DT_GET(DT_NODELABEL(gpio0));

	if (device_is_ready(gpio0)) {
		(void)gpio_pin_configure(gpio0, 14, GPIO_OUTPUT_LOW);
	}
}

int main(void)
{
	protect_vbat_sense_pin();
	gpio_pin_configure_dt(&led_red, GPIO_OUTPUT_INACTIVE);
	gpio_pin_configure_dt(&led_green, GPIO_OUTPUT_INACTIVE);
	gpio_pin_configure_dt(&led_blue, GPIO_OUTPUT_INACTIVE);
	gpio_pin_set_dt(&led_green, 1); /* boot: short green */

	pkt.type = LINK_PACKET_TYPE_MOTION;
	pkt.device_id = read_device_id();
	pkt.fw_version = FW_VERSION;

	cfg_store_init();
	struct pe_config c;

	cfg_store_get(&c, &engine_cfg_gen);
	pe_init(&engine, &c);

	proto_init(&hooks);
	(void)usb_io_init(proto_handle_line);

	int err = radio_init(ESB_MODE_PTX, esb_event);

	k_msleep(300);
	gpio_pin_set_dt(&led_green, 0);
	if (err) {
		/* Without a radio the ring still works wired. */
		gpio_pin_set_dt(&led_red, 1);
		k_msleep(1000);
		gpio_pin_set_dt(&led_red, 0);
	}

	k_thread_start(motion_thread);
	k_thread_start(status_thread);
	return 0;
}
