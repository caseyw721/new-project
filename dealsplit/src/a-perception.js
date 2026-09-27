/* =====================================================================
 * Layer A: Perception. Turns a page into features. Knows nothing about
 * forms, templates or deals. Uses only DS.Infra.
 * ===================================================================== */
DS.Perception = (() => {
  'use strict';
  const { fnv1a64, sha256Hex, normText, clamp, round, now, Store } = DS.Infra;

  /* ---------- canvases ---------- */
  function makeCanvas(w, h) {
    if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  /* Render a pdf.js page at `dpi`. Returns {canvas, width, height, dpi, ms}. */
  async function renderPage(page, dpi) {
    const t0 = now();
    const viewport = page.getViewport({ scale: dpi / 72 });
    const w = Math.ceil(viewport.width), h = Math.ceil(viewport.height);
    const canvas = makeCanvas(w, h);
    const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: true });
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    await page.render({ canvasContext: ctx, viewport, background: '#ffffff' }).promise;
    return { canvas, width: w, height: h, dpi, ms: now() - t0 };
  }

  /* Grayscale luma as Uint8Array. */
  function grayscale(canvas) {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const { width: w, height: h } = canvas;
    const img = ctx.getImageData(0, 0, w, h).data;
    const g = new Uint8Array(w * h);
    for (let i = 0, j = 0; i < g.length; i++, j += 4) {
      g[i] = (img[j] * 77 + img[j + 1] * 150 + img[j + 2] * 29) >> 8;
    }
    return { w, h, data: g };
  }

  /* ---------- text layer ---------- */
  const COMMON = new Set(('the and of to in for or by is are be this that with as at on from not any all ' +
    'date name address city state zip phone signature buyer seller dealer vehicle year make model ' +
    'vin price total amount tax fee cash down payment finance charge rate annual percentage lease ' +
    'term monthly payments contract agreement application credit odometer title trade insurance ' +
    'gap warranty service notice privacy disclosure page of form purchaser co-buyer lessee lessor ' +
    'mileage stock number license customer employer income social security birth email initial').split(' '));
  function tokenPlausible(tok) {
    if (/^[A-Za-z]{2,}$/.test(tok)) {
      if (COMMON.has(tok.toLowerCase())) return 2;
      if (!/[aeiouyAEIOUY]/.test(tok) && tok.length > 3) return 0;
      if (/[bcdfghjklmnpqrstvwxz]{5,}/i.test(tok)) return 0;
      return 1;
    }
    if (/^[A-Za-z]$/.test(tok)) return 0.5;
    if (/^[$(]?[\d,.]+%?\)?$/.test(tok) || /^\d[\d\/.-]*$/.test(tok)) return 1;
    if (/^[A-Z0-9][A-Z0-9-]{1,}$/.test(tok)) return 1;      // form ids, VINs
    if (/^[\w.,;:!?'"()$%#&/-]+$/.test(tok)) return 0.5;
    return 0;                                                // glyph garbage
  }

  /* pdf.js text content → words with normalized boxes (0..1, y down) and a
   * quality record that says whether this layer can be trusted.
   */
  async function extractTextLayer(page) {
    const t0 = now();
    const vp = page.getViewport({ scale: 1 });
    const pw = vp.width, ph = vp.height;
    const tc = await page.getTextContent();
    const words = [];
    let items = 0, longestItem = 0, totalChars = 0;
    for (const it of tc.items) {
      if (!('str' in it)) continue;
      const s = it.str;
      if (!s.trim()) continue;
      items++;
      totalChars += s.length;
      longestItem = Math.max(longestItem, s.length);
      const [a, b, c, d, e, f] = it.transform;
      const fontH = Math.hypot(b, d) || it.height || 10;
      const x = e, yTop = ph - f - fontH;
      const wPer = it.width / Math.max(1, s.length);
      let col = 0;
      for (const m of s.matchAll(/\S+/g)) {
        col = m.index;
        words.push({
          text: m[0],
          x: round((x + col * wPer) / pw, 4),
          y: round(yTop / ph, 4),
          w: round((m[0].length * wPer) / pw, 4),
          h: round(fontH / ph, 4),
        });
      }
    }
    let plaus = 0, garbage = 0;
    for (const w of words) {
      const p = tokenPlausible(w.text);
      if (p >= 1) plaus += 1; else if (p === 0) garbage += 1;
    }
    const n = words.length;
    const plausibleRatio = n ? plaus / n : 0;
    const garbageRatio = n ? garbage / n : 0;
    const giantString = items > 0 && items <= 2 && totalChars > 200;
    let score = plausibleRatio * (1 - garbageRatio) * clamp(n / 25, 0, 1);
    if (giantString) score *= 0.3;
    if (n && garbageRatio > 0.35) score *= 0.4;
    const quality = { score: round(score), tokenCount: n, plausibleRatio: round(plausibleRatio),
                      garbageRatio: round(garbageRatio), giantString, items };
    return { words, quality, text: normText(words.map((w) => w.text).join(' ')), ms: now() - t0 };
  }

  /* ---------- preprocessing ---------- */
  function otsu(g) {
    const hist = new Uint32Array(256);
    for (let i = 0; i < g.length; i++) hist[g[i]]++;
    const total = g.length;
    let sum = 0;
    for (let i = 0; i < 256; i++) sum += i * hist[i];
    let sumB = 0, wB = 0, best = 0, thr = 128;
    for (let t = 0; t < 256; t++) {
      wB += hist[t]; if (!wB) continue;
      const wF = total - wB; if (!wF) break;
      sumB += t * hist[t];
      const mB = sumB / wB, mF = (sum - sumB) / wF;
      const v = wB * wF * (mB - mF) * (mB - mF);
      if (v > best) { best = v; thr = t; }
    }
    return thr;
  }

  function downscale(gray, maxW) {
    const f = Math.max(1, Math.ceil(gray.w / maxW));
    if (f === 1) return gray;
    const w = Math.floor(gray.w / f), h = Math.floor(gray.h / f);
    const out = new Uint8Array(w * h);
    const src = gray.data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let s = 0;
        for (let dy = 0; dy < f; dy++) {
          const row = (y * f + dy) * gray.w + x * f;
          for (let dx = 0; dx < f; dx++) s += src[row + dx];
        }
        out[y * w + x] = s / (f * f);
      }
    }
    return { w, h, data: out };
  }

  /* Skew estimate in degrees via projection-profile variance. Positive =
   * content rotated clockwise. Works on a downscaled global-threshold image.
   */
  function estimateSkew(gray) {
    const small = downscale(gray, 360);
    const thr = Math.min(otsu(small.data), 200);
    const xs = [], ys = [];
    const cx = small.w / 2, cy = small.h / 2;
    for (let y = 0; y < small.h; y++) {
      for (let x = 0; x < small.w; x++) {
        if (small.data[y * small.w + x] < thr) { xs.push(x - cx); ys.push(y - cy); }
      }
    }
    if (xs.length < 50) return 0;
    if (xs.length > 40000) { // subsample for speed
      const step = Math.ceil(xs.length / 40000);
      const sx = [], sy = [];
      for (let i = 0; i < xs.length; i += step) { sx.push(xs[i]); sy.push(ys[i]); }
      xs.length = 0; ys.length = 0; xs.push(...sx); ys.push(...sy);
    }
    const rows = new Float64Array(small.h * 2 + 4);
    const variance = (deg) => {
      const r = deg * Math.PI / 180, s = Math.sin(r), c = Math.cos(r);
      rows.fill(0);
      for (let i = 0; i < xs.length; i++) {
        const yy = Math.round(ys[i] * c - xs[i] * s + small.h);
        if (yy >= 0 && yy < rows.length) rows[yy]++;
      }
      let m = 0; for (let i = 0; i < rows.length; i++) m += rows[i];
      m /= rows.length;
      let v = 0; for (let i = 0; i < rows.length; i++) { const d = rows[i] - m; v += d * d; }
      return v;
    };
    let best = 0, bestV = -1;
    for (let a = -6; a <= 6; a += 0.5) { const v = variance(a); if (v > bestV) { bestV = v; best = a; } }
    let fine = best;
    for (let a = best - 0.5; a <= best + 0.5; a += 0.1) { const v = variance(a); if (v > bestV) { bestV = v; fine = a; } }
    return round(fine, 2);
  }

  /* Rotate grayscale by -deg about the center, bilinear, white background. */
  function rotateGray(gray, deg) {
    const r = -deg * Math.PI / 180, s = Math.sin(r), c = Math.cos(r);
    const { w, h, data } = gray;
    const out = new Uint8Array(w * h).fill(255);
    const cx = w / 2, cy = h / 2;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = x - cx, dy = y - cy;
        const sx = dx * c - dy * s + cx, sy = dx * s + dy * c + cy;
        const x0 = Math.floor(sx), y0 = Math.floor(sy);
        if (x0 < 0 || y0 < 0 || x0 >= w - 1 || y0 >= h - 1) continue;
        const fx = sx - x0, fy = sy - y0;
        const i = y0 * w + x0;
        out[y * w + x] = data[i] * (1 - fx) * (1 - fy) + data[i + 1] * fx * (1 - fy) +
                         data[i + w] * (1 - fx) * fy + data[i + w + 1] * fx * fy;
      }
    }
    return { w, h, data: out };
  }

  /* Sauvola adaptive binarization using integral images. 1 = ink. */
  function sauvola(gray, win = 25, k = 0.3) {
    const { w, h, data } = gray;
    const W = w + 1;
    const I = new Float64Array(W * (h + 1)), I2 = new Float64Array(W * (h + 1));
    for (let y = 1; y <= h; y++) {
      let rs = 0, rs2 = 0;
      for (let x = 1; x <= w; x++) {
        const v = data[(y - 1) * w + (x - 1)];
        rs += v; rs2 += v * v;
        I[y * W + x] = I[(y - 1) * W + x] + rs;
        I2[y * W + x] = I2[(y - 1) * W + x] + rs2;
      }
    }
    const bin = new Uint8Array(w * h);
    const r = win >> 1;
    for (let y = 0; y < h; y++) {
      const y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
      for (let x = 0; x < w; x++) {
        const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1);
        const n = (y1 - y0) * (x1 - x0);
        const s = I[y1 * W + x1] - I[y0 * W + x1] - I[y1 * W + x0] + I[y0 * W + x0];
        const s2 = I2[y1 * W + x1] - I2[y0 * W + x1] - I2[y1 * W + x0] + I2[y0 * W + x0];
        const m = s / n;
        const v = Math.max(0, s2 / n - m * m);
        const t = m * (1 + k * (Math.sqrt(v) / 128 - 1));
        const px = data[y * w + x];
        bin[y * w + x] = px < t && px < 190 ? 1 : 0;
      }
    }
    return bin;
  }

  function contentBox(bin, w, h) {
    const rows = new Uint32Array(h), cols = new Uint32Array(w);
    let total = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (bin[y * w + x]) { rows[y]++; cols[x]++; total++; }
    if (total < 20) return { x0: 0, y0: 0, x1: w, y1: h, ink: 0 };
    const rt = Math.max(2, w * 0.004), ct = Math.max(2, h * 0.004);
    let y0 = 0, y1 = h - 1, x0 = 0, x1 = w - 1;
    while (y0 < h - 1 && rows[y0] < rt) y0++;
    while (y1 > y0 && rows[y1] < rt) y1--;
    while (x0 < w - 1 && cols[x0] < ct) x0++;
    while (x1 > x0 && cols[x1] < ct) x1--;
    const pad = 2;
    x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(w, x1 + pad + 1); y1 = Math.min(h, y1 + pad + 1);
    return { x0, y0, x1, y1, ink: total / (w * h) };
  }

  function preprocess(gray) {
    const t0 = now();
    const skew = estimateSkew(gray);
    const g = Math.abs(skew) >= 0.3 ? rotateGray(gray, skew) : gray;
    const bin = sauvola(g, gray.w > 700 ? 41 : 25);
    const box = contentBox(bin, g.w, g.h);
    return { gray: g, bin, w: g.w, h: g.h, skewDeg: skew, box, inkCoverage: round(box.ink), ms: now() - t0 };
  }

  /* ---------- fingerprints ---------- */
  /* Average-resample a region of a Uint8Array image to tw×th floats. */
  function resample(data, w, region, tw, th) {
    const out = new Float32Array(tw * th);
    const rw = region.x1 - region.x0, rh = region.y1 - region.y0;
    for (let ty = 0; ty < th; ty++) {
      const sy0 = region.y0 + Math.floor(ty * rh / th), sy1 = Math.max(sy0 + 1, region.y0 + Math.floor((ty + 1) * rh / th));
      for (let tx = 0; tx < tw; tx++) {
        const sx0 = region.x0 + Math.floor(tx * rw / tw), sx1 = Math.max(sx0 + 1, region.x0 + Math.floor((tx + 1) * rw / tw));
        let s = 0, n = 0;
        for (let y = sy0; y < sy1; y++) for (let x = sx0; x < sx1; x++) { s += data[y * w + x]; n++; }
        out[ty * tw + tx] = n ? s / n : 0;
      }
    }
    return out;
  }
  const DCT_N = 32;
  const DCT_COS = new Float32Array(DCT_N * DCT_N);
  for (let u = 0; u < DCT_N; u++) for (let x = 0; x < DCT_N; x++) DCT_COS[u * DCT_N + x] = Math.cos(((2 * x + 1) * u * Math.PI) / (2 * DCT_N));
  /* Perceptual hash of a 32×32 float image → 16 hex chars. */
  function phashOf(img32) {
    const tmp = new Float32Array(DCT_N * 8);
    for (let y = 0; y < DCT_N; y++) for (let u = 0; u < 8; u++) {
      let s = 0; for (let x = 0; x < DCT_N; x++) s += img32[y * DCT_N + x] * DCT_COS[u * DCT_N + x];
      tmp[y * 8 + u] = s;
    }
    const coef = new Float32Array(64);
    for (let v = 0; v < 8; v++) for (let u = 0; u < 8; u++) {
      let s = 0; for (let y = 0; y < DCT_N; y++) s += tmp[y * 8 + u] * DCT_COS[v * DCT_N + y];
      coef[v * 8 + u] = s;
    }
    const vals = Array.from(coef.slice(1)).sort((a, b) => a - b);
    const med = vals[31];
    let hex = '';
    for (let i = 0; i < 64; i += 4) {
      let nib = 0;
      for (let b = 0; b < 4; b++) nib = (nib << 1) | (i + b > 0 && coef[i + b] > med ? 1 : 0);
      hex += nib.toString(16);
    }
    return hex;
  }

  /* Long horizontal / vertical rules in a binary region → normalized lines. */
  function detectLines(bin, w, box) {
    const rw = box.x1 - box.x0, rh = box.y1 - box.y0;
    const hMin = Math.max(20, rw * 0.15), vMin = Math.max(20, rh * 0.1);
    const horiz = [], vert = [];
    const runsRow = (y) => {
      const runs = []; let start = -1, gap = 0;
      for (let x = box.x0; x <= box.x1; x++) {
        const ink = x < box.x1 && bin[y * w + x];
        if (ink) { if (start < 0) start = x; gap = 0; }
        else if (start >= 0 && ++gap > 2) { if (x - gap - start >= hMin) runs.push([start, x - gap]); start = -1; gap = 0; }
      }
      return runs;
    };
    let open = [];
    for (let y = box.y0; y < box.y1; y++) {
      const runs = runsRow(y);
      const next = [];
      for (const [x0, x1] of runs) {
        const o = open.find((l) => Math.min(l.x1, x1) - Math.max(l.x0, x0) > 0.7 * Math.min(l.x1 - l.x0, x1 - x0));
        if (o) { o.y1 = y; o.x0 = Math.min(o.x0, x0); o.x1 = Math.max(o.x1, x1); next.push(o); }
        else next.push({ x0, x1, y0: y, y1: y });
      }
      for (const l of open) if (!next.includes(l)) horiz.push(l);
      open = next;
    }
    horiz.push(...open);
    const runsCol = (x) => {
      const runs = []; let start = -1, gap = 0;
      for (let y = box.y0; y <= box.y1; y++) {
        const ink = y < box.y1 && bin[y * w + x];
        if (ink) { if (start < 0) start = y; gap = 0; }
        else if (start >= 0 && ++gap > 2) { if (y - gap - start >= vMin) runs.push([start, y - gap]); start = -1; gap = 0; }
      }
      return runs;
    };
    open = [];
    for (let x = box.x0; x < box.x1; x++) {
      const runs = runsCol(x);
      const next = [];
      for (const [y0, y1] of runs) {
        const o = open.find((l) => Math.min(l.y1, y1) - Math.max(l.y0, y0) > 0.7 * Math.min(l.y1 - l.y0, y1 - y0));
        if (o) { o.x1 = x; o.y0 = Math.min(o.y0, y0); o.y1 = Math.max(o.y1, y1); next.push(o); }
        else next.push({ x0: x, x1: x, y0, y1 });
      }
      for (const l of open) if (!next.includes(l)) vert.push(l);
      open = next;
    }
    vert.push(...open);
    const nh = horiz.filter((l) => l.y1 - l.y0 < 8).map((l) => ({
      y: round((l.y0 + l.y1) / 2 / rh - box.y0 / rh, 3), x0: round((l.x0 - box.x0) / rw, 3), x1: round((l.x1 - box.x0) / rw, 3),
    })).sort((a, b) => a.y - b.y).slice(0, 48);
    const nv = vert.filter((l) => l.x1 - l.x0 < 8).map((l) => ({
      x: round((l.x0 + l.x1) / 2 / rw - box.x0 / rw, 3), y0: round((l.y0 - box.y0) / rh, 3), y1: round((l.y1 - box.y0) / rh, 3),
    })).sort((a, b) => a.x - b.x).slice(0, 48);
    return { h: nh, v: nv };
  }

  /* Count hollow, roughly square small components (checkboxes). */
  function checkboxCount(bin, w, h, box) {
    const lab = new Int32Array(w * h).fill(-1);
    const stack = new Int32Array(w * h);
    let count = 0, comps = 0;
    for (let y = box.y0; y < box.y1; y++) {
      for (let x = box.x0; x < box.x1; x++) {
        const i = y * w + x;
        if (!bin[i] || lab[i] >= 0) continue;
        let sp = 0, n = 0, minx = x, maxx = x, miny = y, maxy = y;
        stack[sp++] = i; lab[i] = comps;
        while (sp) {
          const j = stack[--sp]; n++;
          const jx = j % w, jy = (j - jx) / w;
          if (jx < minx) minx = jx; if (jx > maxx) maxx = jx; if (jy < miny) miny = jy; if (jy > maxy) maxy = jy;
          const nb = [j - 1, j + 1, j - w, j + w];
          for (const k of nb) {
            if (k < 0 || k >= w * h || lab[k] >= 0 || !bin[k]) continue;
            if (Math.abs((k % w) - jx) > 1) continue;
            lab[k] = comps; stack[sp++] = k;
          }
          if (n > 4000) break;
        }
        comps++;
        const bw = maxx - minx + 1, bh = maxy - miny + 1;
        if (bw >= 6 && bw <= 26 && bh >= 6 && bh <= 26) {
          const asp = bw / bh, fill = n / (bw * bh);
          if (asp > 0.7 && asp < 1.4 && fill > 0.18 && fill < 0.6) count++;
        }
      }
    }
    return count;
  }

  /* Full fingerprint of a preprocessed page. */
  function fingerprint(pre) {
    const t0 = now();
    const { gray, bin, w, h, box } = pre;
    const rw = box.x1 - box.x0, rh = box.y1 - box.y0;
    const phash64 = phashOf(resample(gray.data, w, box, 32, 32));
    const rows = new Float32Array(64), cols = new Float32Array(48);
    for (let y = box.y0; y < box.y1; y++) {
      const ry = Math.min(63, Math.floor((y - box.y0) * 64 / rh));
      for (let x = box.x0; x < box.x1; x++) {
        if (bin[y * w + x]) { rows[ry]++; cols[Math.min(47, Math.floor((x - box.x0) * 48 / rw))]++; }
      }
    }
    for (let i = 0; i < 64; i++) rows[i] = round(rows[i] / (rw * (rh / 64)), 4);
    for (let i = 0; i < 48; i++) cols[i] = round(cols[i] / (rh * (rw / 48)), 4);
    const zones = [];
    const hH = Math.max(8, Math.round(rh * 0.12)), fH = Math.max(8, Math.round(rh * 0.10));
    for (let i = 0; i < 3; i++) {
      zones.push({ x0: box.x0 + Math.floor(i * rw / 3), x1: box.x0 + Math.floor((i + 1) * rw / 3), y0: box.y0, y1: box.y0 + hH });
    }
    for (let i = 0; i < 3; i++) {
      zones.push({ x0: box.x0 + Math.floor(i * rw / 3), x1: box.x0 + Math.floor((i + 1) * rw / 3), y0: box.y1 - fH, y1: box.y1 });
    }
    const regionHashes = [], regionInk = [];
    for (const z of zones) {
      regionHashes.push(phashOf(resample(gray.data, w, z, 32, 32)));
      let ink = 0; for (let y = z.y0; y < z.y1; y++) for (let x = z.x0; x < z.x1; x++) ink += bin[y * w + x];
      regionInk.push(round(ink / ((z.x1 - z.x0) * (z.y1 - z.y0)), 4));
    }
    const lineSig = detectLines(bin, w, box);
    const checkboxDensity = round(checkboxCount(bin, w, h, box) * 1e5 / (rw * rh), 3);
    return {
      phash64, bandProfile: { rows: Array.from(rows), cols: Array.from(cols) }, lineSig, regionHashes, regionInk,
      checkboxDensity, orientation: w >= h ? 'landscape' : 'portrait', aspect: round(w / h),
      inkCoverage: pre.inkCoverage, contentBox: { x0: round(box.x0 / w), y0: round(box.y0 / h), x1: round(box.x1 / w), y1: round(box.y1 / h) },
      ms: round(now() - t0, 1),
    };
  }

  /* ---------- similarity between fingerprints (used by the reasoner, defined
   * here because it is pure feature math) ---------- */
  function lineSigSim(a, b) {
    const one = (la, lb, key, k0, k1) => {
      if (!la.length && !lb.length) return 1;
      if (!la.length || !lb.length) return 0;
      let m = 0;
      for (const x of la) {
        if (lb.some((y) => Math.abs(x[key] - y[key]) < 0.012 && Math.abs(x[k0] - y[k0]) < 0.06 && Math.abs(x[k1] - y[k1]) < 0.06)) m++;
      }
      return (2 * m) / (la.length + lb.length);
    };
    return round(0.65 * one(a.h, b.h, 'y', 'x0', 'x1') + 0.35 * one(a.v, b.v, 'x', 'y0', 'y1'));
  }

  /* ---------- page identity hashes ---------- */
  async function pageHash(gray) {
    // Hash of the 72-dpi render: keys the OCR cache and duplicate detection.
    return sha256Hex(gray.data);
  }
  const textHash = (text) => fnv1a64(normText(text));

  /* ---------- OCR pool ---------- */
  const ocrPool = {
    scheduler: null, workers: [], size: 0, ready: null, cfg: {}, stats: { jobs: 0, ms: 0, cacheHits: 0 },
    configure(cfg) { this.cfg = { ...this.cfg, ...cfg }; },
    async init(size) {
      if (this.ready) return this.ready;
      const T = window.Tesseract;
      if (!T) throw new Error('tesseract.js not loaded');
      this.size = Math.max(1, size | 0);
      this.ready = (async () => {
        this.scheduler = T.createScheduler();
        const opts = { ...(this.cfg.tesseractOptions || {}), cacheMethod: 'write' };
        await Promise.all(Array.from({ length: this.size }, async () => {
          const w = await T.createWorker('eng', 1, opts);
          await w.setParameters({ preserve_interword_spaces: '1' });
          this.workers.push(w);
          this.scheduler.addWorker(w);
        }));
      })();
      return this.ready;
    },
    /* OCR a canvas (optionally a rectangle in canvas px). Words normalized to
     * the full canvas (0..1). Cached by (pageHash, regionKey).
     */
    async recognize(canvas, rect, cacheKey) {
      const key = cacheKey ? `${cacheKey}:${rect ? [rect.left, rect.top, rect.width, rect.height].join('x') : 'full'}` : null;
      if (key) {
        const hit = await Store.get('ocr', key).catch(() => undefined);
        if (hit) { this.stats.cacheHits++; return hit; }
      }
      await this.init(this.size || 1);
      const t0 = now();
      const opts = rect ? { rectangle: rect } : {};
      const { data } = await this.scheduler.addJob('recognize', canvas, opts);
      const W = canvas.width, H = canvas.height;
      const words = [];
      let confSum = 0;
      for (const w of data.words || []) {
        if (!w.text || !w.text.trim()) continue;
        const b = w.bbox;
        words.push({ text: w.text, conf: round(w.confidence / 100, 3),
          x: round(b.x0 / W, 4), y: round(b.y0 / H, 4), w: round((b.x1 - b.x0) / W, 4), h: round((b.y1 - b.y0) / H, 4) });
        confSum += w.confidence / 100;
      }
      const res = { words, meanConf: words.length ? round(confSum / words.length) : 0,
                    text: normText(words.map((w) => w.text).join(' ')), ms: round(now() - t0, 1) };
      this.stats.jobs++; this.stats.ms += res.ms;
      if (key) Store.put('ocr', key, res).catch(() => {});
      return res;
    },
    async terminate() {
      if (this.scheduler) await this.scheduler.terminate();
      this.scheduler = null; this.workers = []; this.ready = null;
    },
  };

  /* 3×3 median filter: removes salt-and-pepper noise and fax speckle, which
   * otherwise makes tesseract both slow and wrong.
   */
  function median3(gray) {
    const { w, h, data } = gray;
    const out = new Uint8Array(w * h);
    const win = new Uint8Array(9);
    for (let y = 0; y < h; y++) {
      const y0 = y > 0 ? y - 1 : y, y1 = y < h - 1 ? y + 1 : y;
      for (let x = 0; x < w; x++) {
        const x0 = x > 0 ? x - 1 : x, x1 = x < w - 1 ? x + 1 : x;
        win[0] = data[y0 * w + x0]; win[1] = data[y0 * w + x]; win[2] = data[y0 * w + x1];
        win[3] = data[y * w + x0]; win[4] = data[y * w + x]; win[5] = data[y * w + x1];
        win[6] = data[y1 * w + x0]; win[7] = data[y1 * w + x]; win[8] = data[y1 * w + x1];
        // 19-comparator median-of-9 network (Paeth)
        let t;
        const sw = (a, b) => { if (win[a] > win[b]) { t = win[a]; win[a] = win[b]; win[b] = t; } };
        sw(1, 2); sw(4, 5); sw(7, 8); sw(0, 1); sw(3, 4); sw(6, 7); sw(1, 2); sw(4, 5); sw(7, 8);
        sw(0, 3); sw(5, 8); sw(4, 7); sw(3, 6); sw(1, 4); sw(2, 5); sw(4, 7); sw(4, 2); sw(6, 4); sw(4, 2);
        out[y * w + x] = win[4];
      }
    }
    return { w, h, data: out };
  }

  /* Clean image for OCR: denoise, deskew (angle from the 72-dpi pass), Sauvola
   * binarize. Returns a new black-on-white canvas of the same size.
   */
  function prepareForOcr(canvas, skewDeg) {
    const t0 = now();
    const raw = grayscale(canvas);
    let g = median3(raw);
    // Heavy salt-and-pepper leaves 2-pixel clumps after one pass; measure how
    // much the filter changed and run a second pass when it was a lot.
    let changed = 0;
    for (let i = 0; i < raw.data.length; i += 7) if (Math.abs(raw.data[i] - g.data[i]) > 90) changed++;
    const noise = changed / (raw.data.length / 7);
    if (noise > 0.02) g = median3(g);
    if (Math.abs(skewDeg || 0) >= 0.3) g = rotateGray(g, skewDeg);
    const bin = sauvola(g, 51, 0.25);
    const out = makeCanvas(g.w, g.h);
    const ctx = out.getContext('2d', { willReadFrequently: true });
    const img = ctx.createImageData(g.w, g.h);
    const d = img.data;
    for (let i = 0, j = 0; i < bin.length; i++, j += 4) { const v = bin[i] ? 0 : 255; d[j] = v; d[j + 1] = v; d[j + 2] = v; d[j + 3] = 255; }
    ctx.putImageData(img, 0, 0);
    return { canvas: out, noise: round(noise, 3), ms: round(now() - t0, 1) };
  }

  /* Header/footer strips (in canvas px) for strip-first OCR. */
  function strips(canvas, contentBox) {
    const W = canvas.width, H = canvas.height;
    const cb = contentBox || { x0: 0, y0: 0, x1: 1, y1: 1 };
    const y0 = Math.floor(cb.y0 * H), y1 = Math.ceil(cb.y1 * H), h = y1 - y0;
    return {
      header: { left: 0, top: y0, width: W, height: Math.max(20, Math.round(h * 0.16)) },
      footer: { left: 0, top: Math.max(0, y1 - Math.round(h * 0.13)), width: W, height: Math.max(20, Math.round(h * 0.13)) },
    };
  }

  return { renderPage, grayscale, extractTextLayer, preprocess, fingerprint, lineSigSim, pageHash, textHash,
           ocrPool, strips, makeCanvas, prepareForOcr, median3, _internal: { otsu, sauvola, estimateSkew, rotateGray, phashOf, resample, tokenPlausible } };
})();
