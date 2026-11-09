import {it,expect} from 'vitest';
import {MeshStandardMaterial,Vector3} from 'three';
import {createElasticArm,elasticProgress,poseElasticArm} from '../src/scene/elasticArm';
it('keeps shoulder pinned and reaches the requested endpoint with normalized skin weights',()=>{
 const material=new MeshStandardMaterial();const rig=createElasticArm(material);
 const weights=rig.geometry.getAttribute('skinWeight');
 for(let i=0;i<weights.count;i++)expect(weights.getX(i)+weights.getY(i)).toBeCloseTo(1);
 const target=new Vector3(.1,-.1,1.7);poseElasticArm(rig.bones,target,1);
 rig.mesh.updateMatrixWorld(true);
 expect(rig.mesh.isSkinnedMesh).toBe(true);
 expect(rig.bones[0].position.length()).toBe(0);
 expect(rig.bones[4].getWorldPosition(new Vector3()).distanceTo(target)).toBeLessThan(.00001);
 expect(elasticProgress(0)).toBe(0);expect(elasticProgress(1.55)).toBe(1);expect(elasticProgress(3)).toBe(0);
 rig.geometry.dispose();material.dispose();rig.mesh.skeleton.dispose();
});
