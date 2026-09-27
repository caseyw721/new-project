/* =====================================================================
 * Layer B: Knowledge. The template library, deal types and VIN grammar.
 * Pure data + validation + persistence. Uses only DS.Infra.
 * ===================================================================== */
DS.Knowledge = (() => {
  'use strict';
  const { Store, fnv1a64, hamming64, uid, normText } = DS.Infra;

  const VIN_RE = /\b[A-HJ-NPR-Z0-9]{17}\b/g;           // strict
  const VIN_LOOSE_RE = /\b[A-Z0-9]{17}\b/g;              // permissive (OCR may give I/O/Q)

  /* ---------- default library ----------
   * Anchors are phrases that survive revisions; form IDs are the strongest.
   * Exemplars (fingerprints) are learned from the user's own scans.
   */
  const T = (id, displayName, family, folder, requiredFor, anchors, negatives, extra = {}) => ({
    id, displayName, family, folder,
    expectedPages: extra.expectedPages || { min: 1, max: 4 },
    continuation: extra.continuation || { pattern: 'PAGE \\d+ OF \\d+' },
    anchors, negatives: negatives || [],
    exemplars: [],
    fields: { vin: { zone: 'any', regex: 'VIN' }, ...(extra.fields || {}) },
    routing: { folder, requiredFor },
    dealTypeSignal: extra.dealTypeSignal || null,
    enabled: true,
  });
  const A = (text, zone, weight, fuzzy = 0.85) => ({ text, zone, weight, fuzzy });

  function defaultTemplates() {
    return [
      T('RISC', 'Retail Installment Sale Contract', 'RISC', '01_Contract', ['RETAIL'],
        [A('RETAIL INSTALLMENT SALE CONTRACT', 'header', 3), A('ANNUAL PERCENTAGE RATE', 'any', 2, 0.9),
         A('FINANCE CHARGE', 'any', 1.5, 0.9), A('TOTAL OF PAYMENTS', 'any', 1.5, 0.9), A('ITEMIZATION OF AMOUNT FINANCED', 'any', 2)],
        [A('LEASE AGREEMENT', 'header', -4), A('CLOSED END', 'any', -3)],
        { expectedPages: { min: 1, max: 6 }, dealTypeSignal: 'RETAIL' }),
      T('LEASE', 'Motor Vehicle Lease Agreement', 'LEASE', '01_Contract', ['LEASE'],
        [A('LEASE AGREEMENT', 'header', 3), A('CLOSED END', 'any', 2), A('LESSEE', 'any', 1.5, 0.9),
         A('MONTHLY LEASE PAYMENT', 'any', 2), A('RESIDUAL VALUE', 'any', 2), A('EXCESS MILEAGE', 'any', 1.5)],
        [A('RETAIL INSTALLMENT', 'header', -4), A('ANNUAL PERCENTAGE RATE', 'any', -2)],
        { expectedPages: { min: 1, max: 8 }, dealTypeSignal: 'LEASE' }),
      T('CREDIT_APP', 'Credit Application', 'CREDIT_APP', '02_CreditApp', ['RETAIL', 'LEASE'],
        [A('CREDIT APPLICATION', 'header', 3), A('SOCIAL SECURITY', 'any', 1.5, 0.9), A('EMPLOYER', 'any', 1, 0.9),
         A('MONTHLY INCOME', 'any', 1.5), A('CO-APPLICANT', 'any', 1.5)],
        [A('SALE CONTRACT', 'header', -3)], { expectedPages: { min: 1, max: 3 } }),
      T('ODOMETER', 'Odometer Disclosure Statement', 'ODOMETER', '03_Title', ['RETAIL', 'LEASE', 'CASH'],
        [A('ODOMETER DISCLOSURE STATEMENT', 'header', 3), A('FEDERAL LAW', 'any', 1, 0.9), A('ACTUAL MILEAGE', 'any', 2),
         A('NOT THE ACTUAL MILEAGE', 'any', 1.5), A('TENTHS', 'any', 1, 0.95)],
        [], { expectedPages: { min: 1, max: 1 } }),
      T('TITLE_APP', 'Application for Title and Registration', 'TITLE_APP', '03_Title', ['RETAIL', 'LEASE', 'CASH'],
        [A('APPLICATION FOR TITLE', 'header', 3), A('REGISTRATION', 'header', 1, 0.9), A('LIENHOLDER', 'any', 2),
         A('PLATE NUMBER', 'any', 1.5), A('BODY TYPE', 'any', 1)],
        [A('ODOMETER DISCLOSURE STATEMENT', 'header', -3)], { expectedPages: { min: 1, max: 2 } }),
      T('GAP', 'GAP Addendum', 'GAP', '04_Products', [],
        [A('GUARANTEED ASSET PROTECTION', 'header', 3), A('GAP', 'header', 1.5, 0.95), A('ADDENDUM', 'header', 1, 0.9),
         A('DEFICIENCY BALANCE', 'any', 2), A('PRIMARY INSURANCE', 'any', 1)],
        [A('SERVICE CONTRACT', 'header', -3)], { expectedPages: { min: 1, max: 3 } }),
      T('VSC', 'Vehicle Service Contract', 'VSC', '04_Products', [],
        [A('VEHICLE SERVICE CONTRACT', 'header', 3), A('COVERAGE', 'any', 1, 0.9), A('DEDUCTIBLE', 'any', 2),
         A('TERM MONTHS', 'any', 1), A('ADMINISTRATOR', 'any', 1.5)],
        [A('GUARANTEED ASSET PROTECTION', 'header', -3)], { expectedPages: { min: 1, max: 4 } }),
      T('PRIVACY', 'Privacy Notice', 'PRIVACY', '05_Compliance', ['RETAIL', 'LEASE', 'CASH'],
        [A('PRIVACY NOTICE', 'header', 3), A('WHAT DOES', 'header', 1, 0.9), A('PERSONAL INFORMATION', 'any', 1.5),
         A('AFFILIATES', 'any', 1.5), A('OPT OUT', 'any', 1.5)],
        [], { expectedPages: { min: 1, max: 2 } }),
      T('BUYERS_ORDER', "Buyer's Order", 'BUYERS_ORDER', '01_Contract', ['RETAIL', 'LEASE', 'CASH'],
        [A('BUYERS ORDER', 'header', 3, 0.8), A('PURCHASE AGREEMENT', 'header', 1.5), A('STOCK NUMBER', 'any', 1.5),
         A('SALES TAX', 'any', 1, 0.9), A('DOCUMENTARY FEE', 'any', 2), A('TRADE ALLOWANCE', 'any', 1.5)],
        [A('RETAIL INSTALLMENT', 'header', -2), A('LEASE AGREEMENT', 'header', -2)],
        { expectedPages: { min: 1, max: 2 }, dealTypeSignal: 'CASH_IF_ALONE' }),
      T('TRADE_APPRAISAL', 'Trade-In Appraisal', 'TRADE_APPRAISAL', '06_Trade', [],
        [A('TRADE IN APPRAISAL', 'header', 3, 0.8), A('APPRAISAL', 'header', 1, 0.9), A('PAYOFF', 'any', 2),
         A('CONDITION', 'any', 1, 0.9), A('ACTUAL CASH VALUE', 'any', 2)],
        [], { expectedPages: { min: 1, max: 2 } }),
      T('INSURANCE', 'Insurance Verification', 'INSURANCE', '05_Compliance', ['RETAIL', 'LEASE'],
        [A('INSURANCE VERIFICATION', 'header', 3), A('POLICY NUMBER', 'any', 2), A('AGENT', 'any', 1, 0.9),
         A('COMPREHENSIVE', 'any', 1.5), A('COLLISION', 'any', 1.5), A('LOSS PAYEE', 'any', 2)],
        [], { expectedPages: { min: 1, max: 1 } }),
    ];
  }

  function defaultDealTypes() {
    return {
      RETAIL: { displayName: 'Retail (financed)', required: ['RISC', 'CREDIT_APP', 'ODOMETER', 'TITLE_APP', 'PRIVACY', 'BUYERS_ORDER', 'INSURANCE'] },
      LEASE: { displayName: 'Lease', required: ['LEASE', 'CREDIT_APP', 'ODOMETER', 'TITLE_APP', 'PRIVACY', 'BUYERS_ORDER', 'INSURANCE'] },
      CASH: { displayName: 'Cash', required: ['BUYERS_ORDER', 'ODOMETER', 'TITLE_APP', 'PRIVACY'] },
    };
  }

  function defaultSettings() {
    return {
      thresholds: { accept: 6.0, margin: 2.5, likely: 3.5, imageOnlyAccept: 9.0, imageOnlyMargin: 3.0, textQualityMin: 0.45, ocrConfMin: 0.55, layoutMinExemplars: 2 },
      folders: { reviewFolder: '_Review', duplicatesFolder: '_Duplicates', dealFolder: '<VIN>_<LastName>_<DealType>' },
      ocrWorkers: Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1)),
      maxExemplars: 20,
      libraryVersion: 1,
    };
  }

  /* ---------- validation ---------- */
  const ZONES = new Set(['header', 'footer', 'body', 'any']);
  function validateTemplate(t) {
    const errs = [];
    if (!t || typeof t !== 'object') return ['not an object'];
    if (!t.id || !/^[A-Za-z0-9_-]{1,40}$/.test(t.id)) errs.push('id must be 1-40 letters/digits/_/-');
    if (!t.displayName) errs.push('displayName required');
    if (!t.family) errs.push('family required');
    if (!t.routing || !t.routing.folder) errs.push('routing.folder required');
    for (const a of t.anchors || []) {
      if (!a.text) errs.push('anchor text required');
      if (!ZONES.has(a.zone)) errs.push(`anchor zone ${a.zone} invalid`);
      if (typeof a.weight !== 'number') errs.push('anchor weight must be a number');
    }
    for (const a of t.negatives || []) if (typeof a.weight !== 'number' || a.weight > 0) errs.push('negative weights must be < 0');
    return errs;
  }
  function normalizeTemplate(t) {
    const out = { ...t };
    out.anchors = (t.anchors || []).map((a) => ({ text: normText(a.text), zone: a.zone || 'any', weight: +a.weight, fuzzy: a.fuzzy ?? 0.85 }));
    out.negatives = (t.negatives || []).map((a) => ({ text: normText(a.text), zone: a.zone || 'any', weight: -Math.abs(+a.weight), fuzzy: a.fuzzy ?? 0.85 }));
    out.exemplars = t.exemplars || [];
    out.expectedPages = t.expectedPages || { min: 1, max: 4 };
    out.continuation = t.continuation || { pattern: 'PAGE \\d+ OF \\d+' };
    out.fields = t.fields || {};
    out.routing = { folder: t.routing?.folder || t.folder || '99_Other', requiredFor: t.routing?.requiredFor || [] };
    out.folder = out.routing.folder;
    out.enabled = t.enabled !== false;
    return out;
  }

  /* ---------- library object ---------- */
  const lib = {
    templates: [], dealTypes: {}, settings: defaultSettings(), listeners: new Set(),
    onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },
    _emit() { for (const f of this.listeners) f(this); },
    versionHash() {
      return fnv1a64(JSON.stringify({ t: this.templates, d: this.dealTypes, th: this.settings.thresholds }));
    },
    byId(id) { return this.templates.find((t) => t.id === id); },
    async load() {
      const [t, d, s] = await Promise.all([Store.get('templates', 'library'), Store.get('dealtypes', 'all'), Store.get('settings', 'main')]).catch(() => []);
      this.templates = (t && t.length ? t : defaultTemplates()).map(normalizeTemplate);
      this.dealTypes = d && Object.keys(d).length ? d : defaultDealTypes();
      this.settings = { ...defaultSettings(), ...(s || {}) };
      this.settings.thresholds = { ...defaultSettings().thresholds, ...(s?.thresholds || {}) };
      this._emit();
      return this;
    },
    async save() {
      await Promise.all([Store.put('templates', 'library', this.templates), Store.put('dealtypes', 'all', this.dealTypes), Store.put('settings', 'main', this.settings)]);
      this._emit();
    },
    upsertTemplate(t) {
      const n = normalizeTemplate(t);
      const errs = validateTemplate(n);
      if (errs.length) throw new Error('Invalid template: ' + errs.join('; '));
      const i = this.templates.findIndex((x) => x.id === n.id);
      if (i >= 0) this.templates[i] = n; else this.templates.push(n);
      this.settings.libraryVersion++;
      return n;
    },
    removeTemplate(id) { this.templates = this.templates.filter((t) => t.id !== id); this.settings.libraryVersion++; },
    /* Add an exemplar, keeping the set diverse (drop the exemplar nearest to
     * its neighbours when over the cap). Returns {added, dropped}.
     */
    addExemplar(id, fp, meta = {}) {
      const t = this.byId(id);
      if (!t) throw new Error('unknown template ' + id);
      const ex = { id: uid(), phash64: fp.phash64, bandProfile: fp.bandProfile, lineSig: fp.lineSig, regionHashes: fp.regionHashes,
                   regionInk: fp.regionInk, checkboxDensity: fp.checkboxDensity, orientation: fp.orientation, aspect: fp.aspect,
                   addedAt: new Date().toISOString(), ...meta };
      if (t.exemplars.some((e) => hamming64(e.phash64, ex.phash64) <= 2)) return { added: null, dropped: null, reason: 'near-duplicate exemplar' };
      t.exemplars.push(ex);
      let dropped = null;
      const cap = this.settings.maxExemplars || 20;
      if (t.exemplars.length > cap) {
        // drop the one with the smallest distance to its nearest neighbour (most redundant)
        let worst = -1, worstD = Infinity;
        for (let i = 0; i < t.exemplars.length; i++) {
          let nn = Infinity;
          for (let j = 0; j < t.exemplars.length; j++) if (i !== j) nn = Math.min(nn, hamming64(t.exemplars[i].phash64, t.exemplars[j].phash64));
          if (nn < worstD) { worstD = nn; worst = i; }
        }
        dropped = t.exemplars.splice(worst, 1)[0];
      }
      this.settings.libraryVersion++;
      return { added: ex, dropped };
    },
    removeExemplar(id, exId) {
      const t = this.byId(id); if (!t) return false;
      const n = t.exemplars.length;
      t.exemplars = t.exemplars.filter((e) => e.id !== exId);
      if (t.exemplars.length !== n) this.settings.libraryVersion++;
      return t.exemplars.length !== n;
    },
    exportJSON() {
      return JSON.stringify({ format: 'dealsplit-library', version: 1, exportedAt: new Date().toISOString(),
        templates: this.templates, dealTypes: this.dealTypes, settings: this.settings }, null, 2);
    },
    importJSON(json, { merge = true } = {}) {
      const o = typeof json === 'string' ? JSON.parse(json) : json;
      if (o.format !== 'dealsplit-library') throw new Error('Not a DealSplit library file');
      const incoming = (o.templates || []).map(normalizeTemplate);
      for (const t of incoming) { const e = validateTemplate(t); if (e.length) throw new Error(`Template ${t.id}: ${e.join('; ')}`); }
      if (merge) {
        for (const t of incoming) {
          const cur = this.byId(t.id);
          if (cur) { // merge exemplars, keep local edits to anchors unless incoming is newer
            const seen = new Set(cur.exemplars.map((e) => e.phash64));
            for (const e of t.exemplars) if (!seen.has(e.phash64)) cur.exemplars.push(e);
            cur.anchors = t.anchors; cur.negatives = t.negatives; cur.routing = t.routing; cur.displayName = t.displayName;
          } else this.templates.push(t);
        }
        Object.assign(this.dealTypes, o.dealTypes || {});
      } else {
        this.templates = incoming; this.dealTypes = o.dealTypes || defaultDealTypes();
      }
      if (o.settings?.thresholds) this.settings.thresholds = { ...this.settings.thresholds, ...o.settings.thresholds };
      if (o.settings?.folders) this.settings.folders = { ...this.settings.folders, ...o.settings.folders };
      this.settings.libraryVersion++;
      return { templates: incoming.length };
    },
    resetToDefaults() { this.templates = defaultTemplates().map(normalizeTemplate); this.dealTypes = defaultDealTypes(); this.settings = defaultSettings(); },
  };

  return { VIN_RE, VIN_LOOSE_RE, lib, defaultTemplates, defaultDealTypes, defaultSettings, validateTemplate, normalizeTemplate, ZONES };
})();
