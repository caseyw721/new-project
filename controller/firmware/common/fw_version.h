#ifndef FW_VERSION_H_
#define FW_VERSION_H_

/* Bump on every firmware change that someone might flash. Sent in every radio
 * packet and reported by the "ver" command, so the test app can tell whether
 * the ring and the receiver match.
 */
#define FW_VERSION 1

#endif /* FW_VERSION_H_ */
