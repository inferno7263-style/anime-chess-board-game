import {useEffect,useMemo,useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import {Group,MeshStandardMaterial,Vector3} from 'three';
import {createElasticArm,elasticProgress,poseElasticArm} from './elasticArm';
/** Mounted INSIDE the facing figurine: shoulder and skin move with its body. */
export default function LuffyElasticArm({time,target}:{time:{current:number};target?:Vector3}){
 const shoulder=useRef<Group>(null!),fist=useRef<Group>(null!);
 const material=useMemo(()=>new MeshStandardMaterial({color:'#ddba9d',roughness:.7}),[]);
 const rig=useMemo(()=>createElasticArm(material),[material]);
 useEffect(()=>()=>{rig.geometry.dispose();rig.mesh.skeleton.dispose();material.dispose();},[rig,material]);
 useFrame(()=>{
  shoulder.current.updateWorldMatrix(true,false);
  const world=target?.clone()??shoulder.current.parent!.localToWorld(new Vector3(.12,.76,1.15));
  const goal=shoulder.current.worldToLocal(world);
  const p=elasticProgress(time.current);
  const rest=new Vector3(.04,-.23,.06-.18*Math.sin(Math.min(1,time.current/1.05)*Math.PI/2)*(1-p));
  const end=rest.lerp(goal,p);poseElasticArm(rig.bones,end,p);
  fist.current.position.copy(end);
  fist.current.quaternion.setFromUnitVectors(new Vector3(0,0,1),end.clone().normalize());
 });
 return <group ref={shoulder} position={[.12,.84,0]}>
  <primitive object={rig.mesh}/>
  <group ref={fist}>
   <mesh castShadow material={material}><sphereGeometry args={[.057,12,8]}/></mesh>
   {[-1.5,-.5,.5,1.5].map(i=><mesh key={i} position={[i*.024,0,.033]} castShadow material={material}><capsuleGeometry args={[.019,.04,3,6]}/></mesh>)}
   <mesh position={[-.052,-.02,0]} castShadow material={material}><sphereGeometry args={[.026,8,6]}/></mesh>
  </group>
 </group>;
}
