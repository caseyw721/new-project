"""Scored live test of the receiver's thumb click.
Serves a target page (Chrome) that logs every real click and shows the phase; records the receiver raw (both rings)
plus its I,tap lines with host timestamps; beeps the cues. Phases: still 4 s; A = N cued taps holding still;
B = pointing around without tapping (false positives); C = M cued move-then-tap onto a shown target.
Usage: tap_test.py OUT_DIR [A=15] [C=10] [--mid]   (--mid: middle finger on the thumb ring, pointing finger still)"""
import http.server, json, os, select, subprocess, sys, termios, threading, time, random
PORT = os.environ.get("RECEIVER_PORT", "/dev/cu.usbmodem2101"); HTTP = 8790
MID = "--mid" in sys.argv; args = [a for a in sys.argv[1:] if not a.startswith("--")]
OUT = args[0]; NA = int(args[1]) if len(args) > 1 else 15; NC = int(args[2]) if len(args) > 2 else 10
TAP = "tap your MIDDLE finger on the pad of your thumb (the ring thumb); pointing finger still" if MID else "tap thumb to index fingertip"
os.makedirs(OUT, exist_ok=True)
state = {"phase": "setup", "msg": "Getting ready…", "target": None, "n": 0}
clicks = open(os.path.join(OUT, "clicks.log"), "w", buffering=1)
events = open(os.path.join(OUT, "events.log"), "w", buffering=1)
raw = open(os.path.join(OUT, "raw.csv"), "w", buffering=1 << 16)
def ev(kind, *a):
    events.write(f"{time.time():.4f},{state['phase']},{kind},{','.join(str(x) for x in a)}\n")

PAGE = r"""<!doctype html><meta charset=utf-8><title>Tap test</title>
<style>html,body{margin:0;height:100%;background:#111;color:#eee;font:28px -apple-system,sans-serif;overflow:hidden;cursor:crosshair}
#msg{position:fixed;top:24px;left:0;right:0;text-align:center;font-size:40px}
#n{position:fixed;bottom:24px;left:0;right:0;text-align:center;color:#888}
#t{position:fixed;width:120px;height:120px;border-radius:60px;background:#2c7;display:none;transform:translate(-50%,-50%)}
.hit{position:fixed;width:14px;height:14px;border-radius:7px;background:#f55;transform:translate(-50%,-50%);pointer-events:none}</style>
<div id=msg></div><div id=t></div><div id=n></div>
<script>
let cur=null;
async function poll(){try{const s=await (await fetch('/state')).json();msg.textContent=s.msg;n.textContent=s.phase+'  ·  '+s.n;
 if(s.target){t.style.display='block';t.style.left=s.target[0]*innerWidth+'px';t.style.top=s.target[1]*innerHeight+'px';cur=[s.target[0]*innerWidth,s.target[1]*innerHeight];}else{t.style.display='none';cur=null;}}catch(e){}setTimeout(poll,100);}
poll();
let trail=[];addEventListener('mousemove',e=>{trail.push([performance.now(),e.clientX,e.clientY]);if(trail.length>2000)trail.shift();});
function at(ms){const t=performance.now()-ms;let b=null;for(const p of trail){if(p[0]<=t)b=p;else break;}return b;}
addEventListener('mousedown',e=>{const p3=at(300),p1=at(120);const j3=p3?Math.hypot(e.clientX-p3[1],e.clientY-p3[2]):null,j1=p1?Math.hypot(e.clientX-p1[1],e.clientY-p1[2]):null;const d=document.createElement('div');d.className='hit';d.style.left=e.clientX+'px';d.style.top=e.clientY+'px';document.body.appendChild(d);setTimeout(()=>d.remove(),1500);
 const off=cur?Math.hypot(e.clientX-cur[0],e.clientY-cur[1]):null;
 fetch('/click',{method:'POST',body:JSON.stringify({t:Date.now()/1000,x:e.clientX,y:e.clientY,off:off,w:innerWidth,h:innerHeight,j300:j3,j120:j1})});});
</script>"""
class H(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_GET(self):
        body = PAGE.encode() if self.path == "/" else json.dumps(state).encode()
        self.send_response(200); self.send_header("Content-Type", "text/html" if self.path == "/" else "application/json")
        self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body)
    def do_POST(self):
        d = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        clicks.write(f"{time.time():.4f},{state['phase']},{d['x']},{d['y']},{d['off']},{d['w']},{d['h']},{d.get('j300')},{d.get('j120')}\n")
        ev("click", d["x"], d["y"], d["off"])
        self.send_response(204); self.end_headers()
srv = http.server.ThreadingHTTPServer(("127.0.0.1", HTTP), H)
threading.Thread(target=srv.serve_forever, daemon=True).start()

fd = os.open(PORT, os.O_RDWR | os.O_NOCTTY | os.O_NONBLOCK)
a = termios.tcgetattr(fd); a[0] = a[1] = a[3] = 0; a[2] = termios.CS8 | termios.CREAD | termios.CLOCAL
termios.tcsetattr(fd, termios.TCSANOW, a); termios.tcflush(fd, termios.TCIFLUSH)
os.write(fd, b"telemetry,0\nraw,1\ntap,1\n")
stop = False; npk = {}
def reader():
    buf = b""
    while not stop:
        if select.select([fd], [], [], 0.02)[0]:
            try: buf += os.read(fd, 1 << 16)
            except BlockingIOError: continue
            t = time.time(); *lines, buf = buf.split(b"\n")
            for l in lines:
                if l.startswith(b"R,"):
                    raw.write(f"{t:.4f},{state['phase']},{l.decode(errors='replace')}\n")
                    k = l.split(b",")[1].decode(); npk[k] = npk.get(k, 0) + 1
                elif l.startswith(b"I,tap") or l.startswith(b"OK,tap"):
                    ev("rx", l.decode(errors="replace")); print(f"{time.strftime('%H:%M:%S')} {state['phase']} {l.decode(errors='replace')}", flush=True)
threading.Thread(target=reader, daemon=True).start()
def beep(): subprocess.Popen(["afplay", "/System/Library/Sounds/Tink.aiff"])
def phase(p, msg, target=None, n=""):
    state.update(phase=p, msg=msg, target=target, n=n); ev("phase", msg)
subprocess.run(["open", "-a", "Google Chrome", f"http://127.0.0.1:{HTTP}/"])
time.sleep(2.5)
phase("ready", "Put your pointing hand where you point from. Hold still.")
time.sleep(5)
phase("still", "Hold still…"); time.sleep(4)
phase("A-intro", f"Phase A: on each beep, {TAP}. Hand otherwise still. {NA} beeps."); time.sleep(4)
for i in range(NA):
    phase(f"A{i+1}", "TAP on the beep", n=f"{i+1}/{NA}"); beep(); ev("cue"); time.sleep(1.6)
phase("B-intro", "Phase B: point around the screen for 15 s. Do NOT tap."); time.sleep(3)
phase("B", "Point around. No tapping."); time.sleep(15)
phase("C-intro", f"Phase C: a green dot appears; move onto it and tap it. {NC} dots."); time.sleep(4)
rnd = random.Random(1)
for i in range(NC):
    tgt = (rnd.uniform(0.15, 0.85), rnd.uniform(0.2, 0.85))
    phase(f"C{i+1}", "Move onto the dot, hold still a moment, then " + ("middle-finger tap" if MID else "tap it"), target=tgt, n=f"{i+1}/{NC}"); beep(); ev("cue", tgt[0], tgt[1]); time.sleep(3.5)
phase("done", "Done. Thanks.")
time.sleep(1)
stop = True; time.sleep(0.2)
os.write(fd, b"raw,0\ntelemetry,1\n"); os.close(fd); raw.close(); clicks.close(); events.close()
print("recorded", OUT, "packets per ring:", npk)
