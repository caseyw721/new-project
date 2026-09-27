/* Smoke test: small clean PDF, onboarding loop (LIKELY → confirm → CONFIDENT),
 * VIN repair, manifest plan. Runs in ~1 minute.
 *   cd dealsplit/tests && npm i playwright pdfjs-dist@4.10.38 tesseract.js@5.1.1 tesseract.js-core@5.1.1 @tesseract.js-data/eng pdf-lib@1.17.1 jszip@3.10.1 && node smoke.test.js
 */
const { open, check, summary } = require('./harness.js');

(async () => {
  const h = await open();
  const { page } = h;
  try {
    // Fresh library, no exemplars.
    await page.evaluate(async () => { const { lib } = DealSplit; lib.resetToDefaults(); await lib.save(); for (const s of ['ocr', 'decisions', 'corrections', 'exemplarHistory', 'confirmed']) await DS.Infra.Store.clear(s); });

    console.log('build small PDF: 2 deals, clean pages, one corrupted VIN');
    const spec = { deals: [{}, {}], shuffle: false, items: [
      { deal: 0, form: 'BUYERS_ORDER', rev: 'A', corruptVin: true }, { deal: 0, form: 'RISC', rev: 'A' }, { deal: 0, form: 'ODOMETER', rev: 'B' },
      { deal: 1, form: 'LEASE', rev: 'B' }, { deal: 1, form: 'BUYERS_ORDER', rev: 'B' }, { deal: 1, form: 'PRIVACY', rev: 'A' }, { deal: 1, form: 'ODOMETER', rev: 'A', duplicate: true },
    ] };
    const info = await page.evaluate(async (spec) => {
      const r = await Synth.build(spec);
      window.__truth = r.truth; window.__deals = r.deals;
      await DealSplit.loadPdf(r.bytes, 'smoke.pdf');
      return { pages: r.truth.length, truth: r.truth, deals: r.deals };
    }, spec);
    check(info.pages === 12, `PDF has 12 pages (${info.pages})`);

    console.log('first run: no exemplars → text anchors only → at most LIKELY');
    const run1 = await page.evaluate(async () => { const s = await DealSplit.run(); return { stats: s, dec: DealSplit.state.pages.map((p) => ({ i: p.pageIndex, st: p.decision.state, t: p.decision.templateId, top: p.decision.candidates[0]?.templateId, rung: p.decision.rung, q: p.features.quality, vins: p.vins.map((v) => [v.raw, v.vin, v.repaired]) })) }; });
    check(run1.stats.states.CONFIDENT === undefined, `nothing CONFIDENT without exemplars (${JSON.stringify(run1.stats.states)})`);
    const topRight = run1.dec.filter((d) => d.top === info.truth[d.i].templateId).length;
    check(topRight === 12, `top candidate correct on all 12 pages (${topRight})`);
    check(run1.dec.every((d) => d.q.textLayer >= 0.45), 'text layers judged trustworthy');
    check(run1.stats.perPage < 400, `fast path: ${run1.stats.perPage} ms/page`);
    const bo = run1.dec[0];
    check(bo.vins.some((v) => v[2] === true && v[1] === info.deals[0].vin), `corrupted VIN repaired: ${JSON.stringify(bo.vins)}`);

    console.log('confirm the LIKELY pages (user onboarding), then rerun');
    await page.evaluate(async () => { for (const p of DealSplit.state.pages) { const t = window.__truth[p.pageIndex].templateId; if (t) await DealSplit.confirm(p.pageIndex, t, 'confirm'); } });
    const ex = await page.evaluate(() => Object.fromEntries(DealSplit.lib.templates.map((t) => [t.id, t.exemplars.length])));
    check(ex.BUYERS_ORDER === 2 && ex.ODOMETER === 2 && ex.RISC === 3, `exemplars learned ${JSON.stringify(ex)}`);
    const run2 = await page.evaluate(async () => { const s = await DealSplit.run(); return { stats: s, dec: DealSplit.state.pages.map((p) => ({ i: p.pageIndex, st: p.decision.state, t: p.decision.templateId, fam: p.decision.agreeingFamilies, m: p.decision.margin, dup: p.dup })) }; });
    const conf = run2.dec.filter((d) => d.st === 'CONFIDENT' && d.t === info.truth[d.i].templateId).length;
    const twoEx = run2.dec.filter((d) => ['BUYERS_ORDER', 'ODOMETER', 'RISC'].includes(info.truth[d.i].templateId));
    const confTwo = twoEx.filter((d) => d.st === 'CONFIDENT').length;
    check(confTwo === twoEx.length, `pages of templates with ≥2 exemplars are CONFIDENT (${confTwo}/${twoEx.length}) ${JSON.stringify(run2.dec.map((d) => [d.i, d.st, d.t, d.fam.join('+')]))}`);
    check(run2.dec.every((d) => d.st !== 'CONFIDENT' || d.t === info.truth[d.i].templateId), 'no confident-wrong');
    check(run2.dec[11].dup === 10, `duplicate page detected (dup of page 11): ${run2.dec[11].dup}`);
    check(conf >= 8, `${conf} confident-correct`);

    console.log('segmentation, deals, plan');
    const plan = await page.evaluate(() => ({ deals: DealSplit.state.deals.map((d) => ({ vin: d.vin, type: d.dealType, last: d.lastName, fams: d.families, missing: d.missing })), files: DealSplit.state.planResult.files.map((f) => f.path), docs: DealSplit.state.docs.map((d) => [d.templateId, d.pages.map((p) => p.pageIndex)]) }));
    check(plan.deals.length === 2, `2 deals (${plan.deals.length}) ${JSON.stringify(plan.deals)}`);
    check(plan.deals[0].vin === info.deals[0].vin && plan.deals[0].type === 'RETAIL', 'deal 0: repaired VIN + RETAIL');
    check(plan.deals[1].vin === info.deals[1].vin && plan.deals[1].type === 'LEASE', 'deal 1: LEASE');
    check(plan.deals[0].last === info.deals[0].last, `last name ${plan.deals[0].last}`);
    check(plan.docs.some((d) => d[0] === 'RISC' && d[1].length === 3), `RISC segmented as one 3-page doc ${JSON.stringify(plan.docs)}`);
    check(plan.files.some((f) => /_Duplicates\/duplicates\.pdf$/.test(f)), 'duplicates file planned');
    check(plan.files.some((f) => /01_Contract\/RISC\.pdf$/.test(f)) && plan.files.some((f) => /manifest\.json$/.test(f)) && plan.files.some((f) => /MISSING\.txt$/.test(f)), 'contract, manifest, MISSING planned');

    console.log('write ZIP');
    const zip = await page.evaluate(async () => { const r = await DS.Policy.writeAll(DealSplit.state.planResult.files, DealSplit.state.bytes, {}); const z = await window.JSZip.loadAsync(r.blob); const names = Object.keys(z.files).filter((n) => !z.files[n].dir); const pdf = await z.file(names.find((n) => /RISC\.pdf$/.test(n))).async('uint8array'); return { count: r.count, names, riscBytes: pdf.length, riscHead: String.fromCharCode(...pdf.slice(0, 5)) }; });
    check(zip.riscHead === '%PDF-' && zip.riscBytes > 1000, `ZIP contains a real RISC.pdf (${zip.riscBytes} bytes)`);

    console.log('regression harness + redacted log');
    const reg = await page.evaluate(async () => { const e = await DS.RCA.evaluate(DealSplit.lib, DealSplit.lib.settings.thresholds); const log = JSON.parse(await DS.RCA.exportRedactedLog()); return { e, logPages: log.batches.reduce((a, b) => a + b.entries.length, 0), hasWords: /GARCIA|NGUYEN|CAMRY/i.test(JSON.stringify(log)) }; });
    check(reg.e.n === 12 && reg.e.confidentWrong === 0, `replay of 12 confirmed pages: precision ${reg.e.precision}, unknown ${reg.e.unknown}`);
    check(reg.logPages === 24 && !reg.hasWords, `redacted log has ${reg.logPages} page records and no page words`);
    const guard = await page.evaluate(async () => { const g = await DS.RCA.guardChange(async () => { const t = DealSplit.lib.byId('RISC'); t.negatives.push({ text: 'RETAIL INSTALLMENT SALE CONTRACT', zone: 'header', weight: -40, fuzzy: 0.85 }); /* a sign mistake: the form's own title as a negative */ }); const res = { ok: g.ok, before: g.before.precision, after: g.after.precision, flips: g.flipped.length, sample: g.flipped.slice(0, 3) }; g.revert(); return res; });
    check(guard.ok === false && guard.flips > 0, `harness blocks a bad library edit: ${guard.flips} page(s) would flip ${JSON.stringify(guard.sample)}`);

    check(h.external.length === 0, `no external network requests (${h.external.length})`);
    check(h.errors.length === 0, 'no page errors' + (h.errors.length ? ': ' + h.errors.slice(0, 3).join(' | ') : ''));
  } catch (e) { console.error(e); check(false, 'exception: ' + e.message); }
  await h.close();
  process.exit(summary() ? 1 : 0);
})();
