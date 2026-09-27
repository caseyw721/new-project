/* =====================================================================
 * Layer C: Reasoning. Features + library → classification with evidence.
 * An evidence accumulator with abstention; never an if/else over keywords.
 * Uses DS.Infra, DS.Perception (feature math only) and DS.Knowledge (data).
 * ===================================================================== */
DS.Reasoner = (() => {
  'use strict';
  const { hamming64, cosine, fuzzyFind, clamp, round, deepFreeze } = DS.Infra;
  const { lineSigSim } = DS.Perception;

  const FAMILIES = ['anchor', 'layout', 'region', 'structure', 'negative', 'context'];
  const RUNGS = ['TEXT', 'FINGERPRINT', 'OCR_STRIPS', 'OCR_FULL', 'NONE'];

  class InvariantViolation extends Error { constructor(m) { super('Invariant: ' + m); this.name = 'InvariantViolation'; } }
  function assert(cond, msg) { if (!cond) throw new InvariantViolation(msg); }

  /* ---------- text sources ----------
   * A "text view" merges what we know: text layer (if trusted) and OCR
   * results, each with a reliability in 0..1 used to scale anchor evidence.
   */
  function zoneOf(word, box) {
    const cy = word.y + word.h / 2;
    const h = box ? box.y1 - box.y0 : 1, y0 = box ? box.y0 : 0;
    const rel = (cy - y0) / h;
    return rel < 0.16 ? 'header' : rel > 0.86 ? 'footer' : 'body';
  }
  function buildTextView(features, thresholds) {
    const views = [];
    const tl = features.textLayer;
    if (tl && tl.words.length) {
      const trusted = tl.quality.score >= thresholds.textQualityMin;
      views.push({ source: 'textLayer', reliability: trusted ? clamp(0.6 + tl.quality.score * 0.4, 0, 1) : 0, trusted, words: tl.words });
    }
    for (const key of ['ocrHeader', 'ocrFooter', 'ocrFull']) {
      const o = features[key];
      if (o && o.words.length) {
        const ok = o.meanConf >= thresholds.ocrConfMin;
        views.push({ source: key, reliability: ok ? clamp(o.meanConf, 0, 1) : o.meanConf * 0.3, trusted: ok, words: o.words });
      }
    }
    const box = features.fingerprint?.contentBox;
    for (const v of views) {
      // Per zone: normalized words and their confidences (1 for a text layer),
      // so an anchor can be weighted by the words it actually matched rather
      // than by the page's mean confidence (garbage body text must not hide a
      // clearly read title).
      const z = { header: [], footer: [], body: [], any: [] };
      for (const w of v.words) {
        const t = DS.Infra.normText(w.text);
        if (!t) continue;
        const c = w.conf === undefined ? 1 : w.conf;
        for (const tok of t.split(' ')) { const zn = zoneOf(w, box); z[zn].push([tok, c]); z.any.push([tok, c]); }
      }
      v.zoneWords = {}; v.zoneText = {};
      for (const k of Object.keys(z)) { v.zoneWords[k] = z[k]; v.zoneText[k] = z[k].map((x) => x[0]).join(' '); }
    }
    return views;
  }

  /* ---------- evidence families ---------- */
  function anchorEvidence(tpl, views, thresholds) {
    const hits = [];
    let total = 0, trustedOcrHit = false;
    const eval1 = (a, sign) => {
      let best = null;
      for (const v of views) {
        if (!v.reliability && v.source === 'textLayer') continue;   // untrusted text layer: ignore entirely
        const hay = v.zoneText[a.zone] || '';
        if (!hay) continue;
        const { sim, at } = fuzzyFind(a.text, hay);
        if (sim < a.fuzzy) continue;
        // confidence of the matched window
        const n = a.text.split(' ').length;
        const ws = v.zoneWords[a.zone].slice(Math.max(0, at), at + n);
        const wc = ws.length ? ws.reduce((x, y) => x + y[1], 0) / ws.length : 0;
        // OCR reliability rises smoothly from 0 at conf 0.3 to 1 at conf 0.7.
        const rel = v.source === 'textLayer' ? v.reliability : clamp((wc - 0.3) / 0.4, 0, 1);
        if (!best || sim * rel > best.sim * best.reliability) best = { sim, reliability: rel, source: v.source, conf: wc };
      }
      if (best) {
        const strength = (best.sim - a.fuzzy) / (1 - a.fuzzy);        // 0..1 above the template's threshold
        const c = sign * Math.abs(a.weight) * (0.5 + 0.5 * strength) * best.reliability;
        hits.push({ text: a.text, zone: a.zone, weight: a.weight, sim: round(best.sim), conf: round(best.conf), source: best.source, contribution: round(c, 2) });
        total += c;
        if (best.source !== 'textLayer' && best.conf >= thresholds.ocrConfMin) trustedOcrHit = true;
      }
    };
    for (const a of tpl.anchors) eval1(a, +1);
    const pos = total;
    const posHits = hits.length;
    total = 0;
    for (const a of tpl.negatives) eval1(a, -1);
    return { anchor: { score: round(pos, 2), hits: hits.slice(0, posHits), trustedOcrHit }, negative: { score: round(total, 2), hits: hits.slice(posHits) } };
  }

  function layoutEvidence(tpl, fp, minExemplars) {
    if (!fp || !tpl.exemplars.length) return { score: 0, detail: 'no exemplars' };
    let best = null;
    for (const e of tpl.exemplars) {
      if (e.orientation !== fp.orientation) continue;
      const d = hamming64(e.phash64, fp.phash64);
      const cs = 0.5 * cosine(e.bandProfile.rows, fp.bandProfile.rows) + 0.5 * cosine(e.bandProfile.cols, fp.bandProfile.cols);
      const ls = lineSigSim(e.lineSig, fp.lineSig);
      // Hamming ≤ 6 is a near-identical page; ≥ 22 is unrelated.
      const ph = clamp((22 - d) / 16, 0, 1);
      const s = 3.0 * ph + 2.5 * clamp((cs - 0.75) / 0.25, 0, 1) + 1.5 * ls;
      if (!best || s > best.s) best = { s, d, cs: round(cs), ls, exemplar: e.id };
    }
    if (!best) return { score: 0, detail: 'orientation mismatch' };
    const capped = tpl.exemplars.length < minExemplars;
    return { score: round(best.s, 2), hamming: best.d, profileCos: best.cs, lineSim: best.ls, exemplar: best.exemplar,
             capped, detail: capped ? `only ${tpl.exemplars.length} exemplar(s): layout cannot reach CONFIDENT` : '' };
  }

  function regionEvidence(tpl, fp) {
    if (!fp || !tpl.exemplars.length) return { score: 0, zones: [] };
    let bestScore = -1, bestZones = null;
    for (const e of tpl.exemplars) {
      if (!e.regionHashes) continue;
      const zones = [];
      let s = 0;
      for (let i = 0; i < 6; i++) {
        const inkA = fp.regionInk?.[i] ?? 0, inkB = e.regionInk?.[i] ?? 0;
        if (inkA < 0.004 && inkB < 0.004) { zones.push({ i, d: null }); continue; } // both blank: no information
        if ((inkA < 0.004) !== (inkB < 0.004)) { zones.push({ i, d: 64 }); s -= 0.4; continue; }
        const d = hamming64(e.regionHashes[i], fp.regionHashes[i]);
        zones.push({ i, d });
        s += clamp((20 - d) / 14, -0.5, 1) * (i === 3 || i === 4 || i === 5 ? 0.9 : 0.7); // footer zones (form ids) matter slightly more
      }
      if (s > bestScore) { bestScore = s; bestZones = zones; }
    }
    return { score: round(clamp(bestScore, -2, 4.5), 2), zones: bestZones || [] };
  }

  function structureEvidence(tpl, fp) {
    if (!fp) return { score: 0 };
    let s = 0;
    const notes = [];
    if (tpl.exemplars.length) {
      const ex = tpl.exemplars;
      const cbMean = ex.reduce((a, e) => a + (e.checkboxDensity || 0), 0) / ex.length;
      const cbDiff = Math.abs(cbMean - fp.checkboxDensity) / Math.max(0.5, cbMean, fp.checkboxDensity);
      s += cbDiff < 0.35 ? 0.4 : cbDiff > 0.8 ? -0.4 : 0;
      notes.push(`checkbox ${fp.checkboxDensity} vs ${round(cbMean, 2)}`);
      if (ex.every((e) => e.orientation !== fp.orientation)) { s -= 1.5; notes.push('orientation differs from all exemplars'); }
      const aspMean = ex.reduce((a, e) => a + e.aspect, 0) / ex.length;
      if (Math.abs(aspMean - fp.aspect) > 0.08) { s -= 0.5; notes.push('aspect differs'); }
    }
    return { score: round(s, 2), notes };
  }

  /* ---------- per-page scoring ---------- */
  const TITLED_ELSEWHERE = 2, TITLED_IMAGE_CAP = 2;
  function scorePage(features, library, thresholds) {
    const views = buildTextView(features, thresholds);
    const fp = features.fingerprint;
    const rows = [];
    for (const tpl of library.templates) {
      if (tpl.enabled === false) continue;
      const { anchor, negative } = anchorEvidence(tpl, views, thresholds);
      const layout = layoutEvidence(tpl, fp, thresholds.layoutMinExemplars);
      const region = regionEvidence(tpl, fp);
      const structure = structureEvidence(tpl, fp);
      const ev = { anchor: anchor.score, layout: layout.score, region: region.score, structure: structure.score, negative: negative.score, context: 0 };
      const total = ev.anchor + ev.layout + ev.region + ev.structure + ev.negative;
      rows.push({ templateId: tpl.id, family: tpl.family, total: round(total, 2), evidence: ev,
                  detail: { anchor: anchor.hits, negative: negative.hits, layout, region, structure },
                  layoutCapped: !!layout.capped });
    }
    // The page names itself: an exact, confidently read hit on a strong anchor
    // (a title, weight ≥ 3) of template A means every template whose anchors
    // were all absent from the same text is a look-alike, not a candidate.
    // Forms from one dealership share a skeleton, so their layouts resemble
    // each other (especially when scanner noise dominates the hash): image
    // evidence for such a template is capped and a negative is recorded.
    const titled = rows.filter((r) => r.detail.anchor.some((h) => h.weight >= 3 && h.sim >= 0.95 && (h.source === 'textLayer' || h.conf >= thresholds.ocrConfMin)));
    if (titled.length === 1) {
      const t = titled[0];
      for (const r of rows) {
        if (r === t || r.detail.anchor.length || !library.byId(r.templateId)?.anchors?.length) continue;
        const img = r.evidence.layout + r.evidence.region;
        if (img > TITLED_IMAGE_CAP) { const k = TITLED_IMAGE_CAP / img; r.evidence.layout = round(r.evidence.layout * k, 2); r.evidence.region = round(r.evidence.region * k, 2); }
        r.evidence.negative = round(r.evidence.negative - TITLED_ELSEWHERE, 2);
        r.total = round(r.evidence.anchor + r.evidence.layout + r.evidence.region + r.evidence.structure + r.evidence.negative, 2);
        r.detail.negative = [...r.detail.negative, { text: `page titled as ${t.templateId}`, zone: 'header', sim: 1, conf: 1, source: 'inferred', contribution: -TITLED_ELSEWHERE, imageCapped: img > TITLED_IMAGE_CAP }];
      }
    }
    rows.sort((a, b) => b.total - a.total);
    const textTrusted = views.some((v) => v.trusted && v.source === 'textLayer');
    // OCR counts as trusted when the page reads well overall, or when the top
    // candidate's anchors were matched by confidently read words.
    const ocrTrusted = views.some((v) => v.trusted && v.source !== 'textLayer') || !!rows[0]?.detail?.anchor?.some((h) => h.source !== 'textLayer' && h.conf >= thresholds.ocrConfMin);
    return { rows, textTrusted, ocrTrusted, views: views.map((v) => ({ source: v.source, reliability: round(v.reliability), trusted: v.trusted })) };
  }

  /* Families that agree: positive contribution above a floor. */
  function agreeingFamilies(ev) {
    const out = [];
    if (ev.anchor >= 2) out.push('anchor');
    if (ev.layout >= 2.5) out.push('layout');
    if (ev.region >= 1.5) out.push('region');
    if (ev.structure >= 0.4) out.push('structure');
    if (ev.context >= 1.5) out.push('context');
    return out;
  }
  /* Independent evidence groups for the CONFIDENT rule. Layout and region are
   * both derived from the same exemplar images, so together they count once
   * ("image"); structure is too weak to count. Text (anchor) and context are
   * the other independent sources. Image-only evidence can never be CONFIDENT.
   */
  function independentGroups(families) {
    const g = new Set();
    for (const f of families) { if (f === 'anchor') g.add('anchor'); else if (f === 'layout' || f === 'region') g.add('image'); else if (f === 'context') g.add('context'); }
    return [...g];
  }

  /* ---------- decision rule ---------- */
  function decide(scored, features, thresholds, rung, library) {
    const [top, second] = scored.rows;
    const notes = [];
    if (!top) return { state: 'UNKNOWN', notes: ['no templates'] };
    // Negative evidence is always evaluated (it is already inside total; assert it was computed).
    assert(typeof top.evidence.negative === 'number', 'negative evidence must be evaluated');
    const margin = second ? top.total - second.total : top.total;
    const families = agreeingFamilies(top.evidence);
    // Layout family cannot count when the template has too few exemplars.
    const tpl = library.byId(top.templateId);
    assert(!(top.layoutCapped && top.evidence.layout >= 2.5 && families.includes('layout') && tpl.exemplars.length >= thresholds.layoutMinExemplars),
      'layout cap bookkeeping');
    const famEff = families.filter((f) => !(f === 'layout' && top.layoutCapped));
    const groups = independentGroups(famEff);
    // Text-only identity is forbidden when neither text source is trustworthy.
    const textOnly = famEff.every((f) => f === 'anchor' || f === 'context');
    if (textOnly && !scored.textTrusted && !scored.ocrTrusted) {
      notes.push('text evidence untrusted (layer quality and OCR confidence both below threshold)');
      assert(true, 'text-only identity with untrusted text is blocked');
      return { state: top.total >= thresholds.likely ? 'LIKELY' : 'UNKNOWN', margin, families: famEff, notes, blocked: 'untrusted-text' };
    }
    let state = 'UNKNOWN';
    const imageOnly = groups.length === 1 && groups[0] === 'image';
    if (top.total >= thresholds.accept && margin >= thresholds.margin && groups.length >= 2) state = 'CONFIDENT';
    // Image evidence alone cannot tell an unseen form from a look-alike near
    // the threshold, so it needs a clearly higher bar and both image
    // families (whole-page layout and header/footer zones) agreeing.
    else if (imageOnly && famEff.includes('layout') && famEff.includes('region') && top.total >= thresholds.imageOnlyAccept && margin >= thresholds.imageOnlyMargin) { state = 'CONFIDENT'; notes.push('image-only confidence (high bar)'); }
    else if (top.total >= thresholds.likely) state = 'LIKELY';
    if (state !== 'CONFIDENT') {
      if (top.total < thresholds.accept) notes.push(`score ${top.total} < accept ${thresholds.accept}`);
      if (margin < thresholds.margin) notes.push(`margin ${round(margin, 2)} < ${thresholds.margin}`);
      if (groups.length < 2) notes.push(imageOnly ? `image evidence only (${famEff.join('+')}): needs score ≥ ${thresholds.imageOnlyAccept} and margin ≥ ${thresholds.imageOnlyMargin}, or readable anchors` : `only ${groups.length} independent evidence group (${groups.join(',') || 'none'}; families ${famEff.join('+') || 'none'})`);
      if (top.layoutCapped) notes.push(top.detail.layout.detail);
    }
    return { state, margin: round(margin, 2), families: famEff, notes };
  }

  /* Build the immutable decision object. */
  function makeDecision({ pageIndex, features, scored, verdict, rung, thresholds, libraryVersion, timings }) {
    const top = scored.rows[0];
    const d = {
      pageIndex, state: verdict.state,
      templateId: verdict.state === 'UNKNOWN' ? null : top?.templateId || null,
      family: verdict.state === 'UNKNOWN' ? null : top?.family || null,
      score: top?.total ?? 0, margin: verdict.margin ?? 0, agreeingFamilies: verdict.families || [],
      rung, notes: verdict.notes || [], blocked: verdict.blocked || null,
      candidates: scored.rows.slice(0, 5).map((r) => ({ templateId: r.templateId, total: r.total, evidence: r.evidence, detail: r.detail })),
      textSources: scored.views, quality: features.quality,
      thresholds: { ...thresholds }, libraryVersion, timings: { ...timings }, decidedAt: new Date().toISOString(),
    };
    return deepFreeze(d);
  }

  /* ---------- escalation ladder ----------
   * `perceive` is an async callback provided by the orchestrator: given a
   * rung name it fills in the corresponding features (text layer,
   * fingerprint, OCR strips, OCR full) and returns the features object.
   */
  async function classifyPage(pageIndex, perceive, library, thresholds, log) {
    const t0 = DS.Infra.now();
    const timings = {};
    let features = null, scored = null, verdict = null, rung = 'NONE';
    const ladder = [
      { rung: 'TEXT', need: 'textLayer' },
      { rung: 'FINGERPRINT', need: 'fingerprint' },
      { rung: 'OCR_STRIPS', need: 'ocrStrips' },
      { rung: 'OCR_FULL', need: 'ocrFull' },
    ];
    for (const step of ladder) {
      const ts = DS.Infra.now();
      features = await perceive(step.need, features);
      timings[step.rung] = round(DS.Infra.now() - ts, 1);
      // Skip pointless rungs: no text layer at all → straight to fingerprint.
      if (step.rung === 'TEXT' && (!features.textLayer || !features.textLayer.words.length)) continue;
      scored = scorePage(features, library, thresholds);
      try {
        verdict = decide(scored, features, thresholds, step.rung, library);
      } catch (e) {
        if (e instanceof InvariantViolation) { verdict = { state: 'UNKNOWN', notes: [e.message], families: [] }; log?.('invariant', e.message); }
        else throw e;
      }
      rung = step.rung;
      if (verdict.state === 'CONFIDENT') break;
      // OCR cannot add information when the embedded text layer is already
      // trustworthy: it would read the same words. Stop escalating there.
      if (step.rung === 'FINGERPRINT' && scored.textTrusted) { verdict.notes = [...(verdict.notes || []), 'OCR skipped: text layer trusted']; break; }
    }
    if (!scored) { // no rung produced a score (e.g. no templates)
      scored = { rows: [], textTrusted: false, ocrTrusted: false, views: [] };
      verdict = { state: 'UNKNOWN', notes: ['no evidence'], families: [] };
    }
    timings.total = round(DS.Infra.now() - t0, 1);
    return { decision: makeDecision({ pageIndex, features, scored, verdict, rung, thresholds, libraryVersion: library.versionHash(), timings }), features };
  }

  /* ---------- context pass (second pass, after per-page decisions) ----------
   * Neighbouring pages inform LIKELY/UNKNOWN pages: a page between two pages
   * of the same family, or following page n-1 with a matching continuation
   * marker, gets context evidence. Returns new (immutable) decisions.
   */
  function contextPass(decisions, featuresList, library, thresholds) {
    const out = decisions.slice();
    const contOf = (i) => {
      const f = featuresList[i];
      const txt = (f?.textLayer?.text || '') + ' ' + (f?.ocrHeader?.text || '') + ' ' + (f?.ocrFooter?.text || '');
      const m = /PAGE (\d+) OF (\d+)/.exec(txt);
      return m ? { n: +m[1], of: +m[2] } : null;
    };
    for (let i = 0; i < decisions.length; i++) {
      const d = decisions[i];
      if (d.state === 'CONFIDENT') continue;
      const prev = out[i - 1], next = out[i + 1];
      let boost = 0, from = null, why = [];
      const cand = (tid) => d.candidates.find((c) => c.templateId === tid);
      const consider = (nb, tag) => {
        if (!nb || nb.state !== 'CONFIDENT') return;
        const c = cand(nb.templateId);
        if (!c) return;
        const tpl = library.byId(nb.templateId);
        const cont = contOf(i), contNb = contOf(i - 1);
        let b = 0;
        if (tag === 'prev' && cont && contNb && cont.n === contNb.n + 1 && cont.of === contNb.of) { b = 4; why.push(`page ${cont.n} of ${cont.of} follows page ${contNb.n}`); }
        else if (tag === 'prev' && cont && cont.n > 1 && tpl.expectedPages.max >= cont.n) { b = 2.5; why.push(`page ${cont.n} of ${cont.of} after a ${tpl.id} page`); }
        else if (prev && next && prev.state === 'CONFIDENT' && next.state === 'CONFIDENT' && prev.templateId === next.templateId && prev.templateId === nb.templateId) { b = 3; why.push(`sandwiched between two ${tpl.id} pages`); }
        else if (tag === 'prev' && tpl.expectedPages.max > 1 && c.total > 0) { b = 1.2; why.push(`follows a ${tpl.id} page`); }
        if (b > boost) { boost = b; from = nb.templateId; }
      };
      consider(prev, 'prev');
      consider(next, 'next');
      if (!boost) continue;
      const rows = d.candidates.map((c) => ({ ...c, evidence: { ...c.evidence, context: c.templateId === from ? boost : 0 },
        total: round(c.total + (c.templateId === from ? boost : 0), 2), family: library.byId(c.templateId)?.family, layoutCapped: c.detail?.layout?.capped }));
      rows.sort((a, b) => b.total - a.total);
      const scored = { rows, textTrusted: d.textSources.some((v) => v.trusted && v.source === 'textLayer'), ocrTrusted: d.textSources.some((v) => v.trusted && v.source !== 'textLayer'), views: d.textSources };
      let verdict;
      try { verdict = decide(scored, featuresList[i], thresholds, d.rung, library); }
      catch (e) { verdict = { state: 'UNKNOWN', notes: [e.message], families: [] }; }
      verdict.notes = [...(verdict.notes || []), `context: ${why.join('; ')} (+${boost})`];
      out[i] = makeDecision({ pageIndex: d.pageIndex, features: featuresList[i], scored, verdict, rung: d.rung + '+CTX', thresholds, libraryVersion: d.libraryVersion, timings: d.timings });
    }
    return out;
  }

  /* Replay: score stored feature records without perception (regression harness). */
  function replay(featureRecord, library, thresholds) {
    const scored = scorePage(featureRecord, library, thresholds);
    let verdict;
    try { verdict = decide(scored, featureRecord, thresholds, featureRecord.rung || 'REPLAY', library); }
    catch (e) { verdict = { state: 'UNKNOWN', notes: [e.message], families: [] }; }
    return makeDecision({ pageIndex: featureRecord.pageIndex ?? -1, features: featureRecord, scored, verdict, rung: 'REPLAY', thresholds, libraryVersion: library.versionHash(), timings: {} });
  }

  return { FAMILIES, RUNGS, InvariantViolation, scorePage, decide, classifyPage, contextPass, replay, buildTextView, zoneOf };
})();
