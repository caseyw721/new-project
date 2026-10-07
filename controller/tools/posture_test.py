"""Voice-guided posture test: for each position, still / left-right / up-down / wrist twist, recording every packet
from both rings (receiver raw R lines) with segment labels, for offline comparison of pointing mappings.
Usage: posture_test.py OUT.csv "position one" "position two" ..."""
import os, select, subprocess, sys, termios, threading, time
PORT, OUT, POSES = os.environ.get("RECEIVER_PORT", "/dev/cu.usbmodem2101"), sys.argv[1], sys.argv[2:]
fd = os.open(PORT, os.O_RDWR | os.O_NOCTTY | os.O_NONBLOCK)
a = termios.tcgetattr(fd); a[0] = a[1] = a[3] = 0; a[2] = termios.CS8 | termios.CREAD | termios.CLOCAL
termios.tcsetattr(fd, termios.TCSANOW, a); termios.tcflush(fd, termios.TCIFLUSH)
os.write(fd, b"telemetry,0\nraw,1\n")
label, stop = "setup", False
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
th = threading.Thread(target=reader, daemon=True); th.start()
def say(text):
    subprocess.run([os.path.expanduser("~/bin/claude-say"), text])
for i, pose in enumerate(POSES):
    p = f"p{i + 1}"
    label = "move"; say(f"Position {i + 1}: {pose}. Get comfortable, then hold still.")
    label = f"{p}:still"; time.sleep(2.5)
    label = "move"; say("Left and right, five seconds. Go.")
    label = f"{p}:leftright"; time.sleep(5)
    label = "move"; say("Up and down. Go.")
    label = f"{p}:updown"; time.sleep(5)
    label = "move"; say("Only twist your wrist. Go.")
    label = f"{p}:twist"; time.sleep(5)
label = "end"
say("That's all of them. Thanks.")
stop = True; time.sleep(0.2)
os.write(fd, b"raw,0\ntelemetry,1\n"); os.close(fd); out.close()
print("recorded", OUT)
