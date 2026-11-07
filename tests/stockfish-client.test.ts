import { afterEach, describe, expect, it, vi } from 'vitest';
import { StockfishClient } from '../src/game/StockfishClient';

class FakeWorker {
  static instance: FakeWorker;
  onmessage?: (event: { data: string }) => void;
  onerror?: () => void;
  commands: string[] = [];
  terminated = false;
  constructor(public url: string) { FakeWorker.instance = this; }
  postMessage(command: string) { this.commands.push(command); }
  terminate() { this.terminated = true; }
  emit(data: string) { this.onmessage?.({ data }); }
}

afterEach(() => vi.unstubAllGlobals());

describe('Stockfish UCI worker protocol', () => {
  it('initializes, waits for readiness and requests a real UCI position', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    const onReady = vi.fn();
    const client = new StockfishClient(onReady, vi.fn());
    const worker = FakeWorker.instance;
    expect(worker.url).toBe('/engine/stockfish.js');
    expect(worker.commands).toEqual(['uci']);
    worker.emit('uciok');
    worker.emit('readyok');
    expect(onReady).toHaveBeenCalledOnce();
    const result = client.search('test-fen');
    expect(worker.commands.at(-1)).toBe('isready');
    worker.emit('readyok');
    expect(worker.commands.slice(-2)).toEqual(['position fen test-fen', 'go movetime 650']);
    worker.emit('info depth 10 score cp 12');
    worker.emit('bestmove e7e5 ponder g1f3');
    await expect(result).resolves.toEqual({ from: 'e7', to: 'e5' });
    client.dispose();
    expect(worker.terminated).toBe(true);
  });

  it('ignores a cancelled search result while draining before a new search', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    const client = new StockfishClient(vi.fn(), vi.fn());
    const worker = FakeWorker.instance;
    worker.emit('uciok'); worker.emit('readyok');
    const first = client.search('old-position');
    worker.emit('readyok');
    const second = client.search('new-position');
    worker.emit('bestmove a2a4');
    await expect(first).resolves.toBeNull();
    worker.emit('readyok');
    worker.emit('bestmove b2b4');
    await expect(second).resolves.toEqual({ from: 'b2', to: 'b4' });
    client.dispose();
  });
});
