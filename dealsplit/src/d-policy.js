/* =====================================================================
 * Layer D: Policy / Workflow. Segmentation, duplicates, VIN, deal grouping,
 * routing, manifests, and the writer. Consumes reasoner decisions; never
 * re-interprets raw features.
 * ===================================================================== */
DS.Policy = (() => {
  'use strict';
  const { hamming64, round, normText } = DS.Infra;
  const { VIN_LOOSE_RE } = DS.Knowledge;

  /* ---------- VIN ---------- */
  const VIN_VALUES = { A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
                       S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9 };
  const VIN_WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];
  function vinCheckDigit(vin) {
    let sum = 0;
    for (let i = 0; i < 17; i++) {
      const c = vin[i];
      const v = c >= '0' && c <= '9' ? +c : VIN_VALUES[c];
      if (v === undefined) return null;
      sum += v * VIN_WEIGHTS[i];
    }
    const r = sum % 11;
    return r === 10 ? 'X' : String(r);
  }
  const vinValid = (vin) => /^[A-HJ-NPR-Z0-9]{17}$/.test(vin) && vinCheckDigit(vin) === vin[8];

  /* Repair an OCR'd 17-char candidate. Unconditional: I→1, O→0, Q→0 (these
   * letters never occur in a VIN). Conditional: one S↔5, B↔8 or Z↔2 swap,
   * only if the check digit then validates; such a guess is marked
   * `guessed` and must be corroborated before it can open a deal. The check
   * digit only rejects about 10 of 11 wrong strings, so trying many variants
   * would manufacture false VINs.
   */
  function repairVin(raw) {
    const base = raw.toUpperCase().replace(/I/g, '1').replace(/[OQ]/g, '0');
    if (vinValid(base)) return { vin: base, repaired: base !== raw, guessed: false, steps: base !== raw ? ['IOQ'] : [] };
    const swaps = { S: '5', 5: 'S', B: '8', 8: 'B', Z: '2', 2: 'Z' };
    for (let i = 0; i < 17; i++) {
      if (!swaps[base[i]]) continue;
      const c = base.slice(0, i) + swaps[base[i]] + base.slice(i + 1);
      if (vinValid(c)) return { vin: c, repaired: true, guessed: true, steps: ['IOQ', `pos${i + 1}:${base[i]}→${swaps[base[i]]}`] };
    }
    return { vin: null, repaired: false, guessed: false, steps: [] };
  }

  /* All VIN candidates on a page from every text source, with provenance. */
  function extractVins(features, pageIndex) {
    const out = [];
    const sources = [['textLayer', features.textLayer], ['ocrFull', features.ocrFull], ['ocrHeader', features.ocrHeader], ['ocrFooter', features.ocrFooter]];
    for (const [src, s] of sources) {
      if (!s) continue;
      const pageConf = src === 'textLayer' ? s.quality.score : s.meanConf;
      const seen = new Set();
      // Confidence of a candidate is the confidence of the word(s) it came from.
      for (const w of s.words) {
        const tok = w.text.toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (tok.length !== 17 || seen.has(tok)) continue;
        seen.add(tok);
        const r = repairVin(tok);
        const conf = src === 'textLayer' ? pageConf : (w.conf ?? pageConf);
        out.push({ raw: tok, vin: r.vin, valid: !!r.vin, repaired: r.repaired, guessed: r.guessed, steps: r.steps, source: src, confidence: round(conf), pageIndex });
      }
      // Also try tokens split by OCR noise: 17 chars across two adjacent words
      const words = s.words.map((w) => w.text.toUpperCase().replace(/[^A-Z0-9]/g, ''));
      for (let i = 0; i + 1 < words.length; i++) {
        const j = words[i] + words[i + 1];
        if (j.length === 17 && !seen.has(j)) {
          const r = repairVin(j);
          const conf = src === 'textLayer' ? pageConf : Math.min(s.words[i].conf ?? pageConf, s.words[i + 1].conf ?? pageConf);
          if (r.vin) { seen.add(j); out.push({ raw: j, vin: r.vin, valid: true, repaired: r.repaired, guessed: true, steps: [...r.steps, 'joined'], source: src, confidence: round(conf * 0.8), pageIndex }); }
        }
      }
    }
    return out;
  }

  /* ---------- segmentation ---------- */
  function continuationInfo(features) {
    const txt = [features.textLayer?.text, features.ocrHeader?.text, features.ocrFooter?.text, features.ocrFull?.text].filter(Boolean).join(' ');
    const m = /PAGE (\d+) OF (\d+)/.exec(txt);
    return m ? { n: +m[1], of: +m[2] } : null;
  }
  /* Best readable VIN on a page (text layer preferred), or null. */
  function pageVin(p) {
    const v = (p.vins || []).filter((x) => x.valid);
    if (!v.length) return null;
    v.sort((a, b) => (b.source === 'textLayer') - (a.source === 'textLayer') || b.confidence - a.confidence);
    return v[0].vin;
  }
  /* Group consecutive pages into documents. A new document starts when the
   * family changes, a "page 1" marker appears, the continuation sequence
   * breaks, the page count exceeds the template's maximum, or the page carries
   * a different VIN than the document so far (same form, another deal).
   */
  function segment(pages) {
    // pages: [{pageIndex, decision, features, vins, dup}]
    const docs = [];
    let cur = null;
    for (const p of pages) {
      const d = p.decision;
      const fam = d.family || 'UNKNOWN';
      const cont = continuationInfo(p.features);
      const vin = pageVin(p);
      let start = !cur;
      if (cur) {
        const prevFam = cur.family;
        if (fam !== prevFam) start = true;
        else if (cont && cont.n === 1) start = true;
        else if (cont && cur.lastCont && cont.n !== cur.lastCont.n + 1) start = true;
        else if (!cont && cur.lastCont && cur.lastCont.n < cur.lastCont.of) start = false;   // unreadable marker mid-run: keep
        else if (cur.pages.length >= (cur.expectedMax || 8)) start = true;
        else if (fam === 'UNKNOWN') start = true;              // never merge unknown pages
        else if (vin && cur.vin && vin !== cur.vin) start = true;
        else if (!cont && (cur.expectedMax || 1) === 1) start = true;
      }
      if (start) {
        cur = { id: docs.length + 1, family: fam, templateId: d.templateId, pages: [], lastCont: null, vin: null,
                headerHash: p.features.fingerprint?.regionHashes?.[1] || null, expectedMax: p.expectedMax, states: new Set() };
        docs.push(cur);
      }
      cur.pages.push(p);
      cur.states.add(d.state);
      cur.lastCont = cont;
      if (vin && !cur.vin) cur.vin = vin;
    }
    for (const doc of docs) {
      doc.state = doc.states.has('UNKNOWN') ? 'UNKNOWN' : doc.states.has('LIKELY') ? 'LIKELY' : 'CONFIDENT';
      delete doc.states;
    }
    return docs;
  }

  /* ---------- duplicates ---------- */
  function markDuplicates(pages) {
    const seen = [];
    for (const p of pages) {
      const fp = p.features.fingerprint;
      const th = p.features.textHash;
      p.dup = null;
      for (const s of seen) {
        const sameImg = fp && s.fp && hamming64(fp.phash64, s.fp.phash64) <= 3;
        const sameText = th && s.th && th === s.th && (p.features.textLayer?.words.length || 0) > 20;
        if ((sameImg && (sameText || !th || !s.th)) || (sameText && fp && s.fp && hamming64(fp.phash64, s.fp.phash64) <= 10)) { p.dup = s.pageIndex; break; }
      }
      if (p.dup === null) seen.push({ pageIndex: p.pageIndex, fp, th });
    }
    return pages;
  }

  /* ---------- deal grouping ---------- */
  function groupDeals(docs, library) {
    // 1. VIN per document: prefer high-confidence sources and strong doc types.
    const strong = new Set(['BUYERS_ORDER', 'RISC', 'LEASE', 'TITLE_APP', 'ODOMETER']);
    for (const doc of docs) {
      const cands = doc.pages.flatMap((p) => p.vins || []).filter((v) => v.valid);
      const tally = new Map();
      for (const v of cands) {
        const w = v.confidence * (v.source === 'textLayer' ? 1.2 : 1) * (v.guessed ? 0.3 : v.repaired ? 0.8 : 1) * (strong.has(doc.family) ? 1.3 : 1);
        tally.set(v.vin, (tally.get(v.vin) || 0) + w);
      }
      const best = [...tally.entries()].sort((a, b) => b[1] - a[1])[0];
      doc.vin = best ? best[0] : null;
      doc.vinWeight = best ? round(best[1], 2) : 0;
      doc.vinCandidates = cands;
    }
    // 1b. OCR misreads produce VINs that differ from the true one by a character
    //     or two and can still pass the check digit. Merge each weak VIN into the
    //     strongest VIN within Hamming distance 2 (recorded for the manifest).
    const strength = new Map();
    for (const doc of docs) if (doc.vin) strength.set(doc.vin, (strength.get(doc.vin) || 0) + doc.vinWeight);
    const vins = [...strength.entries()].sort((a, b) => b[1] - a[1]).map((e) => e[0]);
    const ham = (a, b) => { let d = 0; for (let i = 0; i < 17; i++) if (a[i] !== b[i]) d++; return d; };
    const merged = new Map();
    for (let i = 0; i < vins.length; i++) {
      if (merged.has(vins[i])) continue;
      for (let j = i + 1; j < vins.length; j++) {
        if (merged.has(vins[j])) continue;
        const d = ham(vins[i], vins[j]);
        // ≤2 always; ≤4 when the weaker one is a single low-weight (OCR) read.
        if (d <= 2 || (d <= 4 && strength.get(vins[j]) < 0.6 && strength.get(vins[i]) >= 3 * strength.get(vins[j]))) merged.set(vins[j], vins[i]);
      }
    }
    for (const doc of docs) if (doc.vin && merged.has(doc.vin)) { doc.vinMergedFrom = doc.vin; doc.vin = merged.get(doc.vin); }
    // 1c. A VIN seen only once, only by low-confidence OCR, is not enough to open
    //     a deal: the document goes to review with its candidates kept.
    const seenBy = new Map();
    for (const doc of docs) if (doc.vin) seenBy.set(doc.vin, (seenBy.get(doc.vin) || 0) + 1);
    for (const doc of docs) {
      if (!doc.vin || seenBy.get(doc.vin) > 1) continue;
      const strongRead = doc.vinCandidates.some((v) => v.vin === doc.vin && !v.guessed && (v.source === 'textLayer' || v.confidence >= 0.75));
      if (!strongRead) { doc.vinWeak = doc.vin; doc.vin = null; }
    }
    // 2. Propagate along contiguous runs, conservatively: a doc without a
    //    readable VIN takes its neighbours' VIN only when both neighbours
    //    agree. A mis-grouped deal is worse than a document left for review.
    for (let i = 0; i < docs.length; i++) {
      if (docs[i].vin) continue;
      const prev = docs[i - 1]?.vin, next = docs[i + 1]?.vin;
      if (prev && next && prev === next) { docs[i].vin = prev; docs[i].vinPropagated = 'neighbours'; }
    }
    // 3. Group.
    const deals = new Map();
    for (const doc of docs) {
      const key = doc.vin || '_NOVIN';
      if (!deals.has(key)) deals.set(key, { vin: doc.vin, docs: [], families: new Set() });
      const deal = deals.get(key);
      deal.docs.push(doc);
      if (doc.family && doc.family !== 'UNKNOWN') deal.families.add(doc.family);
    }
    // 4. Deal type + last name + checklist. A deal that shows only a buyer's
    //    order is CASH only when no contract in the batch is still unassigned;
    //    otherwise its contract may simply have an unreadable VIN.
    const unassignedContract = (deals.get('_NOVIN')?.docs || []).some((d) => d.family === 'RISC' || d.family === 'LEASE');
    const out = [];
    for (const deal of deals.values()) {
      const fams = deal.families;
      const signals = [];
      for (const t of library.templates) if (fams.has(t.family) && t.dealTypeSignal) signals.push(t.dealTypeSignal);
      let type = null, ambiguous = false;
      const hasRetail = signals.includes('RETAIL'), hasLease = signals.includes('LEASE');
      if (hasRetail && hasLease) ambiguous = true;
      else if (hasRetail) type = 'RETAIL';
      else if (hasLease) type = 'LEASE';
      else if (signals.includes('CASH_IF_ALONE')) { if (unassignedContract) ambiguous = true; else type = 'CASH'; }
      deal.dealType = type; deal.ambiguousType = ambiguous;
      if (ambiguous && !hasRetail) deal.ambiguityNote = 'no contract found for this VIN, but contracts with unreadable VINs exist in this batch';
      deal.lastName = guessLastName(deal.docs);
      const req = type ? (library.dealTypes[type]?.required || []) : [];
      deal.missing = req.filter((fam) => !fams.has(fam)).map((fam) => library.templates.find((t) => t.family === fam)?.displayName || fam);
      deal.families = [...fams];
      out.push(deal);
    }
    return out;
  }
  function guessLastName(docs) {
    // Look for "BUYER" / "PURCHASER" / "LESSEE" / "APPLICANT" followed by a name in the text layer or OCR.
    for (const doc of docs) for (const p of doc.pages) {
      const txt = (p.features.textLayer?.words || p.features.ocrFull?.words || []).map((w) => w.text).join(' ');
      const m = /(?:BUYER|PURCHASER|LESSEE|APPLICANT|CUSTOMER)(?:\s+NAME)?\s*[:.-]?\s*([A-Z][A-Za-z'-]+)\s*,?\s+([A-Z][A-Za-z'-]+)/.exec(txt);
      if (m) {
        const a = m[1].toUpperCase(), b = m[2].toUpperCase();
        if (/^(NAME|SIGNATURE|DATE|ADDRESS|CO)$/.test(a)) continue;
        // "LAST, FIRST" if comma present, else "FIRST LAST"
        return /,/.test(m[0]) ? a : b;
      }
    }
    return 'UNKNOWN';
  }

  /* ---------- routing ---------- */
  function sanitize(s) { return (s || '').replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'X'; }
  function dealFolderName(deal, settings) {
    return settings.folders.dealFolder.replace('<VIN>', deal.vin || 'NOVIN').replace('<LastName>', sanitize(deal.lastName)).replace('<DealType>', deal.dealType || (deal.ambiguousType ? 'AMBIGUOUS' : 'UNTYPED'));
  }
  /* Produce the write plan: [{path, pages:[pageIndex...], kind}] plus manifests. */
  function plan(deals, docs, pages, library, settings) {
    const files = [];
    const rev = settings.folders.reviewFolder, dupF = settings.folders.duplicatesFolder;
    const dupPages = pages.filter((p) => p.dup !== null && p.dup !== undefined);
    const counters = new Map();
    const nextName = (dir, base) => { const k = dir + '/' + base; const n = (counters.get(k) || 0) + 1; counters.set(k, n); return n === 1 ? base : `${base}_${n}`; };
    const manifests = [];
    for (const deal of deals) {
      const root = dealFolderName(deal, settings);
      const manifest = { vin: deal.vin, dealType: deal.dealType, ambiguousType: deal.ambiguousType, lastName: deal.lastName, folder: root,
                         documents: [], missing: deal.missing, generatedAt: new Date().toISOString(), libraryVersion: library.versionHash() };
      for (const doc of deal.docs) {
        const tpl = doc.templateId ? library.byId(doc.templateId) : null;
        const pgs = doc.pages.filter((p) => p.dup === null || p.dup === undefined);
        if (!pgs.length) continue;
        const review = doc.state === 'UNKNOWN' || deal.ambiguousType || !deal.vin;
        const dir = review ? `${root}/${rev}` : `${root}/${tpl?.routing.folder || '99_Other'}`;
        const base = nextName(dir, tpl ? `${tpl.id}${doc.state === 'LIKELY' ? '_LIKELY' : ''}` : 'UNKNOWN');
        const path = `${dir}/${base}.pdf`;
        files.push({ path, pages: pgs.map((p) => p.pageIndex), kind: review ? 'review' : 'doc', docId: doc.id });
        manifest.documents.push({ file: path, templateId: doc.templateId, displayName: tpl?.displayName || null, state: doc.state,
          sourcePages: pgs.map((p) => p.pageIndex + 1), vin: doc.vin, vinPropagated: doc.vinPropagated || null, vinMergedFrom: doc.vinMergedFrom || null,
          decisions: pgs.map((p) => ({ page: p.pageIndex + 1, state: p.decision.state, templateId: p.decision.templateId, score: p.decision.score, margin: p.decision.margin, rung: p.decision.rung,
            override: p.override || null, topCandidates: p.decision.candidates.slice(0, 3).map((c) => ({ templateId: c.templateId, total: c.total })) })) });
        if (review) {
          for (const p of pgs) manifest.documents[manifest.documents.length - 1].reviewNotes = p.decision.notes;
        }
      }
      files.push({ path: `${root}/manifest.json`, text: JSON.stringify(manifest, null, 2), kind: 'manifest' });
      const missingTxt = (deal.missing.length ? deal.missing.map((m) => `- ${m}`).join('\n') : 'Nothing missing.') +
        (deal.dealType ? '' : '\n\n(Deal type could not be determined; checklist not applied.)');
      files.push({ path: `${root}/MISSING.txt`, text: `Missing for ${deal.dealType || 'unknown deal type'} deal ${deal.vin || ''}:\n${missingTxt}\n`, kind: 'missing' });
      manifests.push(manifest);
    }
    if (dupPages.length) {
      const byDeal = new Map();
      for (const p of dupPages) {
        const doc = docs.find((d) => d.pages.includes(p));
        const deal = deals.find((dl) => dl.docs.includes(doc));
        const root = deal ? dealFolderName(deal, settings) : '_Unassigned';
        if (!byDeal.has(root)) byDeal.set(root, []);
        byDeal.get(root).push(p.pageIndex);
      }
      for (const [root, pg] of byDeal) files.push({ path: `${root}/${dupF}/duplicates.pdf`, pages: pg, kind: 'dup' });
    }
    return { files, manifests };
  }

  /* ---------- writer ---------- */
  async function buildPdf(srcDoc, pageIndexes) {
    const { PDFDocument } = window.PDFLib;
    const out = await PDFDocument.create();
    const copied = await out.copyPages(srcDoc, pageIndexes);
    for (const p of copied) out.addPage(p);
    return out.save({ useObjectStreams: false });
  }
  async function writeAll(files, srcBytes, { directory, onProgress } = {}) {
    const { PDFDocument } = window.PDFLib;
    const src = await PDFDocument.load(srcBytes, { ignoreEncryption: true, updateMetadata: false });
    const outputs = [];
    let i = 0;
    for (const f of files) {
      const data = f.text !== undefined ? new TextEncoder().encode(f.text) : await buildPdf(src, f.pages);
      outputs.push({ path: f.path, data });
      onProgress?.(++i, files.length, f.path);
    }
    if (directory) {
      for (const o of outputs) {
        const parts = o.path.split('/');
        let dir = directory;
        for (const part of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(part, { create: true });
        const fh = await dir.getFileHandle(parts[parts.length - 1], { create: true });
        const w = await fh.createWritable();
        await w.write(o.data);
        await w.close();
      }
      return { mode: 'directory', count: outputs.length };
    }
    const zip = new window.JSZip();
    for (const o of outputs) zip.file(o.path, o.data);
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 3 } });
    return { mode: 'zip', blob, count: outputs.length };
  }

  return { vinCheckDigit, vinValid, repairVin, extractVins, segment, markDuplicates, groupDeals, plan, writeAll, buildPdf, dealFolderName, continuationInfo };
})();
