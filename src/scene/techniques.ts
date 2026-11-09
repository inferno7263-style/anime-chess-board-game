/** Cosmetic profiles only. Nothing in this module authorizes or changes a move. */
export const techniques = {
  naruto: { name: 'RASENGAN', color: '#64edff', caption: 'Naruto · Rasengan' },
  madara: { name: 'SUSANOO STRIKE', color: '#9daaff', caption: 'Madara · Susanoo' },
  asta: { name: 'BLACK DIVIDER', color: '#ff4527', caption: 'Asta · Anti-magic' },
  mikasa: { name: 'ODM · CROSS SLASH', color: '#ffba62', caption: 'Mikasa · Cross slash' },
  nezuko: { name: 'EXPLODING BLOOD', color: '#ff56da', caption: 'Nezuko · Blood flame' },
  'sung-jinwoo': { name: 'SHADOW MONARCH · DAGGER RUSH', color: '#b688ff', caption: 'Jinwoo · Shadow daggers' },
} as const;
export type AnimatedCharacterId = keyof typeof techniques;
export const referenceCharacters = ['asta', 'mikasa', 'nezuko', 'sung-jinwoo'] as const;
export const isAnimatedCharacter = (id: string): id is AnimatedCharacterId => Object.hasOwn(techniques, id);
export const hasReferenceEffect = (id: string) => referenceCharacters.some(character => character === id);
