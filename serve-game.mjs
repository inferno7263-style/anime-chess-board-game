#!/usr/bin/env node
/** Dependency-free launcher for the production game. Run: node serve-game.mjs */
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { access, stat } from 'node:fs/promises';
import { dirname, extname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), 'dist');
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || '127.0.0.1';
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.wasm': 'application/wasm', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
};
try { await access(resolve(root, 'index.html')); }
catch { console.error('Game build missing. Run npm ci && npm run build, then try again.'); process.exit(1); }
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('PORT must be a number between 1 and 65535.'); process.exit(1);
}
const server = createServer(async (request, response) => {
  const reply = (status, message) => {
    response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' }); response.end(message);
  };
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.setHeader('Allow', 'GET, HEAD'); reply(405, 'Method not allowed.'); return;
  }
  let path;
  try { path = decodeURIComponent(new URL(request.url || '/', 'http://game.local').pathname); }
  catch { reply(400, 'Invalid path.'); return; }
  if (path.includes('\0') || path.includes('\\')) { reply(400, 'Invalid path.'); return; }
  const file = resolve(root, '.' + (path.endsWith('/') ? path + 'index.html' : path));
  const location = relative(root, file);
  if (location === '..' || location.startsWith('..' + sep)) { reply(403, 'Access denied.'); return; }
  try {
    const info = await stat(file);
    if (!info.isFile()) { reply(404, 'Not found.'); return; }
    response.writeHead(200, {
      'Content-Type': types[extname(file)] || 'application/octet-stream',
      'Content-Length': info.size,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': extname(file) === '.html' ? 'no-cache' : 'public, max-age=3600',
    });
    if (request.method === 'HEAD') { response.end(); return; }
    const stream = createReadStream(file);
    stream.on('error', () => response.destroy());
    stream.pipe(response);
  } catch { reply(404, 'Not found.'); }
});
server.on('error', error => {
  console.error(`Could not start the game: ${error.message}`);
  if (error.code === 'EADDRINUSE') console.error('Close the existing game server or choose another PORT.');
  process.exit(1);
});
server.listen(port, host, () => {
  console.log('\n  ANIME CHESS: MULTIVERSE WAR\n');
  console.log(`  Open http://localhost:${port} in your browser.`);
  console.log('  Choose Local PvP or vs. Computer. Press Ctrl+C to stop.\n');
});
