/* =====================================================================
 * RCA: decision log, corrections → exemplar learning, failure taxonomy,
 * regression harness, drift alarms, redacted export.
 * Uses Infra, Knowledge (library) and Reasoner (replay). Never Policy.
 * ===================================================================== */
DS.RCA = (() => {
  'use strict';
  const { Store, uid, round, hamming64 } = DS.Infra;
  const { lib } = DS.Knowledge;

  /* ---------- feature records (redacted) ----------
   * Stored per confirmed page so the reasoner can be replayed without PDFs
   * and shared without PII: text is reduced to anchor-hit records.
   */
  function redactFeatures(features) {
    const strip = (src) => src ? { words: [], quality: src.quality, meanConf: src.meanConf, text: '', wordCount: src.words?.length || 0 } : null;
    return {
      quality: features.quality, fingerprint: features.fingerprint, textHash: features.textHash, pageHash: features.pageHash,
      textLayer: strip(features.textLayer), ocrHeader: strip(features.ocrHeader), ocrFooter: strip(features.ocrFooter), ocrFull: strip(features.ocrFull),
      redacted: true,
    };
  }
  /* Confirmed-page records keep the page's text and features so the reasoner
   * can be replayed against a changed library. They stay in this browser's
   * IndexedDB (like the OCR cache); the exported log is what gets redacted.
   */
  function makeRecord(pageIndex, features, decision, label, batchId) {
    const { thumb, ...feat } = features;
    return { id: uid(), pageIndex, batchId, label, features: feat, rung: decision.rung,
             decision: { state: decision.state, templateId: decision.templateId, score: decision.score, margin: decision.margin, rung: decision.rung },
             at: new Date().toISOString() };
  }

  /* Replay one record through the real reasoner. */
  function replayRecord(rec, library, thresholds) {
    const d = DS.Reasoner.replay({ ...rec.features, pageIndex: rec.pageIndex, rung: rec.rung }, library, thresholds);
    return { state: d.state, templateId: d.templateId, score: d.score, margin: d.margin };
  }

  /* ---------- regression harness ---------- */
  async function evaluate(library, thresholds) {
    const recs = await Store.getAll('confirmed').catch(() => []);
    const perTemplate = {};
    let unknown = 0, correct = 0, confidentWrong = 0, confident = 0;
    const flips = [];
    for (const r of recs) {
      const out = replayRecord(r, library, thresholds);
      const t = perTemplate[r.label] || (perTemplate[r.label] = { label: r.label, n: 0, confidentCorrect: 0, confidentWrong: 0, likelyCorrect: 0, unknown: 0 });
      t.n++;
      if (out.state === 'UNKNOWN') { unknown++; t.unknown++; }
      else if (out.templateId === r.label) { correct++; if (out.state === 'CONFIDENT') { t.confidentCorrect++; confident++; } else t.likelyCorrect++; }
      else if (out.state === 'CONFIDENT') { confidentWrong++; confident++; t.confidentWrong++; flips.push({ pageIndex: r.pageIndex, batchId: r.batchId, label: r.label, got: out.templateId }); }
      if (r.decision.state === 'CONFIDENT' && r.decision.templateId === r.label && out.templateId !== r.label) {
        if (!flips.some((f) => f.pageIndex === r.pageIndex && f.batchId === r.batchId)) flips.push({ pageIndex: r.pageIndex, batchId: r.batchId, label: r.label, got: out.templateId, from: 'CONFIDENT-correct' });
      }
    }
    const precision = confident ? (confident - confidentWrong) / confident : 1;
    const recall = recs.length ? correct / recs.length : 1;
    return { n: recs.length, precision: round(precision), recall: round(recall), unknown, confidentWrong, flips, perTemplate: Object.values(perTemplate) };
  }
  /* Guard a library/threshold change. Replays every confirmed page before and
   * after; the change is refused when any page that was classified correctly
   * would flip to wrong or unknown, or when precision drops. Returns the
   * flipped pages so the user sees exactly what the change would break.
   */
  async function perRecord(library, thresholds) {
    const recs = await Store.getAll('confirmed').catch(() => []);
    return recs.map((r) => { const out = replayRecord(r, library, thresholds); return { key: `${r.batchId}:${r.pageIndex}`, pageIndex: r.pageIndex, batchId: r.batchId, label: r.label, ...out, correct: out.state !== 'UNKNOWN' && out.templateId === r.label }; });
  }
  async function guardChange(applyFn) {
    const before = await evaluate(lib, lib.settings.thresholds);
    const beforeRows = await perRecord(lib, lib.settings.thresholds);
    const snapshot = { templates: JSON.parse(JSON.stringify(lib.templates)), thresholds: { ...lib.settings.thresholds }, dealTypes: JSON.parse(JSON.stringify(lib.dealTypes)) };
    await applyFn();
    const after = await evaluate(lib, lib.settings.thresholds);
    const afterRows = await perRecord(lib, lib.settings.thresholds);
    const flipped = [];
    for (let i = 0; i < beforeRows.length; i++) {
      const b = beforeRows[i], a = afterRows.find((x) => x.key === b.key);
      if (b.correct && a && !a.correct) flipped.push({ pageIndex: b.pageIndex, batchId: b.batchId, label: b.label, was: b.state, now: a.state, got: a.templateId });
    }
    const ok = after.precision >= before.precision && flipped.length === 0;
    return { ok, before, after, flipped, revert: () => { lib.templates = snapshot.templates; lib.settings.thresholds = snapshot.thresholds; lib.dealTypes = snapshot.dealTypes; } };
  }

  /* ---------- corrections ---------- */
  const CATEGORIES = ['Perception', 'Feature', 'Knowledge', 'Reasoning', 'Segmentation', 'Grouping', 'Policy'];
  /* Auto-classify why a decision was wrong, from its ledger. */
  function classifyFailure(decision, features, correctTemplateId, library) {
    const reasons = [];
    const top = decision.candidates[0];
    const right = decision.candidates.find((c) => c.templateId === correctTemplateId);
    const tl = features.textLayer;
    if (tl && tl.quality.score < 0.45 && decision.textSources.some((v) => v.source === 'textLayer' && v.trusted)) reasons.push(['Perception', 'garbage text layer was trusted']);
    if (Math.abs(features.quality?.skewDeg || 0) > 2.5) reasons.push(['Perception', `skew ${features.quality.skewDeg}° may not be fully corrected`]);
    const ocrConf = features.ocrFull?.meanConf ?? features.ocrHeader?.meanConf;
    if (ocrConf !== undefined && ocrConf < 0.55 && decision.rung.startsWith('OCR')) reasons.push(['Perception', `OCR confidence ${ocrConf} below threshold`]);
    if (!right) reasons.push(['Knowledge', `template ${correctTemplateId} not in candidates (missing or disabled)`]);
    else {
      if (right.evidence.anchor <= 0 && (tl?.quality.score >= 0.45 || (ocrConf ?? 0) >= 0.55)) reasons.push(['Knowledge', 'anchors did not match readable text: revision changed wording or anchor missing']);
      if (top && top.templateId !== correctTemplateId && top.evidence.anchor > 0 && right.evidence.anchor > 0) reasons.push(['Knowledge', `anchors of ${top.templateId} also match this page: add a negative anchor`]);
      const tpl = library.byId(correctTemplateId);
      if (tpl && tpl.exemplars.length < 2) reasons.push(['Knowledge', `template has ${tpl.exemplars.length} exemplar(s): layout evidence unavailable`]);
      if (top && right && features.fingerprint && library.byId(top.templateId)?.exemplars.length && tpl?.exemplars.length) {
        const dTop = top.detail?.layout?.hamming, dRight = right.detail?.layout?.hamming;
        if (dTop !== undefined && dRight !== undefined && Math.abs(dTop - dRight) <= 4) reasons.push(['Feature', `fingerprints collide: hamming ${dTop} vs ${dRight}`]);
      }
      if (decision.state === 'CONFIDENT' && top.templateId !== correctTemplateId) reasons.push(['Reasoning', `confident-wrong: margin ${decision.margin}, families ${decision.agreeingFamilies.join('+')}`]);
      if (decision.state !== 'CONFIDENT' && top.templateId === correctTemplateId) reasons.push(['Reasoning', `right template on top but abstained: ${decision.notes.join('; ')}`]);
    }
    if (!reasons.length) reasons.push(['Reasoning', 'evidence combination did not favour the correct template']);
    return { category: reasons[0][0], reasons: reasons.map((r) => `${r[0]}: ${r[1]}`) };
  }

  /* Record a correction/confirmation and learn from it. */
  async function applyCorrection({ pageIndex, batchId, features, decision, templateId, kind }) {
    const wasCorrect = decision.templateId === templateId && decision.state !== 'UNKNOWN';
    const failure = wasCorrect ? null : classifyFailure(decision, features, templateId, lib);
    const rec = makeRecord(pageIndex, features, decision, templateId, batchId);
    await Store.put('confirmed', `${batchId}:${pageIndex}`, rec);
    let learned = null;
    if (features.fingerprint) {
      const before = lib.byId(templateId)?.exemplars.map((e) => e.id) || [];
      const r = lib.addExemplar(templateId, features.fingerprint, { fromPage: pageIndex, batchId });
      learned = { added: r.added?.id || null, dropped: r.dropped?.id || null, reason: r.reason || null, before, after: lib.byId(templateId).exemplars.map((e) => e.id) };
      await Store.put('exemplarHistory', uid(), { templateId, ...learned, at: new Date().toISOString(), pageIndex, batchId });
      await lib.save();
    }
    const correction = { id: uid(), at: new Date().toISOString(), batchId, pageIndex, kind, from: { state: decision.state, templateId: decision.templateId }, to: templateId,
                         failure, ledger: decision.candidates.map((c) => ({ templateId: c.templateId, total: c.total, evidence: c.evidence })), rung: decision.rung, thresholds: decision.thresholds, libraryVersion: decision.libraryVersion };
    await Store.put('corrections', correction.id, correction);
    return { correction, learned, failure };
  }
  async function undoLearning(historyId) {
    const h = await Store.get('exemplarHistory', historyId);
    if (!h) return false;
    if (h.added) lib.removeExemplar(h.templateId, h.added);
    await lib.save();
    await Store.del('exemplarHistory', historyId);
    return true;
  }

  /* ---------- decision log ---------- */
  async function logDecisions(batchId, decisions, featuresList, meta) {
    const entries = decisions.map((d, i) => ({ ...d, pageHash: featuresList[i]?.pageHash, textHash: featuresList[i]?.textHash, fingerprint: featuresList[i]?.fingerprint }));
    await Store.put('decisions', batchId, { batchId, at: new Date().toISOString(), meta, entries });
  }
  /* Export the log with content redacted: keeps hashes, boxes, scores and anchor names; strips word text. */
  async function exportRedactedLog(batchId) {
    const rec = batchId ? [await Store.get('decisions', batchId)] : await Store.getAll('decisions');
    const corr = await Store.getAll('corrections');
    const clean = (rec || []).filter(Boolean).map((b) => ({ ...b, entries: b.entries.map((e) => ({ ...e, candidates: e.candidates.map((c) => ({ ...c, detail: c.detail ? { ...c.detail, anchor: (c.detail.anchor || []).map((h) => ({ anchor: h.text, zone: h.zone, sim: h.sim, source: h.source, contribution: h.contribution })), negative: (c.detail.negative || []).map((h) => ({ anchor: h.text, sim: h.sim, contribution: h.contribution })) } : null })) })) }));
    return JSON.stringify({ format: 'dealsplit-log', redacted: true, exportedAt: new Date().toISOString(), batches: clean, corrections: corr, libraryVersion: lib.versionHash() }, null, 2);
  }

  /* ---------- drift ---------- */
  async function driftReport(currentBatch) {
    const all = (await Store.getAll('decisions').catch(() => [])).filter((b) => b.batchId !== currentBatch.batchId);
    const hist = {};
    let histEsc = 0, histN = 0;
    for (const b of all) for (const e of b.entries) {
      histN++; if (e.rung.startsWith('OCR')) histEsc++;
      if (e.state === 'CONFIDENT') (hist[e.templateId] = hist[e.templateId] || []).push(e.score);
    }
    const alarms = [];
    const cur = {};
    let curEsc = 0;
    for (const e of currentBatch.entries) { if (e.rung.startsWith('OCR')) curEsc++; if (e.state === 'CONFIDENT') (cur[e.templateId] = cur[e.templateId] || []).push({ score: e.score, page: e.pageIndex + 1 }); }
    const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    const sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length); };
    for (const [tid, list] of Object.entries(cur)) {
      const h = hist[tid];
      if (!h || h.length < 8 || list.length < 3) continue;
      const hm = mean(h), hs = Math.max(0.5, sd(h));
      const cm = mean(list.map((x) => x.score));
      if (cm < hm - 1.2 * hs) {
        const low = list.filter((x) => x.score < hm - hs).map((x) => x.page);
        alarms.push({ templateId: tid, message: `Scanner or form revision may have changed: ${low.length} ${tid} pages scored lower than usual (mean ${round(cm, 1)} vs ${round(hm, 1)})`, pages: low });
      }
    }
    if (histN >= 40) {
      const hr = histEsc / histN, cr = curEsc / Math.max(1, currentBatch.entries.length);
      if (cr > hr * 1.8 + 0.1) alarms.push({ templateId: null, message: `OCR escalation rate jumped: ${round(cr * 100, 0)}% of pages needed OCR (usually ${round(hr * 100, 0)}%)`, pages: [] });
    }
    return alarms;
  }

  async function failureCounts() {
    const corr = await Store.getAll('corrections').catch(() => []);
    const counts = Object.fromEntries(CATEGORIES.map((c) => [c, 0]));
    for (const c of corr) if (c.failure) counts[c.failure.category] = (counts[c.failure.category] || 0) + 1;
    return { counts, total: corr.length, wrong: corr.filter((c) => c.failure).length };
  }

  return { makeRecord, replayRecord, evaluate, guardChange, classifyFailure, applyCorrection, undoLearning, logDecisions, exportRedactedLog, driftReport, failureCounts, CATEGORIES, redactFeatures };
})();
