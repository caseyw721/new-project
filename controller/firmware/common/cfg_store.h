/*
 * The pointer settings shared between the command handler (which changes
 * them) and the motion thread (which uses them), plus saving them to flash.
 */
#ifndef CFG_STORE_H_
#define CFG_STORE_H_

#include <stdint.h>

#include "pointer_engine.h"

/* IMU setup used by the ring (LSM6DS3TR-C). The receiver needs the same
 * numbers to interpret the ring's raw data.
 */
#define IMU_ODR_HZ 1666.0f
#define IMU_GYRO_DPS_PER_LSB 0.035f     /* +-1000 dps full scale */
#define IMU_ACCEL_G_PER_LSB 0.000122f   /* +-4 g full scale */

/* Load saved settings (or defaults). Call once at boot. */
void cfg_store_init(void);

/* Copy of the current settings and their change counter. */
void cfg_store_get(struct pe_config *out, uint32_t *generation);

/* Change counter only; cheap to poll from the motion thread. */
uint32_t cfg_store_generation(void);

/* Replace settings (validated; sensor constants are always forced). */
void cfg_store_set(const struct pe_config *in);

void cfg_store_defaults(void);

/* Persist current settings. Returns 0 or a negative error. */
int cfg_store_save(void);

#endif /* CFG_STORE_H_ */
