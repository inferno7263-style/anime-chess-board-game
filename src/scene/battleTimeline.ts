import type { BoardPiece } from './types';
import { capturePerformer } from './characterAnimation';
import { hasReferenceEffect } from './techniques';
export const BATTLE_DURATION = 4.2;
export const IMPACT_AT = 1.55;
export const RETURN_AT = 3.35;
const clamp = (v: number) => Math.max(0, Math.min(1, v));
export const smooth = (v: number) => { const t = clamp(v); return t * t * (3 - 2 * t); };
export function battleFrame(seconds: number) {
  const t = Math.max(0, seconds);
  return {
    enter: smooth(t / .65),
    approach: smooth((t - 1.05) / .5),
    impact: Math.max(0, 1 - Math.abs(t - IMPACT_AT) / .22),
    fall: smooth((t - IMPACT_AT) / .8),
    exit: smooth((t - RETURN_AT) / (BATTLE_DURATION - RETURN_AT)),
    returning: t >= RETURN_AT,
    done: t >= BATTLE_DURATION,
    phase: t < .65 ? 'focus' : t < 1.05 ? 'charge' : t < IMPACT_AT ? 'strike' : t < RETURN_AT ? 'defeat' : 'return',
  };
}
export type BattleEvent = { attacker: BoardPiece; victim: BoardPiece; nonce: number; kind: 'attack' | 'defeat'; preview?: boolean };
/** Derive participants from a committed capture, never from a selection or undo. */
export function captureBattle(before: BoardPiece[], after: BoardPiece[], move: {from: string;to: string} | null): Omit<BattleEvent,'nonce'> | null {
  const id = capturePerformer(before, after, move);
  if (!move || before.length!==after.length+1) return null;
  const attacker = after.find(p => p.square===move.to);
  if(!attacker || !before.some(p=>p.square===move.from && p.character.id===attacker.character.id)) return null;
  const remaining=new Set(after.map(p=>p.character.id));
  const victim = before.find(p => !remaining.has(p.character.id) && p.character.color !== attacker.character.color);
  return victim && (id || hasReferenceEffect(victim.character.id)) ? { attacker, victim, kind: id?'attack':'defeat' } : null;
}
/** Contact point follows the target's chest, not a fixed orb beside the attacker. */
export function contactPoint(victim: BoardPiece): [number,number,number] {
  return [.79, victim.character.piece === 'p' ? .59 : .72, 0];
}
