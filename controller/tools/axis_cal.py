"""Voice-guided axis calibration of the pointer ring (index, 639e29c3) through the receiver: still -> turn right
-> back -> up. right = the rotation axis of the turn, up = that of the lift (made perpendicular), fwd = up x right.
Applies them to the receiver (which runs the pointer engine for the ring) and saves."""
import os, select, subprocess, sys, termios, threading, time
import numpy as np
PORT = os.environ.get("RECEIVER_PORT", "/dev/cu.usbmodem2101"); RID = os.environ.get("POINTER_RING", "29c3")  # last 4 hex of the pointer ring id
fd = os.open(PORT, os.O_RDWR | os.O_NOCTTY | os.O_NONBLOCK)
a = termios.tcgetattr(fd); a[0] = a[1] = a[3] = 0; a[2] = termios.CS8 | termios.CREAD | termios.CLOCAL
termios.tcsetattr(fd, termios.TCSANOW, a); termios.tcflush(fd, termios.TCIFLUSH)
rows, replies, stop = [], [], False
def reader():
    buf = b""
    while not stop:
        if select.select([fd], [], [], 0.02)[0]:
            try: buf += os.read(fd, 1 << 16)
            except BlockingIOError: continue
            t = time.time()
            *lines, buf = buf.split(b"\n")
            for l in lines:
                if l.startswith(b"R," + RID.encode()):
                    f = l.split(b",")
                    try: rows.append((t, int(f[3]), int(f[4]), int(f[5]), int(f[6])))
                    except (ValueError, IndexError): pass
                elif l.startswith((b"C,", b"OK", b"ERR")):
                    replies.append(l.decode(errors="replace"))
th = threading.Thread(target=reader, daemon=True); th.start()
os.write(fd, b"telemetry,0\nraw,1\n")
def say(text):
    t0 = time.time()
    subprocess.run([os.path.expanduser("~/bin/claude-say"), text])
    return t0, time.time()
def window(t0, t1):
    w = [r for r in rows if t0 <= r[0] < t1]
    dc = sum(r[1] for r in w); g = np.array([r[2:] for r in w], dtype=float).sum(axis=0) if w else np.zeros(3)
    return dc, g
_, t = say("Hold your hand by your side, relaxed, the way you like to use it, and keep still.")
time.sleep(2.0)
dc_s, g_s = window(t + 0.4, t + 2.0)
bias = g_s / max(dc_s, 1)
t0, t = say("Now make the move you would use to send the cursor right, and hold.")
time.sleep(2.0)
dc_r, g_r = window(t0, t + 2.0); right = g_r - bias * dc_r
say("Back to where you started, and hold.")
time.sleep(1.5)
t0, t = say("Now the move you would use to send it up, and hold.")
time.sleep(2.0)
dc_u, g_u = window(t0, t + 2.0); up = g_u - bias * dc_u
stop = True; time.sleep(0.1)
os.write(fd, b"raw,0\ntelemetry,1\n")
print(f"samples still {dc_s}, right {dc_r}, up {dc_u}; packets {len(rows)}")
nr, nu = np.linalg.norm(right), np.linalg.norm(up)
print(f"turn magnitude {nr:.0f}, lift magnitude {nu:.0f} (raw LSB sums)")
if nr < 1000 or nu < 1000:
    print("RESULT: too little rotation recorded; nothing changed"); sys.exit(0)
r = right / nr
u = up - (up @ r) * r; u /= np.linalg.norm(u)
f = np.cross(u, r)
print("right", np.round(r, 3), "up", np.round(u, 3), "fwd", np.round(f, 3), f"(angle between raw turn and lift {np.degrees(np.arccos(abs(right @ up) / nr / nu)):.0f} deg)")
sep = np.degrees(np.arccos(abs(right @ up) / nr / nu))
if sep < 55:
    print(f"RESULT: turn and lift axes only {sep:.0f} deg apart (want ~90): not applied")
    subprocess.run([os.path.expanduser("~/bin/claude-say"), "That one wasn't clean enough, so I kept the old setting."])
    sys.exit(0)
replies.clear()
th = threading.Thread(target=reader, daemon=True); stop = False; th.start()
cmd = ("set,tilt,0\n" f"set,right,{r[0]:.4f},{r[1]:.4f},{r[2]:.4f}\nset,up,{u[0]:.4f},{u[1]:.4f},{u[2]:.4f}\n"
       f"set,fwd,{f[0]:.4f},{f[1]:.4f},{f[2]:.4f}\nsave\n")
os.write(fd, cmd.encode()); time.sleep(3.0); stop = True; time.sleep(0.1); os.close(fd)
print("RESULT:", " | ".join(replies))
