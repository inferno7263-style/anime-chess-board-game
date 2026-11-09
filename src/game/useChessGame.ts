import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess, type Color, type Square } from 'chess.js';
import { capturedPieces, getGameStatus, legalDestinations, needsPromotion, tryMove, type PromotionPiece } from './chess';
import { StockfishClient } from './StockfishClient';
import { initialOnlineMode, replayOnlineGame, useOnlineGame } from '../online/useOnlineGame';

export type GameMode = 'local' | 'ai' | 'online';

/** Local/AI share their original game; online views are always server snapshots. */
export function useChessGame(presentationPaused = false, onKingCapture?: () => void) {
  const localGameRef = useRef(new Chess());
  const engineRef = useRef<StockfishClient | null>(null);
  const [localFen, setLocalFen] = useState(localGameRef.current.fen());
  const [selected, setSelected] = useState<Square | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: Square; to: Square; color: Color } | null>(null);
  const [mode, setModeState] = useState<GameMode>(() => initialOnlineMode() ? 'online' : 'local');
  const [aiReady, setAiReady] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const online = useOnlineGame(mode === 'online');
  const remoteGame = useMemo(() => replayOnlineGame(online.room), [online.room]);
  const game = mode === 'online' ? remoteGame : localGameRef.current;
  const fen = mode === 'online' ? remoteGame.fen() : localFen;
  const terminalOnline = mode === 'online' && (online.room?.phase === 'finished' || online.room?.phase === 'closed');
  const isGameOver = game.isGameOver() || terminalOnline;

  useEffect(() => {
    try {
      const engine = new StockfishClient(() => setAiReady(true), setAiError);
      engineRef.current = engine;
      return () => { engineRef.current = null; engine.dispose(); };
    } catch {
      setAiError('This browser cannot start Stockfish. Local chess is available.');
    }
  }, []);

  const syncLocal = useCallback(() => {
    setLocalFen(localGameRef.current.fen());
    setSelected(null);
    setPendingPromotion(null);
    setError(null);
  }, []);

  useEffect(() => {
    if (mode !== 'online') return;
    setSelected(null);
    setPendingPromotion(null);
  }, [mode, online.room?.revision, online.room?.code, online.room?.phase, online.connection, online.color, online.canMove]);

  const move = useCallback((from: Square, to: Square, promotion?: PromotionPiece) => {
    if (pendingPromotion || isGameOver || (mode === 'ai' && game.turn() === 'b')) return false;
    if (mode === 'online' && !online.canMove) return false;
    // Local legality supplies highlights/promotion choices; the server alone
    // commits online moves after rechecking legality, turn, seat and revision.
    const legal = game.moves({ square: from, verbose: true }).some(m => m.to === to && (!promotion || m.promotion === promotion));
    if (!legal) return false;
    if (!promotion && needsPromotion(game, { from, to })) {
      setPendingPromotion({ from, to, color: game.turn() });
      return true;
    }
    if (mode === 'online') {
      const sent = online.sendMove(from, to, promotion);
      if (sent) setSelected(null);
      return sent;
    }
    const result = tryMove(localGameRef.current, { from, to, ...(promotion ? { promotion } : {}) });
    if (!result) return false;
    if(result.captured && result.piece==='k') onKingCapture?.();
    syncLocal();
    return true;
  }, [game, isGameOver, mode, online.canMove, online.sendMove, pendingPromotion, syncLocal, onKingCapture]);

  const selectSquare = useCallback((square: Square) => {
    if (pendingPromotion || isGameOver || (mode === 'ai' && game.turn() === 'b') || (mode === 'online' && !online.canMove)) return;
    if (selected === square) { setSelected(null); return; }
    if (selected && move(selected, square)) return;
    const piece = game.get(square);
    setSelected(piece?.color === game.turn() ? square : null);
  }, [game, selected, move, mode, pendingPromotion, isGameOver, online.canMove]);

  const promote = useCallback((piece: PromotionPiece) => {
    if (!pendingPromotion) return;
    if (mode === 'online') {
      if (online.canMove && online.sendMove(pendingPromotion.from, pendingPromotion.to, piece)) setPendingPromotion(null);
      return;
    }
    if (tryMove(localGameRef.current, { from: pendingPromotion.from, to: pendingPromotion.to, promotion: piece })) syncLocal();
  }, [mode, online.canMove, online.sendMove, pendingPromotion, syncLocal]);

  useEffect(() => {
    if (presentationPaused || mode !== 'ai' || localGameRef.current.turn() !== 'b' || localGameRef.current.isGameOver() || !aiReady || aiError) {
      setAiThinking(false);
      return;
    }
    const engine = engineRef.current;
    if (!engine) return;
    let active = true;
    setAiThinking(true);
    engine.search(localFen).then((request) => {
      if (!active) return;
      setAiThinking(false);
      if (!request || localGameRef.current.fen() !== localFen) return;
      const result = tryMove(localGameRef.current, request);
      if (result) { if(result.captured && result.piece==='k') onKingCapture?.(); syncLocal(); }
      else setAiError('Stockfish returned an invalid move. Switch to a local match to continue.');
    });
    return () => { active = false; engine.cancel(); };
  }, [localFen, mode, aiReady, aiError, syncLocal, presentationPaused, onKingCapture]);

  const undo = useCallback(() => {
    if (mode === 'online') return;
    engineRef.current?.cancel();
    const current = localGameRef.current;
    const undoPair = mode === 'ai' && current.turn() === 'w' && current.history().length >= 2;
    current.undo();
    if (undoPair) current.undo();
    setAiThinking(false);
    syncLocal();
  }, [mode, syncLocal]);

  const restart = useCallback(() => {
    if (mode === 'online') return;
    engineRef.current?.cancel();
    localGameRef.current.reset();
    setAiThinking(false);
    syncLocal();
  }, [mode, syncLocal]);

  const setMode = useCallback((next: GameMode) => {
    if (next === mode) return;
    engineRef.current?.cancel();
    setModeState(next);
    setSelected(null);
    setPendingPromotion(null);
    setAiThinking(false);
  }, [mode]);

  const history = useMemo(() => game.history({ verbose: true }), [game, fen]);
  const status = useMemo(() => {
    const standard = getGameStatus(game);
    const result = mode === 'online' && online.room?.result;
    if (!result || !terminalOnline || game.isGameOver()) return standard;
    const title = result.winner ? `${result.winner === 'w' ? 'Heroes' : 'Villains'} win`
      : result.reason === 'expired' ? 'Room expired'
      : result.reason === 'closed' ? 'Room closed' : 'Battle ended';
    return { kind: 'finished' as const, title, detail: result.message, winner: result.winner };
  }, [game, fen, mode, online.room?.result, terminalOnline]);
  const legalSquares = useMemo(() => selected && (mode !== 'online' || online.canMove) ? legalDestinations(game, selected) : [], [game, fen, mode, online.canMove, selected]);
  const captured = useMemo(() => capturedPieces(history), [history]);

  return {
    game, fen, history, selected, legalSquares, selectSquare, move, pendingPromotion, promote,
    undo, restart, mode, setMode, aiThinking, aiReady, aiError, error: mode === 'online' ? online.error : error,
    status, captured, isGameOver, online,
    lastMove: history.at(-1) ?? null,
    canUndo: mode !== 'online' && history.length > 0,
  };
}
