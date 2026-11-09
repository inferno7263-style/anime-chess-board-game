/** Remaining Heroes, mapped to the supplied slash/void/beam/punch/lightning/fire/wind references. */
export const heroTechniques = {
  ichigo: { name: 'GETSUGA TENSHO', color: '#62d9ff', caption: 'Ichigo · Azure crescent', family: 'slash' },
  gojo: { name: 'HOLLOW PURPLE', color: '#cb76ff', caption: 'Gojo · Hollow Purple', family: 'void' },
  goku: { name: 'KAMEHAMEHA', color: '#38dfff', caption: 'Goku · Kamehameha', family: 'beam' },
  luffy: { name: 'GUM-GUM · ELEPHANT GUN', color: '#ff6854', caption: 'Luffy · Elephant Gun', family: 'punch' },
  zenitsu: { name: 'THUNDERCLAP AND FLASH', color: '#b4e9ff', caption: 'Zenitsu · Thunderclap', family: 'lightning' },
  killua: { name: 'GODSPEED · THUNDERBOLT', color: '#77bfff', caption: 'Killua · Godspeed', family: 'lightning' },
  tanjiro: { name: 'HINOKAMI KAGURA', color: '#ff8b30', caption: 'Tanjiro · Hinokami Kagura', family: 'fire' },
  gon: { name: 'JAJANKEN · ROCK', color: '#ffbc43', caption: 'Gon · Jajanken', family: 'charged-punch' },
  zoro: { name: 'THREE-SWORD STYLE · DRAGON TWISTER', color: '#72efbd', caption: 'Zoro · Dragon Twister', family: 'wind' },
  yuno: { name: 'SPIRIT DIVE · WIND MAGIC', color: '#9eff8b', caption: 'Yuno · Spirit Dive', family: 'magic' },
  yami: { name: 'DARK MAGIC · BLACK HOLE', color: '#ac87ff', caption: 'Yami · Black Hole', family: 'void' },
} as const;
export type HeroTechniqueId = keyof typeof heroTechniques;
export const remainingHeroIds = Object.keys(heroTechniques) as HeroTechniqueId[];
/** Cosmetic profiles only. Nothing in this module authorizes or changes a move. */
export const techniques = {
  ...heroTechniques,
  naruto: { name: 'RASENGAN', color: '#64edff', caption: 'Naruto · Rasengan' },
  madara: { name: 'SUSANOO STRIKE', color: '#9daaff', caption: 'Madara · Susanoo' },
  asta: { name: 'BLACK DIVIDER', color: '#ff4527', caption: 'Asta · Anti-magic' },
  mikasa: { name: 'ODM · CROSS SLASH', color: '#ffba62', caption: 'Mikasa · Cross slash' },
  nezuko: { name: 'EXPLODING BLOOD', color: '#ff56da', caption: 'Nezuko · Blood flame' },
  'sung-jinwoo': { name: 'SHADOW MONARCH · DAGGER RUSH', color: '#b688ff', caption: 'Jinwoo · Shadow daggers' },
} as const;
export type AnimatedCharacterId = keyof typeof techniques;
export const referenceCharacters = ['asta', 'mikasa', 'nezuko', 'sung-jinwoo', ...remainingHeroIds] as const;
export const isAnimatedCharacter = (id: string): id is AnimatedCharacterId => Object.hasOwn(techniques, id);
export const hasReferenceEffect = (id: string) => referenceCharacters.some(character => character === id);
