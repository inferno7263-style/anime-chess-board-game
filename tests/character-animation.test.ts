import { describe, expect, it } from 'vitest';
import { animationDuration, animationPose, capturePerformer } from '../src/scene/characterAnimation';
describe('procedural character animation timeline',()=>{
  it('winds up and lunges on attack, returning to the original pose',()=>{
    expect(animationPose('attack',0).tilt).toBeCloseTo(0);
    expect(animationPose('attack',0).lunge).toBe(0);
    expect(animationPose('attack',1.2).tilt).toBeLessThan(-.3);
    expect(animationPose('attack',1.2).lunge).toBeGreaterThan(.2);
    expect(animationPose('attack',animationDuration('attack')).tilt).toBeCloseTo(0);
  });
  it('collapses and holds the defeat pose, then recovers without removing the king',()=>{
    expect(animationPose('defeat',1).tilt).toBeCloseTo(1.46);
    expect(animationPose('defeat',2).tilt).toBeCloseTo(1.46);
    expect(animationPose('defeat',3).tilt).toBe(0);
  });
  it('respects reduced motion while retaining the effect timeline',()=>{
    expect(animationPose('attack',1,true)).toMatchObject({tilt:0,lift:0,lunge:0});
    expect(animationPose('defeat',1,true)).toMatchObject({tilt:0,lift:0,lunge:0});
  });
});

it('triggers only committed Naruto/Madara captures and ignores undo or presence updates',()=>{
  for(const id of ['naruto','madara']){
    const before=[{square:'e3',character:{id}},{square:'e4',character:{id:'pawn'}}];
    const after=[{square:'e4',character:{id}}];
    expect(capturePerformer(before,after,{from:'e3',to:'e4'})).toBe(id);
    expect(capturePerformer(after,before,{from:'e3',to:'e4'})).toBeNull();
    expect(capturePerformer(after,after,{from:'e3',to:'e4'})).toBeNull();
    expect(capturePerformer(before,after,{from:'e2',to:'e4'})).toBeNull();
  }
});
