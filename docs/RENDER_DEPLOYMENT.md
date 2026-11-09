# Publish the game on Render

The repository includes `render.yaml` for a single free Node web service. This service serves the production website, Stockfish, GLB assets, and Socket.IO on the same public HTTPS origin. No API key or database is needed.

## In your Render account

1. Open https://dashboard.render.com/ and sign in.
2. Choose **New → Blueprint**, connect GitHub, and select `inferno7263-style/anime-chess-board-game`.
3. Select the branch containing `render.yaml` (the deployment branch is `deploy/render-preview`), review the free web service, and deploy it.
4. Wait for the build and health check to finish. Open the public URL displayed by Render. Render supplies `PORT`; do not set a fixed port.
5. Choose Online Multiplayer, create a private room, and send its invitation to a friend. Both devices must use the public Render URL.

If Render does not offer the deployment branch in the Blueprint flow, choose **New → Web Service**, connect the same repository and branch, and select Node with these values:

- Build: `npm ci --include=dev && npm run build`
- Start: `npm start`
- Health check: `/healthz`
- Instance count: one
- Plan: Free
- Environment: `NODE_VERSION=24`, `NODE_ENV=production`, `HOST=0.0.0.0`, `SERVE_CLIENT=true`

Leave `VITE_MULTIPLAYER_URL` unset: the frontend talks to its own origin. Same-origin socket requests are accepted by the backend. For a separately hosted frontend or an additional domain, set `ALLOWED_ORIGINS` to its exact HTTPS origin. See ONLINE_MULTIPLAYER.md for full configuration.

## Check the live release

- The public `/healthz` endpoint returns `{"status":"ok",...}`.
- Open the game in two independent browsers/devices and create/join the same room.
- Play a move on each side, briefly disconnect/reconnect one browser, and confirm both boards and move logs agree.
- Check Local PvP and Stockfish as well.

## Free-preview limits

Render's free services can sleep and restart. Room state is held in memory, so a service restart or redeployment ends current rooms. The first load after sleeping can be slow. This is a preview deployment; reliable always-on play may require an always-on plan and durable room storage. No paid service is requested by this Blueprint.
