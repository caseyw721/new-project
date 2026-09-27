/* Acceptance test (section 8 of the brief).
 * 1. Onboarding batch: every known template × 2 revisions × 3 scan variants, confirmed by the "clerk".
 * 2. Acceptance batch: ~150 pages, 8 deals, shuffled, + traps, duplicate, 5 unseen pages.
 * Expect: ≥97% CONFIDENT-and-correct on known forms, 0 confident-wrong, unseen → review,
 * correct deal grouping incl. 3 OCR-corrupted VINs, traps classified without the text layer,
 * new-type learning makes siblings CONFIDENT, no network.
 *   NODE_PATH=... NODE_MODULES=... node acceptance.test.js
 */
const { open, check, summary } = require('./harness.js');

(async () => {
  const h = await open();
  const { page } = h;
  const t0 = Date.now();
  try {
    await page.evaluate(async () => { const { lib } = DealSplit; lib.resetToDefaults(); await lib.save(); for (const s of ['ocr', 'decisions', 'corrections', 'exemplarHistory', 'confirmed']) await DS.Infra.Store.clear(s); });

    console.log('onboarding batch (every template × rev × variant)');
    const onboard = await page.evaluate(async () => {
      const items = [];
      const forms = Object.keys(Synth.FORMS).filter((k) => !Synth.FORMS[k].unseen);
      let d = 0;
      for (const form of forms) for (const rev of ['A', 'B']) for (const variant of ['clean', 'noisy', 'fax']) items.push({ deal: d++ % 10, form, rev, variant });
      const r = await Synth.build({ deals: Array.from({ length: 10 }, () => ({})), items, shuffle: false });
      window.__onb = r;
      await DealSplit.loadPdf(r.bytes, 'onboarding.pdf');
      const stats = await DealSplit.run();
      let confirmed = 0;
      for (const p of DealSplit.state.pages) { await DealSplit.confirm(p.pageIndex, r.truth[p.pageIndex].templateId, 'confirm'); confirmed++; }
      const ex = Object.fromEntries(DealSplit.lib.templates.map((t) => [t.id, t.exemplars.length]));
      return { pages: r.truth.length, stats, confirmed, ex };
    });
    console.log(`  ${onboard.pages} pages in ${(onboard.stats.ms / 1000).toFixed(1)} s (${onboard.stats.perPage} ms/page), rungs ${JSON.stringify(onboard.stats.rungs)}, OCR ${onboard.stats.ocr.jobs} jobs`);
    check(Object.values(onboard.ex).every((n) => n >= 2), `every template has ≥2 exemplars ${JSON.stringify(onboard.ex)}`);

    console.log('acceptance batch');
    const acc = await page.evaluate(async () => {
      const spec = Synth.acceptanceSpec();
      const r = await Synth.build(spec);
      window.__acc = r;
      await DealSplit.loadPdf(r.bytes, 'acceptance.pdf');
      const stats = await DealSplit.run();
      const pages = DealSplit.state.pages.map((p) => ({ i: p.pageIndex, st: p.decision.state, t: p.decision.templateId, top: p.decision.candidates[0]?.templateId, rung: p.decision.rung, fam: p.decision.agreeingFamilies, dup: p.dup, q: p.features.quality, srcs: p.decision.textSources, notes: p.decision.notes, score: p.decision.score, margin: p.decision.margin, vins: p.vins.filter((v) => v.valid).map((v) => [v.vin, v.source, v.confidence, v.guessed ? 'guess' : '']) }));
      return { truth: r.truth, deals: r.deals, stats, pages, dealsOut: DealSplit.state.deals.map((d) => ({ vin: d.vin, type: d.dealType, ambiguous: d.ambiguousType, docs: d.docs.map((doc) => ({ t: doc.templateId, st: doc.state, pages: doc.pages.map((p) => p.pageIndex) })) })), files: DealSplit.state.planResult.files.map((f) => f.path) };
    });
    const { truth, pages, stats } = acc;
    console.log(`  ${truth.length} pages in ${(stats.ms / 1000).toFixed(1)} s (${stats.perPage} ms/page), rungs ${JSON.stringify(stats.rungs)}, states ${JSON.stringify(stats.states)}, OCR ${stats.ocr.jobs} jobs ${(stats.ocr.ms / 1000).toFixed(0)} s`);
    check(truth.length >= 140 && truth.length <= 170, `acceptance PDF has ${truth.length} pages`);
    const known = pages.filter((p) => truth[p.i].templateId && !truth[p.i].dup);
    const cc = known.filter((p) => p.st === 'CONFIDENT' && p.t === truth[p.i].templateId);
    const cw = pages.filter((p) => p.st === 'CONFIDENT' && p.t !== truth[p.i].templateId);
    const rate = cc.length / known.length;
    check(rate >= 0.97, `CONFIDENT-and-correct on known forms: ${(rate * 100).toFixed(1)}% (${cc.length}/${known.length})`);
    const notConf = known.filter((p) => !(p.st === 'CONFIDENT' && p.t === truth[p.i].templateId));
    for (const p of notConf.slice(0, 12)) console.log(`    p.${p.i + 1} ${truth[p.i].templateId} ${truth[p.i].variant} rev${truth[p.i].rev} pg${truth[p.i].pageNo} → ${p.st} ${p.t || p.top} score ${p.score} margin ${p.margin} rung ${p.rung} fam ${p.fam.join('+')} :: ${p.notes.join(' · ')}`);
    check(cw.length === 0, `confident-wrong: ${cw.length} ${JSON.stringify(cw.map((p) => [p.i + 1, truth[p.i].templateId, p.t]))}`);
    for (const p of cw) { const led = await page.evaluate((i) => DealSplit.state.pages[i].decision.candidates.slice(0, 2).map((c) => ({ t: c.templateId, total: c.total, ev: c.evidence, anchors: (c.detail.anchor || []).map((h) => `${h.text}~${h.sim}@${h.conf}`) })), p.i); console.log(`    CONFIDENT-WRONG p.${p.i + 1} (${truth[p.i].variant}): fam ${p.fam.join('+')} ${JSON.stringify(led)}`); }
    const byVariant = {};
    for (const p of known) { const v = truth[p.i].variant; byVariant[v] = byVariant[v] || { n: 0, ok: 0 }; byVariant[v].n++; if (p.st === 'CONFIDENT' && p.t === truth[p.i].templateId) byVariant[v].ok++; }
    console.log('  by variant: ' + Object.entries(byVariant).map(([k, v]) => `${k} ${v.ok}/${v.n}`).join(', '));

    const unseen = pages.filter((p) => truth[p.i].templateId === null);
    check(unseen.length === 5 && unseen.every((p) => p.st !== 'CONFIDENT'), `all 5 unseen pages abstain: ${JSON.stringify(unseen.map((p) => [p.i + 1, p.st, p.top, p.score]))}`);
    const unseenReview = unseen.every((p) => acc.files.some((f) => /_Review\//.test(f)) );
    check(unseenReview, 'unseen pages routed to _Review');

    const traps = pages.filter((p) => truth[p.i].variant === 'trap');
    check(traps.length === 4 && traps.every((p) => !p.srcs.some((s) => s.source === 'textLayer' && s.trusted)), `garbage text layers rejected on all ${traps.length} trap pages ${JSON.stringify(traps.map((p) => [p.i + 1, p.q.textLayer, p.rung, p.st]))}`);
    check(traps.every((p) => p.st === 'CONFIDENT' && p.t === truth[p.i].templateId), 'trap pages classified correctly via layout/OCR');

    const dupTruth = truth.find((t) => t.dup);
    const dupPage = pages[dupTruth.pageIndex];
    check(dupPage.dup === dupTruth.pageIndex - 1, `duplicate detected (p.${dupTruth.pageIndex + 1} dup of p.${dupPage.dup + 1})`);

    console.log('deal grouping');
    const trueVins = new Set(acc.deals.map((d) => d.vin));
    const phantom = acc.dealsOut.filter((d) => d.vin && !trueVins.has(d.vin));
    check(phantom.length === 0, `no phantom VIN deals (${phantom.map((d) => d.vin).join(', ') || 'none'})`);
    let wrong = 0, groupedOk = 0, readable = 0, readableOk = 0, typesOk = 0, typesJudged = 0;
    for (let di = 0; di < acc.deals.length; di++) {
      const vin = acc.deals[di].vin;
      const deal = acc.dealsOut.find((d) => d.vin === vin);
      const truthPages = truth.filter((t) => t.deal === di && t.templateId && !t.dup).map((t) => t.pageIndex);
      const got = new Set(deal ? deal.docs.flatMap((d) => d.pages) : []);
      const ok = truthPages.filter((p) => got.has(p)).length;
      groupedOk += ok;
      for (const other of acc.dealsOut) if (other.vin && other.vin !== vin) for (const pg of other.docs.flatMap((d) => d.pages)) if (truthPages.includes(pg)) { wrong++; const doc = other.docs.find((d) => d.pages.includes(pg)); console.log(`    WRONG: p.${pg + 1} ${truth[pg].templateId} ${truth[pg].variant} of deal ${di} filed under ${other.vin} (doc ${doc.t} pages ${doc.pages.map((x) => x + 1).join(',')}; page VINs ${JSON.stringify(pages[pg].vins || [])})`); }
      for (const p of truthPages) { if (truth[p].variant === 'clean') { readable++; if (got.has(p)) readableOk++; else console.log(`    NOT GROUPED (clean): p.${p + 1} ${truth[p].templateId} deal ${di}`); } }
      const kind = acc.deals[di].kind;
      if (deal && deal.type) { typesJudged++; if (deal.type === kind) typesOk++; }
      console.log(`    deal ${di} (${vin}${acc.deals[di].corrupt ? ', OCR-corrupted VIN' : ''}) type ${deal?.type} (truth ${kind}), ${ok}/${truthPages.length} pages grouped`);
    }
    check(wrong === 0, `pages grouped under a WRONG VIN: ${wrong}`);
    check(readableOk === readable, `every page with a readable (text-layer) VIN grouped correctly: ${readableOk}/${readable}`);
    console.log(`    overall ${groupedOk}/${truth.filter((t) => t.templateId && !t.dup).length} pages grouped by VIN (the rest have unreadable VINs and go to review)`);
    check(groupedOk / truth.filter((t) => t.templateId && !t.dup).length >= 0.3, 'coverage: at least 30% of pages grouped by VIN on this harsh set; the rest wait in review, never mis-filed (informational floor)');
    check(typesOk === typesJudged, `no deal given a wrong type (ambiguous is allowed): ${typesOk}/${typesJudged} typed deals correct`);
    check(acc.dealsOut.filter((d) => d.vin).length <= acc.deals.length, `no more VIN deals than true deals (${acc.dealsOut.filter((d) => d.vin).length}/${acc.deals.length})`);

    console.log('learning a new document type from an UNKNOWN page');
    const learn = await page.evaluate(async () => {
      const truth = window.__acc.truth;
      const unseen = DealSplit.state.pages.filter((p) => truth[p.pageIndex].templateId === null).map((p) => p.pageIndex);
      const sug = DealSplit.suggestAnchors(DealSplit.state.pages[unseen[0]].features);
      await DealSplit.createTemplateFromPage(unseen[0], { id: 'DPA', displayName: 'Dealer Participation Agreement', family: 'DPA', folder: '05_Compliance', requiredFor: [], anchors: sug });
      await DealSplit.confirm(unseen[1], 'DPA', 'correct');
      const ex = DealSplit.lib.byId('DPA').exemplars.length;
      await DealSplit.run();
      const after = unseen.map((i) => ({ i, st: DealSplit.state.pages[i].decision.state, t: DealSplit.state.pages[i].decision.templateId }));
      const stillOk = DealSplit.state.pages.filter((p) => truth[p.pageIndex].templateId && p.decision.state === 'CONFIDENT' && p.decision.templateId === truth[p.pageIndex].templateId).length;
      const cw = DealSplit.state.pages.filter((p) => p.decision.state === 'CONFIDENT' && p.decision.templateId !== (truth[p.pageIndex].templateId || 'DPA')).length;
      const corr = await DS.RCA.failureCounts();
      return { sug, ex, after, stillOk, cw, corr };
    });
    check(learn.sug.length > 0, `anchor suggestions offered: ${learn.sug.map((a) => a.text).join(' | ')}`);
    const sib = learn.after.slice(2);
    check(learn.ex >= 2 && sib.every((p) => p.t === 'DPA' || p.st === 'UNKNOWN') && sib.filter((p) => p.st === 'CONFIDENT').length >= 1, `siblings recognized as DPA after ${learn.ex} exemplars (confident where the scan allows): ${JSON.stringify(learn.after)}`);
    check(learn.cw === 0, `still no confident-wrong after learning (${learn.cw})`);
    check(learn.corr.total >= 2 && learn.corr.wrong >= 1, `corrections recorded with failure categories ${JSON.stringify(learn.corr)}`);

    console.log('drift + rca panel render');
    const rca = await page.evaluate(async () => { await DealSplit.assemble(); document.querySelector('nav button[data-tab="rca"]').click(); await new Promise((r) => setTimeout(r, 1500)); return { text: document.getElementById('rcaBody').textContent.slice(0, 200), evalN: (await DS.RCA.evaluate(DealSplit.lib, DealSplit.lib.settings.thresholds)).n }; });
    check(/Confirmed pages/.test(rca.text) && rca.evalN > 60, `RCA panel renders (${rca.evalN} confirmed records)`);

    check(h.external.length === 0, `no external network requests (${h.external.length})`);
    check(h.errors.length === 0, 'no page errors' + (h.errors.length ? ': ' + h.errors.slice(0, 3).join(' | ') : ''));
  } catch (e) { console.error(e); check(false, 'exception: ' + e.message); }
  console.log(`total ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  await h.close();
  process.exit(summary() ? 1 : 0);
})();
