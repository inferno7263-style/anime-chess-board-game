import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { Chess } from 'chess.js';
import { expect, it } from 'vitest';
import { parseUciMove, tryMove } from '../src/game/chess';

it('the installed Stockfish WASM engine produces a legal reply after e4', async () => {
  const enginePath = resolve('node_modules/stockfish/src/stockfish-17.1-lite-single-03e3232.js');
  const game = new Chess();
  game.move('e4');
  const bestmove = await new Promise<string>((resolveMove, reject) => {
    const engine = spawn(process.execPath, [enginePath], { stdio: ['pipe', 'pipe', 'pipe'] });
    let output = '';
    let errors = '';
    let searching = false;
    let settled = false;
    const timer = setTimeout(() => { engine.kill(); reject(new Error(`Stockfish timed out: ${errors}`)); }, 12000);
    engine.stderr.on('data', (chunk) => { errors += String(chunk); });
    engine.on('error', (error) => { clearTimeout(timer); reject(error); });
    engine.on('exit', (code) => {
      if (!settled) { clearTimeout(timer); reject(new Error(`Stockfish exited ${code}: ${errors}`)); }
    });
    engine.stdout.on('data', (chunk) => {
      output += String(chunk);
      if (!searching && output.includes('readyok')) {
        searching = true;
        engine.stdin.write(`position fen ${game.fen()}\ngo movetime 100\n`);
      }
      const match = output.match(/bestmove ([a-h][1-8][a-h][1-8][qrbn]?)/);
      if (match && !settled) {
        settled = true;
        clearTimeout(timer);
        engine.stdin.write('quit\n');
        engine.kill();
        resolveMove(match[1]);
      }
    });
    engine.stdin.write('uci\nisready\n');
  });
  const request = parseUciMove(bestmove);
  expect(request).not.toBeNull();
  expect(tryMove(game, request!)).not.toBeNull();
  expect(game.turn()).toBe('w');
}, 15000);
