#include "imu.h"

#include <zephyr/drivers/gpio.h>
#include <zephyr/drivers/i2c.h>
#include <zephyr/sys/byteorder.h>

#define IMU_NODE DT_NODELABEL(lsm6ds3tr_c)

/* LSM6DS3TR-C registers */
#define REG_INT1_CTRL 0x0D
#define REG_WHO_AM_I 0x0F
#define REG_CTRL1_XL 0x10
#define REG_CTRL2_G 0x11
#define REG_CTRL3_C 0x12
#define REG_CTRL4_C 0x13
#define REG_OUTX_L_G 0x22 /* gyro X,Y,Z then accel X,Y,Z, 12 bytes */

#define WHO_AM_I_LSM6DS3TR_C 0x6A
#define WHO_AM_I_LSM6DS3 0x69

#define CTRL3_SW_RESET 0x01
#define CTRL3_BDU_IF_INC 0x44   /* block data update + register auto-increment */
#define CTRL1_XL_1666HZ_4G 0x88 /* ODR 1.66 kHz, +-4 g */
#define CTRL2_G_1666HZ_1000DPS 0x88 /* ODR 1.66 kHz, +-1000 dps */
#define INT1_DRDY_G 0x02

static const struct i2c_dt_spec bus = I2C_DT_SPEC_GET(IMU_NODE);
static const struct gpio_dt_spec int1 = GPIO_DT_SPEC_GET(IMU_NODE, irq_gpios);
static struct gpio_callback int1_cb;
static struct k_sem *drdy_sem;

static void int1_handler(const struct device *dev, struct gpio_callback *cb, uint32_t pins)
{
	ARG_UNUSED(dev);
	ARG_UNUSED(cb);
	ARG_UNUSED(pins);
	k_sem_give(drdy_sem);
}

static int wr(uint8_t reg, uint8_t val)
{
	return i2c_reg_write_byte_dt(&bus, reg, val);
}

int imu_init(struct k_sem *drdy)
{
	uint8_t id = 0;
	int err;

	drdy_sem = drdy;

	if (!i2c_is_ready_dt(&bus) || !gpio_is_ready_dt(&int1)) {
		return -ENODEV;
	}

	/* The board powers the IMU at boot; give it time if we got here fast. */
	for (int tries = 0; tries < 20; tries++) {
		err = i2c_reg_read_byte_dt(&bus, REG_WHO_AM_I, &id);
		if (err == 0) {
			break;
		}
		k_msleep(5);
	}
	if (err) {
		return err;
	}
	if (id != WHO_AM_I_LSM6DS3TR_C && id != WHO_AM_I_LSM6DS3) {
		return -ENODEV;
	}

	err = wr(REG_CTRL3_C, CTRL3_SW_RESET);
	if (err) {
		return err;
	}
	for (int tries = 0; tries < 20; tries++) {
		uint8_t v = CTRL3_SW_RESET;

		k_msleep(1);
		err = i2c_reg_read_byte_dt(&bus, REG_CTRL3_C, &v);
		if (err == 0 && !(v & CTRL3_SW_RESET)) {
			break;
		}
	}

	err = wr(REG_CTRL3_C, CTRL3_BDU_IF_INC);
	/* CTRL4_C = 0: gyro LPF1 off. The sensor's own smoothing adds delay; the
	 * pointer engine smooths only when the hand is still.
	 */
	err = err ? err : wr(REG_CTRL4_C, 0x00);
	err = err ? err : wr(REG_CTRL1_XL, CTRL1_XL_1666HZ_4G);
	err = err ? err : wr(REG_CTRL2_G, CTRL2_G_1666HZ_1000DPS);
	err = err ? err : wr(REG_INT1_CTRL, INT1_DRDY_G);
	if (err) {
		return err;
	}

	err = gpio_pin_configure_dt(&int1, GPIO_INPUT);
	if (err) {
		return err;
	}
	gpio_init_callback(&int1_cb, int1_handler, BIT(int1.pin));
	err = gpio_add_callback(int1.port, &int1_cb);
	if (err) {
		return err;
	}

	/* The gyro needs ~70 ms to start up; throw away samples until then. */
	k_msleep(100);
	int16_t g[3], a[3];

	(void)imu_read(g, a);
	imu_drdy_irq_enable(true);
	return 0;
}

int imu_read(int16_t gyro[3], int16_t accel[3])
{
	uint8_t buf[12];
	int err = i2c_burst_read_dt(&bus, REG_OUTX_L_G, buf, sizeof(buf));

	if (err) {
		return err;
	}
	for (int i = 0; i < 3; i++) {
		gyro[i] = (int16_t)sys_get_le16(&buf[2 * i]);
		accel[i] = (int16_t)sys_get_le16(&buf[6 + 2 * i]);
	}
	return 0;
}

bool imu_drdy_pending(void)
{
	return gpio_pin_get_dt(&int1) > 0;
}

void imu_drdy_irq_enable(bool enable)
{
	(void)gpio_pin_interrupt_configure_dt(&int1, enable ? GPIO_INT_EDGE_TO_ACTIVE
							    : GPIO_INT_DISABLE);
}
