/* Synthetic dealership-paperwork generator. Runs INSIDE the app page (uses the
 * already-loaded pdf-lib and pdf.js). Builds a combined PDF with known truth:
 *   window.Synth.build(spec) → { bytes: Uint8Array, truth: [{pageIndex, templateId, family, vin, variant, rev, deal, dup}] }
 * Variants: 'clean' (real text layer), 'noisy' (20% noise + 3° skew, image only),
 * 'fax' (100 dpi 1-bit, image only), 'trap' (clean image + garbage text layer).
 */
window.Synth = (() => {
  const rnd = (() => { let s = 42; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; })();
  const pick = (a) => a[Math.floor(rnd() * a.length)];

  /* ---- VINs with a valid check digit ---- */
  const VALS = { A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9, S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9 };
  const W = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];
  const CH = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789';
  function makeVin() {
    let v = '';
    for (let i = 0; i < 17; i++) v += i === 8 ? '0' : CH[Math.floor(rnd() * CH.length)];
    let sum = 0;
    for (let i = 0; i < 17; i++) sum += (v[i] >= '0' && v[i] <= '9' ? +v[i] : VALS[v[i]]) * W[i];
    const r = sum % 11;
    return v.slice(0, 8) + (r === 10 ? 'X' : String(r)) + v.slice(9);
  }
  const corruptVin = (v) => v.replace(/0/, 'O').replace(/1/, 'I');   // what OCR typically does

  /* ---- forms: two revisions each; anchors survive, paragraphs move ---- */
  const LOREM = ['The undersigned agrees to the terms and conditions set forth herein and acknowledges receipt of a completed copy of this document.',
    'Any amendment must be in writing and signed by all parties. Oral agreements are not binding on the dealer.',
    'This document is governed by the laws of the state in which the dealership is located, without regard to conflict of law principles.',
    'Buyer represents that all information provided is true and complete to the best of the buyer\'s knowledge.',
    'Failure to comply with any provision may result in the cancellation of this agreement at the sole discretion of the seller.',
    'Please read this document carefully before signing. Keep a copy for your records.'];
  const FORMS = {
    RISC: { title: 'RETAIL INSTALLMENT SALE CONTRACT', formId: 'RO-553-CA', pages: 3, folder: '01_Contract',
      body: { A: ['ANNUAL PERCENTAGE RATE: The cost of your credit as a yearly rate. FINANCE CHARGE: The dollar amount the credit will cost you.',
                  'ITEMIZATION OF AMOUNT FINANCED. Cash price of motor vehicle and accessories. Total of payments.', ...LOREM.slice(0, 3)],
              B: ['Truth in Lending Disclosures. ANNUAL PERCENTAGE RATE. FINANCE CHARGE. Amount Financed. TOTAL OF PAYMENTS.',
                  ...LOREM.slice(2, 5), 'ITEMIZATION OF AMOUNT FINANCED (see reverse). Trade-in allowance and payoff.'] }, table: true, checkboxes: 6 },
    LEASE: { title: 'MOTOR VEHICLE LEASE AGREEMENT', formId: 'LS-1120-CA', pages: 3, folder: '01_Contract',
      body: { A: ['CLOSED-END LEASE. Lessee agrees to lease the vehicle described above from Lessor. MONTHLY LEASE PAYMENT.', 'RESIDUAL VALUE at scheduled termination. EXCESS MILEAGE charge per mile.', ...LOREM.slice(0, 3)],
              B: ['This is a CLOSED END lease. The LESSEE is responsible for the MONTHLY LEASE PAYMENT shown.', ...LOREM.slice(1, 4), 'RESIDUAL VALUE. EXCESS MILEAGE. Early termination.'] }, table: true, checkboxes: 4 },
    CREDIT_APP: { title: 'CREDIT APPLICATION', formId: 'CA-201', pages: 2, folder: '02_CreditApp',
      body: { A: ['Applicant: SOCIAL SECURITY number, date of birth. EMPLOYER and MONTHLY INCOME. CO-APPLICANT information.', ...LOREM.slice(3, 6)],
              B: ['Personal information. SOCIAL SECURITY NO. EMPLOYER. MONTHLY INCOME. CO-APPLICANT (if any).', ...LOREM.slice(0, 2), LOREM[5]] }, table: true, checkboxes: 10 },
    ODOMETER: { title: 'ODOMETER DISCLOSURE STATEMENT', formId: 'OD-27', pages: 1, folder: '03_Title',
      body: { A: ['FEDERAL LAW (and State law, if applicable) requires that you state the mileage upon transfer of ownership.', 'I certify that the odometer reading is the ACTUAL MILEAGE of the vehicle (no TENTHS).', 'The odometer reading is NOT THE ACTUAL MILEAGE. WARNING: odometer discrepancy.'],
              B: ['FEDERAL LAW requires that you state the mileage in connection with the transfer of ownership.', 'Odometer reading (no TENTHS). ACTUAL MILEAGE. NOT THE ACTUAL MILEAGE. Exceeds mechanical limits.', LOREM[5]] }, table: false, checkboxes: 3 },
    TITLE_APP: { title: 'APPLICATION FOR TITLE AND REGISTRATION', formId: 'REG-343', pages: 1, folder: '03_Title',
      body: { A: ['Vehicle information: BODY TYPE, PLATE NUMBER, LIENHOLDER name and address.', ...LOREM.slice(0, 2)], B: ['LIENHOLDER. PLATE NUMBER. BODY TYPE. Registration class.', LOREM[2], LOREM[3]] }, table: true, checkboxes: 8 },
    GAP: { title: 'GUARANTEED ASSET PROTECTION (GAP) ADDENDUM', formId: 'GAP-77', pages: 1, folder: '04_Products',
      body: { A: ['This GAP Addendum covers the DEFICIENCY BALANCE after PRIMARY INSURANCE settlement in the event of a total loss.', ...LOREM.slice(1, 3)], B: ['DEFICIENCY BALANCE waiver. PRIMARY INSURANCE deductible. Cancellation and refund.', LOREM[0], LOREM[4]] }, table: false, checkboxes: 2 },
    VSC: { title: 'VEHICLE SERVICE CONTRACT', formId: 'VSC-900', pages: 2, folder: '04_Products',
      body: { A: ['COVERAGE: components listed. DEDUCTIBLE per repair visit. TERM MONTHS / miles. ADMINISTRATOR contact.', ...LOREM.slice(2, 4)], B: ['ADMINISTRATOR. COVERAGE plan. DEDUCTIBLE. TERM MONTHS. Exclusions.', LOREM[5], LOREM[1]] }, table: true, checkboxes: 5 },
    PRIVACY: { title: 'PRIVACY NOTICE', formId: 'PN-GLBA', pages: 1, folder: '05_Compliance',
      body: { A: ['WHAT DOES THE DEALERSHIP DO WITH YOUR PERSONAL INFORMATION? Reasons we can share. AFFILIATES. To OPT OUT call us.', LOREM[2]], B: ['Facts. WHAT DOES the dealer do with your PERSONAL INFORMATION? Sharing with AFFILIATES. OPT OUT rights.', LOREM[0]] }, table: true, checkboxes: 0 },
    BUYERS_ORDER: { title: "BUYER'S ORDER / PURCHASE AGREEMENT", formId: 'BO-12', pages: 1, folder: '01_Contract',
      body: { A: ['STOCK NUMBER. Selling price. SALES TAX. DOCUMENTARY FEE. TRADE ALLOWANCE. Balance due.', ...LOREM.slice(0, 2)], B: ['Vehicle purchase agreement. STOCK NUMBER. DOCUMENTARY FEE. SALES TAX. TRADE ALLOWANCE.', LOREM[3], LOREM[4]] }, table: true, checkboxes: 4 },
    TRADE_APPRAISAL: { title: 'TRADE-IN APPRAISAL', formId: 'TA-5', pages: 1, folder: '06_Trade',
      body: { A: ['APPRAISAL of trade vehicle. CONDITION. ACTUAL CASH VALUE. PAYOFF amount and lienholder.', LOREM[1]], B: ['CONDITION report. ACTUAL CASH VALUE. PAYOFF. Appraiser signature.', LOREM[5]] }, table: true, checkboxes: 6 },
    INSURANCE: { title: 'INSURANCE VERIFICATION', formId: 'INS-3', pages: 1, folder: '05_Compliance',
      body: { A: ['POLICY NUMBER. AGENT name and phone. COMPREHENSIVE and COLLISION deductibles. LOSS PAYEE.', LOREM[0]], B: ['Carrier. POLICY NUMBER. AGENT. COMPREHENSIVE. COLLISION. LOSS PAYEE: dealer / lender.', LOREM[4]] }, table: false, checkboxes: 2 },
    // Unseen form: not in the library.
    DPA: { title: 'DEALER PARTICIPATION AGREEMENT', formId: 'DPA-41', pages: 1, folder: null, unseen: true,
      body: { A: ['Participation percentage. Reserve account. Chargeback schedule.', LOREM[2], LOREM[3]], B: ['Reserve account terms. Participation. Chargebacks.', LOREM[1]] }, table: true, checkboxes: 3 },
  };

  /* Each form gets its own stable geometry (logo side, title size, table
   * position/shape, checkbox grid, signature rows), like real forms from
   * different vendors. Revisions of a form keep its geometry.
   */
  function geometry(key) {
    let h = 7; for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    const pick = (n) => { h = (h * 1103515245 + 12345) >>> 0; return h % n; };
    return { logoRight: pick(2) === 1, titleSize: [11, 13, 15][pick(3)], bodyTop: 690 - pick(4) * 12, bodyWidth: [80, 95, 110][pick(3)],
             tableTop: 380 + pick(6) * 22, tableRows: 3 + pick(5), tableCols: 2 + pick(4), tableX: 36 + pick(3) * 30, tableW: 420 + pick(4) * 39,
             cbCols: 3 + pick(4), cbX: 40 + pick(3) * 20, cbY: 230 + pick(4) * 15, sigRows: 1 + pick(3), sigY: 100 + pick(4) * 12, sigW: 200 + pick(3) * 60,
             twoCol: pick(3) === 0, rule: pick(2) === 1 };
  }
  for (const k of Object.keys(FORMS)) FORMS[k].geo = geometry(k);

  const NAMES = [['GARCIA', 'MARIA'], ['NGUYEN', 'DAVID'], ['OKAFOR', 'CHIDI'], ['SMITH', 'JOHN'], ['PATEL', 'ANITA'], ['KOWALSKI', 'ANNA'], ['BROWN', 'TYLER'], ['ROSSI', 'LUCA'], ['KIM', 'SOO'], ['HERNANDEZ', 'LUIS']];

  /* ---- drawing one clean page with pdf-lib ---- */
  async function drawPage(doc, fonts, form, rev, deal, pageNo, opts = {}) {
    const page = doc.addPage([612, 792]);
    const { bold, reg, mono } = fonts;
    const rgb = window.PDFLib.rgb;
    // logo box + dealer name (header left), title (center), form id top-right in rev B
    const g = form.geo;
    const logoX = g.logoRight ? 466 : 36;
    page.drawRectangle({ x: logoX, y: 730, width: 110, height: 34, borderWidth: 1.5, borderColor: rgb(0, 0, 0) });
    page.drawText('NORTHSTAR AUTO GROUP', { x: logoX + 5, y: 743, size: 8, font: bold });
    const ts = form.title.length > 34 ? Math.min(g.titleSize, 11) : g.titleSize;
    page.drawText(form.title, { x: g.logoRight ? 36 : 160, y: 745, size: ts, font: bold });
    if (rev === 'B') page.drawText(`Form ${form.formId}`, { x: g.logoRight ? 36 : 500, y: 728, size: 8, font: mono });
    if (g.rule) page.drawLine({ start: { x: 36, y: 722 }, end: { x: 576, y: 722 }, thickness: 1.2 });
    // vehicle / buyer block
    const y0 = g.bodyTop;
    const vinTxt = opts.vinText || deal.vin;
    page.drawText(`BUYER: ${deal.last}, ${deal.first}     DATE: 03/1${pageNo}/2026`, { x: 36, y: y0, size: 9, font: reg });
    // VINs are printed prominently on real forms (contract/buyer's order VIN box).
    page.drawText('VIN:', { x: 36, y: y0 - 16, size: 9, font: reg });
    page.drawText(vinTxt, { x: 62, y: y0 - 16, size: 11, font: fonts.monoBold || mono });
    page.drawText(`YEAR/MAKE/MODEL: 2025 ${deal.make}   STOCK: S${deal.stock}`, { x: 250, y: y0 - 14, size: 9, font: reg });
    // body paragraphs (rev-specific wording/order)
    let y = y0 - 40;
    const paras = form.body[rev];
    const startAt = pageNo === 1 ? 0 : (pageNo - 1) % paras.length;
    for (let i = 0; i < paras.length; i++) {
      const p = paras[(startAt + i) % paras.length];
      const words = p.split(' ');
      let line = '';
      const bx = g.twoCol && i % 2 ? 320 : 36;
      if (g.twoCol && i % 2) y += 32 + 12 * Math.ceil(paras[(startAt + i - 1) % paras.length].length / g.bodyWidth);
      for (const w of words) {
        if ((line + ' ' + w).length > (g.twoCol ? 48 : g.bodyWidth)) { page.drawText(line, { x: bx, y, size: 9, font: reg }); y -= 12; line = w; } else line = line ? line + ' ' + w : w;
      }
      page.drawText(line, { x: bx, y, size: 9, font: reg }); y -= 20;
      if (y < g.tableTop + 30) break;
    }
    // table grid
    if (form.table) {
      const top = g.tableTop, rows = g.tableRows, cols = g.tableCols, cw = g.tableW / cols;
      for (let r = 0; r <= rows; r++) page.drawLine({ start: { x: g.tableX, y: top - r * 22 }, end: { x: g.tableX + g.tableW, y: top - r * 22 }, thickness: 0.8 });
      for (let c = 0; c <= cols; c++) page.drawLine({ start: { x: g.tableX + c * cw, y: top }, end: { x: g.tableX + c * cw, y: top - rows * 22 }, thickness: 0.8 });
      for (let r = 0; r < rows; r++) page.drawText(`Item ${r + 1}`, { x: g.tableX + 4, y: top - r * 22 - 15, size: 8, font: reg });
    }
    // checkboxes
    for (let i = 0; i < form.checkboxes; i++) {
      page.drawRectangle({ x: g.cbX + (i % g.cbCols) * 100, y: g.cbY - Math.floor(i / g.cbCols) * 18, width: 9, height: 9, borderWidth: 0.9, borderColor: rgb(0, 0, 0) });
      page.drawText(pick(['Yes', 'No', 'N/A', 'Initial']), { x: g.cbX + 13 + (i % g.cbCols) * 100, y: g.cbY + 1 - Math.floor(i / g.cbCols) * 18, size: 8, font: reg });
    }
    // signature lines
    for (let i = 0; i < g.sigRows; i++) {
      const sy = g.sigY - i * 26;
      page.drawLine({ start: { x: 36, y: sy }, end: { x: 36 + g.sigW, y: sy }, thickness: 0.6 });
      page.drawText(['Buyer Signature', 'Co-Buyer Signature', 'Dealer Representative'][i], { x: 36, y: sy - 10, size: 7, font: reg });
      page.drawLine({ start: { x: 76 + g.sigW, y: sy }, end: { x: 216 + g.sigW, y: sy }, thickness: 0.6 });
      page.drawText('Date', { x: 76 + g.sigW, y: sy - 10, size: 7, font: reg });
    }
    // footer: form id (+ rev) and page n of N
    page.drawText(`${form.formId}  Rev ${rev === 'A' ? '01/2024' : '03/2026'}`, { x: 36, y: 30, size: 8, font: mono });
    if (form.pages > 1) page.drawText(`Page ${pageNo} of ${form.pages}`, { x: 500, y: 30, size: 8, font: reg });
    return page;
  }

  /* ---- scan simulation (in-page, via pdf.js render) ---- */
  let pdfjsMod = null;
  async function renderBytes(bytes, dpi) {
    pdfjsMod = pdfjsMod || (await import(window.DealSplit.LIBS.pdfjs));
    const pdf = await pdfjsMod.getDocument({ data: bytes }).promise;
    const page = await pdf.getPage(1);
    const vp = page.getViewport({ scale: dpi / 72 });
    const c = document.createElement('canvas'); c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height);
    const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    await pdf.destroy();
    return c;
  }
  function noisySkew(c, deg, noise) {
    const o = document.createElement('canvas'); o.width = c.width; o.height = c.height;
    const ctx = o.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, o.width, o.height);
    ctx.translate(o.width / 2, o.height / 2); ctx.rotate(deg * Math.PI / 180); ctx.drawImage(c, -c.width / 2, -c.height / 2); ctx.setTransform(1, 0, 0, 1, 0, 0);
    const img = ctx.getImageData(0, 0, o.width, o.height), d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      if (rnd() < noise) { const v = rnd() < 0.5 ? 0 : 255; d[i] = d[i + 1] = d[i + 2] = v; }
      else { const g = Math.min(255, Math.max(0, (d[i] * 0.85 + 20) + (rnd() - 0.5) * 40)); d[i] = d[i + 1] = d[i + 2] = g; } // grey background + gain noise
    }
    ctx.putImageData(img, 0, 0);
    return o;
  }
  function faxify(c) {
    const ctx = c.getContext('2d');
    const img = ctx.getImageData(0, 0, c.width, c.height), d = img.data;
    for (let y = 0; y < c.height; y++) {
      const streak = rnd() < 0.02;
      for (let x = 0; x < c.width; x++) {
        const i = (y * c.width + x) * 4;
        let v = (d[i] + d[i + 1] + d[i + 2]) / 3;
        if (streak) v = 255;
        if (rnd() < 0.015) v = 0;                    // speckle
        v = v < 150 + (x % 7) * 8 ? 0 : 255;         // hard uneven threshold
        d[i] = d[i + 1] = d[i + 2] = v;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }
  async function canvasBytes(c, type, q) { const b = await new Promise((r) => c.toBlob(r, type, q)); return new Uint8Array(await b.arrayBuffer()); }

  async function build(spec) {
    const { PDFDocument, StandardFonts, rgb } = window.PDFLib;
    const out = await PDFDocument.create();
    const fonts = { bold: await out.embedFont(StandardFonts.HelveticaBold), reg: await out.embedFont(StandardFonts.Helvetica), mono: await out.embedFont(StandardFonts.Courier), monoBold: await out.embedFont(StandardFonts.CourierBold) };
    const truth = [];
    const deals = spec.deals.map((d, i) => ({ ...d, vin: d.vin || makeVin(), last: d.last || NAMES[i % NAMES.length][0], first: d.first || NAMES[i % NAMES.length][1], make: pick(['TOYOTA CAMRY', 'FORD F-150', 'HONDA CIVIC', 'CHEVY SILVERADO']), stock: 1000 + i }));
    const pageSpecs = [];
    for (const item of spec.items) {
      const deal = deals[item.deal];
      const form = FORMS[item.form];
      for (let p = 1; p <= (item.pages || form.pages); p++) pageSpecs.push({ ...item, deal, form, pageNo: p });
    }
    if (spec.shuffle) for (let i = pageSpecs.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [pageSpecs[i], pageSpecs[j]] = [pageSpecs[j], pageSpecs[i]]; }
    // Keep multi-page documents contiguous after shuffle by grouping on (deal, form, item index)
    if (spec.shuffle) {
      const groups = new Map();
      for (const ps of pageSpecs) { const k = `${ps.deal.vin}|${ps.form.title}|${ps.rev}|${ps.variant}|${ps.id || ''}`; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(ps); }
      pageSpecs.length = 0;
      for (const g of groups.values()) { g.sort((a, b) => a.pageNo - b.pageNo); pageSpecs.push(...g); }
    }
    let idx = 0;
    const seenClean = new Map();
    for (const ps of pageSpecs) {
      const vinText = ps.corruptVin ? corruptVin(ps.deal.vin) : ps.deal.vin;
      const variant = ps.variant || 'clean';
      if (variant === 'clean') {
        await drawPage(out, fonts, ps.form, ps.rev, ps.deal, ps.pageNo, { vinText });
      } else {
        // draw into a scratch doc, render, degrade, embed as image
        const scratch = await PDFDocument.create();
        const sf = { bold: await scratch.embedFont(StandardFonts.HelveticaBold), reg: await scratch.embedFont(StandardFonts.Helvetica), mono: await scratch.embedFont(StandardFonts.Courier), monoBold: await scratch.embedFont(StandardFonts.CourierBold) };
        await drawPage(scratch, sf, ps.form, ps.rev, ps.deal, ps.pageNo, { vinText });
        const bytes = await scratch.save();
        let canvas;
        if (variant === 'noisy') { canvas = noisySkew(await renderBytes(bytes, 200), 3, 0.2); }   // a real 200-dpi scan, skewed, 20% noise
        else if (variant === 'fax') { canvas = faxify(await renderBytes(bytes, 100)); }
        else { canvas = await renderBytes(bytes, 150); } // trap: clean image
        const jpg = await canvasBytes(canvas, variant === 'fax' ? 'image/png' : 'image/jpeg', 0.7);
        const img = variant === 'fax' ? await out.embedPng(jpg) : await out.embedJpg(jpg);
        const page = out.addPage([612, 792]);
        page.drawImage(img, { x: 0, y: 0, width: 612, height: 792 });
        if (variant === 'trap') {
          // invisible garbage text layer, like a bad embedded OCR
          for (let i = 0; i < 40; i++) {
            let s = ''; for (let k = 0; k < 12; k++) s += String.fromCharCode(33 + Math.floor(rnd() * 90));
            page.drawText(s, { x: 40 + (i % 4) * 130, y: 740 - Math.floor(i / 4) * 60, size: 8, font: fonts.mono, opacity: 0 });
          }
        }
      }
      truth.push({ pageIndex: idx++, templateId: ps.form.unseen ? null : ps.form === FORMS[ps.formKey] ? ps.formKey : Object.keys(FORMS).find((k) => FORMS[k] === ps.form),
                   family: ps.form.unseen ? null : Object.keys(FORMS).find((k) => FORMS[k] === ps.form), vin: ps.deal.vin, variant, rev: ps.rev, deal: deals.indexOf(ps.deal), pageNo: ps.pageNo, corruptVin: !!ps.corruptVin, dup: false });
      if (ps.duplicate) { // exact duplicate of this page right after
        const [copy] = await out.copyPages(out, [out.getPageCount() - 1]);
        out.addPage(copy);
        truth.push({ ...truth[truth.length - 1], pageIndex: idx++, dup: true });
      }
    }
    const bytes = await out.save({ useObjectStreams: false });
    return { bytes, truth, deals };
  }

  /* The acceptance-test composition: ≥8 templates × 3 quality variants × 2 revisions + unseen + duplicates ≈ 150 pages. */
  function acceptanceSpec() {
    const items = [];
    const deals = [];
    const kinds = ['RETAIL', 'LEASE', 'CASH', 'RETAIL', 'LEASE', 'RETAIL', 'CASH', 'RETAIL', 'LEASE', 'RETAIL', 'RETAIL'];
    const variants = ['clean', 'noisy', 'fax'];
    kinds.forEach((kind, di) => {
      deals.push({ kind, corrupt: di < 3 });
      const add = (form, extra = {}) => items.push({ deal: di, form, rev: (di + items.length) % 2 ? 'A' : 'B', variant: variants[(di + items.length) % 3], corruptVin: di < 3 && form === 'BUYERS_ORDER', ...extra });
      if (kind === 'RETAIL') add('RISC'); else if (kind === 'LEASE') add('LEASE');
      add('BUYERS_ORDER'); add('ODOMETER'); add('TITLE_APP'); add('PRIVACY');
      if (kind !== 'CASH') { add('CREDIT_APP'); add('INSURANCE'); }
      if (kind !== 'CASH') { add('GAP'); add('VSC'); } if (di % 3 !== 2) add('TRADE_APPRAISAL');
    });
    // text-layer traps: 4 pages with garbage text layers
    items.push({ deal: 0, form: 'ODOMETER', rev: 'A', variant: 'trap', id: 't1' }, { deal: 1, form: 'PRIVACY', rev: 'B', variant: 'trap', id: 't2' },
               { deal: 2, form: 'GAP', rev: 'A', variant: 'trap', id: 't3' }, { deal: 3, form: 'INSURANCE', rev: 'B', variant: 'trap', id: 't4' });
    // one exact duplicate
    items.push({ deal: 4, form: 'ODOMETER', rev: 'B', variant: 'clean', id: 'dup', duplicate: true });
    // 5 unseen pages
    for (let i = 0; i < 5; i++) items.push({ deal: i, form: 'DPA', rev: i % 2 ? 'A' : 'B', variant: variants[i % 3], id: 'u' + i });
    return { deals, items, shuffle: true };
  }

  return { build, acceptanceSpec, FORMS, makeVin };
})();
