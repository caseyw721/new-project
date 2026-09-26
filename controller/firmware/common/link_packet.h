/*
 * Radio packet sent from the ring to the receiver, and the receiver-side
 * logic that turns a stream of packets into motion deltas.
 *
 * The ring sends *cumulative* values (total gyro sum and total sample count
 * since power-up). The receiver subtracts the previous packet's values. A lost
 * packet therefore loses no motion: the next packet carries it.
 *
 * Portable C, no Zephyr dependencies (unit tested on the host).
 */
#ifndef LINK_PACKET_H_
#define LINK_PACKET_H_

#include <stdbool.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

#define LINK_PACKET_SIZE 32
#define LINK_PACKET_TYPE_MOTION 0xA1

/* flags */
#define LINK_FLAG_IDLE      0x01  /* ring is in low-rate idle mode */
#define LINK_FLAG_IMU_ERROR 0x02  /* ring could not read its IMU */

struct link_packet {
	uint8_t type;
	uint8_t flags;
	uint16_t seq;             /* increments every packet (wraps) */
	uint32_t device_id;       /* identifies the ring */
	uint32_t sample_count;    /* cumulative IMU samples (wraps) */
	int32_t gyro_sum[3];      /* cumulative raw gyro LSB (wraps) */
	int16_t accel[3];         /* latest raw accelerometer LSB */
	uint8_t tx_fail_count;    /* cumulative failed transmissions (wraps) */
	uint8_t fw_version;
};

/* Serialize to exactly LINK_PACKET_SIZE bytes, little-endian. */
void link_packet_encode(const struct link_packet *p, uint8_t buf[LINK_PACKET_SIZE]);

/* Returns false if len or type is wrong. */
bool link_packet_decode(const uint8_t *buf, uint8_t len, struct link_packet *p);

/* Receiver-side tracking of one ring. */
struct link_track {
	bool valid;
	uint32_t device_id;
	uint16_t seq;
	uint32_t sample_count;
	int32_t gyro_sum[3];

	/* statistics (cumulative, wrap freely) */
	uint32_t packets;
	uint32_t lost_packets;    /* from sequence gaps */
	uint32_t resyncs;
};

enum link_result {
	LINK_MOTION,      /* dgyro/dcount valid (dcount may be 0) */
	LINK_RESYNC,      /* first packet, reboot, or long gap: no motion this time */
};

/* Longest gap (in IMU samples) whose motion is still applied. Longer gaps are
 * dropped so the cursor never jumps after a dropout.
 */
#define LINK_MAX_GAP_SAMPLES 1000u

void link_track_reset(struct link_track *t);

enum link_result link_track_process(struct link_track *t, const struct link_packet *p,
				    int32_t dgyro[3], uint32_t *dcount);

#ifdef __cplusplus
}
#endif

#endif /* LINK_PACKET_H_ */
