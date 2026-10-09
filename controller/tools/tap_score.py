"""Score a taptest run offline and sweep the quiet threshold.
Shock = pointer jerk>JP and a clicker jerk>JC within 50 ms (like the firmware); quiet = pointer rotation in the
[t-QF, t-QT) ms window before the pointer shock. Reports per cue (A and C) the first shock after the cue and its
quiet; per B (and any extra 'swing' csv) the shocks; then a sweep of quiet thresholds."""
import sys, numpy as np, collections
IDX, THB = "29c3", "aa2c"; GDPS = 0.070; ODR = 1666.0   # gyro deg/s per LSB (2000 dps range), samples/s
JP, JC, WIN, QF, QT = 1000.0, 300.0, 0.050, 0.400, 0.150
def load(path, with_phase=True):
    rows = {IDX: [], THB: []}
    for line in open(path):
        f = line.strip().split(",")
        if with_phase:
            if len(f) != 12 or f[3] not in rows: continue
            ht, ph, rid, t_us, dc, g, a = float(f[0]), f[1], f[3], int(f[4]), int(f[5]), f[6:9], f[9:12]
        else:
            if len(f) != 12 or f[3] not in rows: continue
            ht, ph, rid, t_us, dc, g, a = float(f[0]), f[1], f[3], int(f[4]), int(f[5]), f[6:9], f[9:12]
        rows[rid].append((ht, ph, t_us / 1e6, dc, [int(x) for x in g], [int(x) for x in a]))
    out = {}
    for rid, r in rows.items():
        r.sort(key=lambda x: x[2])
        tr = np.array([x[2] for x in r]); tr += np.cumsum(np.r_[0, np.diff(tr) < -1000]) * (2 ** 32 / 1e6)
        g = np.array([x[4] for x in r], float); a = np.array([x[5] for x in r], float)
        mag = np.linalg.norm(a, axis=1)
        dt = np.r_[1e-3, np.maximum(np.diff(tr), 0.5e-3)]
        jerk = np.r_[0, np.abs(np.diff(mag))] / (dt * 1e3)
        rot = np.linalg.norm(g, axis=1) * GDPS / ODR
        out[rid] = dict(ht=np.array([x[0] for x in r]), ph=np.array([x[1] for x in r]), tr=tr, jerk=jerk, rot=rot, mag=mag)
    return out
def shocks(S):
    """firmware-like: pointer shock onset times (first sample over JP, grouped within WIN) that have a clicker shock within WIN"""
    P, C = S[IDX], S[THB]
    def onsets(s, thr):
        t = s["tr"][s["jerk"] > thr]; o = []
        for x in t:
            if not o or x - o[-1][0] > WIN: o.append([x, 0.0])
        return np.array([x[0] for x in o]) if o else np.array([])
    po, co = onsets(P, JP), onsets(C, JC)
    res = []
    for t in po:
        d = co - t
        m = np.abs(d) <= WIN
        if not m.any(): continue
        q = P["rot"][(P["tr"] >= t - QF) & (P["tr"] < t - QT)].sum()
        peak = P["jerk"][(P["tr"] >= t) & (P["tr"] < t + WIN)].max()
        i = np.searchsorted(P["tr"], t)
        res.append(dict(t=t, ht=P["ht"][min(i, len(P["ht"]) - 1)], ph=P["ph"][min(i, len(P["ph"]) - 1)], quiet=q, pj=peak, dt=d[m][0] * 1e3))
    return res
path = sys.argv[1]; S = load(path)
sh = shocks(S)
cues = [l.split(",") for l in open(path.replace("raw.csv", "events.log")) if ",cue," in l or l.rstrip().endswith(",cue")]
cues = [(float(c[0]), c[1]) for c in cues]
print(f"packets index {len(S[IDX]['tr'])} thumb {len(S[THB]['tr'])}; shock candidates {len(sh)}")
print("cue    phase   first shock after cue (ms)   quiet deg   pointer jerk")
first = []
for t, ph in cues:
    c = [s for s in sh if 0 <= s["ht"] - t < 1.4]
    if c:
        s = c[0]; first.append((ph, s["quiet"])); print(f"{ph:6s}  {1000*(s['ht']-t):6.0f}  quiet {s['quiet']:6.1f}  jerk {s['pj']:7.0f}  ({len(c)} shocks in 1.4 s)")
    else:
        print(f"{ph:6s}  no shock"); first.append((ph, None))
B = [s for s in sh if s["ph"] == "B"]
print(f"\nphase B shocks: {len(B)}; quiet values: {sorted(round(s['quiet']) for s in B)}")
# merge B shocks into 600 ms refractory groups (what would have become clicks)
def clicks(ss, thr):
    n, last = 0, -1e9
    for s in ss:
        if s["quiet"] < thr and s["t"] - last > 0.6: n += 1; last = s["t"]
    return n
extra = {}
for p in sys.argv[2:]:
    E = load(p); es = shocks(E); extra[p.split('/')[-1]] = es
print("\nthreshold  A taps passed  C taps passed  B false clicks  " + "  ".join(extra))
for thr in (20, 30, 40, 60, 80, 100, 150, 1e9):
    a = sum(1 for ph, q in first if ph.startswith("A") and q is not None and q < thr)
    c = sum(1 for ph, q in first if ph.startswith("C") and q is not None and q < thr)
    print(f"{thr:9.0f}  {a:3d}/{sum(p.startswith('A') for p,_ in first)}          {c:3d}/{sum(p.startswith('C') for p,_ in first)}          {clicks(B, thr):3d}            " + "  ".join(f"{clicks(es, thr):3d}" for es in extra.values()))
