import { describe, expect, it } from 'vitest'
import { Chess } from 'chess.js'
import { derivePieces, roster, rosterIsProvisional } from './roster'

describe('user roster identity', () => {
  it('assigns 32 unique characters and all ten requested universes', () => {
    expect(roster).toHaveLength(32)
    expect(new Set(roster.map(c => c.id)).size).toBe(32)
    expect(new Set(roster.map(c => c.square)).size).toBe(32)
    expect(new Set(roster.map(c => c.anime)).size).toBe(10)
    const game=new Chess()
    for(const c of roster) expect(game.get(c.square as any)).toEqual({color:c.color,type:c.piece})
  })
  it('uses the user’s exact square assignments and final roster', () => {
    const assignments = Object.fromEntries(roster.map(c => [c.square, c.id]))
    expect(rosterIsProvisional).toBe(false)
    expect(assignments).toEqual({
      a1:'luffy',b1:'ichigo',c1:'gojo',d1:'goku',e1:'naruto',f1:'yuno',g1:'sung-jinwoo',h1:'asta',
      a2:'tanjiro',b2:'zenitsu',c2:'mikasa',d2:'killua',e2:'gon',f2:'yami',g2:'zoro',h2:'nezuko',
      a8:'frieza',b8:'meruem',c8:'muzan',d8:'sukuna',e8:'madara',f8:'lucifero',g8:'hisoka',h8:'aizen',
      a7:'obito',b7:'pain',c7:'doflamingo',d7:'blackbeard',e7:'akaza',f7:'mahito',g7:'zeke',h7:'pitou',
    })
  })
  it('preserves character identity through a capture and undo', () => {
    const game=new Chess()
    game.move('e4');game.move('d5');game.move('exd5')
    const pieces=derivePieces(game.history({verbose:true}))
    expect(pieces).toHaveLength(31)
    expect(pieces.find(p=>p.square==='d5')?.character.id).toBe('gon')
    expect(pieces.some(p=>p.character.id==='blackbeard')).toBe(false)
    game.undo()
    expect(derivePieces(game.history({verbose:true}))).toHaveLength(32)
  })
  it('moves the rook character when castling', () => {
    const game=new Chess()
    for(const m of ['e4','e5','Nf3','Nc6','Bc4','Bc5','O-O']) game.move(m)
    const pieces=derivePieces(game.history({verbose:true}))
    expect(pieces.find(p=>p.square==='g1')?.character.id).toBe('naruto')
    expect(pieces.find(p=>p.square==='f1')?.character.id).toBe('asta')
    expect(pieces.some(p=>p.square==='h1')).toBe(false)
  })
  it('removes the captured pawn on en passant', () => {
    const game=new Chess()
    for(const m of ['e4','a6','e5','d5','exd6']) game.move(m)
    const pieces=derivePieces(game.history({verbose:true}))
    expect(pieces.find(p=>p.square==='d6')?.character.id).toBe('gon')
    expect(pieces.some(p=>p.square==='d5')).toBe(false)
    expect(pieces).toHaveLength(31)
  })
  it('updates promoted chess role while preserving the character', () => {
    const moves = [{from:'a2',to:'a8',flags:'np',promotion:'q'}] as any
    const pieces=derivePieces(moves)
    expect(pieces.find(p=>p.square==='a8')?.character).toMatchObject({id:'tanjiro',piece:'q',role:'Queen'})
  })
})
