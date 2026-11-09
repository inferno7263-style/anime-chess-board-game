# Naruto and Madara animation pass

The supplied still images are visual references, not rigged 3D animation files. This implementation uses procedural performances on the existing full-body placeholder GLBs; it does not claim to import skeletal attack/defeat clips from the images.

- Naruto: spinning cyan Rasengan, orbiting energy trails and particles, anticipation and forward lunge.
- Madara: translucent blue Susanoo rib cage/arms, shockwave ring and debris, attack anticipation.
- Naruto defeat: face-down collapse with dust.
- Madara defeat: backward collapse with dissipating energy/dust.

A legal capture by either character triggers their attack in 3D view. Both are kings in the exact roster: they are never captured. The losing king performs its defeat after checkmate. The result dialog waits briefly in 3D so the effect can be seen. Reconnection, online status and all game authority remain in the existing chess code.

Open Settings → Preview the new animations to try Attack or Defeat for each character without moving pieces or changing the move log. The previews force 3D view and automatically finish. Toggle Cinematic character effects off to disable them. Reduced-motion preferences disable figure lunging/rotation while preserving a restrained energy effect. Performance quality reduces particle/mesh detail.

`src/scene/characterAnimation.ts` controls timing and pose; `CharacterPerformance.tsx` renders the body performance and effects. `ChessScene.tsx` detects committed captures/checkmate; App passes only presentation signals. No animation mutates Chess.js or sends a multiplayer command.

To replace this pass with detailed skeletal animation, supply rigged GLBs containing named Attack/Defeat clips. The current models are original static figurines; articulated limb and facial animation require a rigged replacement.

## Close-up finishing sequences

Naruto and Madara now use a 4.2-second cinematic capture replay: focus/zoom → charge → contact → defeat → camera return. The normal board is temporarily hidden so only the two actual combatants are visible. Naruto's Rasengan travels from the charging hand area to the opponent's torso; Madara's Susanoo palm strikes the same target area. Rings, particles and debris mark contact, and the opponent collapses backward. The original generated placeholder figures use a simple raised-arm pose during these close-ups; replacement GLBs are left untouched and need their own rigged clips for articulated motion.

The preview attack buttons now demonstrate the full encounter using Naruto and Madara as visual opponents. This is a presentation demo, never a legal king capture. Actual capture replays use the exact character that was captured. On checkmate, the losing king can be shown defeated without removing it from the chess position. If the final mover is another character, the king's defeat is shown without inventing Naruto/Madara as the attacker.

Use **Skip animation** to restore the previous camera position immediately. The camera also restores on undo, mode change, 2D view, disabling effects or scene unmount. A newer authoritative online move supersedes an old visual replay. Online moves are still committed by the server; animation never delays or changes server validation. Stockfish searches pause during a close-up and resume afterward, so an AI reply cannot cut the local capture short. Reduced-motion mode keeps the board camera and the restrained earlier effects.

Run `npm run build` then `npm run test:cinematic` for production-browser checks. These cover Naruto/Madara previews, skip, legal capture identity, undo, reduced motion and AI resumption. Tests also check the timeline and real capture participant derivation.

Cloud source updates do not automatically update a previously downloaded Windows copy. Rebuild or use the new packaged build to see these controls and scenes.
