/* =====================================================================
 * Infra: small utilities and IndexedDB storage. Layer-neutral: every
 * layer may use this; this uses nothing above it.
 * ===================================================================== */
window.DS = window.DS || {};
DS.Infra = (() => {
  'use strict';

  /* ---------- hashing ---------- */
  function fnv1a64(str) {
    // 64-bit FNV-1a over UTF-16 code units, as two 32-bit halves.
    let h1 = 0x811c9dc5 ^ 0, h2 = 0xcbf29ce4 | 0;
    for (let i = 0; i < str.length; i++) {
      const c = str.charCodeAt(i);
      h1 ^= c & 0xff; h1 = Math.imul(h1, 0x01000193) >>> 0;
      h2 ^= c >>> 8;  h2 = Math.imul(h2, 0x01000193) >>> 0;
      h1 ^= h2 >>> 13;
    }
    return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
  }
  async function sha256Hex(bytes) {
    const d = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  const POP8 = new Uint8Array(256);
  for (let i = 0; i < 256; i++) POP8[i] = (i & 1) + POP8[i >> 1];
  /* Hamming distance between two 16-hex-char (64-bit) hashes. */
  function hamming64(a, b) {
    let d = 0;
    for (let i = 0; i < 16; i++) d += POP8[parseInt(a[i], 16) ^ parseInt(b[i], 16)];
    return d;
  }

  /* ---------- text similarity ---------- */
  function normText(s) {
    return (s || '').toUpperCase().replace(/[^A-Z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function trigrams(s) {
    const t = ' ' + s + ' ';
    const out = new Map();
    for (let i = 0; i + 3 <= t.length; i++) {
      const g = t.slice(i, i + 3);
      out.set(g, (out.get(g) || 0) + 1);
    }
    return out;
  }
  /* Dice coefficient over trigram multisets, 0..1. */
  function trigramSim(a, b) {
    if (!a || !b) return 0;
    const ta = trigrams(a), tb = trigrams(b);
    let inter = 0, na = 0, nb = 0;
    for (const [g, c] of ta) { na += c; if (tb.has(g)) inter += Math.min(c, tb.get(g)); }
    for (const c of tb.values()) nb += c;
    return na + nb ? (2 * inter) / (na + nb) : 0;
  }
  /* Best fuzzy occurrence of `needle` inside `hay` (both normalized): slide a
   * window of needle-length words over hay. Returns {sim, at}.
   */
  function fuzzyFind(needle, hay) {
    const nw = needle.split(' ').length;
    const hw = hay.split(' ');
    if (!needle || hw.length === 0) return { sim: 0, at: -1 };
    let best = 0, at = -1;
    for (let i = 0; i + 1 <= hw.length; i++) {
      for (const span of [nw, nw + 1, nw - 1]) {
        if (span < 1 || i + span > hw.length) continue;
        const s = trigramSim(needle, hw.slice(i, i + span).join(' '));
        if (s > best) { best = s; at = i; }
      }
    }
    return { sim: best, at };
  }

  /* ---------- vectors ---------- */
  function cosine(a, b) {
    let d = 0, na = 0, nb = 0;
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
    return na && nb ? d / Math.sqrt(na * nb) : 0;
  }
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const round = (v, p = 3) => Math.round(v * 10 ** p) / 10 ** p;

  /* ---------- deep freeze (decision immutability) ---------- */
  function deepFreeze(o) {
    if (o && typeof o === 'object' && !Object.isFrozen(o)) {
      Object.freeze(o);
      for (const k of Object.keys(o)) deepFreeze(o[k]);
    }
    return o;
  }

  /* ---------- IndexedDB ---------- */
  const DB_NAME = 'dealsplit', DB_VERSION = 1;
  const STORES = ['ocr', 'templates', 'dealtypes', 'settings', 'decisions', 'corrections', 'exemplarHistory', 'confirmed'];
  let dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const d = req.result;
        for (const s of STORES) if (!d.objectStoreNames.contains(s)) d.createObjectStore(s);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }).catch((e) => { dbp = null; throw e; });
    return dbp;
  }
  function tx(store, mode, fn) {
    return db().then((d) => new Promise((resolve, reject) => {
      const t = d.transaction(store, mode);
      const r = fn(t.objectStore(store));
      t.oncomplete = () => resolve(r instanceof IDBRequest ? r.result : r);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    }));
  }
  const Store = {
    get: (s, k) => tx(s, 'readonly', (o) => o.get(k)).then((r) => r),
    put: (s, k, v) => tx(s, 'readwrite', (o) => o.put(v, k)),
    del: (s, k) => tx(s, 'readwrite', (o) => o.delete(k)),
    clear: (s) => tx(s, 'readwrite', (o) => o.clear()),
    getAll: (s) => tx(s, 'readonly', (o) => o.getAll()),
    getAllKeys: (s) => tx(s, 'readonly', (o) => o.getAllKeys()),
    count: (s) => tx(s, 'readonly', (o) => o.count()),
    available: () => db().then(() => true, () => false),
  };

  /* ---------- misc ---------- */
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

  return { fnv1a64, sha256Hex, hamming64, normText, trigramSim, fuzzyFind, cosine, clamp, round,
           deepFreeze, Store, now, uid };
})();
