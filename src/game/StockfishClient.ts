import { parseUciMove, type MoveRequest } from './chess';

/** Single-threaded Stockfish WASM. No remote API, cross-origin isolation or keys. */
export class StockfishClient {
  private worker: Worker;
  private pending: { fen: string; resolve: (move: MoveRequest | null) => void } | null = null;
  private phase: 'idle' | 'draining' | 'searching' = 'idle';
  private disposed = false;
  private initialized = false;
  private initializationTimer: ReturnType<typeof setTimeout>;

  constructor(onReady: () => void, onError: (message: string) => void) {
    this.worker = new Worker('/engine/stockfish.js');
    this.initializationTimer = setTimeout(() => onError('Stockfish could not start. You can still play a local match.'), 30000);
    this.worker.onerror = () => {
      clearTimeout(this.initializationTimer);
      onError('Stockfish could not load. Try refreshing, or play a local match.');
      this.cancel();
    };
    this.worker.onmessage = (event: MessageEvent<unknown>) => {
      if (this.disposed || typeof event.data !== 'string') return;
      for (const line of event.data.split('\n')) {
        if (line === 'uciok') {
          this.send('setoption name Hash value 32');
          this.send('setoption name Skill Level value 8');
          this.send('isready');
        }
        if (line === 'readyok') {
          if (!this.initialized) {
            this.initialized = true;
            clearTimeout(this.initializationTimer);
            onReady();
          }
          if (this.pending && this.phase === 'draining') {
            this.phase = 'searching';
            this.send(`position fen ${this.pending.fen}`);
            this.send('go movetime 650');
          }
        }
        if (line.startsWith('bestmove ') && this.phase === 'searching' && this.pending) {
          const pending = this.pending;
          this.pending = null;
          this.phase = 'idle';
          pending.resolve(parseUciMove(line.split(' ')[1]));
        }
      }
    };
    this.send('uci');
  }

  private send(command: string) {
    if (!this.disposed) this.worker.postMessage(command);
  }

  search(fen: string): Promise<MoveRequest | null> {
    this.cancel();
    return new Promise((resolve) => {
      this.pending = { fen, resolve };
      // Drain the previous search before accepting a new bestmove response.
      this.phase = 'draining';
      this.send('stop');
      this.send('isready');
    });
  }

  cancel() {
    const pending = this.pending;
    this.pending = null;
    this.phase = 'idle';
    this.send('stop');
    pending?.resolve(null);
  }

  dispose() {
    this.cancel();
    this.disposed = true;
    clearTimeout(this.initializationTimer);
    this.worker.terminate();
  }
}
