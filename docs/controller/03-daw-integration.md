# 03: Making it work in Pro Tools, Logic, Ableton and other DAWs

## Short version

- **Pointing already works in every DAW, today.** The receiver is a normal USB mouse, so the ring
  moves the real cursor in Pro Tools, Logic, Ableton, Cubase, Reaper and everything else. There's
  no DAW support to build for this part.
- **Yes, we can "Trojan horse" in.** We can speak **Mackie Control / HUI**, the language every
  major DAW already understands from hardware mixers. The DAW thinks a Mackie-style control
  surface is plugged in. This gives us knobs, faders, transport, track select, zoom and
  "go to bar 5" in all major DAWs. It's the standard, supported way every third-party controller
  does it, so no hacking is needed.
- **The hard part is "move *this*".** Knowing *which region* you're pointing at needs each DAW's
  own scripting hooks. Ableton, Pro Tools and Reaper have good ones, and Logic is the weakest.
  There's a trick that works everywhere: **point, the ring clicks, the DAW selects it, and then we
  ask the DAW "what's selected?"**
- **A second, "ghost" cursor is possible.** A small helper app can draw our own pointer on top of
  the screen, so the ring and your normal mouse don't fight over one cursor.
- **The recommended build is three layers**, each useful on its own (details below). Pointing
  keeps its lowest-lag path the whole time.

---

## The three layers

| Layer | What it does | Works in | Build effort |
|---|---|---|---|
| **1. Mouse + keyboard** (USB HID) | Move, click, drag, scroll; pinch = click; pinch-and-twist = drag a knob; send shortcuts | **Every DAW**, no setup | Small: add click/keyboard to the current firmware |
| **2. Control surface** (Mackie Control / HUI over MIDI) | Knobs, faders, transport, select/mute/solo, zoom, jump to bar, read track names back | Pro Tools (HUI), Logic, Ableton, Cubase, Studio One, Reaper, Bitwig, FL Studio | Medium: runs in a helper app on the computer |
| **3. DAW adapters** (each DAW's scripting) | "Move **this** clip **there**", "to bar 5", "up a track", knowing what's under the pointer | One adapter per DAW | Medium to large per DAW |

The **helper app** is a small program on the computer that sits between the receiver, your voice
and the DAW. Layers 2 and 3 live there, not in the ring. That way DAW updates never mean
re-flashing hardware.

```
 Ring ──radio──► Receiver ──USB mouse──────────────────────────────► OS cursor (layer 1, fastest)
                          └─USB serial──► Helper app ──Mackie/HUI MIDI──► DAW (layer 2)
                                   voice ─┘         └─DAW scripting API──► DAW (layer 3)
```

---

## Your question 1: can we "Trojan horse" through an existing controller signal?

**Yes, and it's the normal way controllers work.** DAWs support a few control-surface
"languages":

| Language | What it is | Who supports it | Usable by us? |
|---|---|---|---|
| **Mackie Control (MCU)** | MIDI messages for 8 channel strips, knobs, transport, jog wheel, buttons and a text display | Logic, Ableton, Cubase, Studio One, Reaper, Bitwig, FL Studio, and others | ✅ **Yes.** Widely documented; controllers from Behringer, PreSonus, Icon and SSL speak it. |
| **HUI** | The older Mackie/Digidesign protocol | **Pro Tools** (still officially supported), plus Logic, Cubase, Reaper | ✅ **Yes.** This is our way into Pro Tools. |
| **EuCon** | Avid's Ethernet protocol | Pro Tools, Logic, Cubase/Nuendo | ❌ Needs an Avid partnership and licence |
| **Logic's OSC / control-surface plug-ins** | Apple's own | Logic | ❌ Custom plug-ins are for Apple-authorised developers only |
| **Plain MIDI "learn"** | Map a knob to any parameter | Ableton, Logic, Cubase, Reaper, Bitwig | ✅ Yes (Pro Tools has no general MIDI learn) |

**How we'd do it:** the helper app creates a **virtual MIDI port** and speaks Mackie Control (or
HUI for Pro Tools). In the DAW's settings you add a "Mackie Control" device and pick that port.
Done. Two options for where that MIDI comes from:
- **Recommended:** the helper app makes it, so it's easy to update.
- **Alternative:** the receiver dongle itself shows up as a USB-MIDI device. Zephyr, the
  system our firmware runs on, has a USB-MIDI class that includes plain MIDI 1.0. That works
  with no helper app at all, but only for the fixed layer-2 features.

**What Mackie/HUI gives us:**
- turning knobs (the "V-Pots"), including plug-in parameters;
- faders;
- play, stop and record;
- scrub and jog;
- selecting, muting and soloing tracks;
- zoom;
- moving between tracks and markers;
- the display text coming back from the DAW (track names, timecode). That feedback lets the
  voice assistant know what's selected.

**What it doesn't give us:** it knows nothing about *regions/clips on the timeline*. There's no
"select the clip at this spot" or "move this clip". That's layer 3.

**One thing not to do:** pretending to be a specific product (copying e.g. a Behringer X-Touch's
USB ID) isn't needed. Every DAW lets you choose "Mackie Control" or "HUI" generically, and faking
another company's ID is legally iffy.

---

## Your question 2: can we emulate a cursor on screen?

Two ways, and we can offer both:

**A. Move the real cursor** (what the firmware does now)
- Works everywhere, with the lowest lag (the path we just built).
- Downside: the ring and your mouse share one cursor. If both move, they fight.

**B. A "ghost" cursor drawn by the helper app**
- The helper app draws its own pointer in a transparent layer on top of everything. The ring
  moves the ghost; your mouse keeps the real cursor.
- When you say "move **this**…" or pinch, the helper app briefly jumps the real cursor to the
  ghost's spot, clicks or drags, and puts it back. macOS and Windows both allow this with
  permission (macOS asks for *Accessibility* access once).
- Upsides: two pointers at once, and the ghost can show extra information (the numbered pins
  from the design doc, "locked on: Vox take 3").
- Downside: about one screen refresh of extra lag for the ghost (~8–16 ms), since it's drawn by
  an app, not the system cursor. **We'd keep mode A as the default for pure pointing** and use the
  ghost as an option.

---

## The hard part: "move **this** over **there**"

The voice assistant needs to know *what* "this" is: a clip, a track, a knob. Three ways, from most
to least universal:

1. **Point, click, ask.** This works in every DAW. The ring clicks where you point, and the DAW's
   own click selects the clip. Then the helper app asks the DAW "what's selected?" through its
   script hook, its Mackie display, or macOS Accessibility. We never have to work out the DAW's
   graphics ourselves.
2. **Ask the DAW what's under the pointer.** This needs a real scripting API. Reaper can do it
   directly; Ableton and Pro Tools mostly through their APIs.
3. **Look at the screen.** Fallback for anything else: grab a small screenshot around the pointer
   when you say "this", and let a vision model identify it. It's slower (~0.5–1 s) but fine for
   commands, since it isn't used for pointing.

For "**there**", the most portable trick is **"move to playhead"**:
- Jump the playhead to the target spot. Pointing, "bar 5" and Mackie's locate commands all
  can do this.
- Then run the DAW's own "move selection to playhead" command.
- Logic has one built in (*Pickup Clock*). Reaper and Pro Tools can do it through their APIs. For
  others we'd check each one.

### DAW by DAW

| DAW | Pointing & clicks | Knobs / transport | "What's under the pointer / selected" | Moving clips | Overall |
|---|---|---|---|---|---|
| **Reaper** | ✅ | ✅ Mackie + native OSC | ✅ Excellent (ReaScript can ask "item under mouse") | ✅ Full scripting | **Easiest: best for our first prototype** |
| **Ableton Live** | ✅ | ✅ Mackie + MIDI learn | ✅ Good (Python Remote Scripts / Live Object Model; several open-source AI "MCP" bridges already do this) | ✅ Mostly | **Good** |
| **Pro Tools** | ✅ | ✅ HUI | ✅ Good: Avid's free **Pro Tools Scripting SDK (PTSL)**, 150+ commands incl. clip info, selection, editing; open-source Python and AI bridges exist | ✅ Mostly | **Good** (knobs limited: HUI only, no MIDI learn) |
| **Logic Pro** | ✅ | ✅ Mackie (very good) | ⚠️ No official API. Workable via macOS Accessibility + key commands + Mackie; existing AI bridges combine exactly these | ⚠️ Via click + Pickup Clock / key commands | **Hardest, but proven doable** |
| **Cubase / Nuendo** | ✅ | ✅ Mackie + MIDI Remote scripts | ⚠️ Limited editing API | ⚠️ Key commands | Medium |
| **Bitwig** | ✅ | ✅ Mackie + rich Java/JS API | ✅ Good | ✅ | Good |
| **Studio One / FL Studio** | ✅ | ✅ Mackie (+ FL's Python MIDI scripts) | ⚠️ Limited | ⚠️ Key commands | Medium |

**Prior art worth knowing:** people have already built open-source "AI assistant controls my DAW"
bridges for Ableton, Pro Tools (on PTSL) and Logic (Accessibility + Mackie + MIDI + AppleScript).
They validate the approach, and we can learn from them or reuse them where the licences allow.
Ours adds what they don't have: **pointing**, so "this/there" come from your hand instead of
long descriptions.

---

## Knobs with pinch-and-twist, everywhere

- **Universal (layer 1):** pinch on a knob and the ring holds the mouse button; twisting your wrist
  then drags up and down. Every DAW turns knobs that way, and holding a modifier key gives fine
  control. The receiver can send that modifier itself once it also acts as a keyboard.
- **Better (layer 2):** knobs selected through Mackie Control turn by relative steps: smooth, no
  jumps, and they work even when the knob is tiny on screen.

## What changes in the hardware and firmware

Very little:
- **Now:** add mouse **buttons** (pinch → click/drag) and a **keyboard** interface to the
  receiver's USB. Both are standard HID, with no drivers.
- **Later, optional:** a USB-MIDI interface on the receiver, for a helper-app-free Mackie mode.
- The ring, the radio and the lag path stay exactly as they are.

## Suggested order (becomes Phase 5)

1. **5a: Universal basics.** Pinch = click/drag, twist = knob drag, a few voice-triggered key
   commands. Works in all DAWs.
2. **5b: Helper app** (macOS first if you're on a Mac). Voice input, the ghost cursor option, and
   Mackie/HUI over a virtual MIDI port.
3. **5c: First deep adapter for *your* main DAW**, using "point, click, ask", "move to playhead"
   and "to bar 5".
4. **5d: More DAW adapters.** Reaper is quickest to add as a reference.

## Risks and honest limits

- **Logic** has no official editing API, so the Accessibility-based parts can break when Apple
  updates Logic. Mackie + key commands are stable.
- **Pro Tools** knob control is limited to HUI. EuCon would be better but needs an Avid
  partnership.
- The helper app needs **Accessibility / Input Monitoring** permission on macOS, and it must run
  while you work.
- DAW updates can change key commands or APIs; adapters need occasional maintenance.

## Question for you

**Which DAW do you use most?** That decides which adapter we build first (step 5c) and whether
the helper app starts on macOS or Windows.

## Sources

- [Avid: Pro Tools Scripting SDK](https://www.avid.com/resource-center/pro-tools-scripting-sdk), [py-ptsl (Python PTSL client)](https://github.com/iluvcapra/py-ptsl), [Pro Tools MCP server](https://github.com/skrul/protools-mcp-server)
- [Human User Interface protocol (HUI)](https://en.wikipedia.org/wiki/Human_User_Interface_Protocol), [Control surface protocols compared: EuCon, HUI and beyond](https://www.production-expert.com/production-expert-1/control-surface-protocols-compared-eucon-hui-and-beyond), [Mackie Control protocol notes (TouchMCU)](https://github.com/NicoG60/TouchMCU/blob/main/doc/mackie_control_protocol.md)
- [Logic Pro OSC message paths (Apple)](https://support.apple.com/guide/logicpro/osc-message-paths-ctlsf67f4bdc/mac), [TouchOSC setup for Logic](https://hexler.net/touchosc/manual/setup-logic), [Logic Pro MCP server (Accessibility + MCU + CGEvent)](https://github.com/koltyj/logic-pro-mcp)
- [Live Object Model (Max for Live)](https://docs.cycling74.com/max8/vignettes/live_object_model), [ableton-mcp (Remote Script bridge)](https://github.com/ahujasid/ableton-mcp)
- [Zephyr USB-MIDI 2.0 class (includes MIDI 1.0 mode)](https://docs.zephyrproject.org/latest/connectivity/usb/device_next/api/usbd_midi2.html)
