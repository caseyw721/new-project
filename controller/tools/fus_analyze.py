"""Ring vs camera, from one recording on a shared clock (CLOCK_UPTIME_RAW):
1. how late the camera is behind the ring (cross-correlation of angular speed),
2. how ring rotation maps to the fingertip's motion in the camera image (least squares, after the lag)."""
import json, math, sys
import numpy as np

ring_path, frames_path = sys.argv[1], sys.argv[2]
# ring: rotation per T-line interval (millidegrees, drift removed) -> deg/s at the interval's middle
R = []
prev_up = None
for line in open(ring_path):
    f = line.strip().split(",")
    if len(f) < 30 or f[4] != "R":
        continue
    t, up = float(f[0]), int(f[2])
    rot = np.array([float(f[7]), float(f[8]), float(f[9])]) / 1000.0
    if prev_up is not None and 5 <= up - prev_up <= 100:
        dt = (up - prev_up) / 1000.0
        R.append((t - dt / 2, rot / dt))
    prev_up = up
rt = np.array([r[0] for r in R]); rw = np.array([r[1] for r in R])
# camera: index finger direction (world landmarks MCP 5 -> TIP 8) and fingertip image position, at t_read
C = []
for line in open(frames_path):
    fr = json.loads(line)
    if not fr.get("hands"):
        continue
    h = fr["hands"][0]
    wd = np.array(h["world"][8]) - np.array(h["world"][5])
    n = np.linalg.norm(wd)
    if n < 1e-6:
        continue
    C.append((fr["t_read"], wd / n, np.array(h["img"][8][:2]) * [fr["w"], fr["h"]]))
ct = np.array([c[0] for c in C]); cd = np.array([c[1] for c in C]); cp = np.array([c[2] for c in C])
print(f"ring: {len(rt)} intervals over {rt[-1] - rt[0]:.0f} s, peak {np.linalg.norm(rw, axis=1).max():.0f} deg/s")
print(f"camera: {len(ct)} frames with a hand")
# camera angular speed of the finger direction, between consecutive frames no more than 50 ms apart
cs_t, cs_v = [], []
for i in range(1, len(ct)):
    dt = ct[i] - ct[i - 1]
    if 0 < dt <= 0.05:
        ang = math.degrees(math.acos(max(-1.0, min(1.0, float(cd[i] @ cd[i - 1])))))
        cs_t.append((ct[i] + ct[i - 1]) / 2); cs_v.append(ang / dt)
cs_t, cs_v = np.array(cs_t), np.array(cs_v)
# common 100 Hz grid where both exist
t0, t1 = max(rt[0], cs_t[0]) + 0.5, min(rt[-1], cs_t[-1]) - 0.5
g = np.arange(t0, t1, 0.01)
ring_speed = np.interp(g, rt, np.linalg.norm(rw, axis=1))
cam_speed = np.interp(g, cs_t, cs_v)
# keep only grid points with camera data close by (gaps are not motion)
near = np.interp(g, cs_t, np.arange(len(cs_t)))
gap_ok = np.array([abs(cs_t[int(round(k))] - x) < 0.04 for k, x in zip(near, g)])
best = None
for lag_ms in range(-100, 401, 5):          # positive = camera later than ring
    cam_shift = np.interp(g + lag_ms / 1000.0, cs_t, cs_v)
    ok = gap_ok & (g + lag_ms / 1000.0 < cs_t[-1])
    a, b = ring_speed[ok], cam_shift[ok]
    if len(a) < 200:
        continue
    r = np.corrcoef(a, b)[0, 1]
    if best is None or r > best[1]:
        best = (lag_ms, r)
print(f"camera lag behind ring: {best[0]} ms (speed correlation r={best[1]:.2f})")
lag = best[0] / 1000.0
# fingertip image velocity (px/s) vs ring angular velocity (deg/s), camera shifted by the lag
v_t, v_px = [], []
for i in range(1, len(ct)):
    dt = ct[i] - ct[i - 1]
    if 0 < dt <= 0.05:
        v_t.append((ct[i] + ct[i - 1]) / 2 - lag); v_px.append((cp[i] - cp[i - 1]) / dt)
v_t, v_px = np.array(v_t), np.array(v_px)
W = np.stack([np.interp(v_t, rt, rw[:, k]) for k in range(3)], axis=1)
ok = (v_t > rt[0]) & (v_t < rt[-1])
A, res, *_ = np.linalg.lstsq(W[ok], v_px[ok], rcond=None)
pred = W[ok] @ A
for k, name in enumerate(["image x (right)", "image y (down)"]):
    ss = ((v_px[ok, k] - v_px[ok, k].mean()) ** 2).sum()
    r2 = 1 - ((v_px[ok, k] - pred[:, k]) ** 2).sum() / ss
    print(f"{name}: px/s = {A[0, k]:+.1f}*ring_x {A[1, k]:+.1f}*ring_y {A[2, k]:+.1f}*ring_z (deg/s), R^2={r2:.2f}")
