#include "radio.h"

#include <zephyr/sys/util.h>

/* Arbitrary private address; change both sides together if it ever clashes
 * with another ESB device nearby.
 */
static const uint8_t base_addr_0[4] = {0x6D, 0x3A, 0x91, 0xC4};
static const uint8_t base_addr_1[4] = {0xB2, 0x57, 0x0E, 0x83};
static const uint8_t prefixes[1] = {0x5E};

int radio_init(enum esb_mode mode, esb_event_handler handler)
{
	struct esb_config config = ESB_DEFAULT_CONFIG;
	int err;

	config.protocol = ESB_PROTOCOL_ESB_DPL;
	config.mode = mode;
	config.event_handler = handler;
	config.bitrate = ESB_BITRATE_2MBPS;
	config.crc = ESB_CRC_16BIT;
	config.tx_output_power = 0;             /* 0 dBm: plenty for a desk */
	/* Lowest latency: a lost packet is never resent. The next packet (sent
	 * ~0.6 ms later) carries the same cumulative data, so nothing is lost.
	 */
	config.retransmit_count = 0;
	config.retransmit_delay = 600;
	config.selective_auto_ack = false;      /* every packet acknowledged: link stats */
	config.use_fast_ramp_up = true;         /* 40 us instead of 130 us radio start */

	err = esb_init(&config);
	err = err ? err : esb_set_base_address_0(base_addr_0);
	err = err ? err : esb_set_base_address_1(base_addr_1);
	err = err ? err : esb_set_prefixes(prefixes, ARRAY_SIZE(prefixes));
	err = err ? err : esb_set_rf_channel(RADIO_RF_CHANNEL);
	return err;
}
