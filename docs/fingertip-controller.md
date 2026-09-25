# Fingertip Controller — "Put That There" for the Smart DAW

Status: draft design · 2026-09-25

## Why

Voice alone makes the user *describe* things the eye can already see:

> "Take the second vocal region on the Lead Vox track, the one starting around
> bar 17, and move it to bar 33 on the Vox Double track."

A pointer collapses every noun phrase that names a place or object into a
gesture:

> "Move **this** over **here**." *(pinch … pinch)*

Voice carries the **verb** (what to do), and the finger carries the **nouns**
(which thing, and where). The idea is old and proven: Bolt's *Put-That-There*
(MIT, SIGGRAPH 1980). The difference now is that ASR, an LLM for intent
parsing and a tiny BLE ring make it practical.

Design goal: **the ring is optional at every moment.** Voice-only still works,
the ring alone works as a plain mouse, and together they do more than either.

---

## 1. Interaction model

### 1.1 Gesture vocabulary (keep it tiny)

| Gesture | Meaning | Notes |
|---|---|---|
| **Point** | Move the cursor and hover-highlight the target under it | Always on while the ring is engaged |
| **Pinch-tap** | Drop a **mark** (a numbered pin) *or* click, if no speech is active | The main primitive |
| **Pinch-hold + move** | Drag, or sweep a **range** (time selection or multiple regions) | Direct manipulation, no voice needed |
| **Pinch pressure** | Precision mode: a harder squeeze lowers cursor gain | Fine edits without "zoom in" commands |
| **Thumb swipe on pad** | Scroll / zoom (axis set by swipe direction) | |
| **Double pinch-tap** | Confirm the pending action (same as saying "do it") | |
| **Flick / shake** | Cancel and clear marks | Also: "never mind" |

Everything else is voice. Don't grow the gesture set, because each new
gesture is more training for the user and another source of false positives.

### 1.2 Marks: the core concept

A **mark** is a timestamped snapshot taken on pinch-tap:

```
Mark {
  t_device, t_host        // when it happened (shared clock, see §3.1)
  screen_xy               // where the pointer was
  target                  // SEMANTIC hit-test result, resolved immediately:
                          //   { kind: region, id: "rgn_842", track: "Lead Vox" }
                          //   { kind: position, track: "Vox Dbl", beat: 129.0 }
                          //   { kind: param, plugin: "EQ", param: "Band 3 Gain" }
  index                   // 1, 2, 3… shown on screen as a numbered pin
}
```

Rules:

1. **Resolve the target at mark time, not execution time.** The view may
   scroll or zoom before the sentence ends, so store the region ID and beat
   position, not pixels.
2. Marks queue **in the order they happened**. Deictic words in the utterance
   ("this", "that", "here", "there", "these", "from … to …") bind to marks in
   order.
3. Marks expire after a command runs or after ~8 s idle, or when the user
   cancels.
4. Every mark shows on screen right away as a numbered pin, so the user sees
   what the system saw.

### 1.3 Worked examples

| User does | System receives | Result |
|---|---|---|
| "Move this ⟨pinch A⟩ over here ⟨pinch B⟩" | move(region A → track/beat B) | Region moved, snapped to grid |
| "Copy this ⟨A⟩ here ⟨B⟩, here ⟨C⟩ and here ⟨D⟩" | copy(A → [B, C, D]) | Three copies |
| "Fade from here ⟨A⟩ to here ⟨B⟩" | fade(range A–B) | |
| ⟨pinch-drag sweep⟩ "…loop that" | loop(range) | Sweep makes a range mark |
| "Make this ⟨A⟩ as loud as that ⟨B⟩" | match_loudness(A, ref=B) | Two marks carry different roles |
| "Solo" (while hovering a track, no pinch) | solo(hover target) | Hover is a fallback when no pinch happened |
| ⟨pinch-drag region⟩ (no speech) | plain drag | Works like a mouse |

### 1.4 The pointer doesn't need to be pixel-precise

A DAW has meaningful snap targets: bar lines, beats, region edges, transients,
track lanes. "Here" snaps to the nearest meaningful target given the verb
(moving a region snaps its start to the grid, "split here" snaps to the nearest
transient or grid line, and so on). This is the main reason an air pointer
works for editing: the system resolves intent instead of trusting pixels.
Pressure-based precision mode covers the cases where the user really does
want a raw position.

### 1.5 Feedback and safety

- Show a **ghost preview** of the pending action (outline of where the region
  will land).
- Reversible actions run immediately and stay one "undo" away. Destructive or
  large actions (delete a track, bounce, anything that touches many items)
  wait for a double pinch or "do it".
- Keep one unified undo stack for voice, ring and mouse actions.

---

## 2. Hardware

### 2.1 Recommended form factor: one ring, not two

One ring worn on the **index finger** (proximal or middle phalanx), with a
small **touch + force pad on the thumb-facing side**. "Pinch" means the thumb
pressing that pad.

Why one device instead of separate thumb and index pieces:

- One battery, one radio, one charger, and nothing to pair twice.
- Pinch sensing is a direct contact measurement: fast, with no pinch
  inference from motion and so fewer false triggers.
- Pressure (force sensor) comes free, which gives precision mode.
- The pad doubles as a swipe surface for scroll and zoom.

A two-piece thumb+index design (conductive pads that close a circuit on
contact) is a possible v2 if the one-ring pinch feels unnatural. It costs a
second battery or a thin flex link across the web of the hand.

### 2.2 Components (prototype)

| Part | Suggestion | Why |
|---|---|---|
| MCU + radio + IMU | **Seeed XIAO nRF52840 Sense** (21 × 17.5 mm; BLE 5, 6-axis IMU, LiPo charger on board) | Off-the-shelf, tiny, and good enough to validate everything |
| Pinch sensor | Thin FSR (force-sensitive resistor) under a capacitive touch pad | Touch = contact, FSR = pressure |
| Haptics (optional) | Tiny LRA or ERM coin motor | Tick on mark and on snap, so you can confirm without looking |
| Battery | ~40–80 mAh LiPo | Roughly a day of use (estimate; measure it) |
| Shell | 3D-printed ring, adjustable band or sized inserts | |

Prototype weight will be roughly 8–12 g. A custom PCB could plausibly reach
under 5 g in production.

### 2.3 Pointing: relative "air mouse" first

- **v1: gyro-relative pointing**, as used by LG Magic Remote and Logitech air
  mice. Wrist and finger rotation moves the cursor. There's no drift problem
  because the pointer is relative (like a mouse), and a quick "re-center"
  gesture or voice command recovers it.
- **Absolute pointing** (true Wii-style "point at the screen") needs an
  external reference: an IR bar plus a camera on the ring (as the Wii does),
  UWB anchors, or a webcam tracking the hand. Defer this. Relative pointing
  plus semantic snapping is likely enough for a screen at desk distance.

### 2.4 Latency and signal budget

| Stage | Target |
|---|---|
| IMU sample rate | 100–200 Hz |
| BLE connection interval | 7.5–15 ms |
| Motion → cursor on screen | < 20–30 ms total (feels "attached") |
| Pinch → mark visible | < 50 ms |

Filtering: use the **1€ filter** (Casiez et al., CHI 2012). It smooths
tremor when the hand is still and stays responsive during fast moves, and it's
standard for exactly this problem.

**"Heisenberg" effect:** the act of pinching nudges the finger, which moves
the cursor just as you click. Fix: on pinch onset, take the mark position from
the cursor about 50–100 ms *before* the pinch began, from a short ring buffer
of recent positions. Tune the offset by testing.

### 2.5 Musician-specific constraints

- **It must not interfere with playing.** A ring on the index finger may
  bother keyboard or guitar players. Test with real instruments early, and
  consider the middle finger or a thumb-worn variant.
- **Engage/disengage:** while the user is playing, hand motion must not move
  the cursor. Options: auto-sleep when MIDI or audio input is active, a
  "pinch-and-hold 300 ms" wake, or voice ("pointer on").
- Sweaty hands, gloves and stage lighting all argue for contact/force pinch
  sensing over optical sensing.

---

## 3. Software: multimodal fusion

This is the hard part and the real product. The hardware only produces
timestamped events.

### 3.1 One clock for everything

Every input carries a timestamp on a **shared host clock**:

- Ring: device-side timestamps, mapped to host time with periodic sync pings
  (estimate the offset from round-trip time).
- Speech: ASR with **word-level timestamps** (Whisper supports this, and so
  do most streaming ASR engines).
- Mouse/keyboard: OS event timestamps.

**Align by timestamp, not by arrival order.** Speech lags: the transcript for
"here" may arrive 300 ms–1 s after the pinch. "Execute in the order inputs
were received" has to mean *the order they happened*, reconstructed from
timestamps.

### 3.2 Pipeline

```
 Ring (BLE) ──► Pointer stream ──► 1€ filter ──► Cursor + hover hit-test
          └──► Pinch events ────► Mark builder (semantic hit-test, snapshot)
                                          │
 Mic ──► Streaming ASR (word timestamps) ─┤
                                          ▼
                              Fusion / Deixis resolver
                    (bind "this/here/that/there" → marks by time + order)
                                          │
                                          ▼
              Intent parser (LLM or grammar) receives a GROUNDED transcript:
   "move [M1: region 'Vox take 3', Lead Vox, bar 17.2]
    over [M2: track 'Vox Dbl', bar 33.1]"
                                          │
                                          ▼
                     Action planner ─► Ghost preview ─► Execute / Undo
```

### 3.3 Deixis binding rules (initial heuristic)

1. Find deictic tokens in the utterance, in spoken order.
2. Bind them to marks **in order**. With N deictics and N marks, it's a direct
   match.
3. If there are fewer marks than deictics, bind each unmatched deictic to the
   **hover target** at that word's timestamp (pointing often lands slightly
   *before* the word, so look in a window of about −800 ms to +300 ms).
4. If there are more marks than deictics, treat the extras as a list ("here,
   here and here" or a trailing "…and these").
5. If it's still ambiguous, ask, pointing at the candidates ("This region or
   the whole track?"). Don't guess on destructive actions.

Handing the intent parser a grounded transcript is the main win. It never
has to work out *which* region from language, only *what to do* with
already-identified objects. That makes voice command training much simpler,
as intended.

### 3.4 Transport to the host

- The ring exposes **two BLE profiles**:
  - **Standard HID mouse**, so the ring works as a basic mouse in any DAW and
    OS with zero software.
  - **Custom GATT service**, which streams timestamped IMU, pinch and pressure
    data to the smart-DAW companion app for full fusion.
- The companion app talks to the DAW engine through its own API, or for
  third-party DAWs through OSC, MIDI or a plug-in bridge (open question).

---

## 4. Build plan

Validate the **interaction** before building hardware.

1. **Phase 0: no hardware (days).** Use webcam hand tracking (MediaPipe Hand
   Landmarker) to get pointer + pinch, plus Whisper with word timestamps.
   Build the mark queue, deixis resolver and ghost preview against a mock
   timeline UI. This answers whether "move this over here" actually feels
   good.
2. **Phase 1: breadboard ring (weeks).** XIAO nRF52840 Sense, FSR pad and a
   velcro strap. Stream over custom GATT and swap it in for the webcam
   pointer. Tune the 1€ filter, the Heisenberg offset and precision gain.
3. **Phase 2: wearable prototype.** 3D-printed ring, LiPo and haptics. Test
   with real instruments and long sessions (comfort, battery, false pinches).
4. **Phase 3: custom PCB and industrial design.** Weight under 5 g, sizing,
   charging (a small dock or pogo pins).

---

## 5. Open questions

- **Which DAW?** A custom smart DAW, or an assistant layered on
  Ableton/Logic/Reaper? This decides the whole integration layer (Reaper has
  the most scriptable API, and Ableton has a Python remote-script layer plus
  Max for Live).
- **Hand and finger:** dominant hand? Does the user also play an instrument
  during sessions?
- **Screen setup:** a single laptop screen at arm's length vs a large studio
  display or multiple monitors. This decides whether relative pointing is
  enough.
- **Speech trigger:** always-listening with a wake word, or push-to-talk
  (e.g., a pinch-hold starts listening)? Push-to-talk on the ring is cheap
  and removes wake-word false triggers, so it's the likely good default.
