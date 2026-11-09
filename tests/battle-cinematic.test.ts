import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { derivePieces } from '../src/data/roster';
import { BATTLE_DURATION, IMPACT_AT, RETURN_AT, battleFrame, captureBattle, contactPoint } from '../src/scene/battleTimeline';

describe('cinematic battle sequencing',()=>{
  it('focuses, charges, hits the target, defeats, then restores the board',()=>{
    expect(battleFrame(0)).toMatchObject({phase:'focus',enter:0,approach:0,fall:0,exit:0});
    expect(battleFrame(.8).phase).toBe('charge');
    expect(battleFrame(1.2).phase).toBe('strike');
    expect(battleFrame(IMPACT_AT)).toMatchObject({phase:'defeat',impact:1,approach:1,fall:0});
    expect(battleFrame(2.8).fall).toBe(1);
    expect(battleFrame(RETURN_AT).returning).toBe(true);
    expect(battleFrame(BATTLE_DURATION)).toMatchObject({phase:'return',exit:1,done:true});
  });
  it('uses real Naruto capture participants without changing the authoritative position',()=>{
    const game=new Chess();
    for(const san of ['e4','d5','Ke2','dxe4','Ke3','a6']) game.move(san);
    const before=derivePieces(game.history({verbose:true}));
    const move=game.move('Kxe4');
    const after=derivePieces(game.history({verbose:true}));
    const fen=game.fen();
    const battle=captureBattle(before,after,move);
    expect(battle?.attacker.character.id).toBe('naruto');
    expect(battle?.victim.character.id).toBe('blackbeard');
    expect(battle?.victim.square).toBe('e4');
    expect(contactPoint(battle!.victim)).toEqual([.79,.59,0]);
    expect(game.fen()).toBe(fen);
    expect(captureBattle(after,before,move)).toBeNull();
    expect(captureBattle(after,after,move)).toBeNull();
  });
  it('resolves Madara captures against their actual target, not a fixed rival',()=>{
    const initial=derivePieces([]);
    const madara=initial.find(p=>p.character.id==='madara')!;
    const victim=initial.find(p=>p.character.id==='gon')!;
    const before=[{...madara,square:'e4' as const},{...victim,square:'e3' as const}];
    const after=[{...madara,square:'e3' as const}];
    const battle=captureBattle(before,after,{from:'e4',to:'e3'});
    expect(battle?.attacker.character.id).toBe('madara');
    expect(battle?.victim.character.id).toBe('gon');
    expect(captureBattle(before,after,{from:'a8',to:'e3'})).toBeNull();
  });
});
