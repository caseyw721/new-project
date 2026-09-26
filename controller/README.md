# Controller software (Phase 1: tracking test)

**Just want to use it?** Follow [docs/controller/02-phase1-setup-guide.md](../docs/controller/02-phase1-setup-guide.md).
This page is for changing the code.

## What's here

```
controller/
├── firmware/
│   ├── common/          shared by both devices
│   │   ├── pointer_engine.*   hand motion → cursor movement (plain C, unit tested)
│   │   ├── link_packet.*      radio packet format + loss-proof decoding (plain C, unit tested)
│   │   ├── usb_io.*           USB mouse (1000 Hz, 16-bit) + USB serial port
│   │   ├── proto.*            serial commands and telemetry (see PROTOCOL.md)
│   │   ├── cfg_store.*        settings, saved to flash
│   │   └── radio.*            Enhanced ShockBurst setup (channel, address, timing)
│   ├── ring/            XIAO nRF52840 Sense: IMU driver, radio sender, wired mode, idle mode
│   ├── receiver/        nRF52840 Dongle: radio receiver, ring selection
│   ├── tests/           host unit tests:  make -C controller/firmware/tests
│   ├── prebuilt/        ready-to-flash ring.uf2, receiver.hex, receiver-dfu.zip
│   └── build.sh         builds everything from source (downloads the toolchain once)
├── test-app/
│   ├── index.html       the browser test bench (Chrome/Edge, Web Serial)
│   └── tests/           end-to-end test with a simulated device (Playwright)
└── PROTOCOL.md          serial commands, telemetry fields, radio packet
```

## How a movement reaches the screen

1. **Ring:** the LSM6DS3TR-C raises its data-ready line every 0.6 ms (1666 Hz). The ring reads
   the sample over I²C (~0.35 ms) and immediately sends a 32-byte packet with **running totals**.
2. **Radio:** Enhanced ShockBurst at 2 Mbps with fast ramp-up, on 2476 MHz, with no
   retransmits. The next packet, 0.6 ms later, carries everything a lost packet had.
3. **Receiver:** turns the totals into deltas and runs the pointer engine:
   - drift removal;
   - tilt compensation;
   - 1-euro smoothing driven by gyro speed (~1 ms lag at 200 °/s);
   - speed-dependent gain;
   - sub-pixel accumulation.
4. **USB:** a 16-bit relative mouse report is queued for the next 1 ms poll. Motion arriving while
   a report is in flight is added up, never dropped.

In **wired mode** (ring plugged into a computer), step 3 runs on the ring itself and steps 2–3
merge. This is the reference for "how fast could it be".

## Tests

```bash
make -C controller/firmware/tests                     # engine + packet logic, 63 checks
cd controller/test-app/tests && npm install playwright && node app.test.js   # test app, 29 checks
```

The engine tests simulate the IMU at 1666 Hz with bias, noise, hand tremor, packet loss and the
true rotation of gravity. They check:
- directions;
- tilt compensation;
- drift learning;
- smoothing lag;
- steadiness;
- loss invariance;
- float precision over long runs;
- that the test app's calibration math and the engine agree for a sensor mounted at any angle.

The firmware itself is compiled but **not yet run on real hardware**. The first bench session is
its first real test.

## Building

`firmware/build.sh` pins **nRF Connect SDK v3.4.1** and **Zephyr SDK 1.0.1** (ARM compiler only).
Board targets:
- `xiao_ble/nrf52840/sense`: the UF2 image starts at 0x27000, which keeps the XIAO's bootloader.
- `nrf52840dongle/nrf52840`: the image starts at 0x1000, which keeps the dongle's USB bootloader.

Our code is compiled with `-Wextra -Wshadow -Werror`.

USB IDs are pid.codes test IDs (1209:0001 receiver, 1209:0002 ring), fine for a personal
prototype.
