import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { AdditiveBlending, Group, Mesh } from 'three';
import Figurine from './Figurine';
import TechniqueEnergy from './TechniqueEnergy';
import { hasReferenceEffect, isAnimatedCharacter, techniques } from './techniques';
import type { Character } from './types';
import { animationDuration, animationPose, type CharacterAnimation } from './characterAnimation';

/** Reference-inspired procedural performances, not imported skeletal clips. */
export default function CharacterPerformance({ character, animation, lowQuality, reducedMotion }: {
  character: Character; animation?: CharacterAnimation; lowQuality: boolean; reducedMotion: boolean;
}) {
  const body = useRef<Group>(null!);
  const effects = useRef<Group>(null!);
  const orb = useRef<Mesh>(null!);
  const elapsed = useRef(0);
  const started = useRef(0);
  const [playing, setPlaying] = useState(false);
  useEffect(() => { elapsed.current = 0; started.current = performance.now(); setPlaying(Boolean(animation)); }, [animation?.nonce, animation?.kind]);
  const naruto = character.id === 'naruto';
  const reference = hasReferenceEffect(character.id);
  const color = isAnimatedCharacter(character.id) ? techniques[character.id].color : '#899dff';
  useFrame((_, delta) => {
    if (!playing || !animation) {
      body.current.rotation.set(0, 0, 0); body.current.position.set(0, 0, 0); return;
    }
    elapsed.current = (performance.now() - started.current) / 1000;
    const pose = animationPose(animation.kind, elapsed.current, reducedMotion);
    body.current.rotation.x = pose.tilt * (animation.kind === 'defeat' && !naruto ? -1 : 1);
    body.current.position.set(0, pose.lift, pose.lunge);
    if (effects.current) {
      const intensity = Math.sin(pose.progress * Math.PI);
      effects.current.scale.setScalar(.25 + intensity * .85);
      effects.current.rotation.y = reducedMotion ? 0 : elapsed.current * (naruto ? 4 : .8);
      effects.current.traverse(object => {
        const material = (object as Mesh).material;
        for (const mat of Array.isArray(material) ? material : material ? [material] : []) {
          if ('opacity' in mat) mat.opacity = Math.min(.75, intensity * .85);
        }
      });
    }
    if (orb.current) orb.current.scale.setScalar(.85 + Math.sin(elapsed.current * 14) * (reducedMotion ? 0 : .07));
    if (elapsed.current >= animationDuration(animation.kind)) setPlaying(false);
  });
  return <>
    <group ref={body}><Figurine character={character}/></group>
    {playing && animation && <>
      <Html position={[0, naruto ? 1.85 : 2.8, 0]} center style={{ pointerEvents: 'none', whiteSpace: 'nowrap' }} zIndexRange={[25,0]}><span className="technique-label" style={{ borderColor: color, color }} role="status">{animation.kind === 'defeat' ? `${character.name.toUpperCase()} · DEFEATED` : isAnimatedCharacter(character.id) ? techniques[character.id].name : 'IMPACT'}</span></Html>
      <group ref={effects} raycast={()=>null}>
        {reference ? <TechniqueEnergy key={animation.nonce} characterId={animation.characterId} lowQuality={lowQuality} reducedMotion={reducedMotion} defeat={animation.kind==='defeat'}/> : animation.kind === 'attack' ? naruto ? <group position={[.32,.8,.48]}>
          <mesh ref={orb}><sphereGeometry args={[.23,lowQuality?12:24,16]}/><meshBasicMaterial color="#bfffff" transparent blending={AdditiveBlending} depthWrite={false}/></mesh>
          {[0,1,2].map(i=><mesh key={i} rotation={[i*1.1,i*.9,Math.PI/3]}><torusGeometry args={[.32+i*.055,.014,6,48]}/><meshBasicMaterial color={color} transparent blending={AdditiveBlending} depthWrite={false}/></mesh>)}
          {Array.from({length:lowQuality?10:24},(_,i)=><mesh key={i} position={[Math.cos(i*2.4)*(.35+i*.012),Math.sin(i*1.7)*.4,Math.sin(i*2.4)*.35]}><sphereGeometry args={[.018,6,4]}/><meshBasicMaterial color={color} transparent blending={AdditiveBlending} depthWrite={false}/></mesh>)}
          <pointLight color={color} intensity={2} distance={2.5}/>
        </group> : <group>
          {/* A translucent, towering rib cage echoes the supplied Susanoo reference. */}
          <mesh position={[0,1.35,-.15]}><sphereGeometry args={[1,16,12]}/><meshBasicMaterial color="#5978ff" wireframe transparent depthWrite={false}/></mesh>
          {[0,1,2,3,4].map(i=><mesh key={i} position={[0,.65+i*.29,-.12]} rotation={[Math.PI/2,0,0]} scale={[.85-i*.075,.6,1]}><torusGeometry args={[.82,.035,6,40,Math.PI*1.75]}/><meshBasicMaterial color="#9bbaff" transparent blending={AdditiveBlending} depthWrite={false}/></mesh>)}
          <mesh position={[0,2.65,-.12]} scale={[.65,1,.6]}><octahedronGeometry args={[.4]}/><meshBasicMaterial color="#a5c4ff" wireframe transparent depthWrite={false}/></mesh>
          {[-1,1].map(side=><mesh key={side} position={[side*.97,1.45,-.1]} rotation={[0,0,side*.35]}><capsuleGeometry args={[.14,.9,4,8]}/><meshBasicMaterial color="#809eff" wireframe transparent depthWrite={false}/></mesh>)}
          {Array.from({length:lowQuality?8:16},(_,i)=><mesh key={i} position={[Math.cos(i*2.4)*1.2,.15+(i%4)*.17,Math.sin(i*2.4)*1.2]} rotation={[i,i*.7,0]}><dodecahedronGeometry args={[.07+(i%3)*.03,0]}/><meshStandardMaterial color="#8390ae" transparent roughness={.9}/></mesh>)}
          <pointLight position={[0,1,0]} color={color} intensity={3} distance={4}/>
        </group> : <group>
          {Array.from({length:lowQuality?8:18},(_,i)=><mesh key={i} position={[Math.cos(i*2.4)*.6,.1+(i%3)*.15,Math.sin(i*2.4)*.6]}><sphereGeometry args={[.075,8,6]}/><meshBasicMaterial color={naruto?'#e1e7db':'#9496ba'} transparent depthWrite={false}/></mesh>)}
        </group>}
        <mesh position={[0,.08,0]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[.7,.75,lowQuality?24:48]}/><meshBasicMaterial color={color} transparent blending={AdditiveBlending} depthWrite={false} side={2}/></mesh>
      </group>
    </>}
  </>;
}
