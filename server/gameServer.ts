import { randomBytes, timingSafeEqual } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { extname, relative, resolve, sep } from 'node:path';
import { Chess, type Color, type Square } from 'chess.js';
import { Server, type Socket } from 'socket.io';
import type { ClientToServerEvents, CommandAck, Failure, MembershipAck, MoveCommand, OnlineResult, RoomState, ServerToClientEvents } from '../src/online/protocol';

type Identity = { roomCode: string; color: Color };
type SocketData = { identity?: Identity };
type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type Receipt = { fingerprint: string };
type Seat = { token: string; socketId: string | null; disconnectedAt: number | null; left: boolean; receipts: Map<string, Receipt> };
type Room = { code: string; game: Chess; revision: number; phase: RoomState['phase']; seats: { w: Seat; b: Seat | null }; result: OnlineResult | null; createdAt: number; expiresAt: number };
export type GameServerOptions = {
  allowedOrigins?: string[];
  reconnectGraceMs?: number;
  waitingTtlMs?: number;
  finishedTtlMs?: number;
  roomLifetimeMs?: number;
  maxRooms?: number;
  cleanupIntervalMs?: number;
  staticDir?: string | false;
};
const COLORS: Color[] = ['w', 'b'];
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const failure = (code: string, error: string): Failure => ({ ok: false, code, error });
const makeSeat = (socketId: string): Seat => ({ token: randomBytes(32).toString('hex'), socketId, disconnectedAt: null, left: false, receipts: new Map() });
const validObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const normalizeCode = (value: unknown) => typeof value === 'string' && value.length <= 20 ? value.trim().toUpperCase() : '';
const validCode = (value: string) => /^[A-HJ-NP-Z2-9]{8}$/.test(value);
const positive = (value: number | undefined, fallback: number) => Number.isFinite(value) && value! > 0 ? value! : fallback;
const mime: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.wasm': 'application/wasm', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.svg': 'image/svg+xml', '.woff': 'font/woff', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.txt': 'text/plain; charset=utf-8' };

/** A single authoritative process. Room/session credentials never enter public state. */
export function createGameServer(options: GameServerOptions = {}) {
  const reconnectGraceMs = positive(options.reconnectGraceMs, 120_000);
  const waitingTtlMs = positive(options.waitingTtlMs, 15 * 60_000);
  const finishedTtlMs = positive(options.finishedTtlMs, 15 * 60_000);
  const roomLifetimeMs = positive(options.roomLifetimeMs, 24 * 60 * 60_000);
  const maxRooms = Math.floor(positive(options.maxRooms, 1000));
  const allowedOrigins = new Set(options.allowedOrigins ?? ['http://localhost:5173', 'http://127.0.0.1:5173']);
  const staticDir = options.staticDir ? resolve(options.staticDir) : null;
  const rooms = new Map<string, Room>();
  const limits = new Map<string, { count: number; since: number }>();
  let stopping = false;

  function sendText(response: ServerResponse, status: number, body: string) {
    response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff' }); response.end(body);
  }
  const httpServer = createServer(async (request, response) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') { response.setHeader('Allow', 'GET, HEAD'); sendText(response, 405, 'Method not allowed.'); return; }
    let path: string;
    try { path = decodeURIComponent(new URL(request.url || '/', 'http://arena.local').pathname); }
    catch { sendText(response, 400, 'Invalid path.'); return; }
    if (path === '/healthz') {
      response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      response.end(request.method === 'HEAD' ? undefined : JSON.stringify({ status: 'ok', activeRooms: rooms.size })); return;
    }
    if (!staticDir) { sendText(response, 404, 'Online chess backend. Health check: /healthz'); return; }
    if (path.includes('\0') || path.includes('\\')) { sendText(response, 400, 'Invalid path.'); return; }
    const file = resolve(staticDir, '.' + (path.endsWith('/') ? path + 'index.html' : path));
    const rel = relative(staticDir, file);
    if (rel === '..' || rel.startsWith('..' + sep)) { sendText(response, 403, 'Access denied.'); return; }
    try {
      const info = await stat(file);
      if (!info.isFile()) { sendText(response, 404, 'Not found.'); return; }
      response.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Content-Length': info.size, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': extname(file) === '.html' ? 'no-cache' : 'public, max-age=3600' });
      if (request.method === 'HEAD') { response.end(); return; }
      const stream = createReadStream(file); stream.on('error', () => response.destroy()); stream.pipe(response);
    } catch { sendText(response, 404, 'Not found. Run npm run build before serving the client.'); }
  });

  function isOriginAllowed(request: IncomingMessage) {
    const origin = request.headers.origin;
    if (!origin) return true; // Native clients still need the seat credential to act.
    try {
      const parsed = new URL(origin);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
      return allowedOrigins.has(origin) || parsed.host === request.headers.host;
    } catch { return false; }
  }
  const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(httpServer, {
    maxHttpBufferSize: 8192,
    cors: { origin: (origin, callback) => callback(null, !origin || allowedOrigins.has(origin)), methods: ['GET', 'POST'] },
    allowRequest: (request, callback) => callback(null, isOriginAllowed(request)),
    pingInterval: 10_000, pingTimeout: 15_000,
  });

  function publicState(room: Room): RoomState {
    const presence = (seat: Seat) => ({ connected: Boolean(seat.socketId), disconnectedAt: seat.disconnectedAt });
    return { code: room.code, fen: room.game.fen(), history: room.game.history(), revision: room.revision, phase: room.phase, players: { w: presence(room.seats.w), b: room.seats.b ? presence(room.seats.b) : null }, result: room.result, expiresAt: room.expiresAt, reconnectGraceMs };
  }
  function broadcast(room: Room) { io.to(room.code).emit('room:state', publicState(room)); }
  function finish(room: Room, phase: 'finished' | 'closed', result: OnlineResult, changeRevision = true) {
    room.phase = phase; room.result = result; room.expiresAt = Date.now() + finishedTtlMs;
    if (changeRevision) room.revision++;
  }
  function gameResult(game: Chess): OnlineResult | null {
    if (game.isCheckmate()) return { reason: 'checkmate', winner: game.turn() === 'w' ? 'b' : 'w', message: 'Checkmate. The multiverse has a champion.' };
    if (game.isStalemate()) return { reason: 'stalemate', winner: null, message: 'Stalemate. No legal moves remain.' };
    if (game.isThreefoldRepetition()) return { reason: 'repetition', winner: null, message: 'Draw by threefold repetition.' };
    if (game.isInsufficientMaterial()) return { reason: 'insufficient-material', winner: null, message: 'Draw by insufficient material.' };
    if (game.isDraw()) return { reason: 'fifty-move', winner: null, message: 'Draw by the fifty-move rule.' };
    return null;
  }
  function detach(socket: GameSocket, reason: string, code: string) {
    socket.leave(code); delete socket.data.identity;
    socket.emit('room:removed', { reason, code });
  }
  function removeRoom(room: Room, reason: string) {
    for (const color of COLORS) {
      const seat = room.seats[color];
      const socket = seat?.socketId ? io.sockets.sockets.get(seat.socketId) : undefined;
      if (socket) detach(socket, reason, room.code);
    }
    rooms.delete(room.code);
  }
  function refresh(room: Room, now = Date.now()) {
    if (room.expiresAt <= now) {
      if (room.phase !== 'closed') { finish(room, 'closed', { reason: 'expired', winner: null, message: 'This room expired.' }); broadcast(room); }
      removeRoom(room, 'This room has expired. Create a new private room.'); return false;
    }
    if (room.phase === 'playing') {
      const expired = COLORS.filter(c => { const seat = room.seats[c]; return seat && !seat.socketId && seat.disconnectedAt !== null && now - seat.disconnectedAt >= reconnectGraceMs; });
      if (expired.length) {
        const present = COLORS.find(c => Boolean(room.seats[c]?.socketId));
        if (present) finish(room, 'finished', { reason: 'disconnect', winner: present, message: `${present === 'w' ? 'Heroes' : 'Villains'} win by disconnection. The opponent did not reconnect in time.` });
        else finish(room, 'closed', { reason: 'abandoned', winner: null, message: 'Both players disconnected. The room was abandoned.' });
        broadcast(room);
      }
    }
    return true;
  }
  function rateLimit(socket: GameSocket, action: 'general' | 'create') {
    const now = Date.now();
    // Bound room creation across reconnects, but do not pool all players behind
    // a reverse proxy into one move/action bucket.
    const key = `${action === 'create' ? socket.handshake.address : socket.id}:${action}`;
    const limit = action === 'create' ? 15 : 300;
    let bucket = limits.get(key);
    if (!bucket || now - bucket.since > 60_000) { bucket = { count: 0, since: now }; limits.set(key, bucket); }
    bucket.count++;
    if (limits.size > 10_000) limits.delete(limits.keys().next().value!);
    return bucket.count <= limit;
  }
  function identityRoom(socket: GameSocket): { room: Room; color: Color; seat: Seat } | Failure {
    const identity = socket.data.identity;
    if (!identity) return failure('NOT_A_PLAYER', 'Join or resume a room before acting.');
    const room = rooms.get(identity.roomCode);
    if (!room || !refresh(room)) return failure('ROOM_NOT_FOUND', 'This room no longer exists.');
    const seat = room.seats[identity.color];
    if (!seat || seat.left || seat.socketId !== socket.id) return failure('NOT_A_PLAYER', 'This connection does not own a player seat.');
    return { room, color: identity.color, seat };
  }
  function enter(socket: GameSocket, room: Room, color: Color, seat: Seat) {
    socket.data.identity = { roomCode: room.code, color };
    seat.socketId = socket.id; seat.disconnectedAt = null;
    socket.join(room.code);
    broadcast(room);
    return { ok: true as const, state: publicState(room), color, token: seat.token };
  }
  function leave(socket: GameSocket): CommandAck {
    const owned = identityRoom(socket); if ('ok' in owned) return owned;
    const { room, color, seat } = owned;
    seat.socketId = null; seat.disconnectedAt = Date.now(); seat.left = true; seat.token = '';
    if (room.phase === 'waiting') finish(room, 'closed', { reason: 'closed', winner: null, message: 'The room creator left before the battle began.' });
    else if (room.phase === 'playing') finish(room, 'finished', { reason: 'resignation', winner: color === 'w' ? 'b' : 'w', message: `${color === 'w' ? 'Heroes' : 'Villains'} left the battle. The opponent wins by resignation.` });
    const state = publicState(room);
    broadcast(room);
    return { ok: true, state };
  }

  io.on('connection', socket => {
    socket.on('room:create', ack => {
      if (typeof ack !== 'function') return;
      if (!rateLimit(socket, 'create')) { ack(failure('RATE_LIMITED', 'Too many room requests. Please wait a minute.')); return; }
      if (socket.data.identity) { ack(failure('ALREADY_IN_ROOM', 'Leave your current room before creating another.')); return; }
      if (rooms.size >= maxRooms) { ack(failure('SERVER_FULL', 'The server has reached its room limit. Try again later.')); return; }
      let code: string;
      do { code = [...randomBytes(8)].map(v => CODE_ALPHABET[v % CODE_ALPHABET.length]).join(''); } while (rooms.has(code));
      const now = Date.now(); const seat = makeSeat(socket.id);
      const room: Room = { code, game: new Chess(), revision: 0, phase: 'waiting', seats: { w: seat, b: null }, result: null, createdAt: now, expiresAt: now + waitingTtlMs };
      rooms.set(code, room); ack(enter(socket, room, 'w', seat));
    });
    socket.on('room:join', (data, ack) => {
      if (typeof ack !== 'function') return;
      if (!rateLimit(socket, 'general')) { ack(failure('RATE_LIMITED', 'Too many requests. Please wait a minute.')); return; }
      if (socket.data.identity) { ack(failure('ALREADY_IN_ROOM', 'Leave your current room before joining another.')); return; }
      const code = validObject(data) ? normalizeCode(data.code) : '';
      if (!validCode(code)) { ack(failure('INVALID_CODE', 'Enter a valid eight-character room code.')); return; }
      const room = rooms.get(code);
      if (!room || !refresh(room)) { ack(failure('ROOM_NOT_FOUND', 'Room not found or expired. Check the invitation.')); return; }
      if (room.phase !== 'waiting' || room.seats.b) { ack(failure('ROOM_UNAVAILABLE', 'This room is full or no longer accepting players.')); return; }
      if (!room.seats.w.socketId) { ack(failure('HOST_DISCONNECTED', 'The room creator is reconnecting. Try joining again when they are online.')); return; }
      const seat = makeSeat(socket.id); room.seats.b = seat; room.phase = 'playing'; room.expiresAt = Date.now() + roomLifetimeMs;
      ack(enter(socket, room, 'b', seat));
    });
    socket.on('room:resume', (data, ack) => {
      if (typeof ack !== 'function') return;
      if (!rateLimit(socket, 'general')) { ack(failure('RATE_LIMITED', 'Too many requests. Please wait a minute.')); return; }
      if (socket.data.identity) { ack(failure('ALREADY_IN_ROOM', 'This connection is already seated.')); return; }
      const code = validObject(data) ? normalizeCode(data.code) : '';
      const token = validObject(data) && typeof data.token === 'string' ? data.token : '';
      if (!validCode(code) || !/^[a-f0-9]{64}$/.test(token)) { ack(failure('INVALID_SESSION', 'The saved player session is invalid.')); return; }
      const room = rooms.get(code);
      if (!room || !refresh(room)) { ack(failure('ROOM_NOT_FOUND', 'This room no longer exists.')); return; }
      const color = COLORS.find(c => { const seat = room.seats[c]; return seat && !seat.left && seat.token.length === token.length && timingSafeEqual(Buffer.from(seat.token), Buffer.from(token)); });
      if (!color) { ack(failure('INVALID_SESSION', 'This session cannot claim a player seat.')); return; }
      const seat = room.seats[color]!;
      if (seat.socketId && seat.socketId !== socket.id) {
        const previous = io.sockets.sockets.get(seat.socketId);
        if (previous) detach(previous, 'Your player seat was resumed in another connection.', room.code);
      }
      ack(enter(socket, room, color, seat));
    });
    socket.on('game:move', (data, ack) => {
      if (typeof ack !== 'function') return;
      if (!rateLimit(socket, 'general')) { ack(failure('RATE_LIMITED', 'Too many requests. Please wait a minute.')); return; }
      const owned = identityRoom(socket); if ('ok' in owned) { ack(owned); return; }
      const { room, color, seat } = owned;
      if (!validObject(data) || typeof data.from !== 'string' || !/^[a-h][1-8]$/.test(data.from) || typeof data.to !== 'string' || !/^[a-h][1-8]$/.test(data.to) || !Number.isSafeInteger(data.expectedRevision) || Number(data.expectedRevision) < 0 || typeof data.requestId !== 'string' || !/^[a-zA-Z0-9_-]{8,100}$/.test(data.requestId) || (data.promotion !== undefined && !['q', 'r', 'b', 'n'].includes(String(data.promotion)))) {
        ack(failure('INVALID_MOVE', 'The move request is malformed.')); return;
      }
      const command = data as unknown as MoveCommand;
      const fingerprint = JSON.stringify([command.from, command.to, command.promotion ?? null, command.expectedRevision]);
      const previous = seat.receipts.get(command.requestId);
      if (previous) { ack(previous.fingerprint === fingerprint ? { ok: true, state: publicState(room) } : failure('REQUEST_REUSED', 'This move identifier has already been used.')); return; }
      if (room.phase !== 'playing') { ack(failure('GAME_NOT_ACTIVE', 'Wait for an opponent or create a new battle after this one ends.')); return; }
      if (!room.seats.w.socketId || !room.seats.b?.socketId) { ack(failure('OPPONENT_DISCONNECTED', 'The battle is paused while a player reconnects.')); return; }
      if (command.expectedRevision !== room.revision) { ack(failure('STALE_POSITION', 'The position changed. Wait for the latest room state.')); socket.emit('room:state', publicState(room)); return; }
      if (room.game.turn() !== color) { ack(failure('NOT_YOUR_TURN', 'It is your opponent’s turn.')); return; }
      const piece = room.game.get(command.from as Square);
      if (!piece || piece.color !== color) { ack(failure('NOT_YOUR_PIECE', 'You can move only your own pieces.')); return; }
      try { room.game.move({ from: command.from, to: command.to, ...(command.promotion ? { promotion: command.promotion } : {}) }); }
      catch { ack(failure('ILLEGAL_MOVE', 'That move is not legal in the current position.')); return; }
      room.revision++;
      seat.receipts.set(command.requestId, { fingerprint });
      if (seat.receipts.size > 256) seat.receipts.delete(seat.receipts.keys().next().value!);
      const result = gameResult(room.game); if (result) finish(room, 'finished', result, false);
      broadcast(room); ack({ ok: true, state: publicState(room) });
    });
    socket.on('room:leave', ack => {
      if (typeof ack !== 'function') return;
      if (!rateLimit(socket, 'general')) { ack(failure('RATE_LIMITED', 'Too many requests. Please wait a minute.')); return; }
      const result = leave(socket); ack(result);
      if (result.ok) detach(socket, 'You left this room.', result.state.code);
    });
    socket.on('room:close', ack => {
      if (typeof ack !== 'function') return;
      if (!rateLimit(socket, 'general')) { ack(failure('RATE_LIMITED', 'Too many requests. Please wait a minute.')); return; }
      const owned = identityRoom(socket); if ('ok' in owned) { ack(owned); return; }
      if (owned.color !== 'w') { ack(failure('NOT_OWNER', 'Only the room creator can close the room.')); return; }
      if (owned.room.phase === 'finished' || owned.room.phase === 'closed') {
        ack({ ok: true, state: publicState(owned.room) }); return;
      }
      finish(owned.room, 'closed', { reason: 'closed', winner: null, message: 'The room was closed by its creator.' });
      broadcast(owned.room); ack({ ok: true, state: publicState(owned.room) });
    });
    socket.on('disconnect', () => {
      if (stopping) return;
      const identity = socket.data.identity;
      if (!identity) return;
      const room = rooms.get(identity.roomCode), seat = room?.seats[identity.color];
      if (!room || !seat || seat.socketId !== socket.id) return;
      seat.socketId = null; seat.disconnectedAt = Date.now(); broadcast(room);
    });
  });
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const room of rooms.values()) refresh(room, now);
    for (const [key, value] of limits) if (now - value.since > 60_000) limits.delete(key);
  }, positive(options.cleanupIntervalMs, 1000));
  cleanup.unref();

  return {
    httpServer, io,
    listen(port = 0, host = '127.0.0.1'): Promise<number> {
      return new Promise((resolveListen, reject) => {
        const onError = (error: Error) => { httpServer.off('listening', onListening); reject(error); };
        const onListening = () => { httpServer.off('error', onError); const address = httpServer.address(); resolveListen(typeof address === 'object' && address ? address.port : port); };
        httpServer.once('error', onError); httpServer.once('listening', onListening); httpServer.listen(port, host);
      });
    },
    close(): Promise<void> {
      stopping = true; clearInterval(cleanup); rooms.clear(); limits.clear();
      return new Promise(resolveClose => { io.close(() => { if (httpServer.listening) httpServer.close(() => resolveClose()); else resolveClose(); }); });
    },
  };
}
