# Serial protocol (receiver and wired ring)

Both devices show up as a USB mouse **and** a USB serial port. The test app
talks to the serial port. You can also use any serial terminal (the baud rate
doesn't matter). Everything is plain text, one line per message, with
comma-separated fields.

## Commands (you send)

| Command | What it does |
|---|---|
| `ver` | Reply `I,ver,<role>,<firmware version>`. |
| `get` | List every setting as `C,<key>,<value>` lines, then `OK,get`. |
| `set,<key>,<value>` | Change a setting (vectors take three numbers). Echoes the value actually applied. |
| `save` | Store the current settings in flash, so they survive unplugging. |
| `defaults` | Go back to the default settings. They aren't saved until you run `save`. |
| `rezero` | Forget the gyro drift estimate and re-learn it. Put the ring down for 2 s afterwards. |
| `cursor,0` / `cursor,1` | Stop or start moving the real cursor (used during calibration). |
| `telemetry,0` / `telemetry,1` | Stop or start the `T` lines. |
| `help` | List the commands. |
| `rings` | *Receiver only.* List the rings it can hear. |
| `ring,<id>` / `ring,auto` | *Receiver only.* Pin one ring, or let the first ring that moves take over. |
| `info` | *Ring only.* Mode, IMU status and radio counters. |

Replies start with `OK,` or `ERR,`. Informational lines start with `I,`.

## Settings keys

| Key | Meaning | Default |
|---|---|---|
| `gain` | Pixels per degree of hand rotation, at slow speed | 25 |
| `accel` | Extra gain added at high speed (0 = none) | 2 |
| `knee` | Speed (deg/s) where half of the extra gain applies | 80 |
| `mincutoff` | Smoothing when still, in Hz. Higher means less smoothing. | 1.0 |
| `beta` | How fast smoothing turns off as speed rises | 1.0 |
| `speedcutoff` | Low-pass on the speed estimate, in Hz | 30 |
| `deadzone` | Rotation below this (deg/s) is ignored | 0.15 |
| `predict` | Look-ahead in ms (0 = off) | 0 |
| `still` | Max wobble (deg/s) that still counts as "held still" | 1.5 |
| `tilt` | 1 = keep horizontal motion horizontal when the hand is rolled | 1 |
| `autobias` | 1 = keep re-learning gyro drift automatically | 1 |
| `right`, `up`, `fwd` | Axis vectors from calibration (sensor frame) | board guess |

## Telemetry line (device sends, 50 times per second)

`T,` followed by these fields, in order:

| # | Field | Unit |
|---|---|---|
| 1 | device uptime | ms |
| 2 | ring id | hex |
| 3 | mode | `R` = via receiver, `W` = wired ring |
| 4 | engine updates in this interval | count |
| 5 | IMU samples in this interval | count |
| 6–8 | rotation this interval, sensor X/Y/Z, drift removed | millidegrees |
| 9–10 | cursor motion sent to the computer (dx, dy) | pixels (mouse counts) |
| 11 | peak smoothed speed | 0.1 deg/s |
| 12 | held still | 0/1 |
| 13–15 | gyro drift estimate X/Y/Z | millideg/s |
| 16–18 | gravity "up" direction X/Y/Z | ×1000 |
| 19–21 | accelerometer X/Y/Z | milli-g |
| 22 | hand vibration (gyro) | millideg/s RMS |
| 23 | hand vibration (accelerometer) | 0.1 milli-g RMS |
| 24 | radio packets received this interval | count |
| 25 | radio packets lost this interval | count |
| 26 | signal strength (last packet) | dBm |
| 27 | ring transmit failures this interval | count |
| 28 | ring flags (1 = idle, 2 = IMU error) | bits |

## Radio packet (ring to receiver)

32 bytes, little-endian, sent on 2476 MHz (ESB, 2 Mbps). See
`firmware/common/link_packet.h`. The ring sends running totals (gyro sums and
the sample count), so a lost packet loses no motion: the next packet carries
it.
