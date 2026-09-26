# The Controller: a tiny wearable pointer for the smart DAW

## Short version

- We're building a small device you wear on your hand. It moves the cursor, and later it will
  pinch, click, drag and turn knobs.
- **Lowest lag is the #1 priority.** When lag and anything else conflict, lag wins.
- **Step one is getting the cursor to feel perfect**: instant and smooth, with no shake and no
  drift. Everything else (pinch types, knob turning, the device's final shape) comes after that.
- **The plan is to use a motion sensor**, the same kind of chip that knows how your phone is
  tilted. It talks to the computer through a small USB receiver, the way a wireless gaming mouse
  does. The reasons are in [01-cursor-tracking.md](01-cursor-tracking.md).
- **Phase 1 costs roughly $90–120 in parts.** We test the sensors on different spots on your hand
  and measure which one feels best. The shopping list is below.
- You wear it only while editing and mixing, not while playing.

---

## Phases

Each phase answers one question. We don't buy parts for a phase until the one before it is done.

### Phase 1: Tracking test ← **we are here**
**Question:** What gives the smoothest, fastest cursor, and where on the hand should the sensor sit?
- **You:** buy the parts below, and solder a few wires (step-by-step guide provided). Wear the
  test rigs and run the test app.
- **Claude:** writes the software for the boards and the receiver, plus a test app on your
  computer that measures lag, shake and accuracy.
- **Done when:** we find the setup with the **lowest lag**, matching a wired gaming mouse within
  a couple of milliseconds, that is also accurate enough for editing.

### Phase 2: Pinch and knob gestures
**Question:** How does the device sense different pinches (tap, hold, double-tap,
thumb-to-index vs thumb-to-middle) and "pinch and twist" to turn a knob?
- We'll try a few pinch sensors: a touch or pressure pad, a tiny magnet on the thumbnail, and
  tap detection.
- **Shopping list:** written after Phase 1. Expect it to be small (under about $40).

### Phase 3: Shape and fit
**Question:** What does it physically look like: one ring, two rings, a thumbnail piece, a
wristband?
- This depends on where Phase 1 says the sensor works best and what Phase 2 needs for pinching.
- This phase is about 3D-printed shells, trying them on, and making it light.

### Phase 4: Battery and charging
**Question:** How long does it last, and how do you charge it?
- Measure battery life, pick the battery size and design a small charger or dock.

### Phase 5: Connect it to the DAW
**Question:** Does "move **this** over **there**" work with voice + pointing?
- This is where the voice assistant and the controller come together. See
  [../fingertip-controller.md](../fingertip-controller.md).

---

## Phase 1 shopping list

Prices are approximate (late 2025 / 2026). Check them when you buy. Search the **exact name** in
the "Search for" column. Seeed Studio, DigiKey, Mouser, Adafruit, SparkFun and Amazon all carry
most of these.

| Search for | What it is, in plain words | Qty | ~Price | Needed? |
|---|---|---|---|---|
| **Seeed Studio XIAO nRF52840 Sense** | A thumbnail-sized computer with a motion sensor and wireless built in. This is the test "controller." | 2 | $16 each | **Yes** |
| **Nordic nRF52840 Dongle** (part number PCA10059) | A USB stick that receives the controller's signal. It's faster than Bluetooth, like a gaming mouse receiver. | 1 | $10 | **Yes** |
| **ICM-42688-P breakout board** | The favorite motion sensor. It's lower-noise, so it needs less smoothing, which means less lag. It wires onto the second XIAO and gets compared with the built-in one. | 1 | $15–20 | **Yes** |
| **3.7V LiPo battery, 100–150mAh, with protection circuit** (single cell, flat, 2 wires) | Makes the test rigs wireless. About postage-stamp size. See "Battery notes" below. | 2 (+2 spares) | $5–8 each | **Yes** |
| Velcro straps / finger straps (a small assorted pack) | Hold the boards on your wrist, the back of your hand, your finger. | 1 pack | $8 | **Yes** |
| USB-C cable (data, not charge-only) | Loads the software onto the boards. | 1–2 | $5 | If you don't have one |
| Jumper wires + pin headers (small kit) | Connect the second sensor. | 1 kit | $6 | **Yes** |
| Soldering iron kit (basic, with solder) | Attaching wires and batteries. | 1 | $25–40 | If you don't own one |
| A wired gaming mouse (any 1000 Hz mouse) | The "fastest possible" reference we measure the controller against. | 1 | $0 if you have one, ~$25 if not | **Yes** |
| **Ultraleap Leap Motion Controller 2** | A camera that tracks bare hands. It's a comparison benchmark, not part of the product. | 1 | ~$140 | Optional |

**Battery notes**
- **3.7V, single cell** (sometimes written "1S"). Not 7.4V.
- **100–150mAh.** The XIAO charges gently (50–100mA), and this size suits that. It should
  last a full day of testing (estimate, to be measured).
- **Must say "with protection board/circuit."** It's a tiny safety board under the tape that stops
  over-charging and short circuits.
- **Size codes:** names like `401230` mean thickness 4.0mm × width 12mm × length 30mm. Pick
  one around 20–30mm long.
- **Wires:** bare wires or a small plug are both fine (the plug gets cut off). If you cut wires,
  cut **one at a time** so they never touch.
- **Safety:** don't bend or puncture it. Charge it on a hard surface, not a bed or couch. Stop
  using it if it swells.
- The final ring (Phase 3/4) will likely use a smaller, curved battery. That's decided later.

**You'll also need:** a phone that records slow-motion video at 240 fps (most recent iPhones and
Androids do). We use it to measure lag by filming your hand and the screen together.

**Worth knowing:** if your monitor runs at 60 Hz, a **120 Hz or faster monitor** is the biggest
lag cut outside the controller (up to ~8 ms). It's not needed for testing and isn't in the totals.

**Rough totals**
- Required parts only: **about $90**
- Plus a soldering kit: **about $120**
- Plus the optional Leap Motion benchmark: **about $260**

---

## Decisions so far

- **Lowest lag is the top priority.** It's the first test result we judge by.
- **Pointing alone selects.** "Move **this**" means whatever you're pointing at. No pinch is
  needed.
- **Where it goes can come from pointing or from voice:** "over there", "to 5", "up", "to a new
  track". Numbers are read in context: on a pan knob, "5" is a pan value; on a region, it's a
  position. We're keeping the command list open-ended on purpose.
- **Tracking comes first.** The device's shape is decided after we know where the sensor works
  best.
- **Worn only for editing and mixing**, not while playing an instrument.

## Documents

| File | What's in it |
|---|---|
| [01-cursor-tracking.md](01-cursor-tracking.md) | Which tracking method we chose and why, plus how Phase 1 testing works |
| [../fingertip-controller.md](../fingertip-controller.md) | The original big-picture concept (voice + pointing in the DAW). Parked until Phase 5. |
