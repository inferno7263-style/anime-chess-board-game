import type { Move, Square } from 'chess.js'
import type { BoardPiece, Character } from '../scene/types'

/** The user's 32-character roster, assigned to its exact starting chess squares.
 * Chess roles determine rules; character names and appearances never change them.
 */
type Entry = [string, string, string, Character['piece'], string, string, string, NonNullable<Character['appearance']>['style'], NonNullable<Character['appearance']>['weapon']?, boolean?]
const heroes: Entry[] = [
  ['a1', 'luffy', 'Monkey D. Luffy', 'r', 'One Piece', '#ff735f', '#ce3834', 'hat', 'none'],
  ['b1', 'ichigo', 'Ichigo Kurosaki', 'n', 'Bleach', '#ff9c52', '#171925', 'spiky', 'sword'],
  ['c1', 'gojo', 'Satoru Gojo', 'b', 'Jujutsu Kaisen', '#89dcff', '#171d39', 'spiky', 'none'],
  ['d1', 'goku', 'Son Goku (Ultra Instinct)', 'q', 'Dragon Ball', '#d1e8ff', '#ec7b2d', 'spiky', 'none'],
  ['e1', 'naruto', 'Naruto Uzumaki', 'k', 'Naruto', '#ffbf53', '#f18c32', 'spiky', 'none'],
  ['f1', 'yuno', 'Yuno', 'b', 'Black Clover', '#75d5a6', '#2b3f3b', 'short', 'staff', true],
  ['g1', 'sung-jinwoo', 'Sung Jin-Woo', 'n', 'Solo Leveling', '#a98bff', '#252b42', 'short', 'sword', true],
  ['h1', 'asta', 'Asta', 'r', 'Black Clover', '#b8c4dd', '#292c39', 'spiky', 'sword', true],
  ['a2', 'tanjiro', 'Tanjiro Kamado', 'p', 'Demon Slayer', '#53c9a1', '#296f65', 'short', 'sword', true],
  ['b2', 'zenitsu', 'Zenitsu Agatsuma', 'p', 'Demon Slayer', '#ffd363', '#b88a33', 'short', 'sword', true],
  ['c2', 'mikasa', 'Mikasa Ackerman', 'p', 'Attack on Titan', '#d69f98', '#51463d', 'short', 'sword', true],
  ['d2', 'killua', 'Killua Zoldyck', 'p', 'Hunter x Hunter', '#bdccff', '#66648c', 'spiky', 'none'],
  ['e2', 'gon', 'Gon Freecss', 'p', 'Hunter x Hunter', '#9fe872', '#338a43', 'spiky', 'none'],
  ['f2', 'yami', 'Yami Sukehiro', 'p', 'Black Clover', '#a8bdad', '#dfd9c5', 'spiky', 'sword'],
  ['g2', 'zoro', 'Roronoa Zoro', 'p', 'One Piece', '#8edb75', '#256b41', 'spiky', 'sword'],
  ['h2', 'nezuko', 'Nezuko Kamado', 'p', 'Demon Slayer', '#eea9bc', '#a5627c', 'long', 'none', true],
]
const villains: Entry[] = [
  ['a8', 'frieza', 'Frieza (Black Form)', 'r', 'Dragon Ball', '#be97e4', '#37303f', 'bald', 'none'],
  ['b8', 'meruem', 'Meruem', 'n', 'Hunter x Hunter', '#a5db86', '#657a50', 'bald', 'none'],
  ['c8', 'muzan', 'Muzan Kibutsuji', 'b', 'Demon Slayer', '#e4c1c7', '#302533', 'hat', 'none'],
  ['d8', 'sukuna', 'Ryomen Sukuna', 'q', 'Jujutsu Kaisen', '#ff626e', '#872b38', 'spiky', 'none'],
  ['e8', 'madara', 'Madara Uchiha', 'k', 'Naruto', '#ff766d', '#9e3136', 'long', 'staff'],
  ['f8', 'lucifero', 'Lucifero', 'b', 'Black Clover', '#ddd8bf', '#34313c', 'long', 'staff', true],
  ['g8', 'hisoka', 'Hisoka Morow', 'n', 'Hunter x Hunter', '#f49bbc', '#62374b', 'spiky', 'none'],
  ['h8', 'aizen', 'Sosuke Aizen', 'r', 'Bleach', '#c9bbfa', '#d3cfca', 'short', 'sword'],
  ['a7', 'obito', 'Obito Uchiha', 'p', 'Naruto', '#edac78', '#29242e', 'short', 'none', true],
  ['b7', 'pain', 'Pain', 'p', 'Naruto', '#dba2d0', '#262332', 'spiky', 'staff', true],
  ['c7', 'doflamingo', 'Donquixote Doflamingo', 'p', 'One Piece', '#f4a9d7', '#a94985', 'short', 'none', true],
  ['d7', 'blackbeard', 'Blackbeard', 'p', 'One Piece', '#d7ad78', '#342b35', 'hat', 'none', true],
  ['e7', 'akaza', 'Akaza', 'p', 'Demon Slayer', '#8dc9f1', '#947688', 'spiky', 'none'],
  ['f7', 'mahito', 'Mahito', 'p', 'Jujutsu Kaisen', '#adccdf', '#444e62', 'long', 'none'],
  ['g7', 'zeke', 'Zeke Yeager', 'p', 'Attack on Titan', '#d5c39c', '#745647', 'short', 'none'],
  ['h7', 'pitou', 'Neferpitou', 'p', 'Hunter x Hunter', '#e8c6e8', '#364369', 'short', 'none'],
]
const hair: Record<string, string> = {
  luffy: '#14171b', ichigo: '#f38630', gojo: '#e8eff4', goku: '#dbe1ef', naruto: '#f5d05c', yuno: '#1a2022', 'sung-jinwoo': '#17172a', asta: '#b3b2ba',
  tanjiro: '#462127', zenitsu: '#edbd5d', mikasa: '#26232a', killua: '#e5e5eb', gon: '#14251b', yami: '#29282b', zoro: '#7dba67', nezuko: '#34202b',
  frieza: '#584866', meruem: '#5a7853', muzan: '#1c1b22', sukuna: '#ce8a87', madara: '#19171e', lucifero: '#e5ded3', hisoka: '#ae5369', aizen: '#5b4239',
  obito: '#23212a', pain: '#c87642', doflamingo: '#d9c78b', blackbeard: '#211d24', akaza: '#dd8199', mahito: '#aabdc8', zeke: '#ad9c6b', pitou: '#ddd9e6',
}
const role: Record<Character['piece'], string> = { p: 'Pawn', r: 'Rook', n: 'Knight', b: 'Bishop', q: 'Queen', k: 'King' }
export const roster: Character[] = [...heroes.map(e => ({ e, color: 'w' as const })), ...villains.map(e => ({ e, color: 'b' as const }))].map(({ e, color }) => {
  const [square, id, name, piece, anime, accent, outfit, style, weapon = 'none', cloak = false] = e
  return { id, name, anime, piece, color, square, role: role[piece], accent, modelUrl: `/models/${id}.glb`, appearance: { hair: hair[id], outfit, style, weapon, cloak, skin: id === 'frieza' ? '#8c8294' : ['meruem', 'lucifero'].includes(id) ? '#cbd0bc' : '#ddba9d' } }
})

export const rosterIsProvisional = false

/** Replay legal move history so character identity survives captures and castling. */
export function derivePieces(history: Move[]): BoardPiece[] {
  const board = new Map<Square, Character>(roster.map(c => [c.square as Square, c]))
  for (const move of history) {
    const character = board.get(move.from)
    if (!character) continue
    board.delete(move.from)
    if (move.flags.includes('e')) board.delete(`${move.to[0]}${move.from[1]}` as Square)
    if (move.flags.includes('k') || move.flags.includes('q')) {
      const rank = move.from[1]
      const from = `${move.flags.includes('k') ? 'h' : 'a'}${rank}` as Square
      const to = `${move.flags.includes('k') ? 'f' : 'd'}${rank}` as Square
      const rook = board.get(from)
      if (rook) { board.delete(from); board.set(to, rook) }
    }
    board.set(move.to, move.promotion ? { ...character, originalPiece: character.originalPiece ?? character.piece, piece: move.promotion, role: role[move.promotion] } : character)
  }
  return [...board].map(([square, character]) => ({ square, character }))
}
