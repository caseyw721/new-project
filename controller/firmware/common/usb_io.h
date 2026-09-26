/*
 * USB for both devices: one composite device with
 *   - a HID mouse (16-bit X/Y, polled every 1 ms) that moves the real cursor
 *   - a CDC ACM serial port the test app uses for settings and telemetry
 *
 * Each app provides src/usb_ids.h defining USB_IO_PID, USB_IO_PRODUCT and
 * USB_IO_MAX_POWER_2MA.
 */
#ifndef USB_IO_H_
#define USB_IO_H_

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

/* Called from the line thread for every complete line received (no newline). */
typedef void (*usb_io_line_cb)(char *line);

int usb_io_init(usb_io_line_cb line_cb);

/* True while a host has configured the device and the HID mouse is usable. */
bool usb_io_hid_active(void);

/* True while a program (e.g. the test app) has the serial port open. */
bool usb_io_host_listening(void);

/* Queue cursor motion. Sent in the next 1 ms USB frame; motion that arrives
 * while a report is in flight is added up, never dropped.
 */
void usb_io_move(int32_t dx, int32_t dy);

/* Enable/disable cursor output (motion is discarded while disabled). */
void usb_io_set_cursor_enabled(bool enabled);

/* Queue text for the serial port. Whole-or-nothing: returns false (and drops
 * the text) if it does not fit or nobody is listening.
 */
bool usb_io_write(const char *buf, size_t len);

#endif /* USB_IO_H_ */
