"""Score a midtap_session recording: per cue the thumb ring's jolt and the index ring's jolt at the same moment, the
index ring's rotation around it; the biggest thumb jolts in still/wave/confuse (false-positive headroom).
Jolt = |accel| change per ms between consecutive received packets (what the receiver's jerk_update computes)."""
import sys, numpy as np
IDX, THB = "29c3", "aa2c"; G = 0.035; ODR = 1666.0
path = sys.argv[1]
cues = [float(x) for x in open(path + ".cues")]
rows = {IDX: [], THB: []}
for line in open(path):
    f = line.strip().split(",")
    if len(f) != 12 or f[3] not in rows: continue
    rows[f[3]].append((float(f[0]), f[1], int(f[4]) / 1e6, [int(x) for x in f[6:9]], [int(x) for x in f[9:12]]))
def series(rid):
    r = sorted(rows[rid], key=lambda x: x[2])
    th = np.array([x[0] for x in r]); lab = np.array([x[1] for x in r]); tr = np.array([x[2] for x in r])
    tr = tr + np.cumsum(np.r_[0, np.diff(tr) < -1000]) * (2 ** 32 / 1e6)
    g = np.array([x[3] for x in r], float); a = np.array([x[4] for x in r], float)
    mag = np.linalg.norm(a, axis=1); dt = np.r_[1e-3, np.maximum(np.diff(tr), 0.5e-3)]
    jerk = np.r_[0, np.abs(np.diff(mag))] / (dt * 1e3)
    rot = np.linalg.norm(g, axis=1) * G / ODR
    return dict(th=th, lab=lab, tr=tr, jerk=jerk, rot=rot, rate=len(r) / max(tr[-1] - tr[0], 1e-6))
S = {rid: series(rid) for rid in rows}; T, I = S[THB], S[IDX]
print(f"thumb {len(T['th'])} pkts ({T['rate']:.0f}/s)  index {len(I['th'])} ({I['rate']:.0f}/s)")
print(" cue  lag_ms  thumb_jerk  index_jerk(±60ms)  index_rot_400-150ms_before  index_rot_150ms_before")
tj, ij = [], []
for k, c in enumerate(cues):
    m = (T["th"] >= c) & (T["th"] < c + 1.3)
    if not m.any(): print(f"{k+1:4d}  no thumb packets"); continue
    i = np.flatnonzero(m)[np.argmax(T["jerk"][m])]; t0 = T["tr"][i]
    mi = (I["tr"] >= t0 - 0.06) & (I["tr"] <= t0 + 0.06)
    ijk = I["jerk"][mi].max() if mi.any() else float("nan")
    q = I["rot"][(I["tr"] >= t0 - 0.4) & (I["tr"] < t0 - 0.15)].sum(); b = I["rot"][(I["tr"] >= t0 - 0.15) & (I["tr"] < t0)].sum()
    tj.append(T["jerk"][i]); ij.append(ijk)
    print(f"{k+1:4d}  {1000*(T['th'][i]-c):6.0f}  {T['jerk'][i]:10.0f}  {ijk:12.0f}        {q:10.1f}               {b:8.1f}")
tj = np.array(tj); ij = np.array(ij)
print(f"\ntaps: thumb jerk median {np.median(tj):.0f} min {tj.min():.0f};  index jerk median {np.nanmedian(ij):.0f} max {np.nanmax(ij):.0f}")
for seg in ("still", "move", "wave", "confuse"):
    for name, s in (("thumb", T), ("index", I)):
        m = s["lab"] == seg
        if m.any():
            top = np.sort(s["jerk"][m])[-5:]
            print(f"{seg:8s} {name:6s} top jerks: {', '.join(f'{x:.0f}' for x in top[::-1])}")
for thr in (300, 500, 800, 1000, 1500, 2000, 3000):
    hits = (tj >= thr).sum()
    fp = {seg: int(((T["lab"] == seg) & (T["jerk"] >= thr)).sum()) for seg in ("still", "wave", "confuse")}
    print(f"thumb thr {thr:5d}: taps {hits}/{len(tj)}   false packets still/wave/confuse {fp['still']}/{fp['wave']}/{fp['confuse']}")
