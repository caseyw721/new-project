# Phase 1 setup guide: from parts on the desk to test results

## Short version

1. **Solder** each battery to the back of its XIAO board (2 wires each).
2. **Load the ring software** onto each XIAO: double-press its reset button, then drag a file onto
   the drive that appears.
3. **Load the receiver software** onto the Nordic dongle with Nordic's free *Programmer* app.
4. **Open the test app** in Chrome, connect, and calibrate.
5. **Run the tests** for each spot on your hand, plus a normal mouse for comparison.

Everything you need is in this repo:

| File | What it is |
|---|---|
| `controller/firmware/prebuilt/ring.uf2` | Software for the XIAO boards (the ring) |
| `controller/firmware/prebuilt/receiver.hex` | Software for the Nordic dongle (the receiver) |
| `controller/test-app/index.html` | The test app (opens in Chrome) |

To get the files, open https://github.com/caseyw721/new-project (branch `main`) and click
**Code → Download ZIP**.

---

## 1. Solder the batteries

For each XIAO board:

1. Turn the board over. There are two small pads marked **BAT+** and **BAT−**. They may be
   tiny; use your phone's camera to zoom in.
2. Cut the plug off the battery **one wire at a time**, so the two bare ends never touch.
3. Strip about 2 mm of insulation from each wire and add a little solder to each tip ("tin" it).
4. Solder **red → BAT+** and **black → BAT−**.
5. Put a piece of Kapton or electrical tape over the back of the board, then lay the battery on
   top. This stops the battery's little safety board from touching the XIAO's pads.

⚠️ Getting red and black backwards can destroy the board. If you have a multimeter, check which
wire is positive before soldering.

## 2. Load the ring software (both XIAO boards)

1. Plug the XIAO into your computer with a **data** USB-C cable.
2. **Double-press** the tiny reset button on the XIAO quickly (like a double-click). A drive called
   **XIAO-SENSE** appears, like a USB stick.
3. Drag **`ring.uf2`** onto that drive. The drive disappears by itself after a few seconds. That
   means it worked.
4. Repeat for the second XIAO.

The ring is now running. While it's plugged into a computer it acts as a **wired mouse** (the
"fastest possible" reference test). Unplugged, it runs on battery and talks to the receiver.

## 3. Load the receiver software (Nordic dongle)

1. Install **nRF Connect for Desktop** from nordicsemi.com (free). Open it and install the
   **Programmer** app inside it.
2. Plug the dongle into a USB port.
3. Press the dongle's small **RESET button**. It's the tiny button that sticks out **sideways**,
   next to the round white button. The red light starts slowly pulsing, which means it's ready for
   new software.
4. In Programmer, pick the dongle from the device list (it shows up as *Open DFU Bootloader*),
   click **Add file**, choose **`receiver.hex`**, then click **Write**.
5. When it finishes, the dongle restarts with the new software.

*Command-line alternative:* if you have Nordic's `nrfutil` (with the `nrf5sdk-tools` command), run
`nrfutil nrf5sdk-tools dfu usb-serial -pkg receiver-dfu.zip -p <port>` while the red light is
pulsing.

## 4. Turn off your computer's mouse acceleration

Your computer can speed the cursor up on fast moves on its own, which would mix into our
results.

- **Windows:** Settings → Bluetooth & devices → Mouse → Additional mouse settings → Pointer
  Options → untick **Enhance pointer precision**.
- **Mac (macOS 14 Sonoma or newer):** System Settings → Mouse → Advanced… → turn off **Pointer
  acceleration**. On older macOS there's no simple switch. Keep the same tracking-speed setting
  for every test (including the normal mouse) so the comparison stays fair.

The test app has a **Check your computer's mouse acceleration** button (Tune tab) to confirm.

## 5. Open the test app

1. Open `controller/test-app/index.html` in **Google Chrome** or **Microsoft Edge**. Other browsers
   can't talk to USB devices.
2. Click **Connect** and pick **Pointer Receiver** from the list.
3. Wake the ring by moving it. The Connect tab shows the ring's ID, *Radio packets / s* (about
   1,600 is normal) and *Packets lost* (should be near 0 %).

*If the Connect button shows no devices:* some computers block USB access from a file opened
straight off the disk. Open a terminal in the `test-app` folder, run `python3 -m http.server`, and
go to `http://localhost:8000` in Chrome instead.

## 6. Calibrate (once per spot on your hand)

Go to the **Calibrate** tab and follow the 5 steps: put it down, hold your pose, turn right, tip
up, then save. It takes about 30 seconds.

**Redo calibration every time you move the ring to a different spot** (wrist, back of hand,
finger base or fingertip).

## 7. Run the tests

Use the **Testing** menu at the top to say what you're testing. Every result is saved under that
name.

For each of these setups:

- Ring on wrist
- Ring on back of hand
- Ring at finger base
- Ring on fingertip
- Ring wired (plugged in with the USB cable)
- Normal mouse

run the four tests in the **Tests** tab:

| Test | What it measures | Takes |
|---|---|---|
| **A. Lag** | How long from hand moving to the screen reacting (slow-motion video) | 3 min |
| **B. Steadiness** | How still the cursor stays when you hold still | 15 s |
| **C. Pointing accuracy** | The standard test used to rate real mice (throughput) | 2 min |
| **D. Timeline & knobs** | Landing on beats and small knobs, like in a DAW | 1 min |

With the ring, press **Space** with your other hand to "click". With the mouse you can click.

**Lag test tips:**
- Film at 240 fps (your phone's "slow-mo" mode).
- Keep your hand and the black box in the same shot, close to the camera.
- Count frames from the first frame where your hand moves to the first frame where the box is
  white.
- Do the normal mouse too: we compare against it, since the screen and browser add the same
  delay to both.

When you're done, open **Results** → **Download CSV** and send me the file. I'll pick the winning
setup and we move to Phase 2.

## 8. What the lights mean

**Ring (XIAO):**

| Light | Meaning |
|---|---|
| Short green at power-up | Started |
| Blue blink every 2 s | Radio working, the receiver hears it |
| Red blink every 2 s | Can't reach the receiver: is the dongle plugged in? |
| Green blink every 2 s | Plugged into a computer: working as a wired mouse |
| Red blink every second | Motion sensor problem (see troubleshooting) |
| Dark | Resting to save battery. It rests after lying still for 30 s. Move it to wake it (about 20 ms). |

**Receiver (dongle):**

| Light | Meaning |
|---|---|
| Green on | A ring is connected and driving the cursor |
| Red blink every 2 s | No ring heard: wake the ring by moving it |
| Red on, steady | Radio failed to start: unplug and replug the dongle |

## 9. Charging

Plug the ring's USB-C into a **phone charger** (not a computer, where it would become a wired
mouse). The small charge light next to the USB port stays on while charging. A 150 mAh battery
charges in about 3 hours at the board's gentle default rate. We estimate a full charge lasts
about a day of active use (we'll measure it), and several days if it's mostly resting.

## 10. Troubleshooting

| Problem | Try this |
|---|---|
| No XIAO-SENSE drive appears | Double-press faster. Try another cable: charge-only cables don't carry data. |
| Receiver not in Chrome's list | Unplug and replug it. Make sure the receiver software was written (step 3). |
| Ring shows "sensor error" | Unplug the battery (or USB) for 5 seconds and power it again. |
| Cursor drifts slowly on its own | Put the ring down on the table for 3 seconds: it re-learns the sensor drift. Or click *Re-learn drift* in the Tune tab. |
| Cursor moves diagonally | Redo calibration for that spot on your hand. |
| Cursor too slow or too fast | Tune tab → *Speed*. Click *Save to device* to keep it. |
| Cursor feels laggy | Tune tab → *Lowest lag* preset. |
| Cursor shaky when holding still | Tune tab → *Extra steady* preset, or lower *Steadiness when still*. |
| Packets lost above 5 % | Move the receiver closer, or use a short USB extension cable to get it away from the computer's metal case. |
