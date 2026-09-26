/*
 * Text protocol on the USB serial port, shared by the ring (wired mode) and
 * the receiver. One command or report per line, fields separated by commas.
 * The full list is in controller/PROTOCOL.md.
 */
#ifndef PROTO_H_
#define PROTO_H_

#include <stdbool.h>
#include <stdint.h>

#include "pointer_engine.h"

struct proto_hooks {
	const char *role;                          /* "ring" or "receiver" */
	/* Device-specific commands; return true if handled. May be NULL. */
	bool (*extra_cmd)(int argc, char **argv);
};

void proto_init(const struct proto_hooks *hooks);

/* Handle one received line (usb_io line callback). */
void proto_handle_line(char *line);

/* printf to the serial port, whole line or nothing. */
void proto_printf(const char *fmt, ...);

/* Set by the "rezero" command; the motion thread polls and clears it. */
bool proto_take_rezero_request(void);

/* ---- telemetry (called from the motion thread) ---- */

/* Record one engine update. dcount = IMU samples covered by it. */
void proto_telem_update(const struct pe_state *st, const struct pe_output *out,
			uint32_t dcount, const int16_t accel[3]);

/* Link information for the next telemetry line. */
struct proto_link_info {
	uint32_t device_id;
	uint32_t rx_packets;      /* cumulative */
	uint32_t lost_packets;    /* cumulative */
	uint32_t tx_fails;        /* cumulative, reported by the ring */
	int8_t rssi_dbm;          /* last packet (0 = n/a) */
	uint8_t flags;            /* LINK_FLAG_* from the ring */
	char mode;                /* 'R' radio via receiver, 'W' wired ring */
};
void proto_telem_link(const struct proto_link_info *info);

#endif /* PROTO_H_ */
