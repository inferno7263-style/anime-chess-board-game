import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { Chess, type Color, type Square } from 'chess.js';
import type { ClientToServerEvents, CommandAck, Failure, MembershipAck, RoomState, ServerToClientEvents } from './protocol';
import type { PromotionPiece } from '../game/chess';

type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
type SavedSeat = { code: string; token: string; color: Color };
export type OnlineConnection = 'connecting' | 'connected' | 'disconnected';
const seatStorageKey = 'anime-chess:online-seat';
const requestTimeoutMs = 10_000;

function invitationCode() {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get('room')?.trim().toUpperCase() || '';
}
function readSeat(): SavedSeat | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(seatStorageKey) || 'null');
    if (value && typeof value.code === 'string' && typeof value.token === 'string' && (value.color === 'w' || value.color === 'b')) return value;
  } catch { /* Storage can be disabled; the live session can still play. */ }
  return null;
}
function writeSeat(seat: SavedSeat | null) {
  try {
    if (seat) sessionStorage.setItem(seatStorageKey, JSON.stringify(seat));
    else sessionStorage.removeItem(seatStorageKey);
  } catch { /* Reconnection works in memory even without storage. */ }
}
export function initialOnlineMode() {
  return Boolean(invitationCode() || readSeat());
}

/** Replaying the authoritative log retains repetition history and character identities. */
export function replayOnlineGame(room: RoomState | null): Chess {
  const game = new Chess();
  if (!room) return game;
  for (const san of room.history) game.move(san);
  if (game.fen() !== room.fen) throw new Error('Online game state did not match its move history.');
  return game;
}

/** Private room credentials stay in this tab; invitation links contain only room codes. */
export function useOnlineGame(enabled: boolean) {
  const savedSeat = useRef(readSeat());
  const [room, setRoom] = useState<RoomState | null>(null);
  const [color, setColor] = useState<Color | null>(savedSeat.current?.color || null);
  const [connection, setConnection] = useState<OnlineConnection>('disconnected');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialInvitation] = useState(invitationCode);
  const socketRef = useRef<GameSocket | null>(null);
  const roomRef = useRef<RoomState | null>(null);
  const busyRef = useRef(false);
  const requestGeneration = useRef(0);
  const intentionalLeave = useRef<string | null>(null);
  const mounted = useRef(false);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const applyState = useCallback((state: RoomState) => {
    const current = roomRef.current;
    if (current?.code === state.code && current.revision > state.revision) return;
    // Reject incomplete snapshots instead of rebuilding a different board locally.
    try { replayOnlineGame(state); }
    catch { setError('The game could not be synchronized. Reconnect to restore it.'); return; }
    roomRef.current = state;
    setRoom(state);
  }, []);

  const forgetSeat = useCallback(() => {
    savedSeat.current = null;
    writeSeat(null);
    roomRef.current = null;
    setRoom(null);
    setColor(null);
  }, []);

  const acceptMembership = useCallback((reply: Extract<MembershipAck, { ok: true }>) => {
    const seat = { code: reply.state.code, token: reply.token, color: reply.color };
    intentionalLeave.current = null;
    savedSeat.current = seat;
    writeSeat(seat);
    setColor(reply.color);
    applyState(reply.state);
    setError(null);
  }, [applyState]);

  const runCommand = useCallback(async <T extends MembershipAck | CommandAck>(
    request: (socket: GameSocket) => Promise<T>,
    onSuccess: (response: Extract<T, { ok: true }>) => void,
    onFailure?: (response: Failure) => void,
  ): Promise<boolean> => {
    const socket = socketRef.current;
    if (!socket?.connected) { setError('Connect to the online server before continuing.'); return false; }
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    const generation = ++requestGeneration.current;
    try {
      const response = await request(socket);
      if (!mounted.current || generation !== requestGeneration.current) return false;
      if (!response.ok) { onFailure?.(response); setError(response.error); return false; }
      onSuccess(response as Extract<T, { ok: true }>);
      return true;
    } catch {
      if (mounted.current && generation === requestGeneration.current) setError('The server did not respond. Reconnect to refresh the battle before retrying.');
      return false;
    } finally {
      if (mounted.current && generation === requestGeneration.current) { busyRef.current = false; setBusy(false); }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    const endpoint = import.meta.env.VITE_MULTIPLAYER_URL?.trim() || window.location.origin;
    const socket: GameSocket = io(endpoint, {
      autoConnect: false,
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 3000,
      timeout: requestTimeoutMs,
    });
    socketRef.current = socket;
    socket.on('connect', () => {
      if (!mounted.current) return;
      setConnection('connected');
      setError(null);
      const seat = savedSeat.current;
      if (seat) {
        void runCommand(
          s => s.timeout(requestTimeoutMs).emitWithAck('room:resume', { code: seat.code, token: seat.token }),
          acceptMembership,
          failure => {
            if (failure.code === 'INVALID_SESSION' || failure.code === 'ROOM_NOT_FOUND') forgetSeat();
          },
        );
      }
    });
    socket.on('room:state', state => {
      if (!mounted.current || state.code !== savedSeat.current?.code) return;
      applyState(state);
    });
    socket.on('room:removed', message => {
      if (!mounted.current || (message.code !== savedSeat.current?.code && message.code !== intentionalLeave.current)) return;
      const leaving = intentionalLeave.current === message.code;
      if (!leaving) ++requestGeneration.current;
      busyRef.current = false;
      setBusy(false);
      forgetSeat();
      intentionalLeave.current = null;
      setError(leaving ? null : message.reason);
    });
    socket.on('disconnect', () => {
      if (!mounted.current) return;
      ++requestGeneration.current;
      busyRef.current = false;
      setBusy(false);
      setConnection('disconnected');
    });
    socket.on('connect_error', () => {
      if (!mounted.current) return;
      setConnection('disconnected');
      setError('Online server unavailable. Check your connection and try reconnecting.');
    });
    if (enabledRef.current) { setConnection('connecting'); socket.connect(); }
    return () => {
      mounted.current = false;
      ++requestGeneration.current;
      busyRef.current = false;
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [acceptMembership, applyState, forgetSeat, runCommand]);

  useEffect(() => {
    const socket = socketRef.current;
    if (enabled && socket && !socket.connected && !socket.active) {
      setConnection('connecting');
      socket.connect();
    }
  }, [enabled]);

  const createRoom = useCallback(() => {
    if (savedSeat.current) { setError('Leave your current room before creating another battle.'); return Promise.resolve(false); }
    return runCommand(s => s.timeout(requestTimeoutMs).emitWithAck('room:create'), acceptMembership);
  }, [acceptMembership, runCommand]);
  const joinRoom = useCallback((rawCode: string) => {
    const code = rawCode.trim().toUpperCase();
    if (!code || code.length > 16) { setError('Enter a valid room code.'); return Promise.resolve(false); }
    if (savedSeat.current) { setError('Leave your current room before joining another battle.'); return Promise.resolve(false); }
    return runCommand(s => s.timeout(requestTimeoutMs).emitWithAck('room:join', { code }), acceptMembership);
  }, [acceptMembership, runCommand]);
  const leaveRoom = useCallback(() => {
    const code = savedSeat.current?.code;
    const clearInvitation = () => {
      const url = new URL(window.location.href); url.searchParams.delete('room');
      window.history.replaceState(null, '', url);
    };
    if (!socketRef.current?.connected) {
      // The server still owns the abandoned room and resolves it after its grace period.
      forgetSeat(); clearInvitation(); setError(null);
      return Promise.resolve(true);
    }
    intentionalLeave.current = code || null;
    return runCommand(s => s.timeout(requestTimeoutMs).emitWithAck('room:leave'), () => {
      forgetSeat(); setError(null); clearInvitation();
    }, () => { intentionalLeave.current = null; });
  }, [forgetSeat, runCommand]);
  const closeRoom = useCallback(() => {
    return runCommand(s => s.timeout(requestTimeoutMs).emitWithAck('room:close'), response => applyState(response.state));
  }, [applyState, runCommand]);
  const reconnect = useCallback(() => {
    const socket = socketRef.current;
    if (!socket) return;
    ++requestGeneration.current;
    busyRef.current = false;
    setBusy(false);
    setError(null);
    setConnection('connecting');
    socket.disconnect();
    socket.connect();
  }, []);
  const clearError = useCallback(() => setError(null), []);

  const canMove = Boolean(enabled && !busy && connection === 'connected' && room?.phase === 'playing' && color && room.fen.split(' ')[1] === color && room.players.w.connected && room.players.b?.connected);
  const sendMove = useCallback((from: Square, to: Square, promotion?: PromotionPiece) => {
    const current = roomRef.current;
    if (!enabledRef.current || !current || current.phase !== 'playing' || !socketRef.current?.connected || busyRef.current || !savedSeat.current || current.fen.split(' ')[1] !== savedSeat.current.color || !current.players.w.connected || !current.players.b?.connected) return false;
    const requestId = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `move-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    void runCommand(s => s.timeout(requestTimeoutMs).emitWithAck('game:move', {
      from, to, ...(promotion ? { promotion } : {}), expectedRevision: current.revision, requestId,
    }), response => applyState(response.state));
    return true;
  }, [applyState, runCommand]);
  const inviteUrl = useMemo(() => {
    if (!room) return '';
    const url = new URL(window.location.href);
    url.search = '';
    url.hash = '';
    url.searchParams.set('room', room.code);
    return url.toString();
  }, [room?.code]);

  return {
    room, color, connection, busy, error, canMove, invitationCode: initialInvitation, inviteUrl,
    createRoom, joinRoom, leaveRoom, closeRoom, reconnect, clearError, sendMove,
  };
}
