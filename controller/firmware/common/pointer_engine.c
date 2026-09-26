/*
 * Pointer engine implementation. See pointer_engine.h for the pipeline.
 */
#include "pointer_engine.h"

#include <math.h>
#include <string.h>

#define PE_PI 3.14159265358979f
#define DEG2RAD (PE_PI / 180.0f)

/* Stillness detection works on 100 ms block averages over 1 s windows.
 * 100 ms blocks average out physiological hand tremor (8-12 Hz), so a hand
 * held still can count as still, not only a device lying on a table.
 */
#define BLOCK_S 0.100f
#define WINDOW_S 1.0f
/* Bias learning.
 * - "still" (hand held still): may only nudge the bias by a small amount, so
 *   a slow, steady deliberate rotation is never learned as bias.
 * - "resting" (lying on a surface): the fast vibration content of gyro AND
 *   accelerometer is at sensor-noise level, which a hand never achieves
 *   because of tremor. Trusted almost fully, which also recovers from a bad
 *   estimate (e.g. after the sensor warms up on the hand).
 * Vibration is measured on unaveraged data above VIB_HP_HZ.
 */
#define BIAS_MAX_JUMP_DPS 0.5f
#define BIAS_LEARN_RATE 0.1f
#define VIB_HP_HZ 2.0f
#define REST_GYRO_VIB_DPS 0.6f   /* RMS; sensor noise ~0.15, hand tremor ~1-3 */
#define REST_ACCEL_VIB_G 0.006f  /* RMS; sensor noise ~0.002, hand ~0.01+ */
#define REST_LEARN_RATE 0.8f

/* Gravity tracking: accelerometer correction time constant and the band of
 * accelerometer magnitudes (in g) trusted as "mostly gravity".
 */
#define GRAVITY_TAU_S 0.5f
#define GRAVITY_TRUST_G 0.2f

/* In tilt-compensated mode, when the pointing direction is within ~17 degrees
 * of vertical the horizontal reference is unreliable; fall back to fixed axes.
 */
#define TILT_MIN_HORIZ 0.3f

static float dot3(const float a[3], const float b[3])
{
	return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

static void cross3(const float a[3], const float b[3], float out[3])
{
	float r[3];

	r[0] = a[1] * b[2] - a[2] * b[1];
	r[1] = a[2] * b[0] - a[0] * b[2];
	r[2] = a[0] * b[1] - a[1] * b[0];
	memcpy(out, r, sizeof(r));
}

static float norm3(const float a[3])
{
	return sqrtf(dot3(a, a));
}

/* Normalizes in place; returns false (and leaves v untouched) if too short. */
static bool normalize3(float v[3])
{
	float n = norm3(v);

	if (!(n > 1e-6f) || !isfinite(n)) {
		return false;
	}
	v[0] /= n;
	v[1] /= n;
	v[2] /= n;
	return true;
}

/* Exponential smoothing factor for a first-order low-pass at cutoff_hz. */
static float lp_alpha(float cutoff_hz, float dt)
{
	float r = 2.0f * PE_PI * cutoff_hz * dt;

	return r / (r + 1.0f);
}

static float clampf(float v, float lo, float hi)
{
	if (!isfinite(v)) {
		return lo;
	}
	return v < lo ? lo : (v > hi ? hi : v);
}

void pe_config_defaults(struct pe_config *cfg)
{
	memset(cfg, 0, sizeof(*cfg));
	cfg->version = PE_CONFIG_VERSION;

	cfg->gyro_dps_per_lsb = 0.035f;     /* LSM6DS3TR-C at +-1000 dps */
	cfg->accel_g_per_lsb = 0.000122f;   /* LSM6DS3TR-C at +-4 g */
	cfg->odr_hz = 1666.0f;

	cfg->gain = 25.0f;
	cfg->accel = 2.0f;
	cfg->accel_knee_dps = 80.0f;

	/* Tuned lag-first: ~1 ms of smoothing lag at 200 deg/s, ~3 ms at 50. */
	cfg->min_cutoff_hz = 1.0f;
	cfg->beta = 1.0f;
	cfg->speed_cutoff_hz = 30.0f;

	cfg->deadzone_dps = 0.15f;
	cfg->predict_ms = 0.0f;

	/* Guess: board flat, component side up, sensor X pointing forward.
	 * Calibration in the test app replaces these.
	 */
	cfg->axis_right[2] = -1.0f;         /* turn right = rotate about -Z */
	cfg->axis_up[1] = -1.0f;            /* tip up = rotate about -Y (right vector) */
	cfg->forward[0] = 1.0f;
	cfg->tilt_comp = 1;

	cfg->auto_bias = 1;
	cfg->still_thresh_dps = 1.5f;
}

static bool sanitize_axis(float v[3], const float fallback[3])
{
	for (int i = 0; i < 3; i++) {
		if (!isfinite(v[i])) {
			memcpy(v, fallback, 3 * sizeof(float));
			return false;
		}
	}
	if (!normalize3(v)) {
		memcpy(v, fallback, 3 * sizeof(float));
		return false;
	}
	return true;
}

bool pe_config_sanitize(struct pe_config *cfg)
{
	struct pe_config def;

	pe_config_defaults(&def);
	if (cfg->version != PE_CONFIG_VERSION) {
		*cfg = def;
		return false;
	}

	if (!(cfg->gyro_dps_per_lsb > 0.0f) || !isfinite(cfg->gyro_dps_per_lsb)) {
		cfg->gyro_dps_per_lsb = def.gyro_dps_per_lsb;
	}
	if (!(cfg->accel_g_per_lsb > 0.0f) || !isfinite(cfg->accel_g_per_lsb)) {
		cfg->accel_g_per_lsb = def.accel_g_per_lsb;
	}
	if (!(cfg->odr_hz > 1.0f) || !isfinite(cfg->odr_hz)) {
		cfg->odr_hz = def.odr_hz;
	}

	cfg->gain = clampf(cfg->gain, 0.1f, 500.0f);
	cfg->accel = clampf(cfg->accel, 0.0f, 20.0f);
	cfg->accel_knee_dps = clampf(cfg->accel_knee_dps, 1.0f, 2000.0f);
	cfg->min_cutoff_hz = clampf(cfg->min_cutoff_hz, 0.01f, 1000.0f);
	cfg->beta = clampf(cfg->beta, 0.0f, 50.0f);
	cfg->speed_cutoff_hz = clampf(cfg->speed_cutoff_hz, 0.1f, 1000.0f);
	cfg->deadzone_dps = clampf(cfg->deadzone_dps, 0.0f, 20.0f);
	cfg->predict_ms = clampf(cfg->predict_ms, 0.0f, 50.0f);
	cfg->still_thresh_dps = clampf(cfg->still_thresh_dps, 0.05f, 50.0f);
	cfg->tilt_comp = cfg->tilt_comp ? 1 : 0;
	cfg->auto_bias = cfg->auto_bias ? 1 : 0;

	sanitize_axis(cfg->axis_right, def.axis_right);
	sanitize_axis(cfg->axis_up, def.axis_up);
	sanitize_axis(cfg->forward, def.forward);
	return true;
}

static void reset_window(struct pe_state *st)
{
	for (int i = 0; i < 3; i++) {
		st->win_min[i] = INFINITY;
		st->win_max[i] = -INFINITY;
		st->win_sum[i] = 0.0f;
	}
	st->win_vib_g = 0.0f;
	st->win_vib_a = 0.0f;
	st->win_time = 0.0f;
	st->win_blocks = 0;
}

void pe_reset_motion(struct pe_state *st)
{
	st->filt_init = false;
	st->raw_pos[0] = st->raw_pos[1] = 0.0f;
	st->filt_pos[0] = st->filt_pos[1] = 0.0f;
	st->last_out_pos[0] = st->last_out_pos[1] = 0.0f;
	st->vel_hat[0] = st->vel_hat[1] = 0.0f;
	st->speed_hat = 0.0f;
	st->px_rem[0] = st->px_rem[1] = 0.0f;
}

void pe_reset_bias(struct pe_state *st)
{
	st->bias[0] = st->bias[1] = st->bias[2] = 0.0f;
	st->bias_valid = false;
	st->blk_sum[0] = st->blk_sum[1] = st->blk_sum[2] = 0.0f;
	st->blk_time = 0.0f;
	st->vib_init = false;
	st->still = false;
	reset_window(st);
}

void pe_init(struct pe_state *st, const struct pe_config *cfg)
{
	memset(st, 0, sizeof(*st));
	st->cfg = *cfg;
	pe_config_sanitize(&st->cfg);
	st->up_valid = false;
	pe_reset_bias(st);
	pe_reset_motion(st);
}

void pe_set_config(struct pe_state *st, const struct pe_config *cfg)
{
	st->cfg = *cfg;
	pe_config_sanitize(&st->cfg);
	/* Axis changes make the filter history meaningless. */
	pe_reset_motion(st);
}

bool pe_get_bias(const struct pe_state *st, float bias_dps[3])
{
	memcpy(bias_dps, st->bias, sizeof(st->bias));
	return st->bias_valid;
}

void pe_set_bias(struct pe_state *st, const float bias_dps[3])
{
	pe_reset_bias(st);
	memcpy(st->bias, bias_dps, sizeof(st->bias));
	st->bias_valid = true;
}

void pe_get_up(const struct pe_state *st, float up[3])
{
	memcpy(up, st->up, sizeof(st->up));
}

/* Feed raw (not bias-corrected) rate and accel (g) for stillness detection
 * and bias learning.
 */
static void track_bias(struct pe_state *st, const float raw_rate[3], const float acc_g[3],
		       float dt)
{
	/* Vibration energy: high-passed, unaveraged gyro and accel. */
	if (!st->vib_init) {
		memcpy(st->vib_lp_g, raw_rate, sizeof(st->vib_lp_g));
		memcpy(st->vib_lp_a, acc_g, sizeof(st->vib_lp_a));
		st->vib_init = true;
	}
	float a = lp_alpha(VIB_HP_HZ, dt);

	for (int i = 0; i < 3; i++) {
		st->vib_lp_g[i] += a * (raw_rate[i] - st->vib_lp_g[i]);
		st->vib_lp_a[i] += a * (acc_g[i] - st->vib_lp_a[i]);
		float hg = raw_rate[i] - st->vib_lp_g[i];
		float ha = acc_g[i] - st->vib_lp_a[i];

		st->win_vib_g += hg * hg * dt;
		st->win_vib_a += ha * ha * dt;
		st->blk_sum[i] += raw_rate[i] * dt;
	}
	st->blk_time += dt;
	if (st->blk_time < BLOCK_S) {
		return;
	}

	for (int i = 0; i < 3; i++) {
		float m = st->blk_sum[i] / st->blk_time;

		if (m < st->win_min[i]) {
			st->win_min[i] = m;
		}
		if (m > st->win_max[i]) {
			st->win_max[i] = m;
		}
		st->win_sum[i] += st->blk_sum[i];
		st->blk_sum[i] = 0.0f;
	}
	st->win_time += st->blk_time;
	st->win_blocks++;
	st->blk_time = 0.0f;

	if (st->win_time < WINDOW_S) {
		return;
	}

	bool still = true;
	float mean[3];

	for (int i = 0; i < 3; i++) {
		mean[i] = st->win_sum[i] / st->win_time;
		if (st->win_max[i] - st->win_min[i] > st->cfg.still_thresh_dps) {
			still = false;
		}
	}
	/* RMS over the window, summed across the three axes */
	st->vib_gyro_dps = sqrtf(st->win_vib_g / st->win_time);
	st->vib_accel_g = sqrtf(st->win_vib_a / st->win_time);
	bool resting = st->vib_gyro_dps < REST_GYRO_VIB_DPS && st->vib_accel_g < REST_ACCEL_VIB_G;

	if (still && st->cfg.auto_bias) {
		if (!st->bias_valid) {
			memcpy(st->bias, mean, sizeof(mean));
			st->bias_valid = true;
		} else if (resting) {
			for (int i = 0; i < 3; i++) {
				st->bias[i] += REST_LEARN_RATE * (mean[i] - st->bias[i]);
			}
		} else {
			bool plausible = true;

			for (int i = 0; i < 3; i++) {
				if (fabsf(mean[i] - st->bias[i]) > BIAS_MAX_JUMP_DPS) {
					plausible = false;
				}
			}
			if (plausible) {
				for (int i = 0; i < 3; i++) {
					st->bias[i] += BIAS_LEARN_RATE * (mean[i] - st->bias[i]);
				}
			}
		}
	}
	st->still = still;
	reset_window(st);
}

static void track_gravity(struct pe_state *st, const float rate_dps[3],
			  const int16_t accel[3], float dt)
{
	float a[3] = {
		accel[0] * st->cfg.accel_g_per_lsb,
		accel[1] * st->cfg.accel_g_per_lsb,
		accel[2] * st->cfg.accel_g_per_lsb,
	};
	float amag = norm3(a);
	bool trust = amag > 1.0f - GRAVITY_TRUST_G && amag < 1.0f + GRAVITY_TRUST_G;

	if (!st->up_valid) {
		if (amag > 0.5f) {
			memcpy(st->up, a, sizeof(a));
			normalize3(st->up);
			st->up_valid = true;
		}
		return;
	}

	/* A world-fixed vector seen from the rotating sensor: du/dt = -w x u */
	float w[3] = {rate_dps[0] * DEG2RAD, rate_dps[1] * DEG2RAD, rate_dps[2] * DEG2RAD};
	float wxu[3];

	cross3(w, st->up, wxu);
	for (int i = 0; i < 3; i++) {
		st->up[i] -= wxu[i] * dt;
	}

	if (trust) {
		float k = dt / GRAVITY_TAU_S;

		if (k > 1.0f) {
			k = 1.0f;
		}
		for (int i = 0; i < 3; i++) {
			st->up[i] += k * (a[i] / amag - st->up[i]);
		}
	}

	if (!normalize3(st->up)) {
		st->up_valid = false;
	}
}

void pe_update(struct pe_state *st, const int32_t dgyro[3], uint32_t dcount,
	       const int16_t accel[3], struct pe_output *out)
{
	const struct pe_config *c = &st->cfg;

	memset(out, 0, sizeof(*out));
	out->still = st->still;
	if (dcount == 0) {
		return;
	}

	float dt = (float)dcount / c->odr_hz;
	float raw_rate[3];
	float rate[3];

	float acc_g[3];

	for (int i = 0; i < 3; i++) {
		raw_rate[i] = (float)dgyro[i] / (float)dcount * c->gyro_dps_per_lsb;
		acc_g[i] = (float)accel[i] * c->accel_g_per_lsb;
	}

	track_bias(st, raw_rate, acc_g, dt);

	for (int i = 0; i < 3; i++) {
		rate[i] = raw_rate[i] - st->bias[i];
		out->rate_dps[i] = rate[i];
		out->dangle_deg[i] = rate[i] * dt;
	}

	track_gravity(st, rate, accel, dt);

	/* Cursor axes in the sensor frame for this update. */
	const float *ax_r = c->axis_right;
	const float *ax_u = c->axis_up;
	float tr[3], tu[3];

	if (c->tilt_comp && st->up_valid) {
		cross3(c->forward, st->up, tu);
		if (norm3(tu) > TILT_MIN_HORIZ && normalize3(tu)) {
			tr[0] = -st->up[0];
			tr[1] = -st->up[1];
			tr[2] = -st->up[2];
			ax_r = tr;
			ax_u = tu;
		}
	}

	float w[2] = {dot3(rate, ax_r), dot3(rate, ax_u)};
	float wmag = sqrtf(w[0] * w[0] + w[1] * w[1]);

	/* Soft radial deadzone: removes residual bias creep, keeps small motions. */
	if (c->deadzone_dps > 0.0f) {
		if (wmag <= c->deadzone_dps) {
			w[0] = w[1] = 0.0f;
		} else {
			float s = (wmag - c->deadzone_dps) / wmag;

			w[0] *= s;
			w[1] *= s;
		}
	}
	float speed = sqrtf(w[0] * w[0] + w[1] * w[1]);

	st->raw_pos[0] += w[0] * dt;
	st->raw_pos[1] += w[1] * dt;

	if (!st->filt_init) {
		st->filt_pos[0] = st->raw_pos[0];
		st->filt_pos[1] = st->raw_pos[1];
		st->last_out_pos[0] = st->raw_pos[0];
		st->last_out_pos[1] = st->raw_pos[1];
		st->speed_hat = speed;
		st->vel_hat[0] = w[0];
		st->vel_hat[1] = w[1];
		st->filt_init = true;
	}

	/* The gyro measures speed directly, so the 1-euro cutoff reacts at motion
	 * onset instead of waiting for a differentiated position to rise.
	 */
	float as = lp_alpha(c->speed_cutoff_hz, dt);

	st->speed_hat += as * (speed - st->speed_hat);
	st->vel_hat[0] += as * (w[0] - st->vel_hat[0]);
	st->vel_hat[1] += as * (w[1] - st->vel_hat[1]);

	float cutoff = c->min_cutoff_hz + c->beta * st->speed_hat;
	float ap = lp_alpha(cutoff, dt);

	st->filt_pos[0] += ap * (st->raw_pos[0] - st->filt_pos[0]);
	st->filt_pos[1] += ap * (st->raw_pos[1] - st->filt_pos[1]);

	float pos[2] = {st->filt_pos[0], st->filt_pos[1]};

	if (c->predict_ms > 0.0f) {
		float tp = c->predict_ms * 0.001f;

		pos[0] += st->vel_hat[0] * tp;
		pos[1] += st->vel_hat[1] * tp;
	}

	float dpos[2] = {pos[0] - st->last_out_pos[0], pos[1] - st->last_out_pos[1]};
	float g = c->gain * (1.0f + c->accel * st->speed_hat /
					 (st->speed_hat + c->accel_knee_dps));

	st->px_rem[0] += dpos[0] * g;         /* +right */
	st->px_rem[1] -= dpos[1] * g;         /* screen y grows downward */

	for (int i = 0; i < 2; i++) {
		float r = st->px_rem[i];

		if (r > 32767.0f) {
			r = 32767.0f;
		} else if (r < -32767.0f) {
			r = -32767.0f;
		}
		int32_t whole = (int32_t)r;   /* truncates toward zero */

		st->px_rem[i] = r - (float)whole;
		if (i == 0) {
			out->dx = whole;
		} else {
			out->dy = whole;
		}
	}

	/* Re-base so positions stay small and float precision never degrades. */
	for (int i = 0; i < 2; i++) {
		st->raw_pos[i] -= pos[i];
		st->filt_pos[i] -= pos[i];
		st->last_out_pos[i] = 0.0f;
	}

	out->speed_dps = st->speed_hat;
	out->still = st->still;
}
