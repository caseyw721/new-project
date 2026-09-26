/*
 * Minimal driver for the LSM6DS3TR-C on the XIAO nRF52840 Sense.
 * Talks to the registers directly (not the Zephyr sensor API) so every
 * sample is read the moment it is ready, with no extra buffering.
 */
#ifndef IMU_H_
#define IMU_H_

#include <stdbool.h>
#include <stdint.h>

#include <zephyr/kernel.h>

/* Set up the sensor: 1666 Hz, +-1000 dps gyro, +-4 g accel, data-ready on INT1.
 * `drdy` is given every time a new sample is ready.
 */
int imu_init(struct k_sem *drdy);

/* Read the latest gyro + accel sample (raw LSB). Clears the data-ready line. */
int imu_read(int16_t gyro[3], int16_t accel[3]);

/* Level of the data-ready line (true = a sample is waiting). */
bool imu_drdy_pending(void);

/* Enable/disable the data-ready interrupt (disabled in idle mode, where the
 * ring polls slowly instead).
 */
void imu_drdy_irq_enable(bool enable);

#endif /* IMU_H_ */
