/*
 * Enhanced ShockBurst settings shared by the ring (transmitter) and the
 * receiver. Both sides must match exactly.
 */
#ifndef RADIO_H_
#define RADIO_H_

#include <esb.h>

/* 2476 MHz: above Wi-Fi channel 11 (US) and away from the Bluetooth
 * advertising channels (2402/2426/2480 MHz).
 */
#define RADIO_RF_CHANNEL 76

/* Set up ESB in the given mode (ESB_MODE_PTX or ESB_MODE_PRX). */
int radio_init(enum esb_mode mode, esb_event_handler handler);

#endif /* RADIO_H_ */
