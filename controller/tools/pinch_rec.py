"""Record every ring packet (receiver raw,1 R lines) for SECONDS, stamped on arrival; then summarise per ring.
Usage: pinch_rec.py PORT OUT SECONDS"""
import os, select, sys, termios, time
port, out, secs = sys.argv[1], sys.argv[2], float(sys.argv[3])
fd = os.open(port, os.O_RDWR | os.O_NOCTTY | os.O_NONBLOCK)
a = termios.tcgetattr(fd); a[0] = a[1] = a[3] = 0; a[2] = termios.CS8 | termios.CREAD | termios.CLOCAL
termios.tcsetattr(fd, termios.TCSANOW, a); termios.tcflush(fd, termios.TCIFLUSH)
os.write(fd, b"telemetry,0\nraw,1\n")
f = open(out, "w", buffering=1 << 16)
buf, end, n = b"", time.time() + secs, {}
while time.time() < end:
    if select.select([fd], [], [], 0.02)[0]:
        try:
            chunk = os.read(fd, 1 << 16)
        except BlockingIOError:
            continue
        buf += chunk
        *lines, buf = buf.split(b"\n")
        for l in lines:
            if l.startswith(b"R,"):
                f.write(l.decode(errors="replace") + "\n")
                k = l.split(b",")[1]
                n[k] = n.get(k, 0) + 1
os.write(fd, b"raw,0\ntelemetry,1\n")
os.close(fd)
f.close()
print("lines per ring:", {k.decode(): v for k, v in n.items()})
