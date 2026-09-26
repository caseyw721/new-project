#include "usb_io.h"

#include <string.h>

#include <zephyr/device.h>
#include <zephyr/drivers/uart.h>
#include <zephyr/drivers/usb/usb_buf.h>
#include <zephyr/kernel.h>
#include <zephyr/spinlock.h>
#include <zephyr/sys/byteorder.h>
#include <zephyr/sys/ring_buffer.h>
#include <zephyr/sys/util.h>
#include <zephyr/usb/class/hid.h>
#include <zephyr/usb/class/usbd_hid.h>
#include <zephyr/usb/usbd.h>

/* Per-app USB identity: USB_IO_PID, USB_IO_PRODUCT, USB_IO_MAX_POWER_2MA */
#include "usb_ids.h"

#if !defined(USB_IO_PID) || !defined(USB_IO_PRODUCT) || !defined(USB_IO_MAX_POWER_2MA)
#error "usb_ids.h must define USB_IO_PID, USB_IO_PRODUCT and USB_IO_MAX_POWER_2MA"
#endif

/* pid.codes open-source VID. PIDs 0x0001/0x0002 are its test IDs, fine for a
 * personal prototype; register real ones before distributing devices.
 */
#define USB_IO_VID 0x1209

#define LINE_MAX 128
#define TX_BUF_SIZE 4096

/* ------------------------------------------------------------------ */
/* USB device                                                          */

USBD_DEVICE_DEFINE(app_usbd, DEVICE_DT_GET(DT_NODELABEL(zephyr_udc0)), USB_IO_VID, USB_IO_PID);

USBD_DESC_LANG_DEFINE(app_lang);
USBD_DESC_MANUFACTURER_DEFINE(app_mfr, "DAW Controller Project");
USBD_DESC_PRODUCT_DEFINE(app_product, USB_IO_PRODUCT);
USBD_DESC_SERIAL_NUMBER_DEFINE(app_sn);
USBD_DESC_CONFIG_DEFINE(app_fs_cfg_desc, "FS Configuration");
USBD_CONFIGURATION_DEFINE(app_fs_config, 0 /* bus powered, no remote wakeup */,
			  USB_IO_MAX_POWER_2MA, &app_fs_cfg_desc);

static volatile bool usb_suspended;

/* ------------------------------------------------------------------ */
/* HID mouse                                                           */

/*
 * Report (6 bytes, no report ID):
 *   [0] buttons (3 bits)  [1..2] X int16  [3..4] Y int16  [5] wheel int8
 * 16-bit relative X/Y as used by gaming mice: large fast moves are never
 * clipped to +-127 per report.
 */
static const uint8_t hid_report_desc[] = {
	0x05, 0x01,       /* Usage Page (Generic Desktop) */
	0x09, 0x02,       /* Usage (Mouse) */
	0xA1, 0x01,       /* Collection (Application) */
	0x09, 0x01,       /*   Usage (Pointer) */
	0xA1, 0x00,       /*   Collection (Physical) */
	0x05, 0x09,       /*     Usage Page (Button) */
	0x19, 0x01,       /*     Usage Minimum (1) */
	0x29, 0x03,       /*     Usage Maximum (3) */
	0x15, 0x00,       /*     Logical Minimum (0) */
	0x25, 0x01,       /*     Logical Maximum (1) */
	0x75, 0x01,       /*     Report Size (1) */
	0x95, 0x03,       /*     Report Count (3) */
	0x81, 0x02,       /*     Input (Data, Var, Abs) */
	0x75, 0x05,       /*     Report Size (5) */
	0x95, 0x01,       /*     Report Count (1) */
	0x81, 0x01,       /*     Input (Const) padding */
	0x05, 0x01,       /*     Usage Page (Generic Desktop) */
	0x09, 0x30,       /*     Usage (X) */
	0x09, 0x31,       /*     Usage (Y) */
	0x16, 0x01, 0x80, /*     Logical Minimum (-32767) */
	0x26, 0xFF, 0x7F, /*     Logical Maximum (32767) */
	0x75, 0x10,       /*     Report Size (16) */
	0x95, 0x02,       /*     Report Count (2) */
	0x81, 0x06,       /*     Input (Data, Var, Rel) */
	0x09, 0x38,       /*     Usage (Wheel) */
	0x15, 0x81,       /*     Logical Minimum (-127) */
	0x25, 0x7F,       /*     Logical Maximum (127) */
	0x75, 0x08,       /*     Report Size (8) */
	0x95, 0x01,       /*     Report Count (1) */
	0x81, 0x06,       /*     Input (Data, Var, Rel) */
	0xC0,             /*   End Collection */
	0xC0,             /* End Collection */
};

#define HID_REPORT_LEN 6

static const struct device *const hid_dev = DEVICE_DT_GET(DT_NODELABEL(hid_dev_0));

/* The USB controller reads this buffer by DMA until the report is done, so it
 * is only written while no report is in flight.
 */
UDC_STATIC_BUF_DEFINE(hid_report, HID_REPORT_LEN);

static struct k_spinlock hid_lock;
static bool hid_ready;
static bool hid_in_flight;
static bool cursor_enabled = true;
static int32_t pend_dx, pend_dy;

static int16_t take_chunk(int32_t *pend)
{
	int32_t v = CLAMP(*pend, -32767, 32767);

	*pend -= v;
	return (int16_t)v;
}

/* Send pending motion if the endpoint is free. Never called with the lock held. */
static void hid_kick(void)
{
	k_spinlock_key_t key = k_spin_lock(&hid_lock);

	if (!hid_ready || hid_in_flight || usb_suspended || (pend_dx == 0 && pend_dy == 0)) {
		k_spin_unlock(&hid_lock, key);
		return;
	}
	int16_t x = take_chunk(&pend_dx);
	int16_t y = take_chunk(&pend_dy);

	hid_in_flight = true;
	hid_report[0] = 0;
	sys_put_le16((uint16_t)x, &hid_report[1]);
	sys_put_le16((uint16_t)y, &hid_report[3]);
	hid_report[5] = 0;
	k_spin_unlock(&hid_lock, key);

	if (hid_device_submit_report(hid_dev, HID_REPORT_LEN, hid_report) != 0) {
		/* Put the motion back; it goes out with the next attempt. */
		key = k_spin_lock(&hid_lock);
		pend_dx += x;
		pend_dy += y;
		hid_in_flight = false;
		k_spin_unlock(&hid_lock, key);
	}
}

static void hid_iface_ready(const struct device *dev, const bool ready)
{
	ARG_UNUSED(dev);
	k_spinlock_key_t key = k_spin_lock(&hid_lock);

	hid_ready = ready;
	hid_in_flight = false;
	pend_dx = pend_dy = 0;
	k_spin_unlock(&hid_lock, key);
}

static void hid_report_done(const struct device *dev, const uint8_t *const report)
{
	ARG_UNUSED(dev);
	ARG_UNUSED(report);
	k_spinlock_key_t key = k_spin_lock(&hid_lock);

	hid_in_flight = false;
	k_spin_unlock(&hid_lock, key);
	hid_kick();
}

static int hid_get_report(const struct device *dev, const uint8_t type, const uint8_t id,
			  const uint16_t len, uint8_t *const buf)
{
	ARG_UNUSED(dev);
	ARG_UNUSED(id);
	if (type != HID_REPORT_TYPE_INPUT || len < HID_REPORT_LEN) {
		return -ENOTSUP;
	}
	memset(buf, 0, HID_REPORT_LEN);
	return HID_REPORT_LEN;
}

static const struct hid_device_ops hid_ops = {
	.iface_ready = hid_iface_ready,
	.get_report = hid_get_report,
	.input_report_done = hid_report_done,
};

void usb_io_move(int32_t dx, int32_t dy)
{
	if (dx == 0 && dy == 0) {
		return;
	}
	k_spinlock_key_t key = k_spin_lock(&hid_lock);

	if (!cursor_enabled || !hid_ready) {
		k_spin_unlock(&hid_lock, key);
		return;
	}
	/* Saturate instead of overflowing if the host stops polling. */
	pend_dx = CLAMP((int64_t)pend_dx + dx, -1000000, 1000000);
	pend_dy = CLAMP((int64_t)pend_dy + dy, -1000000, 1000000);
	k_spin_unlock(&hid_lock, key);
	hid_kick();
}

void usb_io_set_cursor_enabled(bool enabled)
{
	k_spinlock_key_t key = k_spin_lock(&hid_lock);

	cursor_enabled = enabled;
	if (!enabled) {
		pend_dx = pend_dy = 0;
	}
	k_spin_unlock(&hid_lock, key);
}

bool usb_io_hid_active(void)
{
	return hid_ready && !usb_suspended;
}

/* ------------------------------------------------------------------ */
/* CDC ACM serial                                                      */

static const struct device *const cdc_dev = DEVICE_DT_GET(DT_NODELABEL(board_cdc_acm_uart));

static struct k_spinlock tx_lock;
RING_BUF_DECLARE(tx_rb, TX_BUF_SIZE);
static volatile bool dtr_set;

struct rx_line {
	char text[LINE_MAX];
};
K_MSGQ_DEFINE(rx_lines, sizeof(struct rx_line), 4, 4);

static char rx_buf[LINE_MAX];
static size_t rx_len;
static bool rx_overflow;

static void rx_byte(uint8_t c)
{
	if (c == '\n' || c == '\r') {
		if (!rx_overflow && rx_len > 0) {
			struct rx_line line;

			memcpy(line.text, rx_buf, rx_len);
			line.text[rx_len] = '\0';
			(void)k_msgq_put(&rx_lines, &line, K_NO_WAIT);
		}
		rx_len = 0;
		rx_overflow = false;
		return;
	}
	if (rx_len < LINE_MAX - 1) {
		rx_buf[rx_len++] = (char)c;
	} else {
		rx_overflow = true; /* discard the rest of an over-long line */
	}
}

static void cdc_irq(const struct device *dev, void *user_data)
{
	ARG_UNUSED(user_data);

	while (uart_irq_update(dev) && uart_irq_is_pending(dev)) {
		if (uart_irq_rx_ready(dev)) {
			uint8_t buf[64];
			int n = uart_fifo_read(dev, buf, sizeof(buf));

			for (int i = 0; i < n; i++) {
				rx_byte(buf[i]);
			}
		}
		if (uart_irq_tx_ready(dev)) {
			k_spinlock_key_t key = k_spin_lock(&tx_lock);
			uint8_t *data;
			uint32_t len = ring_buf_get_claim(&tx_rb, &data, 64);

			if (len == 0) {
				ring_buf_get_finish(&tx_rb, 0);
				uart_irq_tx_disable(dev);
			} else {
				int n = uart_fifo_fill(dev, data, (int)len);

				ring_buf_get_finish(&tx_rb, n > 0 ? (uint32_t)n : 0);
			}
			k_spin_unlock(&tx_lock, key);
		}
	}
}

bool usb_io_host_listening(void)
{
	return dtr_set && !usb_suspended;
}

bool usb_io_write(const char *buf, size_t len)
{
	if (!usb_io_host_listening()) {
		return false;
	}
	k_spinlock_key_t key = k_spin_lock(&tx_lock);

	if (ring_buf_space_get(&tx_rb) < len) {
		k_spin_unlock(&tx_lock, key);
		return false;
	}
	ring_buf_put(&tx_rb, (const uint8_t *)buf, len);
	k_spin_unlock(&tx_lock, key);
	uart_irq_tx_enable(cdc_dev);
	return true;
}

static void update_dtr(void)
{
	uint32_t dtr = 0;

	(void)uart_line_ctrl_get(cdc_dev, UART_LINE_CTRL_DTR, &dtr);
	dtr_set = dtr != 0;
	if (!dtr_set) {
		/* Nobody is reading: drop stale output. */
		k_spinlock_key_t key = k_spin_lock(&tx_lock);

		ring_buf_reset(&tx_rb);
		k_spin_unlock(&tx_lock, key);
	}
}

/* ------------------------------------------------------------------ */
/* Line thread                                                         */

static usb_io_line_cb line_cb;

static void line_thread_fn(void *a, void *b, void *c)
{
	ARG_UNUSED(a);
	ARG_UNUSED(b);
	ARG_UNUSED(c);
	struct rx_line line;

	for (;;) {
		k_msgq_get(&rx_lines, &line, K_FOREVER);
		if (line_cb != NULL) {
			line_cb(line.text);
		}
	}
}

K_THREAD_DEFINE(usb_line_thread, 2048, line_thread_fn, NULL, NULL, NULL,
		K_PRIO_PREEMPT(8), 0, 0);

/* ------------------------------------------------------------------ */
/* Device state                                                        */

static void usbd_msg(struct usbd_context *const ctx, const struct usbd_msg *msg)
{
	switch (msg->type) {
	case USBD_MSG_VBUS_READY:
		if (usbd_can_detect_vbus(ctx)) {
			(void)usbd_enable(ctx);
		}
		break;
	case USBD_MSG_VBUS_REMOVED:
		if (usbd_can_detect_vbus(ctx)) {
			(void)usbd_disable(ctx);
		}
		dtr_set = false;
		break;
	case USBD_MSG_SUSPEND:
		usb_suspended = true;
		break;
	case USBD_MSG_RESUME:
		usb_suspended = false;
		hid_kick();
		break;
	case USBD_MSG_RESET:
		usb_suspended = false;
		dtr_set = false;
		break;
	case USBD_MSG_CDC_ACM_CONTROL_LINE_STATE:
		update_dtr();
		break;
	default:
		break;
	}
}

int usb_io_init(usb_io_line_cb cb)
{
	int err;

	line_cb = cb;

	if (!device_is_ready(hid_dev) || !device_is_ready(cdc_dev)) {
		return -ENODEV;
	}

	err = hid_device_register(hid_dev, hid_report_desc, sizeof(hid_report_desc), &hid_ops);
	if (err) {
		return err;
	}

	uart_irq_callback_set(cdc_dev, cdc_irq);

	err = usbd_add_descriptor(&app_usbd, &app_lang);
	err = err ? err : usbd_add_descriptor(&app_usbd, &app_mfr);
	err = err ? err : usbd_add_descriptor(&app_usbd, &app_product);
	err = err ? err : usbd_add_descriptor(&app_usbd, &app_sn);
	err = err ? err : usbd_add_configuration(&app_usbd, USBD_SPEED_FS, &app_fs_config);
	err = err ? err : usbd_register_all_classes(&app_usbd, USBD_SPEED_FS, 1, NULL);
	if (err) {
		return err;
	}

	/* CDC ACM uses an Interface Association Descriptor. */
	usbd_device_set_code_triple(&app_usbd, USBD_SPEED_FS, USB_BCC_MISCELLANEOUS, 0x02, 0x01);
	usbd_self_powered(&app_usbd, false);

	err = usbd_msg_register_cb(&app_usbd, usbd_msg);
	err = err ? err : usbd_init(&app_usbd);
	if (err) {
		return err;
	}

	uart_irq_rx_enable(cdc_dev);

	if (!usbd_can_detect_vbus(&app_usbd)) {
		err = usbd_enable(&app_usbd);
	}
	return err;
}
