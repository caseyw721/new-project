#include "cfg_store.h"

#include <string.h>

#include <zephyr/kernel.h>
#include <zephyr/settings/settings.h>
#include <zephyr/spinlock.h>

static struct k_spinlock lock;
static struct pe_config cfg;
static uint32_t generation;

static void force_sensor_constants(struct pe_config *c)
{
	c->odr_hz = IMU_ODR_HZ;
	c->gyro_dps_per_lsb = IMU_GYRO_DPS_PER_LSB;
	c->accel_g_per_lsb = IMU_ACCEL_G_PER_LSB;
}

static int settings_set(const char *name, size_t len, settings_read_cb read_cb, void *cb_arg)
{
	const char *next;

	if (!settings_name_steq(name, "cfg", &next) || next != NULL) {
		return -ENOENT;
	}
	if (len != sizeof(struct pe_config)) {
		return 0; /* stored by an incompatible firmware: ignore, use defaults */
	}

	struct pe_config tmp;
	ssize_t rc = read_cb(cb_arg, &tmp, sizeof(tmp));

	if (rc != (ssize_t)sizeof(tmp)) {
		return 0;
	}
	if (pe_config_sanitize(&tmp)) {
		force_sensor_constants(&tmp);
		k_spinlock_key_t key = k_spin_lock(&lock);

		cfg = tmp;
		generation++;
		k_spin_unlock(&lock, key);
	}
	return 0;
}

SETTINGS_STATIC_HANDLER_DEFINE(ptr, "ptr", NULL, settings_set, NULL, NULL);

void cfg_store_init(void)
{
	pe_config_defaults(&cfg);
	force_sensor_constants(&cfg);
	generation = 1;

	if (settings_subsys_init() == 0) {
		(void)settings_load_subtree("ptr");
	}
}

void cfg_store_get(struct pe_config *out, uint32_t *gen)
{
	k_spinlock_key_t key = k_spin_lock(&lock);

	*out = cfg;
	if (gen != NULL) {
		*gen = generation;
	}
	k_spin_unlock(&lock, key);
}

uint32_t cfg_store_generation(void)
{
	return generation;
}

void cfg_store_set(const struct pe_config *in)
{
	struct pe_config tmp = *in;

	tmp.version = PE_CONFIG_VERSION;
	pe_config_sanitize(&tmp);
	force_sensor_constants(&tmp);

	k_spinlock_key_t key = k_spin_lock(&lock);

	cfg = tmp;
	generation++;
	k_spin_unlock(&lock, key);
}

void cfg_store_defaults(void)
{
	struct pe_config tmp;

	pe_config_defaults(&tmp);
	cfg_store_set(&tmp);
}

int cfg_store_save(void)
{
	struct pe_config tmp;

	cfg_store_get(&tmp, NULL);
	return settings_save_one("ptr/cfg", &tmp, sizeof(tmp));
}
