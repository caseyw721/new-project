"""Look at a two-ring raw recording: per ring, accel jolts (high-passed magnitude) and gyro speed; list moments
where both rings jolt within 40 ms (pinch candidates)."""
import sys, statistics as st
import numpy as np
NAMES = {"29c3": "index", "aa2c": "thumb"}
rows = {}
for line in open(sys.argv[1]):
    f = line.strip().split(",")
    if len(f) != 10:
        continue
    rid = f[1]
    try:
        t, dc = int(f[2]) / 1e6, int(f[3])
        g = [int(x) for x in f[4:7]]; a = [int(x) for x in f[7:10]]
    except ValueError:
        continue
    rows.setdefault(rid, []).append((t, dc, g, a))
events = {}
for rid, r in rows.items():
    r.sort(key=lambda x: x[0])
    t = np.array([x[0] for x in r]); t -= 0  # receiver seconds (wraps every 71 min; fine for a short take)
    a = np.array([x[3] for x in r], dtype=float)
    mag = np.linalg.norm(a, axis=1)
    # high-pass: minus a running median over ~40 ms of samples
    w = 25
    med = np.array([np.median(mag[max(0, i - w):i + 1]) for i in range(len(mag))])
    hp = np.abs(mag - med)
    thr = np.median(hp) + 8 * (np.median(np.abs(hp - np.median(hp))) + 1)
    peaks, last = [], -1
    for i in np.argsort(-hp):
        if hp[i] < thr:
            break
        if all(abs(t[i] - t[j]) > 0.15 for j in peaks):
            peaks.append(i)
    peaks.sort()
    gyro = np.array([np.linalg.norm(x[2]) / max(x[1], 1) for x in r])
    dur = t[-1] - t[0]
    print(f"{NAMES.get(rid, rid)} ({rid}): {len(r)} packets in {dur:.1f} s ({len(r) / max(dur, 1e-6):.0f}/s), accel |a| median {np.median(mag):.0f} LSB, "
          f"jolt threshold {thr:.0f}, jolts {len(peaks)}, gyro median {np.median(gyro):.0f} LSB/sample")
    events[rid] = [(t[i], hp[i]) for i in peaks]
ids = list(events)
if len(ids) == 2:
    A, B = events[ids[0]], events[ids[1]]
    both = [(ta, ha, min(B, key=lambda b: abs(b[0] - ta))) for ta, ha in A if B and min(abs(b[0] - ta) for b in B) < 0.04]
    print(f"jolts on both rings within 40 ms: {len(both)}")
    t0 = min(r[0][0] for r in rows.values())
    for ta, ha, (tb, hb) in both[:25]:
        print(f"  t={ta - t0:6.2f}s  {NAMES.get(ids[0])} {ha:.0f}  {NAMES.get(ids[1])} {hb:.0f}  dt {1000 * (tb - ta):+.0f} ms")
