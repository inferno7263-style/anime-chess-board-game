import { isAnimatedCharacter, hasReferenceEffect, type AnimatedCharacterId } from './techniques';
export type CharacterAnimation = { characterId: AnimatedCharacterId; kind: 'attack' | 'defeat'; nonce: number };
export const animationDuration = (kind: CharacterAnimation['kind']) => kind === 'attack' ? 2.4 : 3;
export function animationPose(kind: CharacterAnimation['kind'], elapsed: number, reducedMotion = false) {
  const progress = Math.min(1, Math.max(0, elapsed / animationDuration(kind)));
  if (reducedMotion) return { progress, tilt: 0, lift: 0, lunge: 0 };
  const envelope = Math.sin(progress * Math.PI);
  if (kind === 'attack') return { progress, tilt: -.32 * envelope, lift: .12 * envelope, lunge: .27 * envelope };
  // Collapse, hold the pose, then recover the figurine without changing game state.
  const fall = Math.min(1, progress / .3) * (progress > .82 ? (1 - progress) / .18 : 1);
  return { progress, tilt: 1.46 * fall, lift: -.02 * fall, lunge: .15 * fall };
}

/** Only a newly committed capture can trigger a character attack, never undo. */
export function capturePerformer(
  before: { square: string; character: { id: string } }[],
  after: { square: string; character: { id: string } }[],
  move: { from: string; to: string } | null,
): CharacterAnimation['characterId'] | null {
  if (!move || before.length !== after.length + 1) return null;
  const attacker = after.find(piece => piece.square === move.to);
  if (!attacker || !isAnimatedCharacter(attacker.character.id)) return null;
  return before.some(piece => piece.character.id === attacker.character.id && piece.square === move.from)
    ? attacker.character.id as CharacterAnimation['characterId'] : null;
}

/** Small arrival effects require a forward transition, not selection/presence/undo. */
export function movePerformer(
  before: { square: string; character: { id: string } }[],
  after: { square: string; character: { id: string } }[],
  move: { from: string; to: string } | null,
): AnimatedCharacterId | null {
  if (!move || before.length !== after.length) return null;
  const actor = after.find(p => p.square === move.to);
  if (!actor || !hasReferenceEffect(actor.character.id)) return null;
  return before.some(p => p.square === move.from && p.character.id === actor.character.id)
    ? actor.character.id as AnimatedCharacterId : null;
}
