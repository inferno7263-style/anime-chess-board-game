import { describe, expect, it } from 'vitest';
import { Chess, type Square } from 'chess.js';
import { capturedPieces, getGameStatus, legalDestinations, needsPromotion, parseUciMove, tryMove } from '../src/game/chess';

function perft(game: Chess, depth: number): number {
  if (depth === 0) return 1;
  let nodes = 0;
  for (const move of game.moves({ verbose: true })) {
    game.move(move);
    nodes += perft(game, depth - 1);
    game.undo();
  }
  return nodes;
}

describe('legal chess mechanics', () => {
  it('matches the standard initial-position move tree through depth 3', () => {
    const game = new Chess();
    expect(perft(game, 1)).toBe(20);
    expect(perft(game, 2)).toBe(400);
    expect(perft(game, 3)).toBe(8902);
    expect(game.history()).toHaveLength(0);
  });

  it('rejects illegal moves without mutating the board', () => {
    const game = new Chess();
    const original = game.fen();
    expect(tryMove(game, { from: 'e2', to: 'e5' })).toBeNull();
    expect(tryMove(game, { from: 'e7', to: 'e5' })).toBeNull();
    expect(game.fen()).toBe(original);
    expect(legalDestinations(game, 'e2')).toEqual(['e3', 'e4']);
  });

  it('does not let a pinned piece expose its king', () => {
    const game = new Chess('4r1k1/8/8/8/8/8/4R3/4K3 w - - 0 1');
    expect(legalDestinations(game, 'e2')).not.toContain('d2');
    expect(tryMove(game, { from: 'e2', to: 'd2' })).toBeNull();
  });

  it.each([['e1', 'g1', 'f1', 'h1'], ['e1', 'c1', 'd1', 'a1']] as Square[][])('moves both king and rook when castling %s to %s', (from, to, rookTo, rookFrom) => {
    const game = new Chess('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
    expect(tryMove(game, { from, to })).not.toBeNull();
    expect(game.get(to)).toEqual({ type: 'k', color: 'w' });
    expect(game.get(rookTo)).toEqual({ type: 'r', color: 'w' });
    expect(game.get(rookFrom)).toBeUndefined();
  });

  it('forbids castling through an attacked square', () => {
    const game = new Chess('r3kr1r/8/8/8/8/8/8/R3K2R w KQ - 0 1');
    expect(legalDestinations(game, 'e1')).not.toContain('g1');
    expect(legalDestinations(game, 'e1')).toContain('c1');
  });

  it('does not restore castling rights after a rook returns', () => {
    const game = new Chess('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
    for (const san of ['Rh2', 'Rh7', 'Rh1', 'Rh8']) game.move(san);
    expect(legalDestinations(game, 'e1')).not.toContain('g1');
  });

  it('captures en passant on the immediate next move', () => {
    const game = new Chess();
    for (const san of ['e4', 'a6', 'e5', 'd5']) game.move(san);
    const move = tryMove(game, { from: 'e5', to: 'd6' });
    expect(move?.isEnPassant()).toBe(true);
    expect(game.get('d5')).toBeUndefined();
    expect(game.get('d6')).toEqual({ type: 'p', color: 'w' });
    expect(capturedPieces(game.history({ verbose: true })).w).toEqual(['p']);
  });

  it('expires en passant after a different move', () => {
    const game = new Chess();
    for (const san of ['e4', 'a6', 'e5', 'd5', 'Nf3', 'a5']) game.move(san);
    expect(legalDestinations(game, 'e5')).not.toContain('d6');
  });

  it.each(['q', 'r', 'b', 'n'] as const)('supports promotion to %s', (promotion) => {
    const game = new Chess('7k/P7/8/8/8/8/8/7K w - - 0 1');
    expect(needsPromotion(game, { from: 'a7', to: 'a8' })).toBe(true);
    expect(tryMove(game, { from: 'a7', to: 'a8', promotion })).not.toBeNull();
    expect(game.get('a8')).toEqual({ type: promotion, color: 'w' });
  });

  it('recognizes check and restricts moves to king-saving responses', () => {
    const game = new Chess('4k3/8/8/8/8/8/4r3/R3K3 w Q - 0 1');
    expect(getGameStatus(game).kind).toBe('check');
    expect(tryMove(game, { from: 'a1', to: 'a2' })).toBeNull();
    expect(tryMove(game, { from: 'e1', to: 'e2' })).not.toBeNull();
  });

  it('recognizes checkmate and prevents further play', () => {
    const game = new Chess();
    for (const san of ['f3', 'e5', 'g4', 'Qh4#']) game.move(san);
    expect(getGameStatus(game)).toMatchObject({ kind: 'checkmate', winner: 'b', title: 'Villains win' });
    expect(tryMove(game, { from: 'e2', to: 'e3' })).toBeNull();
  });

  it('recognizes stalemate', () => {
    const game = new Chess('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
    expect(getGameStatus(game)).toMatchObject({ kind: 'draw', detail: 'Stalemate. No legal moves remain.' });
  });

  it('recognizes insufficient material', () => {
    const game = new Chess('7k/8/8/8/8/8/8/K7 w - - 0 1');
    expect(getGameStatus(game).detail).toBe('Draw by insufficient material.');
  });

  it('recognizes threefold repetition', () => {
    const game = new Chess();
    for (let i = 0; i < 2; i++) for (const san of ['Nf3', 'Nf6', 'Ng1', 'Ng8']) game.move(san);
    expect(getGameStatus(game).detail).toBe('Draw by threefold repetition.');
  });

  it('recognizes the fifty-move rule', () => {
    const game = new Chess('7k/8/8/8/8/8/R7/K7 w - - 99 50');
    game.move('Ra3');
    expect(getGameStatus(game).detail).toBe('Draw by the fifty-move rule.');
  });

  it('undo restores captures, en passant rights, castling rights and turn', () => {
    const game = new Chess();
    for (const san of ['e4', 'd5']) game.move(san);
    const before = game.fen();
    game.move('exd5');
    expect(capturedPieces(game.history({ verbose: true })).w).toHaveLength(1);
    game.undo();
    expect(game.fen()).toBe(before);
    expect(capturedPieces(game.history({ verbose: true })).w).toHaveLength(0);
    game.reset();
    expect(game.fen()).toBe(new Chess().fen());
    expect(game.history()).toHaveLength(0);
  });

  it('parses only valid engine move coordinates, including underpromotion', () => {
    expect(parseUciMove('e2e4')).toEqual({ from: 'e2', to: 'e4' });
    expect(parseUciMove('a7a8n')).toEqual({ from: 'a7', to: 'a8', promotion: 'n' });
    expect(parseUciMove('(none)')).toBeNull();
    expect(parseUciMove('z9e4')).toBeNull();
  });
});
