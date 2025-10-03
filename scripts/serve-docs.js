#!/usr/bin/env node
/**
 * Super-slim static file server for docs preview.
 * Usage: node scripts/serve-docs.js [port]
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const port = Number(process.argv[2]) || Number(process.env.PORT) || 5173;
const rootDir = path.resolve(__dirname, '..', 'docs');

const mimeByExt = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif'
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Cache-Control': 'no-store', ...headers });
  res.end(body);
}

function safeJoin(base, target) {
  const targetPath = path.posix.normalize('/' + target);
  return path.join(base, targetPath);
}

const server = http.createServer((req, res) => {
  try {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    let filePath = safeJoin(rootDir, urlPath);

    // If path is a directory, serve index.html
    let stat;
    try { stat = fs.statSync(filePath); } catch (_) { /* ignore */ }
    if (stat && stat.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }

    // Default to /index.html for root
    if (!stat && (urlPath === '/' || urlPath === '')) {
      filePath = path.join(rootDir, 'index.html');
    }

    if (!fs.existsSync(filePath)) {
      return send(res, 404, 'Not found');
    }

    const ext = path.extname(filePath).toLowerCase();
    const mime = mimeByExt[ext] || 'application/octet-stream';
    const stream = fs.createReadStream(filePath);
    res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-store' });
    stream.pipe(res);
    stream.on('error', (err) => send(res, 500, String(err)));
  } catch (err) {
    send(res, 500, String(err));
  }
});

server.listen(port, () => {
  console.log(`Docs preview running at http://localhost:${port}`);
  console.log(`Serving from: ${rootDir}`);
});
