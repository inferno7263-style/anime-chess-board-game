import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

// Keep the engine on the same origin. This lite, single-threaded build needs
// neither a paid API nor SharedArrayBuffer / cross-origin isolation headers.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, 'node_modules/stockfish');
const destination = resolve(root, 'public/engine');
await mkdir(destination, { recursive: true });
for (const [from, to] of [
  ['src/stockfish-17.1-lite-single-03e3232.js', 'stockfish.js'],
  ['src/stockfish-17.1-lite-single-03e3232.wasm', 'stockfish.wasm'],
  ['Copying.txt', 'LICENSE.txt'],
  ['AUTHORS', 'AUTHORS'],
]) {
  await copyFile(resolve(source, from), resolve(destination, to));
}
await writeFile(resolve(destination, 'README.txt'), `Stockfish.js 17.1, lite single-threaded WASM build
Copyright 2025 Chess.com, LLC and Stockfish contributors. Licensed GPLv3.

Upstream JavaScript/WASM package and corresponding source:
https://github.com/nmrugg/stockfish.js/tree/Stockfish17.1
https://www.npmjs.com/package/stockfish/v/17.1.0
Original files: stockfish-17.1-lite-single-03e3232.js and matching .wasm.
They are copied without modification and renamed together for browser loading.
Stockfish source: https://github.com/official-stockfish/Stockfish
See LICENSE.txt and AUTHORS. Regenerate with npm run prepare:engine.
`);
console.log('Prepared Stockfish 17.1 lite single-threaded browser engine.');
