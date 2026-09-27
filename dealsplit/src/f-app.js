/* =====================================================================
 * App: orchestration (drives the layers per page) and the UI.
 * ===================================================================== */
DS.App = (() => {
  'use strict';
  const { now, round, uid, Store, deepFreeze } = DS.Infra;
  const P = DS.Perception, K = DS.Knowledge, R = DS.Reasoner, Pol = DS.Policy, RCA = DS.RCA;
  const lib = K.lib;
  const $ = (id) => document.getElementById(id);

  /* ---------- library loading (pinned CDN, overridable for self-hosting) ---------- */
  const DEFAULT_LIBS = {
    pdfjs: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs',
    pdfjsWorker: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs',
    tesseract: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js',
    tesseractWorker: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js',
    tesseractCore: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1',
    tesseractLang: 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng/4.0.0_best_int',
    pdflib: 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js',
    jszip: 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js',
  };
  let LIBS = { ...DEFAULT_LIBS, ...(window.DEALSPLIT_LIBS || {}) };
  try { LIBS = { ...LIBS, ...JSON.parse(localStorage.getItem('dealsplit.libs') || '{}') }; } catch { /* ignore */ }

  const loadScript = (src) => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('failed to load ' + src)); document.head.appendChild(s); });
  let pdfjs = null;
  async function loadLibs(status) {
    status('Loading pdf.js…');
    pdfjs = await import(LIBS.pdfjs);
    pdfjs.GlobalWorkerOptions.workerSrc = LIBS.pdfjsWorker;
    status('Loading pdf-lib and JSZip…');
    await Promise.all([loadScript(LIBS.pdflib), loadScript(LIBS.jszip)]);
    status('Loading tesseract.js…');
    await loadScript(LIBS.tesseract);
    P.ocrPool.configure({ tesseractOptions: { workerPath: LIBS.tesseractWorker, corePath: LIBS.tesseractCore, langPath: LIBS.tesseractLang } });
    status('');
  }

  /* ---------- network monitor ---------- */
  const net = { entries: [], loadedAt: 0 };
  function watchNetwork() {
    try {
      const po = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) net.entries.push({ url: e.name, at: round(e.startTime, 0), type: e.initiatorType, afterLoad: net.loadedAt && e.startTime > net.loadedAt });
        renderNetwork();
      });
      po.observe({ type: 'resource', buffered: true });
    } catch { /* ignore */ }
  }

  /* ---------- state ---------- */
  const state = {
    file: null, bytes: null, pdf: null, pageCount: 0, batchId: null,
    pages: [],            // {pageIndex, thumb, features, decision, vins, dup, override, expectedMax}
    docs: [], deals: [], planResult: null, running: false, cancel: false,
    dirHandle: null, drift: [], stats: {},
  };

  /* ---------- perception per page (the ladder's callback) ---------- */
  async function perceiveFactory(pageIndex) {
    const page = await state.pdf.getPage(pageIndex + 1);
    let r72 = null, r150 = null, gray = null;
    const features = { pageIndex, quality: {} };
    const render150 = async () => { if (!r150) r150 = await P.renderPage(page, 150); return r150; };
    const setTextHash = () => {
      const tl = features.textLayer, ok = tl && tl.quality.score >= lib.settings.thresholds.textQualityMin;
      const txt = ok ? tl.text : (features.ocrFull?.text || features.ocrHeader?.text || '');
      features.textHash = txt ? P.textHash(txt) : null;
    };
    return async (need) => {
      if (need === 'textLayer') {
        features.textLayer = await P.extractTextLayer(page);
        features.quality.textLayer = features.textLayer.quality.score;
        setTextHash();
      } else if (need === 'fingerprint') {
        if (!features.fingerprint) {
          r72 = await P.renderPage(page, 72);
          gray = P.grayscale(r72.canvas);
          features.pageHash = await P.pageHash(gray);
          const pre = P.preprocess(gray);
          features.fingerprint = P.fingerprint(pre);
          features.quality.skewDeg = pre.skewDeg; features.quality.inkCoverage = pre.inkCoverage;
          features.timing = { render72: round(r72.ms, 1), preprocess: round(pre.ms, 1), fingerprint: features.fingerprint.ms };
          features.thumb = await thumbnail(r72.canvas);
        }
      } else if (need === 'ocrStrips') {
        const r = await render150();
        const s = P.strips(r.canvas, features.fingerprint?.contentBox);
        const [h, f] = await Promise.all([P.ocrPool.recognize(r.canvas, s.header, features.pageHash), P.ocrPool.recognize(r.canvas, s.footer, features.pageHash)]);
        features.ocrHeader = h; features.ocrFooter = f;
        features.quality.ocrConf = round((h.meanConf + f.meanConf) / 2);
        setTextHash();
      } else if (need === 'ocrFull') {
        const r = await render150();
        features.ocrFull = await P.ocrPool.recognize(r.canvas, null, features.pageHash);
        features.quality.ocrConf = features.ocrFull.meanConf;
        setTextHash();
      }
      return features;
    };
  }
  async function thumbnail(canvas) {
    const w = 120, h = Math.round(canvas.height * w / canvas.width);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    c.getContext('2d').drawImage(canvas, 0, 0, w, h);
    return c.toDataURL('image/jpeg', 0.6);
  }

  /* ---------- pipeline ---------- */
  async function loadPdf(bytes, name) {
    state.bytes = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    state.file = name || 'input.pdf';
    state.pdf = await pdfjs.getDocument({ data: state.bytes.slice(), isEvalSupported: false }).promise;
    state.pageCount = state.pdf.numPages;
    state.pages = []; state.docs = []; state.deals = []; state.planResult = null; state.drift = [];
    state.batchId = uid();
    ui.onLoaded();
    return state.pageCount;
  }

  async function run({ onProgress } = {}) {
    if (!state.pdf) throw new Error('no PDF loaded');
    state.running = true; state.cancel = false;
    state.batchId = uid();               // every run is its own batch in the log
    const t0 = now();
    const th = lib.settings.thresholds;
    const n = state.pageCount;
    const results = new Array(n);
    let done = 0;
    const conc = Math.max(1, Math.min(3, (lib.settings.ocrWorkers | 0) + 1));
    P.ocrPool.size = lib.settings.ocrWorkers;
    const worker = async (start) => {
      for (let i = start; i < n; i += conc) {
        if (state.cancel) return;
        const perceive = await perceiveFactory(i);
        const { decision, features } = await R.classifyPage(i, perceive, lib, th, (k, m) => console.warn('[reasoner]', k, m));
        if (!features.fingerprint) await perceive('fingerprint');   // needed for duplicates + exemplars
        results[i] = { pageIndex: i, features, decision, thumb: features.thumb };
        done++;
        onProgress?.({ done, total: n, page: i + 1, rung: decision.rung, state: decision.state });
        ui.onPage(results[i]);
      }
    };
    await Promise.all(Array.from({ length: conc }, (_, k) => worker(k)));
    if (state.cancel) { state.running = false; return null; }
    // Second pass: context.
    const decisions = R.contextPass(results.map((r) => r.decision), results.map((r) => r.features), lib, th);
    for (let i = 0; i < n; i++) { results[i].decision = decisions[i]; results[i].vins = Pol.extractVins(results[i].features, i); results[i].expectedMax = decisions[i].templateId ? lib.byId(decisions[i].templateId)?.expectedPages.max : 1; }
    state.pages = results;
    await assemble();
    state.stats = { ms: round(now() - t0, 0), perPage: round((now() - t0) / n, 0), ocr: { ...P.ocrPool.stats },
                    rungs: countBy(results, (r) => r.decision.rung.replace('+CTX', '')), states: countBy(results, (r) => r.decision.state) };
    await RCA.logDecisions(state.batchId, decisions, results.map((r) => r.features), { file: state.file, pages: n, stats: state.stats });
    state.drift = await RCA.driftReport({ batchId: state.batchId, entries: decisions.map((d, i) => ({ ...d, pageIndex: i })) }).catch(() => []);
    state.running = false;
    ui.onRunDone();
    return state.stats;
  }
  const countBy = (arr, f) => arr.reduce((m, x) => { const k = f(x); m[k] = (m[k] || 0) + 1; return m; }, {});

  /* Segmentation → grouping → plan. Re-run after corrections. */
  async function assemble() {
    const pages = state.pages.map((p) => ({ ...p, decision: p.override ? overrideDecision(p) : p.decision }));
    Pol.markDuplicates(pages);
    for (let i = 0; i < pages.length; i++) state.pages[i].dup = pages[i].dup;
    state.docs = Pol.segment(pages);
    state.deals = Pol.groupDeals(state.docs, lib);
    state.planResult = Pol.plan(state.deals, state.docs, pages, lib, lib.settings);
    ui.onAssembled();
  }
  /* Policy may override routing; it records the reason and never mutates the decision. */
  function overrideDecision(p) {
    const tpl = lib.byId(p.override.templateId);
    return deepFreeze({ ...p.decision, state: 'CONFIDENT', templateId: p.override.templateId, family: tpl?.family || null, overrideReason: p.override.reason, original: { state: p.decision.state, templateId: p.decision.templateId } });
  }

  /* ---------- corrections ---------- */
  async function confirm(pageIndex, templateId, kind = 'correct') {
    const p = state.pages[pageIndex];
    if (!p) throw new Error('no such page');
    const res = await RCA.applyCorrection({ pageIndex, batchId: state.batchId, features: p.features, decision: p.decision, templateId, kind });
    p.override = { templateId, reason: kind === 'confirm' ? 'user confirmed' : 'user corrected', at: new Date().toISOString(), learned: res.learned };
    await assemble();
    return res;
  }
  async function createTemplateFromPage(pageIndex, { id, displayName, family, folder, requiredFor, anchors }) {
    const p = state.pages[pageIndex];
    const t = { id, displayName, family: family || id, folder, routing: { folder, requiredFor: requiredFor || [] },
                anchors: (anchors || []).map((a) => ({ text: a.text, zone: a.zone || 'header', weight: a.weight || 2, fuzzy: 0.85 })), negatives: [], exemplars: [] };
    lib.upsertTemplate(t);
    for (const rf of requiredFor || []) { const dt = lib.dealTypes[rf]; if (dt && !dt.required.includes(t.family)) dt.required.push(t.family); }
    await lib.save();
    return confirm(pageIndex, id, 'new-type');
  }
  /* Candidate anchors for a new template: distinctive header/footer phrases. */
  function suggestAnchors(features) {
    const box = features.fingerprint?.contentBox;
    const views = R.buildTextView(features, { textQualityMin: 0.3, ocrConfMin: 0.4 });
    const out = [];
    for (const v of views) {
      for (const zone of ['header', 'footer']) {
        const t = v.zoneText[zone];
        if (!t) continue;
        const words = t.split(' ').filter((w) => w.length > 2);
        for (let i = 0; i < words.length && out.length < 12; i += 3) {
          const phrase = words.slice(i, i + 3).join(' ');
          if (phrase.length >= 8 && !out.some((o) => o.text === phrase)) out.push({ text: phrase, zone, weight: zone === 'footer' && /\d/.test(phrase) ? 4 : 2 });
        }
      }
    }
    return out;
  }

  /* ---------- writing ---------- */
  async function write({ directory } = {}) {
    if (!state.planResult) throw new Error('nothing planned');
    const res = await Pol.writeAll(state.planResult.files, state.bytes, { directory: directory || state.dirHandle, onProgress: (i, n, path) => ui.status(`Writing ${i}/${n}: ${path}`) });
    if (res.mode === 'zip') {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(res.blob);
      a.download = (state.file || 'deals').replace(/\.pdf$/i, '') + '_split.zip';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 60000);
    }
    ui.status(`Wrote ${res.count} files (${res.mode}).`);
    return res;
  }
  /* Manual split: ranges like "1-3 RISC, 4 Odometer, 5-8" → files. */
  function parseRanges(text, n) {
    const files = [];
    for (const part of text.split(/[,\n;]+/)) {
      const m = /^\s*(\d+)(?:\s*-\s*(\d+))?\s*(.*?)\s*$/.exec(part);
      if (!m) continue;
      const a = Math.max(1, +m[1]), b = Math.min(n, +(m[2] || m[1]));
      if (a > b) continue;
      const name = (m[3] || `pages_${a}-${b}`).replace(/[^A-Za-z0-9_-]+/g, '_');
      const pages = []; for (let i = a; i <= b; i++) pages.push(i - 1);
      files.push({ path: `manual/${name}.pdf`, pages, kind: 'manual' });
    }
    return files;
  }
  async function writeManual(text, { directory } = {}) {
    const files = parseRanges(text, state.pageCount);
    if (!files.length) throw new Error('no valid ranges');
    const res = await Pol.writeAll(files, state.bytes, { directory: directory || state.dirHandle });
    if (res.mode === 'zip') { const a = document.createElement('a'); a.href = URL.createObjectURL(res.blob); a.download = 'manual_split.zip'; a.click(); }
    return res;
  }

  /* =====================================================================
   * UI
   * ===================================================================== */
  const ui = {
    status(msg) { const el = $('status'); if (el) el.textContent = msg || ''; },
    onLoaded() {
      $('fileInfo').textContent = `${state.file}: ${state.pageCount} pages`;
      $('btnRun').disabled = false; $('btnManual').disabled = false;
      $('pages').innerHTML = '';
      for (let i = 0; i < state.pageCount; i++) {
        const d = document.createElement('div'); d.className = 'pg'; d.id = 'pg' + i;
        d.innerHTML = `<div class="th"></div><div class="pn">p.${i + 1}</div><div class="lbl">–</div>`;
        d.addEventListener('click', () => inspector.open(i));
        $('pages').appendChild(d);
      }
      $('summary').innerHTML = '';
      $('results').innerHTML = '';
    },
    onPage(r) {
      const el = $('pg' + r.pageIndex); if (!el) return;
      el.querySelector('.th').innerHTML = r.thumb ? `<img src="${r.thumb}" alt="">` : '';
      this.paintLabel(r.pageIndex);
    },
    paintLabel(i) {
      const p = state.pages[i] || null; const el = $('pg' + i); if (!el) return;
      const d = p ? (p.override ? { state: 'CONFIDENT', templateId: p.override.templateId } : p.decision) : null;
      if (!d) return;
      const lbl = el.querySelector('.lbl');
      lbl.textContent = (d.templateId || 'UNKNOWN') + (p?.override ? ' ✎' : '') + (p?.dup !== null && p?.dup !== undefined ? ' (dup)' : '');
      el.className = 'pg st-' + d.state;
    },
    onRunDone() {
      for (let i = 0; i < state.pages.length; i++) this.paintLabel(i);
      const s = state.stats;
      $('summary').innerHTML = `<div class="stats">
        <div class="stat"><div class="k">Pages</div><div class="v">${state.pageCount}</div></div>
        <div class="stat"><div class="k">Confident</div><div class="v ok">${s.states.CONFIDENT || 0}</div></div>
        <div class="stat"><div class="k">Likely</div><div class="v warn">${s.states.LIKELY || 0}</div></div>
        <div class="stat"><div class="k">Unknown</div><div class="v bad">${s.states.UNKNOWN || 0}</div></div>
        <div class="stat"><div class="k">Time</div><div class="v">${(s.ms / 1000).toFixed(1)} s</div><div class="k">${s.perPage} ms/page</div></div>
        <div class="stat"><div class="k">Decided by</div><div class="k">${Object.entries(s.rungs).map(([k, v]) => `${k}: ${v}`).join(' · ')}</div></div>
        <div class="stat"><div class="k">OCR</div><div class="k">${s.ocr.jobs} jobs, ${s.ocr.cacheHits} cached, ${(s.ocr.ms / 1000).toFixed(1)} s</div></div>
      </div>` + (state.drift.length ? `<div class="alarm">${state.drift.map((a) => `⚠ ${a.message}${a.pages.length ? ' (pages ' + a.pages.join(', ') + ')' : ''}`).join('<br>')}</div>` : '');
      $('btnWrite').disabled = false;
      this.renderReview();
      rcaPanel.render();
    },
    onAssembled() {
      for (let i = 0; i < state.pages.length; i++) this.paintLabel(i);
      const rows = state.deals.map((d) => `<tr><td>${d.vin || '<i>no VIN</i>'}</td><td>${d.lastName}</td><td>${d.dealType || (d.ambiguousType ? '<b class="bad">ambiguous</b>' : '<i>untyped</i>')}</td>
        <td>${d.docs.map((doc) => `${doc.templateId || 'UNKNOWN'}${doc.state !== 'CONFIDENT' ? ' <span class="' + (doc.state === 'LIKELY' ? 'warn' : 'bad') + '">(' + doc.state.toLowerCase() + ')</span>' : ''} p.${doc.pages.map((p) => p.pageIndex + 1).join(',')}`).join('<br>')}</td>
        <td>${d.missing.length ? d.missing.join('<br>') : '<span class="ok">complete</span>'}</td></tr>`).join('');
      $('results').innerHTML = `<table><tr><th>VIN</th><th>Last name</th><th>Deal type</th><th>Documents (source pages)</th><th>Missing</th></tr>${rows}</table>
        <details><summary>Files to be written (${state.planResult.files.length})</summary><pre>${state.planResult.files.map((f) => f.path + (f.pages ? '  ← pages ' + f.pages.map((p) => p + 1).join(',') : '')).join('\n')}</pre></details>`;
      this.renderReview();
    },
    renderReview() {
      const q = state.pages.filter((p) => !p.override && p.decision.state !== 'CONFIDENT');
      $('reviewCount').textContent = q.length ? `(${q.length})` : '';
      const el = $('reviewList');
      if (!q.length) { el.innerHTML = '<p class="muted">Nothing to review.</p>'; return; }
      el.innerHTML = q.map((p) => {
        const d = p.decision;
        const opts = d.candidates.slice(0, 3).map((c) => `<button class="btn small" data-act="choose" data-page="${p.pageIndex}" data-tpl="${c.templateId}">${c.templateId} (${c.total})</button>`).join(' ');
        return `<div class="rv st-${d.state}"><img src="${p.thumb || ''}" alt=""><div>
          <div><b>Page ${p.pageIndex + 1}</b> · ${d.state} · top: ${d.templateId || d.candidates[0]?.templateId || '–'} · score ${d.score} · margin ${d.margin} · decided by ${d.rung}</div>
          <div class="muted">${d.notes.join(' · ')}</div>
          <div class="row">${opts} <select class="tplsel" data-page="${p.pageIndex}"><option value="">other template…</option>${lib.templates.map((t) => `<option value="${t.id}">${t.displayName}</option>`).join('')}</select>
          <button class="btn small secondary" data-act="new" data-page="${p.pageIndex}">New document type</button>
          <button class="btn small secondary" data-act="inspect" data-page="${p.pageIndex}">Inspect</button></div></div></div>`;
      }).join('');
    },
  };

  /* ---------- inspector ---------- */
  const inspector = {
    async open(i) {
      const p = state.pages[i];
      const m = $('inspector'); m.hidden = false;
      $('insTitle').textContent = `Page ${i + 1}`;
      $('insBody').innerHTML = '<p class="muted">Rendering…</p>';
      const page = await state.pdf.getPage(i + 1);
      const r = await P.renderPage(page, 72);
      const gray = P.grayscale(r.canvas);
      const pre = P.preprocess(gray);
      const fp = p?.features?.fingerprint || P.fingerprint(pre);
      const orig = document.createElement('canvas'); orig.width = r.width; orig.height = r.height; orig.getContext('2d').drawImage(r.canvas, 0, 0);
      const bin = document.createElement('canvas'); bin.width = pre.w; bin.height = pre.h;
      const bctx = bin.getContext('2d'); const img = bctx.createImageData(pre.w, pre.h);
      for (let k = 0; k < pre.bin.length; k++) { const v = pre.bin[k] ? 0 : 255; img.data[k * 4] = v; img.data[k * 4 + 1] = v; img.data[k * 4 + 2] = v; img.data[k * 4 + 3] = 255; }
      bctx.putImageData(img, 0, 0);
      const b = pre.box; const rw = b.x1 - b.x0, rh = b.y1 - b.y0;
      bctx.strokeStyle = '#e33'; bctx.lineWidth = 1;
      for (const l of fp.lineSig.h) { bctx.beginPath(); bctx.moveTo(b.x0 + l.x0 * rw, b.y0 + l.y * rh); bctx.lineTo(b.x0 + l.x1 * rw, b.y0 + l.y * rh); bctx.stroke(); }
      bctx.strokeStyle = '#36c';
      for (const l of fp.lineSig.v) { bctx.beginPath(); bctx.moveTo(b.x0 + l.x * rw, b.y0 + l.y0 * rh); bctx.lineTo(b.x0 + l.x * rw, b.y0 + l.y1 * rh); bctx.stroke(); }
      bctx.strokeStyle = '#2a2'; bctx.strokeRect(b.x0, b.y0, rw, rh);
      // OCR heat over the original
      const octx = orig.getContext('2d');
      const words = [...(p?.features?.ocrFull?.words || []), ...(p?.features?.ocrHeader?.words || []), ...(p?.features?.ocrFooter?.words || [])];
      for (const w of words) { octx.fillStyle = `rgba(${Math.round(255 * (1 - w.conf))},${Math.round(200 * w.conf)},0,0.35)`; octx.fillRect(w.x * r.width, w.y * r.height, w.w * r.width, w.h * r.height); }
      const tlw = p?.features?.textLayer?.words || [];
      octx.strokeStyle = 'rgba(0,80,255,0.5)';
      for (const w of tlw) octx.strokeRect(w.x * r.width, w.y * r.height, w.w * r.width, w.h * r.height);
      const d = p?.decision;
      let ledger = '<p class="muted">Not classified yet.</p>';
      if (d) {
        const fams = R.FAMILIES;
        ledger = `<table><tr><th>Template</th>${fams.map((f) => `<th>${f}</th>`).join('')}<th>Total</th></tr>` +
          d.candidates.map((c) => `<tr class="${c.templateId === d.templateId ? 'hl' : ''}"><td>${c.templateId}</td>${fams.map((f) => `<td>${c.evidence[f]}</td>`).join('')}<td><b>${c.total}</b></td></tr>`).join('') + '</table>' +
          `<div class="muted">State <b>${d.state}</b>${p.override ? ' (overridden → ' + p.override.templateId + ')' : ''} · rung ${d.rung} · margin ${d.margin} · families ${d.agreeingFamilies.join('+') || '–'}<br>${d.notes.join(' · ')}</div>` +
          `<details><summary>Anchor hits (top candidate)</summary><pre>${JSON.stringify(d.candidates[0]?.detail?.anchor || [], null, 1)}</pre></details>` +
          `<details><summary>Layout / region detail</summary><pre>${JSON.stringify({ layout: d.candidates[0]?.detail?.layout, region: d.candidates[0]?.detail?.region, structure: d.candidates[0]?.detail?.structure }, null, 1)}</pre></details>`;
      }
      const q = p?.features?.quality || {};
      $('insBody').innerHTML = `<div class="insgrid"><div><div class="muted">Original + OCR confidence (red = low) + text layer boxes (blue)</div></div><div><div class="muted">Binarized + detected rules + content box</div></div></div>
        <div class="insgrid" id="insCanvases"></div>
        <div class="stats">
          <div class="stat"><div class="k">Skew</div><div class="v">${pre.skewDeg}°</div></div>
          <div class="stat"><div class="k">Ink</div><div class="v">${pre.inkCoverage}</div></div>
          <div class="stat"><div class="k">Text layer quality</div><div class="v">${q.textLayer ?? '–'}</div></div>
          <div class="stat"><div class="k">OCR conf</div><div class="v">${q.ocrConf ?? '–'}</div></div>
          <div class="stat"><div class="k">phash</div><div class="v mono">${fp.phash64}</div></div>
          <div class="stat"><div class="k">Checkboxes</div><div class="v">${fp.checkboxDensity}</div></div>
          <div class="stat"><div class="k">VINs</div><div class="v small">${(p?.vins || []).map((v) => (v.vin || v.raw) + (v.valid ? ' ✓' : ' ✗') + (v.repaired ? ' (repaired)' : '')).join('<br>') || '–'}</div></div>
        </div>
        <h3>Evidence ledger</h3>${ledger}
        <div class="row">${d ? `<button class="btn" data-act="confirm" data-page="${i}" data-tpl="${d.templateId || ''}" ${d.templateId ? '' : 'disabled'}>Mark correct</button>` : ''}
          <select class="tplsel" data-page="${i}"><option value="">Choose other…</option>${lib.templates.map((t) => `<option value="${t.id}">${t.displayName}</option>`).join('')}</select>
          <button class="btn secondary" data-act="new" data-page="${i}">New document type</button></div>`;
      $('insCanvases').append(orig, bin);
    },
  };

  /* ---------- new template dialog ---------- */
  async function newTypeDialog(pageIndex) {
    const p = state.pages[pageIndex];
    const sug = p ? suggestAnchors(p.features) : [];
    const m = $('newtype'); m.hidden = false;
    $('ntPage').textContent = String(pageIndex + 1);
    $('ntName').value = ''; $('ntId').value = ''; $('ntFolder').value = '05_Compliance';
    $('ntDeal').innerHTML = Object.entries(lib.dealTypes).map(([k, v]) => `<label><input type="checkbox" value="${k}"> ${v.displayName}</label>`).join(' ');
    $('ntAnchors').innerHTML = sug.length ? sug.map((a, i) => `<label><input type="checkbox" checked data-i="${i}"> <span class="mono">${a.text}</span> <span class="muted">(${a.zone}, weight ${a.weight})</span></label>`).join('<br>') : '<span class="muted">No readable header/footer text; the template will rely on layout.</span>';
    m.dataset.page = pageIndex; m._sug = sug;
  }

  /* ---------- templates panel ---------- */
  const tplPanel = {
    render() {
      const el = $('tplList'); if (!el) return;
      el.innerHTML = lib.templates.map((t) => `<div class="tpl"><div><b>${t.displayName}</b> <span class="mono muted">${t.id}</span> · family ${t.family} · folder ${t.routing.folder} · ${t.exemplars.length} exemplar(s)
        ${t.enabled === false ? '<span class="bad">disabled</span>' : ''}</div>
        <div class="muted">anchors: ${t.anchors.map((a) => `${a.text} [${a.zone} ${a.weight}]`).join('; ') || '–'}<br>negatives: ${t.negatives.map((a) => `${a.text} [${a.weight}]`).join('; ') || '–'}</div>
        <div class="row"><button class="btn small secondary" data-act="edit" data-tpl="${t.id}">Edit JSON</button><button class="btn small secondary" data-act="toggle" data-tpl="${t.id}">${t.enabled === false ? 'Enable' : 'Disable'}</button><button class="btn small secondary" data-act="delete" data-tpl="${t.id}">Delete</button></div></div>`).join('');
      $('dealTypes').value = JSON.stringify(lib.dealTypes, null, 2);
      $('folders').value = JSON.stringify(lib.settings.folders, null, 2);
      $('libVersion').textContent = lib.versionHash();
    },
  };

  /* ---------- RCA panel ---------- */
  const rcaPanel = {
    async render() {
      const el = $('rcaBody'); if (!el) return;
      const [evalr, fc, hist] = await Promise.all([RCA.evaluate(lib, lib.settings.thresholds), RCA.failureCounts(), Store.getAll('exemplarHistory').catch(() => [])]);
      el.innerHTML = `<div class="stats">
        <div class="stat"><div class="k">Confirmed pages</div><div class="v">${evalr.n}</div></div>
        <div class="stat"><div class="k">Precision (confident)</div><div class="v">${(evalr.precision * 100).toFixed(1)}%</div></div>
        <div class="stat"><div class="k">Recall</div><div class="v">${(evalr.recall * 100).toFixed(1)}%</div></div>
        <div class="stat"><div class="k">Unknown on replay</div><div class="v">${evalr.unknown}</div></div>
        <div class="stat"><div class="k">Confident-wrong</div><div class="v ${evalr.confidentWrong ? 'bad' : 'ok'}">${evalr.confidentWrong}</div></div>
        <div class="stat"><div class="k">Corrections</div><div class="v">${fc.total}</div><div class="k">${fc.wrong} were fixes</div></div>
      </div>
      <h3>Failures by category</h3><table><tr>${RCA.CATEGORIES.map((c) => `<th>${c}</th>`).join('')}</tr><tr>${RCA.CATEGORIES.map((c) => `<td>${fc.counts[c] || 0}</td>`).join('')}</tr></table>
      <h3>Per template (replay of confirmed pages)</h3><table><tr><th>Template</th><th>n</th><th>confident ✓</th><th>confident ✗</th><th>likely ✓</th><th>unknown</th></tr>
      ${evalr.perTemplate.map((t) => `<tr><td>${t.label}</td><td>${t.n}</td><td>${t.confidentCorrect}</td><td class="${t.confidentWrong ? 'bad' : ''}">${t.confidentWrong}</td><td>${t.likelyCorrect}</td><td>${t.unknown}</td></tr>`).join('')}</table>
      <h3>Recent learning</h3>${hist.slice(-10).reverse().map((h) => `<div class="muted">${h.at.slice(0, 19)} · ${h.templateId} gained exemplar ${h.added || '(none: ' + (h.reason || '') + ')'}${h.dropped ? ', dropped ' + h.dropped : ''} · from page ${(h.pageIndex ?? 0) + 1} <button class="btn small secondary" data-act="undo" data-id="${Object.keys(h).includes('id') ? h.id : ''}" data-key="${h.key || ''}">undo</button></div>`).join('') || '<p class="muted">Nothing learned yet.</p>'}`;
      // attach keys for undo
      const keys = await Store.getAllKeys('exemplarHistory').catch(() => []);
      const btns = el.querySelectorAll('[data-act="undo"]');
      const last = keys.slice(-10).reverse();
      btns.forEach((b, i) => { b.dataset.key = last[i] || ''; });
    },
  };

  function renderNetwork() {
    const el = $('netList'); if (!el) return;
    const after = net.entries.filter((e) => e.afterLoad);
    $('netSummary').textContent = `${net.entries.length} requests during load; ${after.length} after load` + (after.length ? ' (expected: tesseract worker, core and language data on first OCR only)' : '');
    el.innerHTML = net.entries.slice(-60).map((e) => `<div class="mono small ${e.afterLoad ? 'warn' : 'muted'}">${e.at} ms · ${e.url}</div>`).join('');
  }

  /* ---------- wiring ---------- */
  function wire() {
    document.querySelectorAll('nav button').forEach((b) => b.addEventListener('click', () => {
      document.querySelectorAll('nav button').forEach((x) => x.classList.toggle('on', x === b));
      document.querySelectorAll('main > section').forEach((s) => s.classList.toggle('on', s.id === 'tab-' + b.dataset.tab));
      if (b.dataset.tab === 'templates') tplPanel.render();
      if (b.dataset.tab === 'rca') rcaPanel.render();
    }));
    const drop = $('drop');
    const pick = async (file) => { if (!file) return; ui.status('Loading PDF…'); await loadPdf(new Uint8Array(await file.arrayBuffer()), file.name); ui.status(''); };
    drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); pick(e.dataTransfer.files[0]); });
    $('fileInput').addEventListener('change', (e) => pick(e.target.files[0]));
    $('btnRun').addEventListener('click', async () => {
      $('btnRun').disabled = true;
      try { await run({ onProgress: (p) => ui.status(`Page ${p.done}/${p.total} · ${p.state} via ${p.rung}`) }); ui.status(`Done in ${(state.stats.ms / 1000).toFixed(1)} s.`); }
      catch (e) { ui.status('Error: ' + e.message); console.error(e); }
      $('btnRun').disabled = false;
    });
    $('btnCancel').addEventListener('click', () => { state.cancel = true; });
    $('btnFolder').addEventListener('click', async () => {
      if (!window.showDirectoryPicker) { ui.status('This browser cannot write folders directly; a ZIP will be downloaded instead.'); return; }
      try { state.dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' }); $('folderName').textContent = state.dirHandle.name; } catch { /* cancelled */ }
    });
    $('btnWrite').addEventListener('click', () => write().catch((e) => ui.status('Write failed: ' + e.message)));
    $('btnManual').addEventListener('click', () => writeManual($('manualRanges').value).then((r) => ui.status(`Wrote ${r.count} manual files (${r.mode}).`)).catch((e) => ui.status(e.message)));
    document.body.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      const act = b.dataset.act, pg = +b.dataset.page;
      try {
        if (act === 'choose' || act === 'confirm') { await confirm(pg, b.dataset.tpl, act === 'confirm' ? 'confirm' : 'correct'); ui.status(`Page ${pg + 1} → ${b.dataset.tpl}. Library learned an exemplar.`); rcaPanel.render(); if (!$('inspector').hidden) inspector.open(pg); }
        else if (act === 'new') newTypeDialog(pg);
        else if (act === 'inspect') inspector.open(pg);
        else if (act === 'edit') { $('tplJson').value = JSON.stringify(lib.byId(b.dataset.tpl), null, 2); }
        else if (act === 'toggle') { const t = lib.byId(b.dataset.tpl); t.enabled = t.enabled === false; await lib.save(); tplPanel.render(); }
        else if (act === 'delete') { if (confirm(`Delete template ${b.dataset.tpl}?`)) { lib.removeTemplate(b.dataset.tpl); await lib.save(); tplPanel.render(); } }
        else if (act === 'undo') { if (b.dataset.key) { await RCA.undoLearning(b.dataset.key); rcaPanel.render(); tplPanel.render(); } }
      } catch (err) { ui.status('Error: ' + err.message); console.error(err); }
    });
    document.body.addEventListener('change', async (e) => {
      const s = e.target.closest('select.tplsel'); if (!s || !s.value) return;
      const pg = +s.dataset.page; const tpl = s.value; s.value = '';
      await confirm(pg, tpl, 'correct'); ui.status(`Page ${pg + 1} → ${tpl}.`); rcaPanel.render();
    });
    $('insClose').addEventListener('click', () => { $('inspector').hidden = true; });
    $('ntCancel').addEventListener('click', () => { $('newtype').hidden = true; });
    $('ntCreate').addEventListener('click', async () => {
      const m = $('newtype'); const pg = +m.dataset.page;
      const name = $('ntName').value.trim(); const id = ($('ntId').value.trim() || name.toUpperCase().replace(/[^A-Z0-9]+/g, '_').slice(0, 30));
      if (!name || !id) { $('ntMsg').textContent = 'Name is required.'; return; }
      const anchors = [...$('ntAnchors').querySelectorAll('input:checked')].map((c) => m._sug[+c.dataset.i]);
      const requiredFor = [...$('ntDeal').querySelectorAll('input:checked')].map((c) => c.value);
      try { await createTemplateFromPage(pg, { id, displayName: name, family: id, folder: $('ntFolder').value.trim() || '99_Other', requiredFor, anchors }); m.hidden = true; ui.status(`Created ${name}. Add one more example and its siblings can become CONFIDENT.`); tplPanel.render(); }
      catch (err) { $('ntMsg').textContent = err.message; }
    });
    $('btnTplSave').addEventListener('click', async () => {
      try {
        const t = JSON.parse($('tplJson').value);
        const g = await RCA.guardChange(async () => { lib.upsertTemplate(t); });
        if (!g.ok && !confirm(`This change would break ${g.flipped.length} confirmed page(s) (${g.flipped.slice(0, 5).map((f) => 'p.' + (f.pageIndex + 1) + ' ' + f.label + '→' + (f.got || f.now)).join(', ')}${g.flipped.length > 5 ? '…' : ''}); precision ${(g.before.precision * 100).toFixed(1)}% → ${(g.after.precision * 100).toFixed(1)}%. Save anyway?`)) { g.revert(); ui.status('Change reverted.'); return; }
        await lib.save(); tplPanel.render(); ui.status('Template saved.');
      } catch (err) { ui.status('Invalid template: ' + err.message); }
    });
    $('btnDealSave').addEventListener('click', async () => { try { lib.dealTypes = JSON.parse($('dealTypes').value); lib.settings.folders = JSON.parse($('folders').value); await lib.save(); ui.status('Saved.'); } catch (err) { ui.status('Invalid JSON: ' + err.message); } });
    $('btnExport').addEventListener('click', () => download('dealsplit-library.json', lib.exportJSON()));
    $('importInput').addEventListener('change', async (e) => { const f = e.target.files[0]; if (!f) return; try { const r = lib.importJSON(await f.text()); await lib.save(); tplPanel.render(); ui.status(`Imported ${r.templates} templates.`); } catch (err) { ui.status('Import failed: ' + err.message); } });
    $('btnReset').addEventListener('click', async () => { if (confirm('Reset the template library to defaults? Learned exemplars are lost.')) { lib.resetToDefaults(); await lib.save(); tplPanel.render(); } });
    $('btnExportLog').addEventListener('click', async () => download('dealsplit-log-redacted.json', await RCA.exportRedactedLog()));
    $('btnThSave').addEventListener('click', async () => {
      const th = { accept: +$('thAccept').value, margin: +$('thMargin').value, likely: +$('thLikely').value, textQualityMin: +$('thText').value, ocrConfMin: +$('thOcr').value, layoutMinExemplars: +$('thEx').value };
      const g = await RCA.guardChange(async () => { lib.settings.thresholds = { ...lib.settings.thresholds, ...th }; });
      if (!g.ok && !confirm(`These thresholds would break ${g.flipped.length} confirmed page(s); precision ${(g.before.precision * 100).toFixed(1)}% → ${(g.after.precision * 100).toFixed(1)}%. Save anyway?`)) { g.revert(); return; }
      lib.settings.ocrWorkers = +$('setWorkers').value || 1;
      await lib.save(); ui.status('Settings saved.');
    });
    $('btnClearData').addEventListener('click', async () => { if (confirm('Delete all stored decisions, corrections and OCR cache? (Templates are kept.)')) { for (const s of ['ocr', 'decisions', 'corrections', 'exemplarHistory', 'confirmed']) await Store.clear(s); rcaPanel.render(); } });
    lib.onChange(() => { $('thAccept').value = lib.settings.thresholds.accept; $('thMargin').value = lib.settings.thresholds.margin; $('thLikely').value = lib.settings.thresholds.likely; $('thText').value = lib.settings.thresholds.textQualityMin; $('thOcr').value = lib.settings.thresholds.ocrConfMin; $('thEx').value = lib.settings.thresholds.layoutMinExemplars; $('setWorkers').value = lib.settings.ocrWorkers; });
  }
  function download(name, text) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = name; a.click(); }

  async function boot() {
    watchNetwork();
    wire();
    try { await loadLibs(ui.status); }
    catch (e) { ui.status('Could not load libraries: ' + e.message + '. Check the network or the self-hosting settings.'); return; }
    await lib.load();
    tplPanel.render();
    net.loadedAt = performance.now();
    $('btnRun').disabled = !state.pdf;
    ui.status('Ready. Drop a PDF.');
    window.dispatchEvent(new Event('dealsplit-ready'));
  }

  /* Public API (also used by the automated tests). */
  window.DealSplit = { state, lib, loadPdf, run, assemble, confirm, createTemplateFromPage, suggestAnchors, write, writeManual, parseRanges, net, LIBS, ready: new Promise((r) => window.addEventListener('dealsplit-ready', r, { once: true })) };
  return { boot, ui };
})();
