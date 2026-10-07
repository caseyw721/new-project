"""Update each ring that gets plugged in: bootloader command -> XIAO-SENSE drive -> ring.uf2, then set its txdiv
(index 639e29c3: 2, thumb 4bbfaa2c: 6) and save. Ends when both are done (or after 40 min)."""
import glob, os, select, shutil, subprocess, sys, termios, time
UF2 = os.path.expanduser("~/ring/controller/firmware/prebuilt/ring.uf2")
WANT = {"639e29c3": 2, "4bbfaa2c": 6}
NAME = {"639e29c3": "index ring", "4bbfaa2c": "thumb ring"}
done = set()

def talk(port, *cmds, wait=1.0):
    try:
        fd = os.open(port, os.O_RDWR | os.O_NOCTTY | os.O_NONBLOCK)
    except OSError:
        return ""
    a = termios.tcgetattr(fd); a[0] = a[1] = a[3] = 0; a[2] = termios.CS8 | termios.CREAD | termios.CLOCAL
    termios.tcsetattr(fd, termios.TCSANOW, a); termios.tcflush(fd, termios.TCIFLUSH)
    buf = b""
    for c in cmds:
        os.write(fd, (c + "\n").encode())
        end = time.time() + wait
        while time.time() < end:
            if select.select([fd], [], [], 0.05)[0]:
                try: buf += os.read(fd, 65536)
                except (BlockingIOError, OSError): break
    try: os.close(fd)
    except OSError: pass
    return "\n".join(l for l in buf.decode(errors="replace").splitlines() if not l.startswith(("T,", "R,")))

def ring_ports():
    out = []
    for p in glob.glob("/dev/cu.usbmodem*"):
        r = talk(p, "ver", "info", wait=0.6)
        if "I,ver,ring" in r:
            rid = next((l.split(",")[3] for l in r.splitlines() if l.startswith("I,info,id,")), None)
            out.append((p, rid, r))
    return out

t_end = time.time() + 2400
print("WATCH START", time.strftime("%T"), flush=True)
while time.time() < t_end and len(done) < len(WANT):
    for port, rid, r in ring_ports():
        if rid not in WANT or rid in done:
            continue
        print(f"{NAME[rid]} ({rid}) plugged in on {port}", flush=True)
        got = talk(port, "get", wait=0.8)
        if "C,txdiv" not in got:                        # old firmware: update it
            talk(port, "bootloader", wait=0.3)
            t0 = time.time()
            while time.time() - t0 < 30 and not os.path.exists("/Volumes/XIAO-SENSE/INFO_UF2.TXT"):
                time.sleep(0.3)
            if not os.path.exists("/Volumes/XIAO-SENSE/INFO_UF2.TXT"):
                print("  no XIAO-SENSE drive appeared (the Mac may want you to allow it)", flush=True)
                continue
            subprocess.run(["cp", "-X", UF2, "/Volumes/XIAO-SENSE/"])
            print("  firmware copied", time.strftime("%T"), flush=True)
            t0 = time.time(); port = None
            while time.time() - t0 < 40 and port is None:
                time.sleep(1)
                for p2, rid2, _ in ring_ports():
                    if rid2 == rid:
                        port = p2
            if port is None:
                print("  ring did not come back on USB (allow it if the Mac asks)", flush=True)
                continue
        r = talk(port, f"set,txdiv,{WANT[rid]}", "save", wait=0.8)
        ok = f"C,txdiv,{WANT[rid]}" in r and "OK,save" in r
        print(f"  txdiv {WANT[rid]} {'saved' if ok else 'NOT saved: ' + r}", flush=True)
        if ok:
            done.add(rid)
            print(f"DONE {NAME[rid]} {time.strftime('%T')} - unplug it", flush=True)
    time.sleep(1)
print("END", sorted(done), flush=True)
