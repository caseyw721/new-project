# 01: How the controller tracks the cursor

## Short version

- **Lowest lag is the #1 priority.** When lag and anything else conflict, lag wins. Every choice
  below is made lag-first.
- **The pick: a motion sensor on your hand that works like an "air mouse."** Tilting your hand
  moves the cursor, and a USB receiver keeps the lag as low as a gaming mouse's.
- This is the fastest, smoothest option that needs **no camera or sensor bar** and fits in the
  smallest device.
- If the cursor slowly stops lining up with where your hand points and that bugs you, there's an
  upgrade path (a small light bar under the screen, like the Wii). We only add it if testing shows
  we need it.
- **Still to decide by testing:** where the sensor sits (wrist, back of hand, base of the index
  finger, or fingertip). That answer decides what the device looks like.

---

## What "good" means

These are the numbers the Phase 1 test checks, listed in priority order. **Lag comes first.**

| Goal | Target | In plain words |
|---|---|---|
| **Lag (#1)** | Within ~2 ms of a **wired gaming mouse** on the same computer, measured the same way. The controller's own share (hand moves → computer has the data) is under ~5 ms. | As fast as the fastest mouse you can buy |
| Shake | Under 1 pixel when your hand is still | Cursor sits dead still when you stop |
| Accuracy | Hit a 1-beat slot or a small knob without zooming in | Good enough for real editing |
| Drift | No constant re-centering | You don't fight it |
| Setup | Nothing extra except a USB receiver | Plug in and go |

It also has to leave room for what comes later: several kinds of pinch, click and drag, and
"pinch and twist" to turn a knob.

---

## Where lag comes from

Lag adds up in a chain. Each link matters:

1. **The sensor reads your motion.** A faster reading rate means less lag. We'll read it hundreds
   of times a second.
2. **Smoothing.** This removes hand shake, but too much of it adds lag. We use a smart filter that
   smooths only when you're moving slowly (details at the bottom).
3. **Wireless link.** This is the big one.
   - **Bluetooth** on a computer usually delivers updates every 11–15 ms, sometimes slower.
   - **A USB receiver using its own 2.4 GHz signal**, like gaming mice use, can deliver updates
     every ~1 ms.
   - → **We use a USB receiver**, and keep Bluetooth as a backup so it still works without the
     receiver.
4. **Your screen.**
   - A normal 60 Hz screen adds up to ~17 ms by itself.
   - A 120 Hz+ screen roughly halves that.
   - This isn't something the controller can fix, but it's worth knowing.

### Lag-cutting rules (what we'll actually do)

1. **USB receiver, 1000 updates per second.** Bluetooth is a backup only, labeled "slow mode."
2. **Send every reading immediately.** Nothing is saved up and sent in batches.
3. **Read the sensor 1000+ times per second**, and set the sensor's own built-in smoothing to its
   fastest setting.
4. **Use the lowest-noise sensor we can get.** A cleaner signal needs less smoothing, and less
   smoothing means less lag. This is why the ICM-42688-P is the favorite.
5. **Smooth only when your hand is almost still** (to kill shake). When you move, the smoothing
   gets out of the way.
6. **Try "prediction" in testing.** Guess where the cursor will be a few milliseconds ahead from
   how fast your hand is turning; VR headsets do this. We keep it only if it doesn't overshoot.
7. **Test against wired.** Plug the controller straight into USB with a cable as the "fastest
   possible" reference. The wireless version must match it within ~1 ms.
8. **Screen:** a 120 Hz or faster monitor is the single biggest lag cut outside the controller
   (up to ~8 ms). This is recommended but not required.
9. **Later, in the DAW (Phase 5):** highlights and other on-screen feedback must keep up with the
   cursor. A laggy highlight feels like a laggy controller.

---

## The options we considered

| Option | How it works | Lag | Smooth | Needs extra gear | Verdict |
|---|---|---|---|---|---|
| **1. Air mouse (motion sensor)** | Sensor feels your hand rotate, and the cursor moves by that much | ★★★ very low | ★★★ with filtering | Just a USB receiver | **✅ Chosen** |
| 2. Motion sensor + compass | Uses a compass to know exactly which way you point | ★★★ | ★★ | None | ❌ Studio speakers have magnets that throw the compass off |
| 3. Wii-style light bar | Tiny camera on your hand sees a light bar under the screen | ★★★ | ★★ | Light bar at the screen, a camera on the hand | ⏸ Upgrade path if needed |
| 4a. Webcam watches your hand | Computer vision tracks your hand, no wearable | ★ slow | ★ shaky | Webcam | ❌ Too laggy for a cursor. Fine for quick experiments |
| 4b. IR camera tracks a light on your ring | Like head-tracking gear used for flight sims | ★★ | ★★ | Camera near the screen | ❌ More setup, no big win over option 1 |
| 4c. Leap Motion / Ultraleap | Special camera tracks your bare hand | ★★ | ★★ | Camera on the desk | 🔍 Used only as a comparison in testing |
| 5. Air mouse + light bar (hybrid) | Option 1 for speed, option 3 now and then to fix alignment | ★★★ | ★★★ | Light bar | ⏸ The upgrade path from option 1 |
| 6. Radio positioning (UWB), magnetic trackers, ultrasound | Various | – | – | Base stations | ❌ Too coarse, or disturbed by studio gear |

**Why the air mouse wins:**
- It's the fastest option.
- It stays smooth with good filtering.
- It needs nothing on your desk except a USB stick.
- It works from any angle, even if you're not facing the screen.
- It's the smallest to wear.

LG's TV "Magic Remote" and older Gyration air mice already use this approach successfully.

**The one weakness:** it tracks *how much* your hand turns, not *exactly where* it points. Over
time the cursor can stop lining up with your finger, like picking a mouse up and setting it down
somewhere else. That's fixed with a quick re-center gesture or a voice command. If that still
bothers you in testing, we add the light bar (option 5).

---

## The question testing has to answer: where does the sensor go?

| Spot | Likely feel |
|---|---|
| Wrist | Steadiest, but big arm-style movements |
| Back of hand | Steady, and moderately fine |
| Base of the index finger (ring position) | Finer control, a little more shake |
| Fingertip / fingernail | Most precise and expressive, and the shakiest |

We don't know which is best yet, so we'll test all four. This result also decides the shape of
the device in Phase 3.

---

## How Phase 1 testing works (parts in the [README shopping list](README.md#phase-1-shopping-list))

**Setup**
- **Test controller A:** a XIAO board using its built-in motion sensor.
- **Test controller B:** a XIAO board with the lower-noise ICM-42688-P sensor wired on.
- Both talk to the computer through the Nordic USB receiver.
- Velcro straps move them between the wrist, back of hand, finger base and fingertip.
- **Comparisons:** your normal mouse and, optionally, the Leap Motion.

**What we measure** (Claude writes a test app that does most of it automatically)
1. **Lag (most important):**
   - Film your hand and the screen together in 240 fps slow motion, then count frames between
     your hand moving and the cursor moving. If your phone has a 960 fps "super slow-mo" mode,
     use it for finer detail.
   - Film a **wired gaming mouse** the same way as the reference.
   - The test app also logs the controller-to-computer delay on every single update.
2. **Shake:** hold still for 10 seconds, and the app measures how much the cursor wiggles.
3. **Accuracy:**
   - a standard "click the targets as fast as you can" test (the same kind used to rate real
     mice);
   - a DAW-style version: hit 1-beat slots and small knobs.
4. **Drift:** use it for 10 minutes and count how often you need to re-center.

**How we pick the winner:** **lowest lag first.** Among the setups within ~1–2 ms of the fastest
one, pick the one with the best accuracy and least shake.

---

## What comes after this

- **02: Pinch and gestures.** Different kinds of pinch:
  - tap, hold and double-tap;
  - thumb-to-index vs thumb-to-middle;
  - click and drag;
  - **pinch-and-twist for knobs**: pinch to grab the knob (the cursor freezes so the knob stays
    selected), twist your wrist to turn it, and let go and re-grab to keep turning, like a real
    knob.
- **03: Shape and fit.** Decided by this test's sensor-position result plus what pinch sensing
  needs.
- **04: Battery and charging.**

---

## Technical details (optional reading)

- **Pointer model:** relative pointing. Gyro angular rate (yaw → x, pitch → y) is multiplied by a
  gain curve, and the result becomes the cursor delta. Roll is reserved for knob twist (doc 02).
- **Why not absolute orientation:** a 9-axis fusion needs a magnetometer for heading.
  Studio-monitor magnets and steel racks distort it, which causes heading drift. 6-axis fusion
  has no absolute yaw reference.
- **Sensors:**
  - Candidates are the TDK ICM-42688-P (low gyro noise), ST LSM6DSV and Bosch BMI270.
  - The XIAO Sense's built-in IMU (LSM6DS3TR-C family) is the baseline.
  - Use a gyro output rate of ≥ 400 Hz internally, and 200–1000 Hz reports to the host.
- **Sensor latency:**
  - The ICM-42688-P supports gyro ODR up to 32 kHz. Run 1–8 kHz and pick the internal
    anti-alias/UI filter setting with the lowest group delay.
  - Read with a data-ready interrupt, not polling.
- **Prediction:** extrapolate the cursor by ω × t_pred, with t_pred ≈ the measured downstream
  latency. It's clamped and gated off at high angular acceleration to avoid overshoot.
- **Smoothing:**
  - The 1€ filter (Casiez, Roussel & Vogel, CHI 2012) cuts jitter at low speed while keeping lag
    low at high speed.
  - Accumulate sub-pixel deltas so slow motion isn't lost to rounding.
  - Automatic gyro-bias re-estimation whenever the device is detected as stationary.
  - A precision mode (lower gain) for fine edits.
- **Radio:**
  - The primary link is nRF52840 ↔ nRF52840 dongle over Nordic Enhanced ShockBurst
    (proprietary 2.4 GHz), which gives ~1 ms report intervals.
  - Transmit on the IMU data-ready interrupt, with no batching.
  - Send a running cumulative motion counter instead of raw deltas. Then a dropped packet doesn't
    lose motion, and retries can stay at 0–1 (retries add jitter).
  - The dongle is USB full-speed, so a 1 ms interrupt poll is the floor. 4–8 kHz polling would
    need a high-speed USB receiver chip. That saves under 1 ms, so it's a possible later
    optimization, not a Phase 1 item.
  - The fallback is BLE HID mouse. The 7.5 ms minimum connection interval is often negotiated
    up to 11.25–15 ms by desktop OSes.
- **Latency budget (goal):**
  - sensor + filter ≤ 5 ms;
  - radio ≤ 2 ms (ESB);
  - host input path ≤ 5 ms;
  - display: up to 16.7 ms on a 60 Hz screen.
- **Upgrade path (hybrid):**
  - Put a PixArt-class IR blob-tracking sensor on the hand and IR LEDs at the screen, as the
    Wii remote did.
  - Fuse the absolute IR fix with the gyro in a complementary filter. The gyro gives
    responsiveness, and the IR slowly corrects long-term misalignment.
- **Test methods:**
  - ISO 9241-411 multidirectional tapping gives Fitts' law throughput and error rate.
  - Latency comes from 240 fps video, counting frames from motion onset to cursor onset (~4.2 ms
    resolution).
  - Jitter is cursor position RMS over 10 s at rest.
