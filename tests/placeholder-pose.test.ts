import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Group, Object3D, Vector3 } from 'three';
import { posePlaceholderArms } from '../src/scene/placeholderPose';
it.each(['naruto','madara'])('raises the real %s GLB hands toward its target without modifying the cached model',async id=>{
  const data=await readFile(new URL(`../public/models/${id}.glb`,import.meta.url));
  const gltf=await new Promise<any>((resolve,reject)=>new GLTFLoader().parse(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'',resolve,reject));
  let hand:Object3D|undefined;
  gltf.scene.traverse((object:Object3D)=>{if(object.position.x>.18&&object.position.x<.22&&Math.abs(object.position.y-.48)<.01)hand=object});
  expect(hand).toBeDefined();
  const before=hand!.getWorldPosition(new Vector3());
  const copy=gltf.scene.clone(true);posePlaceholderArms(copy);
  const after=copy.getObjectByName(hand!.name).getWorldPosition(new Vector3());
  expect(after.y).toBeGreaterThan(before.y+.15);
  expect(after.z).toBeGreaterThan(before.z+.15);
  expect(hand!.getWorldPosition(new Vector3()).distanceTo(before)).toBe(0);
});
it('leaves replacement models untouched',()=>{
  const model=new Group();model.add(new Group());const before=model.toJSON();
  posePlaceholderArms(model);expect(model.toJSON()).toEqual(before);
});
