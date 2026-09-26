/*
 * Host unit tests for the pointer engine and the radio packet logic.
 * Build & run:  make -C controller/firmware/tests
 *
 * The IMU is simulated at 1666 Hz with bias and noise, including the true
 * rotation of the gravity vector, so tilt compensation is tested against real
 * kinematics rather than against the engine's own assumptions.
 */
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "link_packet.h"
#include "pointer_engine.h"

static int failures;
static int checks;

#define CHECK(cond, ...)                                                        \
	do {                                                                    \
		checks++;                                                       \
		if (!(cond)) {                                                  \
			failures++;                                             \
			printf("  FAIL %s:%d: ", __FILE__, __LINE__);           \
			printf(__VA_ARGS__);                                    \
			printf("\n");                                           \
		}                                                               \
	} while (0)

/* ---- deterministic noise ---- */
static uint32_t rng_state = 12345;

static float frand(void)
{
	rng_state = rng_state * 1664525u + 1013904223u;
	return (float)(rng_state >> 8) / 16777216.0f;
}

static float gauss(void)
{
	float u1 = frand() + 1e-7f, u2 = frand();

	return sqrtf(-2.0f * logf(u1)) * cosf(6.2831853f * u2);
}

/* ---- simulated IMU ---- */
struct sim {
	struct pe_state pe;
	float bias_dps[3];
	float noise_dps;
	float up[3];            /* true gravity "up" in the sensor frame */
	int samples_per_update; /* 1 = every sample delivered */
	float drop_prob;        /* chance an update is lost (merged into next) */
	float tremor_dps;       /* physiological hand tremor amplitude (8-12 Hz) */
	float t;                /* simulated time */
	/* cursor position statistics (for jitter) */
	double pos_sum[2], pos_sq[2];
	long pos_n;
	int32_t pend_g[3];
	uint32_t pend_n;
	long total_dx, total_dy;
};

static void sim_init(struct sim *s, const struct pe_config *cfg)
{
	memset(s, 0, sizeof(*s));
	pe_init(&s->pe, cfg);
	s->up[2] = 1.0f;
	s->samples_per_update = 1;
}

static void cross(const float a[3], const float b[3], float o[3])
{
	o[0] = a[1] * b[2] - a[2] * b[1];
	o[1] = a[2] * b[0] - a[0] * b[2];
	o[2] = a[0] * b[1] - a[1] * b[0];
}

/* Run for `seconds` with a constant true angular rate (sensor frame, deg/s). */
static void sim_run(struct sim *s, const float rate_dps[3], float seconds)
{
	const struct pe_config *c = &s->pe.cfg;
	int n = (int)(seconds * c->odr_hz + 0.5f);
	float dt = 1.0f / c->odr_hz;

	for (int k = 0; k < n; k++) {
		/* true gravity rotates opposite to the sensor: du/dt = -w x u */
		float w[3] = {rate_dps[0] * 0.01745329f, rate_dps[1] * 0.01745329f,
			      rate_dps[2] * 0.01745329f};
		float wxu[3];

		cross(w, s->up, wxu);
		for (int i = 0; i < 3; i++) {
			s->up[i] -= wxu[i] * dt;
		}
		float nrm = sqrtf(s->up[0] * s->up[0] + s->up[1] * s->up[1] +
				  s->up[2] * s->up[2]);
		for (int i = 0; i < 3; i++) {
			s->up[i] /= nrm;
		}

		/* tremor: two sinusoids on a skewed axis, like a real hand */
		static const float tax[3] = {0.55f, 0.48f, 0.68f};
		float trem = s->tremor_dps * (0.7f * sinf(6.2831853f * 9.0f * s->t) +
					     0.3f * sinf(6.2831853f * 11.3f * s->t + 1.0f));

		s->t += dt;
		for (int i = 0; i < 3; i++) {
			float meas = rate_dps[i] + trem * tax[i] + s->bias_dps[i] +
				     s->noise_dps * gauss();

			s->pend_g[i] += (int32_t)lroundf(meas / c->gyro_dps_per_lsb);
		}
		s->pend_n++;

		if ((int)s->pend_n >= s->samples_per_update) {
			if (s->drop_prob > 0.0f && frand() < s->drop_prob) {
				continue; /* lost: data stays pending, next update carries it */
			}
			int16_t acc[3];
			struct pe_output out;

			/* a trembling hand also shakes linearly (~0.02 g at 9 Hz) */
			float lin = s->tremor_dps * 0.007f * sinf(6.2831853f * 9.0f * s->t + 0.5f);

			for (int i = 0; i < 3; i++) {
				acc[i] = (int16_t)lroundf((s->up[i] + lin * tax[i]) /
							 c->accel_g_per_lsb);
			}
			pe_update(&s->pe, s->pend_g, s->pend_n, acc, &out);
			s->total_dx += out.dx;
			s->total_dy += out.dy;
			s->pos_sum[0] += (double)s->total_dx;
			s->pos_sum[1] += (double)s->total_dy;
			s->pos_sq[0] += (double)s->total_dx * (double)s->total_dx;
			s->pos_sq[1] += (double)s->total_dy * (double)s->total_dy;
			s->pos_n++;
			s->pend_g[0] = s->pend_g[1] = s->pend_g[2] = 0;
			s->pend_n = 0;
		}
	}
}

static const float ZERO[3] = {0, 0, 0};

static void jitter_reset(struct sim *s)
{
	s->pos_sum[0] = s->pos_sum[1] = 0.0;
	s->pos_sq[0] = s->pos_sq[1] = 0.0;
	s->pos_n = 0;
}

/* RMS distance of the cursor from its mean position (pixels). */
static double jitter_rms(const struct sim *s)
{
	double v = 0.0;

	for (int i = 0; i < 2; i++) {
		double m = s->pos_sum[i] / (double)s->pos_n;

		v += s->pos_sq[i] / (double)s->pos_n - m * m;
	}
	return sqrt(v > 0.0 ? v : 0.0);
}

static void rotate_up_about(float up[3], const float axis[3], float deg)
{
	/* Rodrigues rotation of up about unit axis by deg */
	float a = deg * 0.01745329f, c = cosf(a), s = sinf(a);
	float kxv[3], kdv = axis[0] * up[0] + axis[1] * up[1] + axis[2] * up[2];

	cross(axis, up, kxv);
	for (int i = 0; i < 3; i++) {
		up[i] = up[i] * c + kxv[i] * s + axis[i] * kdv * (1 - c);
	}
}

/* ------------------------------------------------------------------ */

static void test_bias_learning_and_no_drift(void)
{
	struct pe_config cfg;
	struct sim s;

	printf("bias learning / drift at rest\n");
	pe_config_defaults(&cfg);
	sim_init(&s, &cfg);
	s.bias_dps[0] = 1.2f;
	s.bias_dps[1] = -0.8f;
	s.bias_dps[2] = 2.5f;
	s.noise_dps = 0.2f;

	sim_run(&s, ZERO, 3.0f);
	float b[3];

	pe_get_bias(&s.pe, b);
	for (int i = 0; i < 3; i++) {
		CHECK(fabsf(b[i] - s.bias_dps[i]) < 0.05f, "bias[%d]=%.3f want %.3f", i, b[i],
		      s.bias_dps[i]);
	}
	s.total_dx = s.total_dy = 0;
	sim_run(&s, ZERO, 10.0f);
	CHECK(labs(s.total_dx) <= 1 && labs(s.total_dy) <= 1,
	      "drift over 10 s: dx=%ld dy=%ld", s.total_dx, s.total_dy);
}

static void learn(struct sim *s)
{
	sim_run(s, ZERO, 2.5f);
	s->total_dx = s->total_dy = 0;
}

static void test_directions(void)
{
	struct pe_config cfg;
	struct sim s;

	printf("cursor directions (default axes)\n");
	pe_config_defaults(&cfg);

	/* turn right = rotate about axis_right (-Z) */
	sim_init(&s, &cfg);
	s.noise_dps = 0.2f;
	learn(&s);
	float r[3] = {0, 0, -30.0f};

	sim_run(&s, r, 1.0f);
	sim_run(&s, ZERO, 1.0f);
	CHECK(s.total_dx > 700 && s.total_dx < 2300, "right: dx=%ld", s.total_dx);
	CHECK(labs(s.total_dy) < s.total_dx / 50, "right: dy=%ld (should be ~0)", s.total_dy);

	/* tip up = rotate about axis_up (-Y) -> screen dy negative */
	sim_init(&s, &cfg);
	s.noise_dps = 0.2f;
	learn(&s);
	float u[3] = {0, -30.0f, 0};

	sim_run(&s, u, 1.0f);
	sim_run(&s, ZERO, 1.0f);
	CHECK(s.total_dy < -700 && s.total_dy > -2300, "up: dy=%ld", s.total_dy);
	CHECK(labs(s.total_dx) < -s.total_dy / 50, "up: dx=%ld (should be ~0)", s.total_dx);

	/* left and down are the mirror images */
	sim_init(&s, &cfg);
	learn(&s);
	float l[3] = {0, 0, 30.0f};

	sim_run(&s, l, 1.0f);
	sim_run(&s, ZERO, 1.0f);
	CHECK(s.total_dx < -700, "left: dx=%ld", s.total_dx);
}

static void test_tilt_compensation(void)
{
	printf("tilt compensation (hand rolled)\n");
	const float fwd[3] = {1, 0, 0};
	const float rolls[] = {-90.0f, -45.0f, 30.0f, 60.0f, 90.0f};

	for (unsigned k = 0; k < sizeof(rolls) / sizeof(rolls[0]); k++) {
		for (int tilt = 1; tilt >= 0; tilt--) {
			struct pe_config cfg;
			struct sim s;

			pe_config_defaults(&cfg);
			cfg.tilt_comp = (uint8_t)tilt;
			sim_init(&s, &cfg);
			s.noise_dps = 0.2f;
			/* roll the device about its forward axis */
			rotate_up_about(s.up, fwd, rolls[k]);
			learn(&s);

			/* world "turn right" = rotation about -up, whatever the roll */
			float w[3] = {-s.up[0] * 30.0f, -s.up[1] * 30.0f, -s.up[2] * 30.0f};

			sim_run(&s, w, 1.0f);
			sim_run(&s, ZERO, 0.5f);

			if (tilt) {
				CHECK(s.total_dx > 700 && labs(s.total_dy) < s.total_dx / 20,
				      "roll %.0f tilt on: dx=%ld dy=%ld", rolls[k], s.total_dx,
				      s.total_dy);
			} else if (fabsf(rolls[k]) >= 45.0f) {
				/* without compensation a rolled hand moves the cursor
				 * diagonally; confirm the test would catch a broken
				 * compensation
				 */
				CHECK(labs(s.total_dy) > labs(s.total_dx) / 2,
				      "roll %.0f tilt off: expected diagonal, dx=%ld dy=%ld",
				      rolls[k], s.total_dx, s.total_dy);
			}
		}
	}

	/* pitch while rolled 90: "tip up" in the world should move cursor up */
	struct pe_config cfg;
	struct sim s;

	pe_config_defaults(&cfg);
	sim_init(&s, &cfg);
	rotate_up_about(s.up, fwd, 90.0f);
	learn(&s);
	/* world right vector r = f x up; tipping up = rotation about +r */
	float r[3];

	cross(fwd, s.up, r);
	float w[3] = {r[0] * 20.0f, r[1] * 20.0f, r[2] * 20.0f};

	sim_run(&s, w, 1.0f);
	sim_run(&s, ZERO, 0.5f);
	CHECK(s.total_dy < -400 && labs(s.total_dx) < -s.total_dy / 20,
	      "rolled 90 + tip up: dx=%ld dy=%ld", s.total_dx, s.total_dy);
}

static long run_pattern(int spu, float drop)
{
	struct pe_config cfg;
	struct sim s;

	pe_config_defaults(&cfg);
	rng_state = 999;
	sim_init(&s, &cfg);
	s.noise_dps = 0.2f;
	learn(&s);
	s.samples_per_update = spu;
	s.drop_prob = drop;
	float a[3] = {0, 0, -60.0f}, b[3] = {0, 0, 25.0f}, c[3] = {0, 0, -120.0f};

	sim_run(&s, a, 0.4f);
	sim_run(&s, b, 0.7f);
	sim_run(&s, c, 0.3f);
	s.drop_prob = 0.0f;
	sim_run(&s, ZERO, 1.0f);
	return s.total_dx;
}

static void test_packet_rate_and_loss_invariance(void)
{
	printf("same motion, different packet rates and 30%% loss\n");
	long ref = run_pattern(1, 0.0f);
	long r4 = run_pattern(4, 0.0f);
	long lossy = run_pattern(1, 0.3f);
	long lossy3 = run_pattern(3, 0.3f);

	CHECK(labs(r4 - ref) <= labs(ref) / 50 + 2, "4 samples/packet: %ld vs %ld", r4, ref);
	CHECK(labs(lossy - ref) <= labs(ref) / 50 + 2, "30%% loss: %ld vs %ld", lossy, ref);
	CHECK(labs(lossy3 - ref) <= labs(ref) / 50 + 2, "3 spp + loss: %ld vs %ld", lossy3, ref);
}

static void test_slow_motion_subpixel(void)
{
	struct pe_config cfg;
	struct sim s;

	printf("very slow motion is not lost to rounding\n");
	pe_config_defaults(&cfg);
	cfg.deadzone_dps = 0.0f;
	cfg.auto_bias = 0; /* this test is only about rounding */
	sim_init(&s, &cfg);
	learn(&s);
	float r[3] = {0, 0, -1.0f}; /* 1 deg/s */

	sim_run(&s, r, 10.0f);
	sim_run(&s, ZERO, 1.0f);
	/* 10 degrees at ~25.6 px/deg */
	CHECK(s.total_dx > 240 && s.total_dx < 270, "1 dps for 10 s: dx=%ld (want ~256)",
	      s.total_dx);
}

static void test_long_run_precision(void)
{
	struct pe_config cfg;
	struct sim s;

	printf("long continuous rotation keeps precision\n");
	pe_config_defaults(&cfg);
	cfg.accel = 0.0f; /* linear gain: expected value is exact */
	cfg.auto_bias = 0;
	cfg.deadzone_dps = 0.0f;
	sim_init(&s, &cfg);
	float r[3] = {0, 0, -50.0f};

	sim_run(&s, r, 1.0f);
	long first = s.total_dx;

	for (int i = 0; i < 598; i++) {
		sim_run(&s, r, 1.0f);
	}
	long before = s.total_dx;

	sim_run(&s, r, 1.0f);
	long last = s.total_dx - before;

	CHECK(labs(last - 1250) <= 3, "after 10 min, 1 s of 50 dps = %ld px (want 1250)", last);
	CHECK(labs(first - 1250) <= 30, "first second = %ld px (filter start-up)", first);
}

static void test_slow_steady_rotation_not_absorbed(void)
{
	struct pe_config cfg;
	struct sim s;

	printf("slow steady hand rotation is not mistaken for bias\n");
	const float speeds[] = {1.0f, 3.0f};

	for (int k = 0; k < 2; k++) {
		pe_config_defaults(&cfg);
		sim_init(&s, &cfg);
		s.noise_dps = 0.2f;
		learn(&s);              /* learn on a table (no tremor) */
		s.tremor_dps = 3.0f;    /* then it's in a hand */
		float r[3] = {0, 0, -speeds[k]};

		sim_run(&s, r, 5.0f);
		long early = s.total_dx;

		sim_run(&s, r, 10.0f);
		long mid = s.total_dx;

		sim_run(&s, r, 5.0f);
		long late = s.total_dx - mid;

		CHECK(early > 0 && late > early * 8 / 10,
		      "%.0f dps: first 5 s %ld px, last 5 s %ld px", speeds[k], early, late);
	}
}

static void test_bias_recovers_when_resting(void)
{
	struct pe_config cfg;
	struct sim s;

	printf("wrong bias is corrected when resting on a table\n");
	pe_config_defaults(&cfg);
	sim_init(&s, &cfg);
	s.noise_dps = 0.2f;
	s.bias_dps[2] = 3.0f;
	learn(&s);
	s.bias_dps[2] = 6.0f; /* bias jumps (e.g. temperature), bigger than normal limit */
	sim_run(&s, ZERO, 6.0f);
	s.total_dx = s.total_dy = 0;
	sim_run(&s, ZERO, 5.0f);
	CHECK(labs(s.total_dx) <= 2, "after bias jump + rest: drift dx=%ld", s.total_dx);
}

static void test_prediction_returns(void)
{
	printf("prediction does not change where the cursor ends up\n");
	struct pe_config cfg;
	struct sim a, b;

	pe_config_defaults(&cfg);
	cfg.accel = 0.0f;
	rng_state = 5;
	sim_init(&a, &cfg);
	cfg.predict_ms = 15.0f;
	rng_state = 5;
	sim_init(&b, &cfg);
	learn(&a);
	learn(&b);
	float r[3] = {0, 0, -90.0f};

	sim_run(&a, r, 0.5f);
	sim_run(&b, r, 0.5f);
	sim_run(&a, ZERO, 1.0f);
	sim_run(&b, ZERO, 1.0f);
	CHECK(labs(a.total_dx - b.total_dx) <= 3, "no-predict %ld vs predict %ld", a.total_dx,
	      b.total_dx);
}

/* How far (in ms) the cursor trails an ideal, unfiltered cursor during a
 * steady fast turn: the smoothing lag the user feels.
 */
static float measure_lag_ms(float rate)
{
	struct pe_config cfg;
	struct sim s;

	pe_config_defaults(&cfg);
	cfg.accel = 0.0f;
	sim_init(&s, &cfg);
	learn(&s);
	float r[3] = {0, 0, -rate};

	sim_run(&s, r, 0.3f);
	float ideal = 0.3f * rate * cfg.gain;
	float px_per_ms = rate * cfg.gain / 1000.0f;

	return (ideal - (float)s.total_dx) / px_per_ms;
}

static void test_filter_lag(void)
{
	printf("smoothing lag at default settings\n");
	float lag200 = measure_lag_ms(200.0f);
	float lag50 = measure_lag_ms(50.0f);

	printf("  lag at 200 deg/s: %.1f ms, at 50 deg/s: %.1f ms\n", lag200, lag50);
	CHECK(lag200 < 2.0f, "lag at 200 dps = %.1f ms", lag200);
	CHECK(lag50 < 5.0f, "lag at 50 dps = %.1f ms", lag50);
}

static void test_jitter_held_still(void)
{
	struct pe_config cfg;
	struct sim s;

	printf("cursor steadiness while the hand is held still\n");
	pe_config_defaults(&cfg);
	sim_init(&s, &cfg);
	s.noise_dps = 0.2f;
	s.bias_dps[0] = 0.7f;
	learn(&s);
	s.tremor_dps = 3.0f; /* ~0.05 deg tremor, typical of a steady hand */
	sim_run(&s, ZERO, 1.0f);
	jitter_reset(&s);
	sim_run(&s, ZERO, 10.0f);
	double rms = jitter_rms(&s);

	printf("  jitter RMS %.2f px (tremor 3 dps at 9-11 Hz)\n", rms);
	CHECK(rms < 1.0, "jitter RMS %.2f px", rms);
	CHECK(labs(s.total_dx) < 30 && labs(s.total_dy) < 30,
	      "creep while held: dx=%ld dy=%ld", s.total_dx, s.total_dy);
}

/* The test app's calibration math (controller/test-app/index.html, step 4)
 * applied to a sensor mounted at an arbitrary angle must give a cursor that
 * moves right when the hand turns right and up when it tips up.
 */
static void mat_apply_t(const float R[3][3], const float v[3], float out[3])
{
	for (int j = 0; j < 3; j++) {
		out[j] = R[0][j] * v[0] + R[1][j] * v[1] + R[2][j] * v[2]; /* R^T v */
	}
}

static void test_calibrated_arbitrary_mount(void)
{
	printf("app calibration + engine agree for an arbitrary mounting\n");
	const float a = 0.7f, b = -0.4f, c = 1.9f;
	const float ca = cosf(a), sa = sinf(a), cb = cosf(b), sb = sinf(b), cc = cosf(c), sc = sinf(c);
	const float R[3][3] = {
		{ca * cb, ca * sb * sc - sa * cc, ca * sb * cc + sa * sc},
		{sa * cb, sa * sb * sc + ca * cc, sa * sb * cc - ca * sc},
		{-sb, cb * sc, cb * cc},
	};
	/* world: x forward (at the screen), y left, z up */
	const float w_up[3] = {0, 0, 1}, w_down[3] = {0, 0, -1}, w_right[3] = {0, -1, 0};
	float up0[3], sweep_r[3], sweep_u[3];

	mat_apply_t(R, w_up, up0);
	mat_apply_t(R, w_down, sweep_r);   /* turning right = rotation about down */
	mat_apply_t(R, w_right, sweep_u);  /* tipping up = rotation about right */

	/* same steps as the app */
	float d = sweep_u[0] * up0[0] + sweep_u[1] * up0[1] + sweep_u[2] * up0[2];
	float upH[3] = {sweep_u[0] - d * up0[0], sweep_u[1] - d * up0[1], sweep_u[2] - d * up0[2]};
	float n = sqrtf(upH[0] * upH[0] + upH[1] * upH[1] + upH[2] * upH[2]);

	for (int i = 0; i < 3; i++) {
		upH[i] /= n;
	}
	float fwd[3];

	cross(up0, upH, fwd);

	for (int tilt = 0; tilt <= 1; tilt++) {
		struct pe_config cfg;
		struct sim s;

		pe_config_defaults(&cfg);
		memcpy(cfg.axis_right, sweep_r, sizeof(sweep_r));
		memcpy(cfg.axis_up, upH, sizeof(upH));
		memcpy(cfg.forward, fwd, sizeof(fwd));
		cfg.tilt_comp = (uint8_t)tilt;
		sim_init(&s, &cfg);
		memcpy(s.up, up0, sizeof(up0));
		learn(&s);

		float wr[3] = {sweep_r[0] * 30, sweep_r[1] * 30, sweep_r[2] * 30};

		sim_run(&s, wr, 1.0f);
		sim_run(&s, ZERO, 0.5f);
		CHECK(s.total_dx > 700 && labs(s.total_dy) < s.total_dx / 30,
		      "tilt %d, turn right: dx=%ld dy=%ld", tilt, s.total_dx, s.total_dy);

		sim_init(&s, &cfg);
		memcpy(s.up, up0, sizeof(up0));
		learn(&s);
		float wu[3] = {sweep_u[0] * 30, sweep_u[1] * 30, sweep_u[2] * 30};

		sim_run(&s, wu, 1.0f);
		sim_run(&s, ZERO, 0.5f);
		CHECK(s.total_dy < -700 && labs(s.total_dx) < -s.total_dy / 30,
		      "tilt %d, tip up: dx=%ld dy=%ld", tilt, s.total_dx, s.total_dy);
	}
}

static void test_config_sanitize(void)
{
	struct pe_config cfg;

	printf("config validation\n");
	pe_config_defaults(&cfg);
	cfg.gain = NAN;
	cfg.beta = -5.0f;
	cfg.axis_up[0] = cfg.axis_up[1] = cfg.axis_up[2] = 0.0f;
	cfg.forward[0] = INFINITY;
	CHECK(pe_config_sanitize(&cfg), "sanitize should accept a fixable config");
	CHECK(cfg.gain >= 0.1f && isfinite(cfg.gain), "gain fixed: %f", cfg.gain);
	CHECK(cfg.beta == 0.0f, "beta clamped: %f", cfg.beta);
	CHECK(cfg.axis_up[1] == -1.0f, "zero axis replaced with default");
	CHECK(isfinite(cfg.forward[0]), "infinite axis replaced");

	cfg.version = 999;
	CHECK(!pe_config_sanitize(&cfg), "wrong version should be rejected");
	CHECK(cfg.version == PE_CONFIG_VERSION, "rejected config replaced by defaults");

	pe_config_defaults(&cfg);
	cfg.axis_right[0] = 3.0f;
	cfg.axis_right[1] = 4.0f;
	cfg.axis_right[2] = 0.0f;
	pe_config_sanitize(&cfg);
	CHECK(fabsf(cfg.axis_right[0] - 0.6f) < 1e-6f, "axis normalized");
}

/* ---- link packet tests ---- */

static void test_packet_roundtrip(void)
{
	struct link_packet p = {
		.type = LINK_PACKET_TYPE_MOTION,
		.flags = LINK_FLAG_IDLE,
		.seq = 0xBEEF,
		.device_id = 0xDEADBEEF,
		.sample_count = 0xFFFFFFF0u,
		.gyro_sum = {-2147483647 - 1, 2147483647, -5},
		.accel = {-32768, 32767, 123},
		.tx_fail_count = 250,
		.fw_version = 7,
	};
	uint8_t buf[LINK_PACKET_SIZE];
	struct link_packet q;

	printf("packet encode/decode\n");
	link_packet_encode(&p, buf);
	CHECK(link_packet_decode(buf, LINK_PACKET_SIZE, &q), "decode ok");
	CHECK(memcmp(&p.gyro_sum, &q.gyro_sum, sizeof(p.gyro_sum)) == 0, "gyro sums");
	CHECK(memcmp(&p.accel, &q.accel, sizeof(p.accel)) == 0, "accel");
	CHECK(p.seq == q.seq && p.device_id == q.device_id && p.sample_count == q.sample_count &&
		      p.flags == q.flags && p.tx_fail_count == q.tx_fail_count &&
		      p.fw_version == q.fw_version,
	      "scalars");
	CHECK(buf[4] == 0xEF && buf[7] == 0xDE, "little-endian on the wire");
	CHECK(!link_packet_decode(buf, LINK_PACKET_SIZE - 1, &q), "short packet rejected");
	buf[0] = 0x00;
	CHECK(!link_packet_decode(buf, LINK_PACKET_SIZE, &q), "wrong type rejected");
}

static void test_link_tracking(void)
{
	struct link_track t;
	struct link_packet p = {.type = LINK_PACKET_TYPE_MOTION, .device_id = 42};
	int32_t dg[3];
	uint32_t dc;

	printf("link tracking: wrap-around, loss, reboot, gaps\n");
	link_track_reset(&t);

	/* start near the wrap points */
	p.seq = 65534;
	p.sample_count = 0xFFFFFFFEu;
	p.gyro_sum[0] = 2147483600;
	p.gyro_sum[1] = -2147483600;
	p.gyro_sum[2] = 0;
	CHECK(link_track_process(&t, &p, dg, &dc) == LINK_RESYNC, "first packet resyncs");

	p.seq = 65535;
	p.sample_count += 3;             /* wraps to 1 */
	p.gyro_sum[0] = (int32_t)((uint32_t)p.gyro_sum[0] + 100u);   /* wraps */
	p.gyro_sum[1] = (int32_t)((uint32_t)p.gyro_sum[1] - 100u);   /* wraps */
	p.gyro_sum[2] -= 7;
	CHECK(link_track_process(&t, &p, dg, &dc) == LINK_MOTION, "motion");
	CHECK(dc == 3 && dg[0] == 100 && dg[1] == -100 && dg[2] == -7,
	      "wrapped deltas: dc=%u dg=%d,%d,%d", dc, dg[0], dg[1], dg[2]);

	/* two packets lost: seq jumps by 3, data still complete */
	p.seq = 2;
	p.sample_count += 9;
	p.gyro_sum[2] += 90;
	CHECK(link_track_process(&t, &p, dg, &dc) == LINK_MOTION, "after loss");
	CHECK(dc == 9 && dg[2] == 90, "loss carried: dc=%u dg2=%d", dc, dg[2]);
	CHECK(t.lost_packets == 2, "lost counted: %u", t.lost_packets);

	/* duplicate (no new samples) */
	CHECK(link_track_process(&t, &p, dg, &dc) == LINK_MOTION && dc == 0, "duplicate");

	/* long gap: dropped, no jump */
	p.seq++;
	p.sample_count += LINK_MAX_GAP_SAMPLES + 1;
	p.gyro_sum[0] += 123456;
	CHECK(link_track_process(&t, &p, dg, &dc) == LINK_RESYNC, "long gap resyncs");
	CHECK(dc == 0 && dg[0] == 0, "no motion on resync");

	/* ring reboot: counters restart */
	p.seq = 0;
	p.sample_count = 5;
	CHECK(link_track_process(&t, &p, dg, &dc) == LINK_RESYNC, "reboot resyncs");

	/* different ring */
	p.device_id = 43;
	p.sample_count += 1;
	CHECK(link_track_process(&t, &p, dg, &dc) == LINK_RESYNC, "new ring resyncs");
}

int main(void)
{
	test_bias_learning_and_no_drift();
	test_directions();
	test_tilt_compensation();
	test_packet_rate_and_loss_invariance();
	test_slow_motion_subpixel();
	test_long_run_precision();
	test_slow_steady_rotation_not_absorbed();
	test_bias_recovers_when_resting();
	test_prediction_returns();
	test_filter_lag();
	test_jitter_held_still();
	test_calibrated_arbitrary_mount();
	test_config_sanitize();
	test_packet_roundtrip();
	test_link_tracking();

	printf("\n%d checks, %d failures\n", checks, failures);
	return failures ? 1 : 0;
}
