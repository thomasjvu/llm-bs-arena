import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const APP_DIR = path.dirname(__filename);
const REPO_ROOT = path.resolve(APP_DIR, '../..');
const IMAGES_DIR = path.join(REPO_ROOT, 'ui/images');
const PORT = Number(process.env.RESEARCH_PORT || 3002);

const MIME_TYPES = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

function sendFile(res, filePath) {
  fs.readFile(filePath, (error, buffer) => {
    if (error) {
      if (error.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not found');
        return;
      }

      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Internal server error');
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[extension] || 'application/octet-stream',
      'Cache-Control': extension === '.html' ? 'no-store' : 'public, max-age=300',
    });
    res.end(buffer);
  });
}

function resolvePath(requestPath) {
  if (requestPath === '/' || requestPath === '/index.html') {
    return path.join(APP_DIR, 'index.html');
  }

  if (requestPath.startsWith('/images/')) {
    return path.join(IMAGES_DIR, requestPath.slice('/images/'.length));
  }

  return path.join(APP_DIR, requestPath.replace(/^\/+/, ''));
}

function isAllowedPath(filePath, requestPath) {
  if (requestPath.startsWith('/images/')) {
    return filePath.startsWith(IMAGES_DIR);
  }
  return filePath.startsWith(APP_DIR);
}

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || `localhost:${PORT}`}`);
  const filePath = resolvePath(parsedUrl.pathname);

  if (!isAllowedPath(filePath, parsedUrl.pathname)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  sendFile(res, filePath);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║        BS-Bench Research Dashboard (Frozen)          ║
╠═══════════════════════════════════════════════════════╣
║  Server running at http://localhost:${PORT}              ║
║                                                       ║
║  • Standalone static research app                    ║
║  • Frozen 600-game paper cohort only                 ║
║  • No live gameplay or visualizer APIs               ║
╚═══════════════════════════════════════════════════════╝
  `);
});
