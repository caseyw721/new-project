"""Send one text command to the ring's serial port and print the non-telemetry replies."""
import os, select, sys, termios, time

port, cmds = sys.argv[1], sys.argv[2:]
fd = os.open(port, os.O_RDWR | os.O_NOCTTY | os.O_NONBLOCK)
a = termios.tcgetattr(fd)
a[0] = 0; a[1] = 0; a[2] = termios.CS8 | termios.CREAD | termios.CLOCAL; a[3] = 0
a[4] = a[5] = termios.B115200
termios.tcsetattr(fd, termios.TCSANOW, a)
termios.tcflush(fd, termios.TCIFLUSH)
buf = b""
for cmd in cmds:
    os.write(fd, (cmd + "\n").encode())
    end = time.time() + 1.0
    while time.time() < end:
        r, _, _ = select.select([fd], [], [], 0.05)
        if r:
            try:
                buf += os.read(fd, 65536)
            except BlockingIOError:
                pass
os.close(fd)
for line in buf.decode(errors="replace").splitlines():
    if line and not line.startswith(("T,", "L,")):
        print(line)
