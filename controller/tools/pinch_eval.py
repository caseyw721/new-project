"""Score a pinch_session recording: per cue, the jolt (high-passed |accel|) on each ring and its timing, the index
ring's rotation in the 150 ms before the thumb's jolt (what a click would have to rewind), and the biggest jolts in
the still / wave segments (false-positive headroom). Usage: pinch_eval.py REC.csv [--thr LSB]"""
import sys
import numpy as np
IDX, THB = "29c3", "aa2c"; G = 0.035; ODR = 1666.0
path = sys.argv[1]
thr_arg = float(sys.argv[sys.argv.index("--thr") + 1]) if "--thr" in sys.argv else None
cues = [float(x) for x in open(path + ".cues")]
rows = {IDX: [], THB: []}
for line in open(path):
    f = line.strip().split(",")
    if len(f) != 12 or f[3] not in rows:
        continue
    try:
        rows[f[3]].append((float(f[0]), f[1], int(f[4]) / 1e6, int(f[5]), [int(x) for x in f[6:9]], [int(x) for x in f[9:12]]))
    except ValueError:
        pass
def series(rid):
    r = sorted(rows[rid], key=lambda x: x[0])
    th = np.array([x[0] for x in r]); lab = np.array([x[1] for x in r]); tr = np.array([x[2] for x in r])
    tr = tr + np.cumsum(np.r_[0, np.diff(tr) < -1000]) * (2 ** 32 / 1e6)      # 71-min wrap
    dc = np.array([x[3] for x in r], float); g = np.array([x[4] for x in r], float); a = np.array([x[5] for x in r], float)
    mag = np.linalg.norm(a, axis=1)
    rate = len(r) / max(tr[-1] - tr[0], 1e-6); w = max(3, int(0.04 * rate))
    med = np.array([np.median(mag[max(0, i - w):i + 1]) for i in range(len(mag))])
    jolt = np.abs(mag - med)
    rot = np.linalg.norm(g, axis=1) * G / ODR                                   # degrees turned per packet
    return dict(th=th, lab=lab, tr=tr, dc=dc, jolt=jolt, mag=mag, rot=rot, rate=rate)
S = {rid: series(rid) for rid in rows}
T, I = S[THB], S[IDX]
print(f"thumb {len(T['th'])} packets ({T['rate']:.0f}/s), index {len(I['th'])} ({I['rate']:.0f}/s); |a| median thumb {np.median(T['mag']):.0f} index {np.median(I['mag']):.0f} LSB")
print(" cue  lag_ms  thumb_jolt  idx_jolt  dt_ms  idx_rot_150ms_deg  idx_rot_after_deg")
tj, ij, rots = [], [], []
for k, c in enumerate(cues):
    m = (T["th"] >= c) & (T["th"] < c + 1.2)
    if not m.any():
        print(f"{k + 1:4d}  (no thumb packets)"); continue
    i = np.flatnonzero(m)[np.argmax(T["jolt"][m])]
    t0 = T["tr"][i]
    mi = (I["tr"] >= t0 - 0.06) & (I["tr"] <= t0 + 0.06)
    j = np.flatnonzero(mi)[np.argmax(I["jolt"][mi])] if mi.any() else None
    before = I["rot"][(I["tr"] >= t0 - 0.15) & (I["tr"] < t0)].sum()
    after = I["rot"][(I["tr"] >= t0) & (I["tr"] < t0 + 0.15)].sum()
    tj.append(T["jolt"][i]); rots.append(before)
    if j is not None:
        ij.append(I["jolt"][j])
    print(f"{k + 1:4d}  {1000 * (T['th'][i] - c):6.0f}  {T['jolt'][i]:10.0f}  {I['jolt'][j] if j is not None else float('nan'):8.0f}  "
          f"{1000 * (I['tr'][j] - t0) if j is not None else float('nan'):5.0f}  {before:17.1f}  {after:17.1f}")
for name, s in (("thumb", T), ("index", I)):
    for seg in ("still", "wave"):
        m = s["lab"] == seg
        if m.any():
            print(f"{name} {seg}: max jolt {s['jolt'][m].max():.0f}, p99 {np.percentile(s['jolt'][m], 99):.0f}, packets {m.sum()}")
tj, ij = np.array(tj), np.array(ij)
print(f"thumb jolt at cues: min {tj.min():.0f} median {np.median(tj):.0f}; index: min {ij.min():.0f} median {np.median(ij):.0f}")
print(f"index rotation in the 150 ms before contact: median {np.median(rots):.2f} deg (x70 px/deg = {70 * np.median(rots):.0f} px), max {max(rots):.2f} deg")
thr = thr_arg or min(tj) * 0.8
for name, s in (("thumb", T), ("index", I)):
    m = s["lab"] == "wave"
    n = 0; last = -1
    for i in np.flatnonzero(m & (s["jolt"] > thr)):
        if s["tr"][i] - last > 0.15:
            n += 1; last = s["tr"][i]
    print(f"{name}: jolts above {thr:.0f} LSB during wave: {n} events")
