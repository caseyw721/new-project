/* Local static server for the tests: serves the artifact and local copies of
 * the pinned CDN packages so the tests never touch the network.
 *   /                 → dealsplit/index.html
 *   /npm/<pkg>@<ver>/<path> → <nodeModules>/<pkg>/<path>   (version ignored; pinned in package.json)
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.json': 'application/json',
                '.gz': 'application/gzip', '.pdf': 'application/pdf', '.map': 'application/json', '.txt': 'text/plain' };

function start({ root, nodeModules, port = 0 }) {
  const server = http.createServer((req, res) => {
    let url = decodeURIComponent(req.url.split('?')[0]);
    let file;
    if (url === '/' || url === '/index.html') file = path.join(root, 'index.html');
    else if (url.startsWith('/npm/')) {
      const rest = url.slice(5);
      const m = /^((?:@[^/]+\/)?[^/@]+)(?:@[^/]+)?\/(.*)$/.exec(rest);
      if (m) file = path.join(nodeModules, m[1], m[2]);
    } else file = path.join(root, url);
    if (!file || !file.startsWith(path.resolve(root)) && !file.startsWith(path.resolve(nodeModules))) { res.writeHead(403); res.end(); return; }
    fs.stat(file, (err, st) => {
      if (err || !st.isFile()) { res.writeHead(404); res.end('not found: ' + url); return; }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp' });
      fs.createReadStream(file).pipe(res);
    });
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve({ server, port: server.address().port })));
}

function libsFor(base) {
  return {
    pdfjs: `${base}/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs`,
    pdfjsWorker: `${base}/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs`,
    tesseract: `${base}/npm/tesseract.js@5.1.1/dist/tesseract.min.js`,
    tesseractWorker: `${base}/npm/tesseract.js@5.1.1/dist/worker.min.js`,
    tesseractCore: `${base}/npm/tesseract.js-core@5.1.1`,
    tesseractLang: `${base}/npm/@tesseract.js-data/eng/4.0.0_best_int`,
    pdflib: `${base}/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js`,
    jszip: `${base}/npm/jszip@3.10.1/dist/jszip.min.js`,
  };
}

module.exports = { start, libsFor };
if (require.main === module) {
  start({ root: path.join(__dirname, '..'), nodeModules: process.env.NODE_MODULES || path.join(__dirname, 'node_modules'), port: +(process.env.PORT || 8765) })
    .then(({ port }) => console.log(`http://127.0.0.1:${port}/  (libs: set localStorage dealsplit.libs to`, JSON.stringify(libsFor(`http://127.0.0.1:${port}`)), ')'));
}
