import { Bone, CylinderGeometry, Float32BufferAttribute, Skeleton, SkinnedMesh, Uint16BufferAttribute, Vector3, type Material } from 'three';
export function elasticProgress(t:number){
 const s=(x:number)=>{const v=Math.max(0,Math.min(1,x));return v*v*(3-2*v);};
 return s((t-1.05)/.5)*(1-s((t-1.85)/.8));
}
export function createElasticArm(material:Material){
 const geometry=new CylinderGeometry(.036,.038,1,10,32,true);geometry.rotateX(Math.PI/2);geometry.translate(0,0,.5);
 const p=geometry.getAttribute('position'),indices:number[]=[],weights:number[]=[];
 for(let i=0;i<p.count;i++){const f=Math.max(0,Math.min(1,p.getZ(i)))*4,lo=Math.min(3,Math.floor(f));indices.push(lo,lo+1,0,0);weights.push(1-(f-lo),f-lo,0,0);}
 geometry.setAttribute('skinIndex',new Uint16BufferAttribute(indices,4));geometry.setAttribute('skinWeight',new Float32BufferAttribute(weights,4));
 const bones=Array.from({length:5},(_,i)=>{const b=new Bone();b.name=`Luffy elastic joint ${i}`;if(i)b.position.z=.25;return b;});
 for(let i=1;i<5;i++)bones[i-1].add(bones[i]);
 const mesh=new SkinnedMesh(geometry,material);mesh.add(bones[0]);mesh.bind(new Skeleton(bones));mesh.castShadow=true;
 return {mesh,bones,geometry};
}
export function poseElasticArm(bones:Bone[],end:Vector3,stretch:number){
 const points=Array.from({length:5},(_,i)=>{const u=i/4;return end.clone().multiplyScalar(u).add(new Vector3(0,-.08*Math.sin(u*Math.PI)*(1-stretch),0));});
 for(let i=0;i<5;i++)bones[i].position.copy(i?points[i].clone().sub(points[i-1]):points[0]);
}
