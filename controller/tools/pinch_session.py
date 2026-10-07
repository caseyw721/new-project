"""Guided pinch recording for the thumb-ring click: both rings recorded raw (receiver `raw,1`) while the user
taps thumb tip to index fingertip on each beep. Segments: `still` (4 s), `cueN` (from beep N to the next beep),
`wave` (pointing around without pinching, for false positives), `end`.
Usage: pinch_session.py OUT.csv [BEEPS=20] [GAP_S=1.5]      cue times go to OUT.cues (one host time per line)."""
import os, select, subprocess, sys, termios, threading, time
PORT = os.environ.get("RECEIVER_PORT", "/dev/cu.usbmodem2101")
OUT = sys.argv[1]; N = int(sys.argv[2]) if len(sys.argv) > 2 else 20; GAP = float(sys.argv[3]) if len(sys.argv) > 3 else 1.5
fd = os.open(PORT, os.O_RDWR | os.O_NOCTTY | os.O_NONBLOCK)
a = termios.tcgetattr(fd); a[0] = a[1] = a[3] = 0; a[2] = termios.CS8 | termios.CREAD | termios.CLOCAL
termios.tcsetattr(fd, termios.TCSANOW, a); termios.tcflush(fd, termios.TCIFLUSH)
os.write(fd, b"telemetry,0\nraw,1\n")
label, stop, n = "setup", False, {}
out = open(OUT, "w", buffering=1 << 16)
def reader():
    buf = b""
    while not stop:
        if select.select([fd], [], [], 0.02)[0]:
            try: buf += os.read(fd, 1 << 16)
            except BlockingIOError: continue
            t = time.time()
            *lines, buf = buf.split(b"\n")
            for l in lines:
                if l.startswith(b"R,"):
                    out.write(f"{t:.4f},{label},{l.decode(errors='replace')}\n")
                    k = l.split(b",")[1].decode(); n[k] = n.get(k, 0) + 1
th = threading.Thread(target=reader, daemon=True); th.start()
def say(text): subprocess.run([os.path.expanduser("~/bin/claude-say"), text])
def beep(): subprocess.Popen(["afplay", "/System/Library/Sounds/Tink.aiff"])
say("Hold your hand the way you point, and keep it still for a moment.")
label = "still"; time.sleep(4)
label = "move"
say(f"On each beep, tap your thumb tip to your index fingertip, then let go. {N} beeps, starting now.")
time.sleep(0.8)
cues = []
for i in range(N):
    label = f"cue{i + 1}"; cues.append(time.time()); beep(); time.sleep(GAP)
label = "move"
say("Now point around the screen for eight seconds without pinching.")
label = "wave"; time.sleep(8)
label = "end"
say("Done, thanks.")
stop = True; time.sleep(0.2)
os.write(fd, b"raw,0\ntelemetry,1\n"); os.close(fd); out.close()
with open(OUT + ".cues", "w") as f:
    f.write("".join(f"{t:.4f}\n" for t in cues))
print("recorded", OUT, "packets per ring:", n, "cues:", len(cues))
