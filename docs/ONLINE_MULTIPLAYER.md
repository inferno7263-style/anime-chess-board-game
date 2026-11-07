# Online Multiplayer

The game now has three independent modes: Local PvP, Stockfish, and Online Multiplayer. All modes reuse the same chessboard, 3D characters, capture animations and legal chess helpers. Local/AI play still works without a room server. Switching modes preserves the local position and online session; return to the room to continue.

## Start development

Requires Node.js 22.12+ and npm (validated on Node 24).

```sh
npm ci
cp .env.example .env
npm run dev
```

This starts Vite on port 5173 and the Node room server on port 3001. Vite proxies `/socket.io` HTTP and WebSocket traffic to the backend. Frontend changes reload automatically; restart this command after backend edits. For separate terminals, use `npm run server` and `npm run dev:client`. The health endpoint is `/healthz` on the backend.

Choose Online Multiplayer, create a private room, and copy its invitation link. Open the link in another browser/device and click Join room. The creator is White; the joining player is Black. Black's board initially faces their side. The link contains a room code only, never a player's credential. Room codes can also be entered manually.

For two physical devices on the same Wi-Fi, visit Vite using your computer's LAN address on both devices. Include that exact origin, such as `http://192.168.1.10:5173`, in `ALLOWED_ORIGINS` and restart development. Share the LAN invitation; a localhost invitation refers to the receiving device itself. Networks and device firewalls must allow the selected listening port. Internet play requires a publicly hosted server as below.

## Deploy frontend and backend together (recommended)

Use a long-running Node web service that supports WebSockets, such as a Node service on Render, Railway, or a VPS. A static-only hosting service cannot run the room authority. No API key or database is required for this single-process implementation.

Build command:

```sh
npm ci
npm run build
```

Start command:

```sh
npm start
```

Set the hosting service's environment configuration:

- `NODE_ENV=production`
- `HOST=0.0.0.0`
- `PORT`: use the port supplied by your host, or choose your listening port.
- `ALLOWED_ORIGINS=https://your-public-game-domain.example` (replace with the actual exact origin, no trailing slash).
- `SERVE_CLIENT=true` (default). The backend serves `dist/` and `/socket.io` from the same origin.
- Leave `VITE_MULTIPLAYER_URL` empty for this deployment.

Serve the public address over HTTPS, with WebSocket forwarding enabled. Invitation URLs derive from the browser's frontend address, so players receive links to the hosted game. A hosting preview using a different origin needs that origin added to `ALLOWED_ORIGINS` too.

For an Nginx reverse proxy, forward requests to the Node port with the original Host and WebSocket upgrade headers. An example server location (TLS/domain setup is host-specific):

```nginx
location / {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 75s;
}
```

The application serves GLB, fonts and Stockfish WASM locally with the correct MIME types. `npm run play` / `node serve-game.mjs` remains an **offline-only** dependency-free preview; use `npm start` for all three modes. `vite preview` alone does not start the online backend.

## Deploy frontend and backend separately

Set `VITE_MULTIPLAYER_URL=https://your-backend.example` when building the frontend. This is a public build-time URL, not a secret. Rebuild after changing it. Set `ALLOWED_ORIGINS` on the backend to the frontend's exact public origin. Use `SERVE_CLIENT=false` on a backend-only service if desired. Preserve the default Socket.IO path `/socket.io` and support HTTP polling and WebSockets. Never place seat credentials in URLs or reverse-proxy logs.

## State, reconnection and lifecycle

One Node process owns each room's Chess.js game, seats, results and move revision. The current implementation stores these **in memory**. Deploy one instance/replica; server restart or redeployment ends existing rooms. Browser/network reconnection is supported while the server and room still exist. Server restart persistence and multi-instance failover are not implemented. Scaling requires shared authoritative room persistence and routing plus a Socket.IO adapter; an adapter alone does not share Chess.js state.

A private cryptographically random 256-bit seat credential is stored in the player's tab session storage. Refreshing the same tab or reconnecting restores their side, full move history, captures, turn and result. Closing the tab clears its session storage. Do not share that storage or a player credential. Resuming a seat in another connection evicts the old connection. The invitation code alone cannot claim an occupied seat.

- Waiting rooms expire after 15 minutes.
- Moves pause while either player is disconnected. A disconnected seat is reserved for 120 seconds. If its player does not return, the connected opponent wins by disconnection; if both are absent, the room is abandoned.
- Explicitly leaving an active game resigns. Leaving a waiting room closes it. The creator may close a room for both players. A waiting room accepts a guest only while its creator is connected.
- Finished/closed games are inspectable for 15 minutes, then cleaned up. Active rooms have a maximum lifetime of 24 hours.
- These durations and the room cap are configurable in `.env.example`.
- Online undo and unilateral restart are disabled. Exit and create a new room for a new game. Local/AI undo and restart retain their prior behavior.

## Authority and protocol

`server/gameServer.ts` owns every online Chess.js instance. The browser requests a move with origin/destination, optional promotion, expected room revision and unique request ID. No client FEN, turn, capture, status, color or result is accepted as authority. The server checks socket seat ownership, both players' presence, active phase, revision, turn and Chess.js legality, then broadcasts a complete public snapshot. Snapshots contain the SAN history and FEN, allowing clients to reconstruct repetition history and character identities.

Duplicate IDs with the same payload are idempotent. Reusing an ID for a different move is rejected; old revisions cannot replay a move. Malformed requests, wrong-side moves, stale sessions and unseated clients are rejected. Room creation has a bounded per-address rate limit and game commands have a per-connection rate limit, room counts are capped, request payloads are bounded, and unused rooms are cleaned up. Room-creation limits use the actual socket peer address; reverse-proxy users may share that creation bucket. General game actions have an independent bucket per connection. No resume credentials are broadcast in public state.

Protocol types are in `src/online/protocol.ts`. Events are `room:create`, `room:join`, `room:resume`, `game:move`, `room:leave`, `room:close`, `room:state`, and `room:removed`.

## Verify

```sh
npm test
npm run build
npm run test:browser
```

Backend integration tests use real independent Socket.IO clients and ephemeral ports. Browser tests use independent contexts for White and Black, including mobile layout, invitation joining, synchronized moves/captures/checkmate, reload, offline/reconnect, room limits and leaving/closing. The original local, Stockfish and 3D-drag browser tests remain in place. Chromium is at `/usr/bin/chromium` in the prepared cloud machine; set `CHROMIUM_PATH` elsewhere. The cloud command sandbox requires supported approved execution for listening servers and browser/engine subprocesses.

For a manual check, use different browsers/devices or one regular and one private window, create and join a room, play a move on each side, disconnect one device briefly, then reconnect and verify identical boards and move logs.
