/*
 * Pointer engine: turns gyro/accelerometer data into cursor movement.
 *
 * Portable C (no Zephyr dependencies) so it runs on the receiver dongle, on the
 * ring in wired mode, and in host unit tests.
 *
 * Input is delivered per "update" as the change in cumulative raw gyro sums
 * plus the number of IMU samples those sums cover. This is exactly what the
 * radio link carries, so a lost radio packet never loses motion.
 *
 * Pipeline per update:
 *   raw sums -> rate (deg/s) -> bias removal -> gravity tracking
 *   -> project onto cursor axes (tilt compensated or fixed axes)
 *   -> soft deadzone -> 1-euro smoothing (angle domain)
 *   -> optional prediction -> speed-dependent gain -> sub-pixel accumulation
 */
#ifndef POINTER_ENGINE_H_
#define POINTER_ENGINE_H_

#include <stdbool.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/* Bump when struct pe_config changes layout; stored configs with another
 * version are ignored and defaults are used instead.
 */
#define PE_CONFIG_VERSION 1

struct pe_config {
	uint32_t version;

	/* Sensor scaling, set by firmware from the IMU setup (not user tuning). */
	float gyro_dps_per_lsb;   /* e.g. 0.035 for +-1000 dps */
	float accel_g_per_lsb;    /* e.g. 0.000122 for +-4 g */
	float odr_hz;             /* IMU output data rate */

	/* Gain: pixels per degree of hand rotation. */
	float gain;               /* at slow speed */
	float accel;              /* extra gain multiplier reached at high speed (0 = linear) */
	float accel_knee_dps;     /* speed where half of the extra gain is applied */

	/* 1-euro filter (angle domain, cutoff driven by gyro speed). */
	float min_cutoff_hz;      /* smoothing when still; larger = less smoothing */
	float beta;               /* cutoff increase per deg/s of speed */
	float speed_cutoff_hz;    /* low-pass on the speed estimate itself */

	float deadzone_dps;       /* soft deadzone subtracted from each cursor-axis rate */
	float predict_ms;         /* extrapolate ahead by this much (0 = off) */

	/* Axes, in the sensor frame (unit vectors). Set by calibration. */
	float axis_right[3];      /* +rotation about this moves cursor right (fixed-axis mode) */
	float axis_up[3];         /* +rotation about this moves cursor up (fixed-axis mode) */
	float forward[3];         /* pointing direction (tilt-compensated mode) */
	uint8_t tilt_comp;        /* 1 = keep horizontal hand motion horizontal when rolled */

	/* Automatic gyro bias (zero-rate offset) tracking. */
	uint8_t auto_bias;
	float still_thresh_dps;   /* max wobble allowed for "still" */
	uint8_t reserved[2];
};

struct pe_output {
	int32_t dx;               /* whole pixels to move now (+right) */
	int32_t dy;               /* whole pixels to move now (+down, screen convention) */
	float rate_dps[3];        /* bias-corrected gyro rate, sensor frame */
	float dangle_deg[3];      /* bias-corrected rotation this update, sensor frame */
	float speed_dps;          /* smoothed cursor-plane speed */
	bool still;               /* device currently judged still */
};

/* Internal state; treat as opaque. */
struct pe_state {
	struct pe_config cfg;

	/* gravity (unit "up" vector, sensor frame) */
	float up[3];
	bool up_valid;

	/* bias estimate (deg/s) and stillness detection */
	float bias[3];
	bool bias_valid;
	float blk_sum[3];         /* current 100 ms block accumulators */
	float blk_time;
	float win_min[3], win_max[3], win_sum[3];
	bool vib_init;            /* vibration (tremor) measurement */
	float vib_lp_g[3], vib_lp_a[3];
	float win_vib_g, win_vib_a;
	float vib_gyro_dps, vib_accel_g;  /* last window's RMS vibration */
	float win_time;
	int win_blocks;

	/* 1-euro filter state (degrees, cursor plane) */
	bool filt_init;
	float raw_pos[2];         /* unfiltered integrated cursor-plane angle */
	float filt_pos[2];
	float speed_hat;
	float vel_hat[2];         /* smoothed cursor-plane velocity (deg/s), for prediction */

	float last_out_pos[2];    /* position (deg) already converted to pixels */
	float px_rem[2];          /* sub-pixel remainder */

	bool still;
};

/* Fill a config with defaults suited to the LSM6DS3TR-C setup used here. */
void pe_config_defaults(struct pe_config *cfg);

/* Clamp / sanitize a config (e.g. one loaded from flash or set by the user).
 * Returns true if the config was usable (possibly after clamping),
 * false if it had to be replaced with defaults.
 */
bool pe_config_sanitize(struct pe_config *cfg);

void pe_init(struct pe_state *st, const struct pe_config *cfg);

/* Replace the config without losing bias / gravity estimates. */
void pe_set_config(struct pe_state *st, const struct pe_config *cfg);

/* Forget filter history (e.g. after a long radio gap). Keeps bias and gravity. */
void pe_reset_motion(struct pe_state *st);

/* Force the bias estimate to be re-learned from scratch. */
void pe_reset_bias(struct pe_state *st);

/*
 * Process one update.
 *  dgyro:  change in cumulative raw gyro sums (LSB * samples), sensor axes
 *  dcount: number of IMU samples covered (0 = no new data)
 *  accel:  latest raw accelerometer reading (LSB)
 */
void pe_update(struct pe_state *st, const int32_t dgyro[3], uint32_t dcount,
	       const int16_t accel[3], struct pe_output *out);

/* Current bias estimate in deg/s. Returns whether it has been learned yet. */
bool pe_get_bias(const struct pe_state *st, float bias_dps[3]);

/* Restore a previously learned bias (e.g. when switching back to a ring). */
void pe_set_bias(struct pe_state *st, const float bias_dps[3]);

/* Current gravity "up" estimate (unit vector, sensor frame). */
void pe_get_up(const struct pe_state *st, float up[3]);

#ifdef __cplusplus
}
#endif

#endif /* POINTER_ENGINE_H_ */
