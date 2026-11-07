import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { io, type Socket } from 'socket.io-client';
import { Chess } from 'chess.js';
import { randomUUID } from 'node:crypto';
import type { ClientToServerEvents, CommandAck, MembershipAck, RoomMembership, RoomState, ServerToClientEvents } from '../src/online/protocol';
import { createGameServer } from '../server/gameServer';

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;
const sockets: Client[] = [];
const timeoutMs = 4000;
const ack = <T>(send: (resolve: (value: T) => void) => void): Promise<T> => new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error('Socket acknowledgement timed out')), timeoutMs);
  send(value => { clearTimeout(timeout); resolve(value); });
});
const create = (socket: Client) => ack<MembershipAck>(done => socket.emit('room:create', done));
const join = (socket: Client, code: string) => ack<MembershipAck>(done => socket.emit('room:join', { code }, done));
const resume = (socket: Client, code: string, token: string) => ack<MembershipAck>(done => socket.emit('room:resume', { code, token }, done));
const leave = (socket: Client) => ack<CommandAck>(done => socket.emit('room:leave', done));
const close = (socket: Client) => ack<CommandAck>(done => socket.emit('room:close', done));
function membership(result: MembershipAck): RoomMembership {
  expect(result.ok, !result.ok ? result.error : undefined).toBe(true);
  if (!result.ok) throw new Error(result.error);
  return result;
}
function state(result: CommandAck): RoomState {
  expect(result.ok, !result.ok ? result.error : undefined).toBe(true);
  if (!result.ok) throw new Error(result.error);
  return result.state;
}
function assertRejected(result: CommandAck | MembershipAck) {
  expect(result.ok).toBe(false);
  if (!result.ok) { expect(result.error).toBeTruthy(); expect(result.code).toBeTruthy(); }
}
const states = new Map<Client, RoomState[]>();
function latest(socket: Client) { return states.get(socket)?.at(-1); }
const request = (socket: Client, data: Parameters<ClientToServerEvents['game:move']>[0]) => ack<CommandAck>(done => socket.emit('game:move', data, done));
const move = (socket: Client, room: RoomState, from: string, to: string, promotion?: 'q' | 'r' | 'b' | 'n') => request(socket, { from, to, ...(promotion ? { promotion } : {}), expectedRevision: room.revision, requestId: randomUUID() });
async function waitForState(socket: Client, predicate: (state: RoomState) => boolean) {
  await expect.poll(() => latest(socket) ? predicate(latest(socket)!) : false, { timeout: timeoutMs, interval: 15 }).toBe(true);
  return latest(socket)!;
}

let server: ReturnType<typeof createGameServer>;
let serverUrl: string;
async function connect(origin = 'http://game.test'): Promise<Client> {
  const socket: Client = io(serverUrl, {
    transports: ['websocket'], forceNew: true, reconnection: false,
    extraHeaders: { Origin: origin },
  });
  sockets.push(socket);
  states.set(socket, []);
  socket.on('room:state', value => states.get(socket)?.push(value));
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Connection timed out')), timeoutMs);
    socket.once('connect', () => { clearTimeout(timeout); resolve(); });
    socket.once('connect_error', error => { clearTimeout(timeout); reject(error); });
  });
  return socket;
}
async function pair() {
  const white = await connect(), black = await connect();
  const host = membership(await create(white));
  const guest = membership(await join(black, host.state.code));
  await waitForState(white, room => room.phase === 'playing');
  return { white, black, host, guest, room: guest.state };
}
async function playSAN(white: Client, black: Client, initial: RoomState, moves: string[]) {
  const game = new Chess();
  for (const san of initial.history) game.move(san);
  let room = initial;
  for (const san of moves) {
    const chosen = game.move(san);
    room = state(await move(chosen.color === 'w' ? white : black, room, chosen.from, chosen.to, chosen.promotion));
    expect(room.fen).toBe(game.fen());
  }
  await waitForState(white, value => value.revision === room.revision);
  await waitForState(black, value => value.revision === room.revision);
  return room;
}

beforeEach(async () => {
  server = createGameServer({
    allowedOrigins: ['http://game.test'], staticDir: false,
    reconnectGraceMs: 1500, waitingTtlMs: 3000, finishedTtlMs: 2000,
    roomLifetimeMs: 20000, cleanupIntervalMs: 25,
  });
  serverUrl = `http://127.0.0.1:${await server.listen()}`;
});
afterEach(async () => {
  for (const socket of sockets.splice(0)) socket.disconnect();
  states.clear();
  await server.close();
});

describe('private rooms and server authority', () => {
  it('assigns White and Black, unique room codes and private resume credentials', async () => {
    const { white, black, host, guest, room } = await pair();
    expect(host.color).toBe('w'); expect(guest.color).toBe('b');
    expect(host.state.phase).toBe('waiting'); expect(room.phase).toBe('playing');
    expect(room.code).toMatch(/^[A-Z0-9]{8}$/);
    expect(host.token).not.toBe(guest.token);
    expect(host.token.length).toBeGreaterThanOrEqual(32);
    expect(room.players.w.connected).toBe(true); expect(room.players.b?.connected).toBe(true);
    expect(JSON.stringify(latest(white))).not.toContain(host.token);
    expect(JSON.stringify(latest(black))).not.toContain(guest.token);
    const other = membership(await create(await connect()));
    expect(other.state.code).not.toBe(room.code);
  });

  it('rejects unknown, full and malformed joins without changing occupied seats', async () => {
    const { room } = await pair();
    const stranger = await connect();
    assertRejected(await join(stranger, 'ZZZZZZZZ'));
    assertRejected(await join(stranger, room.code));
    assertRejected(await join(stranger, '../room'));
    assertRejected(await resume(stranger, room.code, 'not-a-valid-token'));
    assertRejected(await resume(stranger, room.code, '0'.repeat(64))); 
  });

  it('rejects moves before an opponent arrives or without a room membership', async () => {
    const white = await connect(), stranger = await connect();
    const host = membership(await create(white));
    assertRejected(await move(white, host.state, 'e2', 'e4'));
    assertRejected(await move(stranger, host.state, 'e2', 'e4'));
    assertRejected(await close(stranger));
    expect(latest(white)?.history).toEqual([]);
  });

  it('keeps the Black seat available while the waiting creator is disconnected', async () => {
    const creator = await connect();
    const host = membership(await create(creator));
    creator.disconnect();
    const guest = await connect();
    const denied = await join(guest, host.state.code);
    expect(denied).toMatchObject({ ok: false, code: 'HOST_DISCONNECTED' });
    const returningCreator = await connect();
    const restored = membership(await resume(returningCreator, host.state.code, host.token));
    expect(restored.color).toBe('w');
    expect(restored.state.phase).toBe('waiting');
    expect(restored.state.players.b).toBeNull();
    const joined = membership(await join(guest, host.state.code));
    expect(joined.color).toBe('b');
    expect(joined.state.phase).toBe('playing');
    expect(joined.state.history).toEqual([]);
    await waitForState(returningCreator, value => value.players.b?.connected === true);
  });

  it('rejects illegal, wrong-turn, malformed and stale moves; exact retries are idempotent', async () => {
    const { white, black, room } = await pair();
    assertRejected(await move(black, room, 'e7', 'e5'));
    assertRejected(await move(white, room, 'e2', 'e5'));
    assertRejected(await move(white, room, 'e7', 'e5'));
    assertRejected(await move(white, room, 'z9', 'e4'));
    const command = { from: 'e2', to: 'e4', expectedRevision: room.revision, requestId: randomUUID() };
    const after = state(await request(white, command));
    expect(after.history).toEqual(['e4']);
    const retry = state(await request(white, command));
    expect(retry.revision).toBe(after.revision); expect(retry.history).toEqual(['e4']);
    assertRejected(await request(white, { ...command, to: 'e3' }));
    assertRejected(await move(white, after, 'd2', 'd4'));
    assertRejected(await move(black, room, 'e7', 'e5'));
    await waitForState(black, value => value.revision === after.revision);
    expect(latest(white)?.fen).toBe(latest(black)?.fen);
    const next = state(await move(black, after, 'e7', 'e5'));
    expect(next.history).toEqual(['e4', 'e5']);
  });

  it('accepts only server-validated moves, ignoring a forged client FEN or color', async () => {
    const { white, black, room } = await pair();
    const malicious = {
      from: 'e2', to: 'e4', expectedRevision: room.revision, requestId: randomUUID(),
      fen: '7k/8/8/8/8/8/8/K7 w - - 0 1', color: 'b', result: { winner: 'w' },
    };
    const response = await request(white, malicious);
    // Unknown fields can be rejected or ignored, but cannot rewrite authority.
    if (response.ok) {
      const expected = new Chess(); expected.move('e4');
      expect(response.state.fen).toBe(expected.fen()); expect(response.state.phase).toBe('playing');
      await waitForState(black, value => value.history.length === 1);
      expect(latest(black)?.fen).toBe(expected.fen());
    } else {
      expect(latest(white)?.fen).toBe(room.fen);
    }
  });

  it('synchronizes capture and checkmate, then refuses further moves', async () => {
    const { white, black, room } = await pair();
    let after = await playSAN(white, black, room, ['e4', 'd5', 'exd5']);
    expect(new Chess(after.fen).get('d5')).toEqual({ type: 'p', color: 'w' });
    expect(new Chess(after.fen).get('e4')).toBeUndefined();
    expect(latest(white)).toEqual(latest(black));
    await close(white);
    await leave(white); await leave(black);
    const second = membership(await create(white));
    const secondJoin = membership(await join(black, second.state.code));
    after = await playSAN(white, black, secondJoin.state, ['f3', 'e5', 'g4', 'Qh4#']);
    expect(after.phase).toBe('finished'); expect(after.result).toMatchObject({ reason: 'checkmate', winner: 'b' });
    expect(new Chess(after.fen).isCheckmate()).toBe(true);
    assertRejected(await move(white, after, 'e2', 'e3'));
    expect(latest(white)).toEqual(latest(black));
  });

  it('preserves legal castling and en passant across both clients', async () => {
    const { white, black, room } = await pair();
    const after = await playSAN(white, black, room, ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'O-O']);
    const board = new Chess(after.fen);
    expect(board.get('g1')).toEqual({ type: 'k', color: 'w' });
    expect(board.get('f1')).toEqual({ type: 'r', color: 'w' });
    expect(board.get('h1')).toBeUndefined();
    await close(white);
    await leave(white); await leave(black);
    const second = membership(await create(white));
    const secondJoin = membership(await join(black, second.state.code));
    const enPassant = await playSAN(white, black, secondJoin.state, ['e4', 'a6', 'e5', 'd5', 'exd6']);
    const epBoard = new Chess(enPassant.fen);
    expect(epBoard.get('d5')).toBeUndefined();
    expect(epBoard.get('d6')).toEqual({ type: 'p', color: 'w' });
    expect(latest(white)).toEqual(latest(black));
  });

  it('requires an explicit legal promotion and synchronizes underpromotion', async () => {
    const { white, black, room } = await pair();
    const before = await playSAN(white, black, room, ['a4', 'b5', 'axb5', 'a6', 'bxa6', 'h6', 'a7', 'h5']);
    assertRejected(await move(white, before, 'a7', 'b8'));
    const after = state(await move(white, before, 'a7', 'b8', 'n'));
    await waitForState(black, value => value.revision === after.revision);
    expect(new Chess(after.fen).get('b8')).toEqual({ type: 'n', color: 'w' });
    expect(after.history.at(-1)).toBe('axb8=N');
    expect(latest(white)).toEqual(latest(black));
  });

  it('declares repetition from full server history, not just the current FEN', async () => {
    const { white, black, room } = await pair();
    const after = await playSAN(white, black, room, ['Nf3', 'Nf6', 'Ng1', 'Ng8', 'Nf3', 'Nf6', 'Ng1', 'Ng8']);
    expect(after.phase).toBe('finished'); expect(after.result).toMatchObject({ reason: 'repetition', winner: null });
  });
});

describe('reconnection and room lifecycle', () => {
  it('reports disconnect, blocks moves while offline, and restores the exact game on authenticated resume', async () => {
    const { white, black, host, guest, room } = await pair();
    const before = await playSAN(white, black, room, ['e4', 'e5']);
    black.disconnect();
    const offline = await waitForState(white, value => value.players.b?.connected === false);
    expect(offline.players.b?.disconnectedAt).toBeTypeOf('number');
    assertRejected(await move(white, offline, 'g1', 'f3'));
    const returning = await connect();
    assertRejected(await resume(returning, host.state.code, '0'.repeat(64)));
    const restored = membership(await resume(returning, guest.state.code, guest.token));
    expect(restored.color).toBe('b'); expect(restored.state.fen).toBe(before.fen);
    expect(restored.state.history).toEqual(before.history);
    await waitForState(white, value => value.players.b?.connected === true);
    const after = state(await move(white, restored.state, 'g1', 'f3'));
    expect(after.history).toEqual(['e4', 'e5', 'Nf3']);
    await waitForState(returning, value => value.history.length === 3);
  });

  it('reclaims only the authenticated seat and prevents its previous socket from acting', async () => {
    const { white, black, host, room } = await pair();
    const replacement = await connect();
    const restored = membership(await resume(replacement, room.code, host.token));
    expect(restored.color).toBe('w');
    if (white.connected) assertRejected(await move(white, restored.state, 'e2', 'e4'));
    const after = state(await move(replacement, restored.state, 'e2', 'e4'));
    expect(after.history).toEqual(['e4']);
    await waitForState(black, value => value.history.length === 1);
  });

  it('limits room closing to its host and resolves a deliberate departure as resignation', async () => {
    const { white, black, room } = await pair();
    assertRejected(await close(black));
    const ended = state(await leave(black));
    expect(ended.result).toMatchObject({ reason: 'resignation', winner: 'w' });
    await waitForState(white, value => value.result?.reason === 'resignation');
    const visitor = await connect();
    assertRejected(await join(visitor, room.code));
  });

  it('closes the room for both players when the host requests it', async () => {
    const { white, black, room } = await pair();
    const closed = state(await close(white));
    expect(closed.phase).toBe('closed');
    expect(closed.result?.reason).toBe('closed');
    await waitForState(black, value => value.phase === 'closed');
    assertRejected(await join(await connect(), room.code));
    assertRejected(await move(black, closed, 'e7', 'e5'));
  });

  it.each(['checkmate', 'resignation', 'closed'] as const)('keeps terminal %s result, revision and expiry unchanged when closing again', async (reason) => {
    const { white, black, room } = await pair();
    let terminal: RoomState;
    if (reason === 'checkmate') terminal = await playSAN(white, black, room, ['f3', 'e5', 'g4', 'Qh4#']);
    else if (reason === 'resignation') {
      terminal = state(await leave(black));
      await waitForState(white, value => value.result?.reason === 'resignation');
    } else {
      terminal = state(await close(white));
      await waitForState(black, value => value.phase === 'closed');
    }
    const updatesBefore = states.get(white)!.length;
    const first = state(await close(white));
    const second = state(await close(white));
    expect(first).toEqual(terminal);
    expect(second).toEqual(terminal);
    expect(second.result?.reason).toBe(reason);
    expect(second.revision).toBe(terminal.revision);
    expect(second.expiresAt).toBe(terminal.expiresAt);
    await new Promise(resolve => setTimeout(resolve, 30));
    expect(states.get(white)!.length).toBe(updatesBefore);
  });

  it('rate limits close and leave actions per connection without blocking another player', async () => {
    const noisy = await connect();
    for (let i = 0; i < 300; i++) {
      const result = await close(noisy);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).not.toBe('RATE_LIMITED');
    }
    const limitedClose = await close(noisy);
    expect(limitedClose).toMatchObject({ ok: false, code: 'RATE_LIMITED' });
    const limitedLeave = await leave(noisy);
    expect(limitedLeave).toMatchObject({ ok: false, code: 'RATE_LIMITED' });
    const unaffected = await close(await connect());
    expect(unaffected.ok).toBe(false);
    if (!unaffected.ok) expect(unaffected.code).not.toBe('RATE_LIMITED');
  });

  it('awards the connected player a disconnect result after the reconnect grace expires', async () => {
    const { white, black } = await pair();
    black.disconnect();
    const ended = await waitForState(white, value => value.result?.reason === 'disconnect');
    expect(ended.phase).toBe('finished'); expect(ended.result?.winner).toBe('w');
  });

  it('ends abandoned games when both players stay disconnected beyond the grace period', async () => {
    const { white, black, host, room } = await pair();
    white.disconnect(); black.disconnect();
    await new Promise(resolve => setTimeout(resolve, 1650));
    const visitor = await connect();
    const restored = await resume(visitor, room.code, host.token);
    if (restored.ok) {
      expect(['finished', 'closed']).toContain(restored.state.phase);
      expect(restored.state.result?.reason).toBe('abandoned');
      assertRejected(await move(visitor, restored.state, 'e2', 'e4'));
    } else {
      expect(restored.code).toBeTruthy();
    }
    assertRejected(await join(await connect(), room.code));
  });

  it('expires unjoined rooms and refuses expired invitations', async () => {
    const white = await connect();
    const host = membership(await create(white));
    const expired = await waitForState(white, value => value.phase === 'closed');
    expect(expired.result?.reason).toBe('expired');
    assertRejected(await join(await connect(), host.state.code));
  });

  it('serves a lightweight health endpoint and rejects an unapproved browser origin', async () => {
    const health = await fetch(`${serverUrl}/healthz`);
    expect(health.status).toBe(200);
    expect(await health.json()).toMatchObject({ status: 'ok' });
    await expect(connect('https://unapproved.invalid')).rejects.toThrow();
  });
});
