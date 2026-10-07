"""Score pointing mappings on a posture-test recording. For each position: during left-right the cursor should move
across (selectivity ~1), during up-down it should move vertically, and a wrist twist should move it little (leak ~0).
Mappings (index ring = 29c3, thumb = aa2c):
  tilt-board : today's firmware tilt mode (yaw about gravity, pitch about fwd x up) with the board-guess fwd
  tilt-est   : the same with the finger axis estimated from the twists
  fixed-cal  : fixed sensor axes from today's calibration (current setting)
  hand-roll0 : fixed sensor axes, made perpendicular to the estimated finger axis (a twist about the finger is ignored)
  rel-thumb  : hand-roll0 on (index - thumb) rotation: motion both rings share is ignored"""
import sys
import numpy as np
G = 0.035  # dps per LSB
IDX, THB = "29c3", "aa2c"
rows = []
for line in open(sys.argv[1]):
    f = line.strip().split(",")
    if len(f) != 12:
        continue
    try:
        rows.append((float(f[0]), f[1], f[3], int(f[4]) / 1e6, int(f[5]), np.array([int(x) for x in f[6:9]], float),
                     np.array([int(x) for x in f[9:12]], float)))
    except ValueError:
        pass
labels = sorted({r[1] for r in rows if ":" in r[1]})
poses = sorted({l.split(":")[0] for l in labels})
def seg(rid, lab):
    w = [r for r in rows if r[2] == rid and r[1] == lab and r[4] > 0]
    if not w:
        return None
    t = np.array([r[3] for r in w]); dc = np.array([r[4] for r in w], float)
    g = np.array([r[5] for r in w]); a = np.array([r[6] for r in w])
    return t, dc, g, a
bias, grav = {}, {}
for p in poses:
    for rid in (IDX, THB):
        s = seg(rid, f"{p}:still")
        if s:
            bias[(p, rid)] = s[2].sum(axis=0) / s[1].sum()
            grav[(p, rid)] = s[3].mean(axis=0) / np.linalg.norm(s[3].mean(axis=0))
def rate(p, rid, lab):
    s = seg(rid, lab)
    if s is None or (p, rid) not in bias:
        return None
    t, dc, g, a = s
    w = (g / dc[:, None] - bias[(p, rid)]) * G      # deg/s per packet
    up = a / np.linalg.norm(a, axis=1)[:, None]
    return t, w, up
# finger axis from all twists (principal rotation axis of the index ring)
tw = [rate(p, IDX, f"{p}:twist") for p in poses]
W = np.vstack([x[1] for x in tw if x is not None])
fwd_est = np.linalg.svd(W - W.mean(axis=0), full_matrices=False)[2][0]
right_cal = np.array([0.0451, -0.9989, 0.0138]); up_cal = np.array([-0.5642, -0.0141, 0.8255])
def ortho(v, n):
    v = v - (v @ n) * n
    return v / np.linalg.norm(v)
r0 = ortho(right_cal, fwd_est); u0 = np.cross(fwd_est, r0)
if u0 @ up_cal < 0:
    u0 = -u0
def tilt(w, up, fwd):
    hv = []
    for wi, ui in zip(w, up):
        tu = np.cross(fwd, ui); n = np.linalg.norm(tu)
        tu = tu / n if n > 0.2 else up_cal
        hv.append((wi @ -ui, wi @ tu))
    return np.array(hv)
def fixed(w, r, u):
    return np.stack([w @ r, w @ u], axis=1)
# thumb -> index frame: least squares over all moving data (shared motion), per pose pooled
def thumb_map():
    A, B = [], []
    for p in poses:
        for lab in ("leftright", "updown", "twist"):
            a = rate(p, IDX, f"{p}:{lab}"); b = rate(p, THB, f"{p}:{lab}")
            if a is None or b is None:
                continue
            tb = np.interp(a[0], b[0], np.arange(len(b[0])))
            bi = b[1][np.clip(np.round(tb).astype(int), 0, len(b[1]) - 1)]
            A.append(bi); B.append(a[1])
    if not A:
        return None
    A, B = np.vstack(A), np.vstack(B)
    M, *_ = np.linalg.lstsq(A, B, rcond=None)
    return M
M = thumb_map()
def mapping(name, p, lab):
    x = rate(p, IDX, f"{p}:{lab}")
    if x is None:
        return None
    t, w, up = x
    if name == "tilt-board":
        return tilt(w, up, np.array([1.0, 0, 0]))
    if name == "tilt-est":
        return tilt(w, up, fwd_est)
    if name == "fixed-cal":
        return fixed(w, right_cal, up_cal)
    if name == "hand-roll0":
        return fixed(w, r0, u0)
    if name == "rel-thumb" and M is not None:
        b = rate(p, THB, f"{p}:{lab}")
        if b is None:
            return None
        tb = np.interp(t, b[0], np.arange(len(b[0])))
        bi = b[1][np.clip(np.round(tb).astype(int), 0, len(b[1]) - 1)]
        return fixed(w - bi @ M, r0, u0)
    return None
print(f"finger axis (from twists): {np.round(fwd_est, 3)}  | packets: index {sum(1 for r in rows if r[2] == IDX)}, thumb {sum(1 for r in rows if r[2] == THB)}")
for name in ("tilt-board", "tilt-est", "fixed-cal", "hand-roll0", "rel-thumb"):
    out = []
    for p in poses:
        lr, ud, tw_ = mapping(name, p, "leftright"), mapping(name, p, "updown"), mapping(name, p, "twist")
        if lr is None or ud is None or tw_ is None:
            out.append(f"{p}: n/a"); continue
        e = lambda m: (m ** 2).sum(axis=0)
        sh = e(lr)[0] / e(lr).sum(); sv = e(ud)[1] / e(ud).sum()
        rms = lambda m: np.sqrt((m ** 2).sum(axis=1).mean())
        leak = rms(tw_) / max(1e-9, (rms(lr) + rms(ud)) / 2)
        out.append(f"{p}: across {sh:.2f} up {sv:.2f} twist-leak {leak:.2f}")
    print(f"{name:11s} | " + " | ".join(out))

# learned: right = main rotation axis of the left-right moves, up = of the up-down moves, both made perpendicular
# to the twist axis; scored leave-one-position-out (learned on the other positions only)
def axis(lab, ps):
    W = np.vstack([rate(p, IDX, f"{p}:{lab}")[1] for p in ps if rate(p, IDX, f"{p}:{lab}") is not None])
    W = W[np.isfinite(W).all(axis=1)]
    return np.linalg.svd(W, full_matrices=False)[2][0]
def learned(ps):
    T = np.vstack([rate(p, IDX, f"{p}:twist")[1] for p in ps])
    T = T[np.isfinite(T).all(axis=1)]
    f = np.linalg.svd(T, full_matrices=False)[2][0]
    r = ortho(axis("leftright", ps), f)
    u = ortho(axis("updown", ps), f); u = ortho(u, r)
    return r, u
out = []
for p in poses:
    r, u = learned([q for q in poses if q != p])
    def m(lab):
        x = rate(p, IDX, f"{p}:{lab}")
        w = x[1][np.isfinite(x[1]).all(axis=1)]
        return np.stack([w @ r, w @ u], axis=1)
    lr, ud, tw_ = m("leftright"), m("updown"), m("twist")
    e = lambda mm: (mm ** 2).sum(axis=0)
    rms = lambda mm: np.sqrt((mm ** 2).sum(axis=1).mean())
    out.append(f"{p}: across {e(lr)[0] / e(lr).sum():.2f} up {e(ud)[1] / e(ud).sum():.2f} twist-leak {rms(tw_) / ((rms(lr) + rms(ud)) / 2):.2f}")
print(f"{'learned-LOO':11s} | " + " | ".join(out))
r, u = learned(poses)
print("learned on all three: right", np.round(r, 4), "up", np.round(u, 4))

# twist gate: when most of the rotation is about the finger axis, the cursor holds still
r, u = learned(poses)
T = np.vstack([rate(p, IDX, f"{p}:twist")[1] for p in poses]); T = T[np.isfinite(T).all(axis=1)]
fax = np.linalg.svd(T, full_matrices=False)[2][0]
print("finger (twist) axis:", np.round(fax, 4))
for lo, hi in ((0.5, 0.8), (0.4, 0.7), (0.3, 0.6)):
    out = []
    for p in poses:
        def m(lab):
            x = rate(p, IDX, f"{p}:{lab}")
            w = x[1][np.isfinite(x[1]).all(axis=1)]
            tw = np.abs(w @ fax) / (np.linalg.norm(w, axis=1) + 1e-9)
            gate = np.clip((hi - tw) / (hi - lo), 0, 1)
            return np.stack([w @ r, w @ u], axis=1) * gate[:, None], np.stack([w @ r, w @ u], axis=1)
        (lr, lr0), (ud, ud0), (tw_, tw0) = m("leftright"), m("updown"), m("twist")
        rms = lambda mm: np.sqrt((mm ** 2).sum(axis=1).mean())
        keep = (rms(lr) + rms(ud)) / (rms(lr0) + rms(ud0))
        out.append(f"{p}: twist-leak {rms(tw_) / ((rms(lr) + rms(ud)) / 2):.2f} (was {rms(tw0) / ((rms(lr0) + rms(ud0)) / 2):.2f}), real moves kept {100 * keep:.0f}%")
    print(f"gate {lo}-{hi} | " + " | ".join(out))
