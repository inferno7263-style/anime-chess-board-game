import { Chess, type Color, type Move, type PieceSymbol, type Square } from 'chess.js';

export type PromotionPiece = 'q' | 'r' | 'b' | 'n';
export type MoveRequest = { from: Square; to: Square; promotion?: PromotionPiece };
export type GameStatus = {
  kind: 'playing' | 'check' | 'checkmate' | 'draw';
  title: string;
  detail: string;
  winner: Color | null;
};

export function teamName(color: Color) {
  return color === 'w' ? 'Heroes' : 'Villains';
}

export function getGameStatus(game: Chess): GameStatus {
  const turn = teamName(game.turn());
  if (game.isCheckmate()) {
    const winner = game.turn() === 'w' ? 'b' : 'w';
    return { kind: 'checkmate', title: `${teamName(winner)} win`, detail: 'Checkmate. The multiverse has a champion.', winner };
  }
  if (game.isDraw()) {
    const detail = game.isStalemate() ? 'Stalemate. No legal moves remain.'
      : game.isThreefoldRepetition() ? 'Draw by threefold repetition.'
      : game.isInsufficientMaterial() ? 'Draw by insufficient material.'
      : 'Draw by the fifty-move rule.';
    return { kind: 'draw', title: 'An equal universe', detail, winner: null };
  }
  if (game.isCheck()) return { kind: 'check', title: `${turn} in check`, detail: 'Protect your king to continue the battle.', winner: null };
  return { kind: 'playing', title: `${turn} to move`, detail: 'Select a warrior, then choose a highlighted square.', winner: null };
}

export function legalDestinations(game: Chess, square: Square): Square[] {
  return [...new Set(game.moves({ square, verbose: true }).map((move) => move.to))];
}

export function needsPromotion(game: Chess, request: MoveRequest): boolean {
  return game.moves({ square: request.from, verbose: true }).some((move) => move.to === request.to && Boolean(move.promotion));
}

/** Invalid input never changes the position. Every move is authorized by chess.js. */
export function tryMove(game: Chess, request: MoveRequest): Move | null {
  if (game.isGameOver()) return null;
  try { return game.move(request); } catch { return null; }
}

export function capturedPieces(history: Move[]): Record<Color, PieceSymbol[]> {
  const captured: Record<Color, PieceSymbol[]> = { w: [], b: [] };
  for (const move of history) if (move.captured) captured[move.color].push(move.captured);
  return captured;
}

export function parseUciMove(uci: string): MoveRequest | null {
  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) return null;
  return { from: uci.slice(0, 2) as Square, to: uci.slice(2, 4) as Square, ...(uci[4] ? { promotion: uci[4] as PromotionPiece } : {}) };
}
