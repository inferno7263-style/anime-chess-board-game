import type { Color } from 'chess.js';

export type RoomPhase = 'waiting' | 'playing' | 'finished' | 'closed';
export type OnlineResultReason = 'checkmate' | 'stalemate' | 'repetition' | 'insufficient-material' | 'fifty-move' | 'resignation' | 'disconnect' | 'abandoned' | 'closed' | 'expired';
export type OnlineResult = { reason: OnlineResultReason; winner: Color | null; message: string };
export type PlayerPresence = { connected: boolean; disconnectedAt: number | null };
/** Public authoritative state. Resume credentials are NEVER included here. */
export type RoomState = {
  code: string;
  fen: string;
  history: string[];
  revision: number;
  phase: RoomPhase;
  players: { w: PlayerPresence; b: PlayerPresence | null };
  result: OnlineResult | null;
  expiresAt: number;
  reconnectGraceMs: number;
};
export type Failure = { ok: false; error: string; code: string };
export type RoomMembership = { ok: true; state: RoomState; color: Color; token: string };
export type MembershipAck = RoomMembership | Failure;
export type CommandAck = { ok: true; state: RoomState } | Failure;
export type MoveCommand = {
  from: string;
  to: string;
  promotion?: 'q' | 'r' | 'b' | 'n';
  expectedRevision: number;
  requestId: string;
};
export type ServerToClientEvents = {
  'room:state': (state: RoomState) => void;
  'room:removed': (message: { reason: string; code: string }) => void;
};
export type ClientToServerEvents = {
  'room:create': (ack: (response: MembershipAck) => void) => void;
  'room:join': (data: { code: string }, ack: (response: MembershipAck) => void) => void;
  'room:resume': (data: { code: string; token: string }, ack: (response: MembershipAck) => void) => void;
  'game:move': (data: MoveCommand, ack: (response: CommandAck) => void) => void;
  'room:leave': (ack: (response: CommandAck) => void) => void;
  'room:close': (ack: (response: CommandAck) => void) => void;
};
