# Anime Chess: Multiverse War

A playable cinematic chess game with the user's exact 32-character Heroes Alliance / Villains Alliance roster. React 19, TypeScript, Three.js, React Three Fiber, Chess.js and local Stockfish 17.1 WASM. Local and AI modes need no backend. Private online games use the included Node.js / Socket.IO server; no account or API key is required.

## Deploy on Render

Use the included `render.yaml` Blueprint. Follow [the Render deployment steps](docs/RENDER_DEPLOYMENT.md) to publish all three game modes on one service.

## Online Multiplayer

Private rooms, invitation links, automatic White/Black seats, authoritative server-side Chess.js validation, synchronized games and reconnect support are implemented. Start both services with `npm run dev`, or build and run `npm start` for the complete production game. See [backend configuration, deployment and lifecycle](docs/ONLINE_MULTIPLAYER.md).

## Play the built game offline

With Node.js 22.12+ installed, run from the project folder:

```sh
node serve-game.mjs
```

Open the address printed by the launcher in your browser. The included `dist/` contains the complete game, figurines, fonts and AI engine. No `npm install` is needed for Local PvP or Stockfish in the packaged build. Online Multiplayer requires `npm ci` and `npm start` instead. Keep the terminal open while playing; press Ctrl+C to stop it. `npm run play` is an equivalent command. Set `PORT` if 4173 is already in use.

Use **Local PvP** for two players on the same device, or **vs. Computer** for Stockfish. White Heroes move first.

## Development

Requires Node.js 22.12+ (validated on Node 24) and npm.

```sh
npm ci
npm run dev
```

`npm ci` prepares the bundled, single-threaded Stockfish worker. Open the Vite server in your browser. No external font, model, or engine CDN is required; all runtime assets are served locally.

```sh
npm run build          # TypeScript + production bundle
npm start              # Serve production game + multiplayer backend
npm run preview        # Offline preview only (no room server)
npm test               # Rules, roster, worker protocol + actual WASM engine
npm run test:browser   # Playwright interaction tests
```

Browser tests use `/usr/bin/chromium` by default; set `CHROMIUM_PATH` to override. The included cloud machine requires approved execution outside its command sandbox for network access, listening servers, browser processes, and the real-engine child-process test. This is a machine restriction, not an application requirement.

## Playing

- Heroes are white and move first. Choose Local PvP, Stockfish, or Online Multiplayer with private rooms.
- Click a figure and then a highlighted square, or drag it to a legal destination. In 2D view every square is keyboard-accessible.
- Right-drag to orbit, scroll/pinch to zoom, and use the flip button to switch perspective.
- Castling, en passant, queen/rook/bishop/knight promotions, check, checkmate, stalemate, threefold repetition, insufficient material and the fifty-move rule are enforced by Chess.js. Character effects never alter chess rules.
- Undo reverses one move locally or a full player/AI turn. Restart asks before clearing an active battle.
- Sound, aura and render-quality controls are in Settings. Sound starts muted. There is no chess clock. Online Multiplayer is a third mode with private rooms; see the deployment guide.
- Local/AI matches last for the open browser session. Online games reconnect and restore in the same tab while the room server remains running.

## Exact roster

Assignments for duplicate roles run left to right; pawns run from a to h.

| Square | Heroes Alliance | Square | Villains Alliance |
|---|---|---|---|
| a1 | Monkey D. Luffy · rook | a8 | Frieza (Black Form) · rook |
| b1 | Ichigo Kurosaki · knight | b8 | Meruem · knight |
| c1 | Satoru Gojo · bishop | c8 | Muzan Kibutsuji · bishop |
| d1 | Son Goku (Ultra Instinct) · queen | d8 | Ryomen Sukuna · queen |
| e1 | Naruto Uzumaki · king | e8 | Madara Uchiha · king |
| f1 | Yuno · bishop | f8 | Lucifero · bishop |
| g1 | Sung Jin-Woo · knight | g8 | Hisoka · knight |
| h1 | Asta · rook | h8 | Sosuke Aizen · rook |
| a2 | Tanjiro · pawn | a7 | Obito · pawn |
| b2 | Zenitsu · pawn | b7 | Pain · pawn |
| c2 | Mikasa · pawn | c7 | Doflamingo · pawn |
| d2 | Killua · pawn | d7 | Blackbeard · pawn |
| e2 | Gon · pawn | e7 | Akaza · pawn |
| f2 | Yami · pawn | f7 | Mahito · pawn |
| g2 | Roronoa Zoro · pawn | g7 | Zeke Yeager · pawn |
| h2 | Nezuko · pawn | h7 | Pitou · pawn |

## Asset management

`src/data/roster.ts` is the character/role/appearance/model manifest. It is the single source of truth for the board and collection. Move replay preserves each character through captures, castling, en passant, promotion and undo.

The 32 supplied self-contained GLB files are **original, stylized full-body placeholder figurines**, generated with simple geometry and costume/hairstyle cues. They are not detailed or official character models. See `public/models/README.md` for the replacement scale/orientation contract. Replace each `modelUrl` with a licensed GLB to upgrade a figurine. Loading failures fall back to procedural geometry; the 2D board also works without WebGL. Promotions keep the character and show the new role in 2D, the collection selection, and a 3D promotion marker.

```sh
npm run generate:models  # Regenerate original placeholders from manifest
npm run prepare:engine  # Re-copy installed engine assets
```

`src/scene` owns board materials, lights, figures, input, camera and capture effects. `src/game` owns legal rules, state and the cancellable UCI worker. `src/styles.css` owns the responsive interface. Tests cover the standard move tree (20/400/8902 nodes), special rules, exact roster mapping, identity replay, engine lifecycle, and real engine output.

## Stockfish licensing

Stockfish is GPLv3. The engine's license, attribution, version, and corresponding source links are supplied in `public/engine/`. This original fan-made game is unaffiliated with the anime rights holders. No official character assets are bundled.

## Character animation effects

Settings → Character animation previews now includes Asta (Black Divider), Mikasa (ODM cross slash), Nezuko (Exploding Blood) and Sung Jin-Woo (shadow dagger rush), alongside Naruto and Madara. Each has attack/defeat previews; these never modify the position. Confirmed captures use the actual attacker and victim, including en passant. The four new characters also have short arrival effects on ordinary confirmed moves. Capturing one of them can trigger its defeat effect.

The effects are original procedural Three.js geometry inspired by the supplied visual references: black/red lightning blades, orange sweeping slash ribbons, pink flame energy, and violet enchanted daggers. They are not imported skeletal animation clips or copies of the reference images. They reuse the existing cinematic camera, skip control, performance setting and reduced-motion behavior. `src/scene/techniques.ts` holds the effect names/colors; `TechniqueEnergy.tsx` builds the visuals. Chess.js and the multiplayer server remain the sole authorities for moves.
