import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGameServer } from './gameServer';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
function milliseconds(name: string, fallback: number) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be a positive number of milliseconds.`);
  return value;
}
const port = Number(process.env.PORT || 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer between 1 and 65535.');
const host = process.env.HOST || '0.0.0.0';
const origins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173').split(',').map(value => value.trim()).filter(Boolean);
for (const origin of origins) {
  const url = new URL(origin);
  if (origin === '*' || !['http:', 'https:'].includes(url.protocol) || url.origin !== origin) throw new Error('ALLOWED_ORIGINS must contain exact HTTP(S) origins, without paths or wildcards.');
}
const server = createGameServer({
  allowedOrigins: origins,
  reconnectGraceMs: milliseconds('RECONNECT_GRACE_MS', 120_000),
  waitingTtlMs: milliseconds('WAITING_ROOM_TTL_MS', 15 * 60_000),
  finishedTtlMs: milliseconds('FINISHED_ROOM_TTL_MS', 15 * 60_000),
  roomLifetimeMs: milliseconds('ROOM_LIFETIME_MS', 24 * 60 * 60_000),
  maxRooms: milliseconds('MAX_ROOMS', 1000),
  staticDir: process.env.SERVE_CLIENT === 'false' ? false : resolve(root, 'dist'),
});
await server.listen(port, host);
console.log(`Anime Chess server listening on port ${port}. Health check: /healthz`);
for (const signal of ['SIGTERM', 'SIGINT'] as const) process.once(signal, () => { void server.close().then(() => process.exit(0)); });
