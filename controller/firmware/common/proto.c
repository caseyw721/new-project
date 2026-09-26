#include "proto.h"

#include <math.h>
#include <stdarg.h>
#include <stddef.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include <zephyr/kernel.h>
#include <zephyr/spinlock.h>
#include <zephyr/sys/printk.h>

#include "cfg_store.h"
#include "fw_version.h"
#include "usb_io.h"

#define MAX_ARGS 8
#define TELEM_PERIOD_MS 20

static const struct proto_hooks *hooks;
static atomic_t rezero_request;
static volatile bool telem_enabled = true;

void proto_printf(const char *fmt, ...)
{
	char buf[256];
	va_list ap;

	va_start(ap, fmt);
	int n = vsnprintk(buf, sizeof(buf), fmt, ap);

	va_end(ap);
	if (n > 0 && n < (int)sizeof(buf)) {
		(void)usb_io_write(buf, (size_t)n);
	}
}

bool proto_take_rezero_request(void)
{
	return atomic_set(&rezero_request, 0) != 0;
}

/* ------------------------------------------------------------------ */
/* Settings keys                                                        */

enum key_type { KEY_F32, KEY_BOOL, KEY_VEC3 };

struct key_def {
	const char *name;
	enum key_type type;
	size_t offset;
};

#define KEY_F(n, f) {n, KEY_F32, offsetof(struct pe_config, f)}
#define KEY_B(n, f) {n, KEY_BOOL, offsetof(struct pe_config, f)}
#define KEY_V(n, f) {n, KEY_VEC3, offsetof(struct pe_config, f)}

static const struct key_def keys[] = {
	KEY_F("gain", gain),
	KEY_F("accel", accel),
	KEY_F("knee", accel_knee_dps),
	KEY_F("mincutoff", min_cutoff_hz),
	KEY_F("beta", beta),
	KEY_F("speedcutoff", speed_cutoff_hz),
	KEY_F("deadzone", deadzone_dps),
	KEY_F("predict", predict_ms),
	KEY_F("still", still_thresh_dps),
	KEY_B("tilt", tilt_comp),
	KEY_B("autobias", auto_bias),
	KEY_V("right", axis_right),
	KEY_V("up", axis_up),
	KEY_V("fwd", forward),
};

static const struct key_def *find_key(const char *name)
{
	for (size_t i = 0; i < ARRAY_SIZE(keys); i++) {
		if (strcmp(keys[i].name, name) == 0) {
			return &keys[i];
		}
	}
	return NULL;
}

static void print_key(const struct pe_config *c, const struct key_def *k)
{
	const uint8_t *base = (const uint8_t *)c + k->offset;

	switch (k->type) {
	case KEY_F32: {
		float v;

		memcpy(&v, base, sizeof(v));
		proto_printf("C,%s,%.4f\n", k->name, (double)v);
		break;
	}
	case KEY_BOOL:
		proto_printf("C,%s,%u\n", k->name, (unsigned int)*base);
		break;
	case KEY_VEC3: {
		float v[3];

		memcpy(v, base, sizeof(v));
		proto_printf("C,%s,%.4f,%.4f,%.4f\n", k->name, (double)v[0], (double)v[1],
			     (double)v[2]);
		break;
	}
	}
}

static bool parse_float(const char *s, float *out)
{
	char *end;
	float v = strtof(s, &end);

	if (end == s || *end != '\0' || !isfinite(v)) {
		return false;
	}
	*out = v;
	return true;
}

static void cmd_set(int argc, char **argv)
{
	if (argc < 3) {
		proto_printf("ERR,set,usage: set,<key>,<value>[,<y>,<z>]\n");
		return;
	}
	const struct key_def *k = find_key(argv[1]);

	if (k == NULL) {
		proto_printf("ERR,set,unknown key %s\n", argv[1]);
		return;
	}

	struct pe_config c;

	cfg_store_get(&c, NULL);
	uint8_t *base = (uint8_t *)&c + k->offset;

	switch (k->type) {
	case KEY_F32: {
		float v;

		if (argc != 3 || !parse_float(argv[2], &v)) {
			proto_printf("ERR,set,%s needs one number\n", k->name);
			return;
		}
		memcpy(base, &v, sizeof(v));
		break;
	}
	case KEY_BOOL: {
		float v;

		if (argc != 3 || !parse_float(argv[2], &v)) {
			proto_printf("ERR,set,%s needs 0 or 1\n", k->name);
			return;
		}
		*base = v != 0.0f ? 1 : 0;
		break;
	}
	case KEY_VEC3: {
		float v[3];

		if (argc != 5 || !parse_float(argv[2], &v[0]) || !parse_float(argv[3], &v[1]) ||
		    !parse_float(argv[4], &v[2])) {
			proto_printf("ERR,set,%s needs three numbers\n", k->name);
			return;
		}
		memcpy(base, v, sizeof(v));
		break;
	}
	}

	cfg_store_set(&c);
	cfg_store_get(&c, NULL);
	print_key(&c, k); /* echo the value actually applied (after validation) */
	proto_printf("OK,set,%s\n", k->name);
}

static void cmd_get(void)
{
	struct pe_config c;

	cfg_store_get(&c, NULL);
	for (size_t i = 0; i < ARRAY_SIZE(keys); i++) {
		print_key(&c, &keys[i]);
	}
	proto_printf("OK,get\n");
}

static void cmd_help(void)
{
	char buf[160] = "";
	size_t n = 0;

	proto_printf("I,help,commands: ver get set save defaults rezero cursor telemetry help\n");
	/* Build the whole line first: output is only ever written in whole lines
	 * so it can't interleave with telemetry.
	 */
	for (size_t i = 0; i < ARRAY_SIZE(keys) && n < sizeof(buf); i++) {
		int w = snprintk(buf + n, sizeof(buf) - n, " %s", keys[i].name);

		if (w < 0) {
			break;
		}
		n += (size_t)w;
	}
	proto_printf("I,help,keys:%s\n", buf);
	if (hooks->extra_cmd != NULL) {
		char *argv[] = {"help"};

		(void)hooks->extra_cmd(1, argv);
	}
	proto_printf("OK,help\n");
}

void proto_handle_line(char *line)
{
	char *argv[MAX_ARGS];
	int argc = 0;
	char *save = NULL;

	for (char *tok = strtok_r(line, ", \t", &save); tok != NULL && argc < MAX_ARGS;
	     tok = strtok_r(NULL, ", \t", &save)) {
		argv[argc++] = tok;
	}
	if (argc == 0) {
		return;
	}

	const char *cmd = argv[0];

	if (strcmp(cmd, "ver") == 0) {
		proto_printf("I,ver,%s,%d\n", hooks->role, FW_VERSION);
		proto_printf("OK,ver\n");
	} else if (strcmp(cmd, "get") == 0) {
		cmd_get();
	} else if (strcmp(cmd, "set") == 0) {
		cmd_set(argc, argv);
	} else if (strcmp(cmd, "save") == 0) {
		int err = cfg_store_save();

		if (err) {
			proto_printf("ERR,save,%d\n", err);
		} else {
			proto_printf("OK,save\n");
		}
	} else if (strcmp(cmd, "defaults") == 0) {
		cfg_store_defaults();
		proto_printf("OK,defaults\n");
	} else if (strcmp(cmd, "rezero") == 0) {
		atomic_set(&rezero_request, 1);
		proto_printf("OK,rezero\n");
	} else if (strcmp(cmd, "cursor") == 0 && argc == 2) {
		usb_io_set_cursor_enabled(strcmp(argv[1], "0") != 0);
		proto_printf("OK,cursor,%s\n", argv[1]);
	} else if (strcmp(cmd, "telemetry") == 0 && argc == 2) {
		telem_enabled = strcmp(argv[1], "0") != 0;
		proto_printf("OK,telemetry,%s\n", argv[1]);
	} else if (strcmp(cmd, "help") == 0) {
		cmd_help();
	} else if (hooks->extra_cmd == NULL || !hooks->extra_cmd(argc, argv)) {
		proto_printf("ERR,%s,unknown command (try help)\n", cmd);
	}
}

/* ------------------------------------------------------------------ */
/* Telemetry                                                            */

struct telem_acc {
	float dangle[3];
	int32_t dx, dy;
	uint32_t updates, samples;
	float speed_max;
	bool still;
	float bias[3];
	float up[3];
	int16_t accel[3];
	float vib_g, vib_a;
};

static struct k_spinlock telem_lock;
static struct telem_acc acc;
static struct proto_link_info link_now;

void proto_telem_update(const struct pe_state *st, const struct pe_output *out,
			uint32_t dcount, const int16_t accel[3])
{
	k_spinlock_key_t key = k_spin_lock(&telem_lock);

	for (int i = 0; i < 3; i++) {
		acc.dangle[i] += out->dangle_deg[i];
		acc.bias[i] = st->bias[i];
		acc.up[i] = st->up[i];
		acc.accel[i] = accel[i];
	}
	acc.dx += out->dx;
	acc.dy += out->dy;
	acc.updates++;
	acc.samples += dcount;
	if (out->speed_dps > acc.speed_max) {
		acc.speed_max = out->speed_dps;
	}
	acc.still = out->still;
	acc.vib_g = st->vib_gyro_dps;
	acc.vib_a = st->vib_accel_g;
	k_spin_unlock(&telem_lock, key);
}

void proto_telem_link(const struct proto_link_info *info)
{
	k_spinlock_key_t key = k_spin_lock(&telem_lock);

	link_now = *info;
	k_spin_unlock(&telem_lock, key);
}

static int32_t r(float v)
{
	return (int32_t)lroundf(v);
}

static void telem_thread_fn(void *a, void *b, void *c)
{
	ARG_UNUSED(a);
	ARG_UNUSED(b);
	ARG_UNUSED(c);
	struct proto_link_info prev = {0};
	int64_t next = k_uptime_get();

	for (;;) {
		next += TELEM_PERIOD_MS;
		k_sleep(K_TIMEOUT_ABS_MS(next));

		struct telem_acc s;
		struct proto_link_info l;
		k_spinlock_key_t key = k_spin_lock(&telem_lock);

		s = acc;
		l = link_now;
		/* keep the slowly changing state, clear the interval sums */
		memset(acc.dangle, 0, sizeof(acc.dangle));
		acc.dx = acc.dy = 0;
		acc.updates = acc.samples = 0;
		acc.speed_max = 0.0f;
		k_spin_unlock(&telem_lock, key);

		uint32_t rx = l.rx_packets - prev.rx_packets;
		uint32_t lost = l.lost_packets - prev.lost_packets;
		uint32_t txf = l.tx_fails - prev.tx_fails;

		if (l.device_id != prev.device_id) {
			rx = lost = txf = 0; /* different ring: counters not comparable */
		}
		prev = l;

		if (!telem_enabled || !usb_io_host_listening()) {
			continue;
		}

		proto_printf("T,%u,%08x,%c,%u,%u,%d,%d,%d,%d,%d,%d,%d,%d,%d,%d,%d,%d,%d,%d,%d,%d,"
			     "%d,%d,%u,%u,%d,%u,%u\n",
			     k_uptime_get_32(), l.device_id, l.mode ? l.mode : '-', s.updates,
			     s.samples, r(s.dangle[0] * 1000.0f), r(s.dangle[1] * 1000.0f),
			     r(s.dangle[2] * 1000.0f), s.dx, s.dy, r(s.speed_max * 10.0f),
			     s.still ? 1 : 0, r(s.bias[0] * 1000.0f), r(s.bias[1] * 1000.0f),
			     r(s.bias[2] * 1000.0f), r(s.up[0] * 1000.0f), r(s.up[1] * 1000.0f),
			     r(s.up[2] * 1000.0f), r(s.accel[0] * IMU_ACCEL_G_PER_LSB * 1000.0f),
			     r(s.accel[1] * IMU_ACCEL_G_PER_LSB * 1000.0f),
			     r(s.accel[2] * IMU_ACCEL_G_PER_LSB * 1000.0f), r(s.vib_g * 1000.0f),
			     r(s.vib_a * 10000.0f), rx, lost, (int)l.rssi_dbm, txf,
			     (unsigned int)l.flags);
	}
}

K_THREAD_DEFINE(telem_thread, 2048, telem_thread_fn, NULL, NULL, NULL, K_PRIO_PREEMPT(9), 0,
		0);

void proto_init(const struct proto_hooks *h)
{
	hooks = h;
}
