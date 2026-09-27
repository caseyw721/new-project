#!/usr/bin/env node
/* Inline the layer sources into the single-file artifact and enforce the
 * layering rule (no upward imports): each layer may reference only the
 * layers below it.
 *   node dealsplit/build.js   → dealsplit/index.html
 */
const fs = require('fs');
const path = require('path');

const here = __dirname;
const order = ['0-infra.js', 'a-perception.js', 'b-knowledge.js', 'c-reasoner.js', 'd-policy.js', 'e-rca.js', 'f-app.js'];
const allowed = {
  '0-infra.js': [],
  'a-perception.js': ['DS.Infra'],
  'b-knowledge.js': ['DS.Infra'],
  'c-reasoner.js': ['DS.Infra', 'DS.Perception', 'DS.Knowledge'],
  'd-policy.js': ['DS.Infra', 'DS.Knowledge'],
  'e-rca.js': ['DS.Infra', 'DS.Knowledge', 'DS.Reasoner'],
  'f-app.js': ['DS.Infra', 'DS.Perception', 'DS.Knowledge', 'DS.Reasoner', 'DS.Policy', 'DS.RCA'],
};
const layers = ['DS.Infra', 'DS.Perception', 'DS.Knowledge', 'DS.Reasoner', 'DS.Policy', 'DS.RCA', 'DS.App'];

let problems = 0;
const parts = [];
for (const f of order) {
  const src = fs.readFileSync(path.join(here, 'src', f), 'utf8');
  const own = 'DS.' + { '0-infra.js': 'Infra', 'a-perception.js': 'Perception', 'b-knowledge.js': 'Knowledge', 'c-reasoner.js': 'Reasoner', 'd-policy.js': 'Policy', 'e-rca.js': 'RCA', 'f-app.js': 'App' }[f];
  for (const L of layers) {
    if (L === own || allowed[f].includes(L)) continue;
    const re = new RegExp(L.replace('.', '\\.') + '\\b');
    if (re.test(src)) { console.error(`LAYERING: ${f} references ${L} (not allowed)`); problems++; }
  }
  parts.push(`<script>\n/* ---- ${f} ---- */\n${src}\n</script>`);
}
if (problems) { console.error(`${problems} layering violation(s)`); process.exit(1); }

const tpl = fs.readFileSync(path.join(here, 'index.template.html'), 'utf8');
const out = tpl.replace('<!-- @@SCRIPTS@@ -->', parts.join('\n'));
fs.writeFileSync(path.join(here, 'index.html'), out);
console.log(`Built dealsplit/index.html (${(out.length / 1024).toFixed(0)} KB); layering OK`);
