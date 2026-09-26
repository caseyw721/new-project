#include "link_packet.h"

#include <string.h>

static void put_u16(uint8_t *b, uint16_t v)
{
	b[0] = (uint8_t)v;
	b[1] = (uint8_t)(v >> 8);
}

static void put_u32(uint8_t *b, uint32_t v)
{
	b[0] = (uint8_t)v;
	b[1] = (uint8_t)(v >> 8);
	b[2] = (uint8_t)(v >> 16);
	b[3] = (uint8_t)(v >> 24);
}

static uint16_t get_u16(const uint8_t *b)
{
	return (uint16_t)(b[0] | ((uint16_t)b[1] << 8));
}

static uint32_t get_u32(const uint8_t *b)
{
	return (uint32_t)b[0] | ((uint32_t)b[1] << 8) | ((uint32_t)b[2] << 16) |
	       ((uint32_t)b[3] << 24);
}

void link_packet_encode(const struct link_packet *p, uint8_t buf[LINK_PACKET_SIZE])
{
	buf[0] = p->type;
	buf[1] = p->flags;
	put_u16(&buf[2], p->seq);
	put_u32(&buf[4], p->device_id);
	put_u32(&buf[8], p->sample_count);
	for (int i = 0; i < 3; i++) {
		put_u32(&buf[12 + 4 * i], (uint32_t)p->gyro_sum[i]);
	}
	for (int i = 0; i < 3; i++) {
		put_u16(&buf[24 + 2 * i], (uint16_t)p->accel[i]);
	}
	buf[30] = p->tx_fail_count;
	buf[31] = p->fw_version;
}

bool link_packet_decode(const uint8_t *buf, uint8_t len, struct link_packet *p)
{
	if (len != LINK_PACKET_SIZE || buf[0] != LINK_PACKET_TYPE_MOTION) {
		return false;
	}
	p->type = buf[0];
	p->flags = buf[1];
	p->seq = get_u16(&buf[2]);
	p->device_id = get_u32(&buf[4]);
	p->sample_count = get_u32(&buf[8]);
	for (int i = 0; i < 3; i++) {
		p->gyro_sum[i] = (int32_t)get_u32(&buf[12 + 4 * i]);
	}
	for (int i = 0; i < 3; i++) {
		p->accel[i] = (int16_t)get_u16(&buf[24 + 2 * i]);
	}
	p->tx_fail_count = buf[30];
	p->fw_version = buf[31];
	return true;
}

void link_track_reset(struct link_track *t)
{
	memset(t, 0, sizeof(*t));
}

static void take_reference(struct link_track *t, const struct link_packet *p)
{
	t->valid = true;
	t->device_id = p->device_id;
	t->seq = p->seq;
	t->sample_count = p->sample_count;
	memcpy(t->gyro_sum, p->gyro_sum, sizeof(t->gyro_sum));
}

enum link_result link_track_process(struct link_track *t, const struct link_packet *p,
				    int32_t dgyro[3], uint32_t *dcount)
{
	dgyro[0] = dgyro[1] = dgyro[2] = 0;
	*dcount = 0;
	t->packets++;

	if (!t->valid || t->device_id != p->device_id) {
		take_reference(t, p);
		t->resyncs++;
		return LINK_RESYNC;
	}

	uint16_t seq_step = (uint16_t)(p->seq - t->seq);

	if (seq_step > 1u && seq_step < 0x8000u) {
		t->lost_packets += seq_step - 1u;
	}

	/* Unsigned wrap-around subtraction gives the true difference as long as
	 * less than 2^31 elapsed, which the gap limit below guarantees.
	 */
	uint32_t dc = p->sample_count - t->sample_count;

	if (dc > LINK_MAX_GAP_SAMPLES) {
		/* Long dropout, or the ring rebooted (count went backwards). */
		take_reference(t, p);
		t->resyncs++;
		return LINK_RESYNC;
	}

	for (int i = 0; i < 3; i++) {
		dgyro[i] = (int32_t)((uint32_t)p->gyro_sum[i] - (uint32_t)t->gyro_sum[i]);
	}
	*dcount = dc;
	take_reference(t, p);
	return LINK_MOTION;
}
