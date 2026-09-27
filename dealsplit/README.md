# DealSplit

A single HTML file that splits a combined dealership-paperwork PDF into individual documents,
identifies each one, reads the VIN, groups pages into deals and writes the folder tree for each
deal. Everything runs inside the browser tab. **Documents never leave the browser.**

## Use it

1. Open `dealsplit/index.html` in Chrome or Edge (Firefox and Safari work too, but download a ZIP
   instead of writing folders directly).
2. Drop the combined PDF on the page.
3. Click **Split & classify**. Pages turn green (confident), amber (likely) or red (unknown).
4. Open **Review** for anything amber or red. Choosing the right document type teaches the
   system: that page becomes an example for the type. After two examples of a form, its siblings
   come back confident.
5. Click **Choose output folder…** (Chrome/Edge) then **Write deals**, or just **Write deals**
   for a ZIP.

The first time it runs on a new dealership's forms, most pages come back **likely**, because the
built-in library knows the form *names* but has never seen your scans. Confirm one batch and the
next batch is mostly confident. Export the library (Templates → Export JSON) and import it on the
other machines.

Output per deal:

```
<VIN>_<LastName>_<DealType>/
  01_Contract/  02_CreditApp/  03_Title/  04_Products/  05_Compliance/  06_Trade/
  _Review/      _Duplicates/   manifest.json   MISSING.txt
```

`manifest.json` maps every output file back to the source page numbers with the decision, score
and top candidates. `MISSING.txt` lists checklist items not found for the deal type.

## Privacy and network

Only code is fetched from the network: pdf.js, tesseract.js, pdf-lib and JSZip from
`cdn.jsdelivr.net`, and on the first OCR the tesseract worker, engine and English language data
from the same CDN (cached in IndexedDB afterwards). The **Privacy & network** tab lists every
request the page made. For air-gapped machines, self-host those files and point the page at them
(see that tab).

## How it decides

Four layers, in separate sections of the file, with no upward references (enforced by
`build.js`):

| Layer | File | Job |
|---|---|---|
| Perception | `src/a-perception.js` | Page → features. Text layer + a quality score that rejects garbage embedded OCR; deskew; Sauvola binarization; fingerprints (perceptual hash, ink band profiles, rule positions, six header/footer zone hashes, checkbox density); OCR worker pool, header/footer strips first, cached by page hash. |
| Knowledge | `src/b-knowledge.js` | Template library (anchors, negatives, exemplars, routing), deal types, VIN grammar. JSON import/export. |
| Reasoning | `src/c-reasoner.js` | Evidence accumulator: anchor, layout, region, structure, negative and context families in log-odds-like units. `CONFIDENT` needs score ≥ accept, margin ≥ margin and two independent families. Escalation ladder: text layer → fingerprint → OCR strips → full OCR → UNKNOWN. Invariants are assertions. Decisions are frozen. |
| Policy | `src/d-policy.js` | Segmentation, duplicates, VIN repair with ISO 3779 check digit, deal grouping and type inference, routing, manifests, writer (File System Access API or ZIP). |
| RCA | `src/e-rca.js` | Decision log, corrections → exemplars (with undo), failure taxonomy, regression harness that replays confirmed pages and blocks changes that break them, drift alarms, redacted export. |

`src/f-app.js` is the orchestration and UI; `index.template.html` the shell. `node build.js`
inlines everything into `index.html`.

## Tests

```bash
cd dealsplit/tests
npm install playwright pdfjs-dist@4.10.38 tesseract.js@5.1.1 tesseract.js-core@5.1.1 @tesseract.js-data/eng pdf-lib@1.17.1 jszip@3.10.1
node smoke.test.js        # ~1 min: onboarding loop, VIN repair, duplicates, ZIP, harness, redacted log
node acceptance.test.js   # several min: 150-page synthetic PDF, 3 scan qualities, traps, unseen forms, learning
```

The tests serve the pinned libraries from local `node_modules` and abort any other request, so a
passing run proves the page makes no external network calls.

`tests/gen-synthetic.js` builds the synthetic paperwork in-page: 10 known forms + 1 unseen form,
two text revisions each, and clean / noisy+skewed / fax-simulated / garbage-text-layer variants.
