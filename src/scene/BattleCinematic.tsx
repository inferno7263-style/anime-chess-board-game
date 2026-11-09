import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { AdditiveBlending, Group, Mesh, PerspectiveCamera, Quaternion, Vector3 } from 'three';
import Figurine from './Figurine';
import TechniqueEnergy from './TechniqueEnergy';
import { hasReferenceEffect, isAnimatedCharacter, techniques } from './techniques';
import { battleFrame, contactPoint, IMPACT_AT, type BattleEvent } from './battleTimeline';

export type CameraView = { position: Vector3; rotation: Quaternion; fov: number };
type Props = { originalView: CameraView; battle: BattleEvent; lowQuality: boolean; onReveal: () => void; onDone: () => void };

/** A cosmetic close-up. It cannot alter board pieces, history or server state. */
export default function BattleCinematic({ originalView, battle, lowQuality, onReveal, onDone }: Props) {
  const { camera } = useThree();
  const saved = originalView;
  const shot = useMemo(() => {
    const view = new PerspectiveCamera(); view.position.set(1.2, 2.15, 4.6); view.lookAt(.4, 1.05, 0);
    return { position: view.position.clone(), rotation: view.quaternion.clone() };
  }, []);
  const started = useRef(performance.now());
  const finished = useRef(false), revealed = useRef(false);
  const attacker = useRef<Group>(null!), victim = useRef<Group>(null!), orb = useRef<Group>(null!), aura = useRef<Group>(null!), impact = useRef<Group>(null!);
  const [phase, setPhase] = useState('focus');
  const phaseRef = useRef('focus');
  const [returning, setReturning] = useState(false);
  const naruto = battle.attacker.character.id === 'naruto';
  const madara = battle.attacker.character.id === 'madara';
  const characterId=battle.attacker.character.id;
  const reference=hasReferenceEffect(characterId) && isAnimatedCharacter(characterId);
  const effectId=battle.kind==='defeat'?battle.victim.character.id:characterId;
  const color=isAnimatedCharacter(effectId)?techniques[effectId].color:'#9daaff';
  const target = useMemo(() => new Vector3(...contactPoint(battle.victim)), [battle.victim]);
  const charge = useMemo(() => new Vector3(-.58, .75, .18), []);
  useEffect(() => () => {
    camera.position.copy(saved.position); camera.quaternion.copy(saved.rotation);
    (camera as PerspectiveCamera).fov = saved.fov; camera.updateProjectionMatrix();
  }, [camera, saved]);
  useFrame(() => {
    if (finished.current) return;
    const elapsed = (performance.now() - started.current) / 1000;
    const f = battleFrame(elapsed);
    if (phaseRef.current !== f.phase) { phaseRef.current = f.phase; setPhase(f.phase); }
    camera.position.copy(saved.position).lerp(shot.position, f.enter);
    camera.quaternion.copy(saved.rotation).slerp(shot.rotation, f.enter);
    const closeFov = (camera as PerspectiveCamera).aspect < 1 ? 48 : 36;
    (camera as PerspectiveCamera).fov = saved.fov + (closeFov - saved.fov) * f.enter;
    if (f.returning) {
      camera.position.copy(shot.position).lerp(saved.position, f.exit);
      camera.quaternion.copy(shot.rotation).slerp(saved.rotation, f.exit);
      (camera as PerspectiveCamera).fov = closeFov + (saved.fov - closeFov) * f.exit;
      if (!revealed.current) { revealed.current = true; setReturning(true); onReveal(); }
    }
    camera.updateProjectionMatrix();
    const attack = battle.kind === 'attack';
    attacker.current.position.x = -.9 + (attack ? f.approach * 1.3 : 0);
    attacker.current.rotation.x = attack ? -.2 * Math.sin(f.approach * Math.PI) : 0;
    victim.current.rotation.x = -1.4 * f.fall;
    victim.current.position.y = -.02 * f.fall;
    orb.current.position.copy(charge).lerp(target, attack ? f.approach : 1);
    orb.current.rotation.set(reference?0:elapsed * 3, reference?0:elapsed * 5, reference?0:elapsed * 2);
    if(reference && battle.kind==='attack'){
      attacker.current.rotation.z=characterId==='mikasa'?Math.sin(f.approach*Math.PI)*.6:0;
      attacker.current.position.y=characterId==='mikasa'?.35*Math.sin(f.approach*Math.PI):characterId==='nezuko'?.16*Math.sin(f.approach*Math.PI):0;
    }
    const energy = elapsed < .65 ? 0 : elapsed < IMPACT_AT ? Math.min(1,(elapsed-.65)*2.5) : Math.max(0,1-(elapsed-IMPACT_AT)/.55);
    orb.current.scale.setScalar(Math.max(.001, attack ? energy : 0));
    aura.current.scale.setScalar(Math.max(.001, attack && madara ? energy : 0));
    impact.current.visible = elapsed >= IMPACT_AT && elapsed < RETURN_CUTOFF;
    impact.current.scale.setScalar(.2 + f.fall * 1.1);
    impact.current.traverse(object => {
      const materials = (object as Mesh).material;
      for (const m of Array.isArray(materials) ? materials : materials ? [materials] : []) m.opacity = Math.max(0, .85 * (1 - f.fall));
    });
    if (f.done) { finished.current = true; onDone(); }
  });
  return <>
    <Html fullscreen position={[.4,1.05,0]} style={{pointerEvents:'none'}} zIndexRange={[25,0]}><div className="battle-title" data-testid="battle-cinematic" data-phase={phase}><span>{battle.preview?'ANIMATION PREVIEW':'CONFIRMED BATTLE'}</span><strong>{battle.kind==='attack' ? isAnimatedCharacter(characterId)?techniques[characterId].name:'FINAL IMPACT' : 'DEFEAT'}</strong><small>{battle.attacker.character.name} <i>vs</i> {battle.victim.character.name}</small></div></Html>
    <group visible={!returning} raycast={()=>null}>
      <mesh position={[0,-.08,0]} receiveShadow><cylinderGeometry args={[2.7,2.9,.12,64]}/><meshStandardMaterial color="#151d25" metalness={.35} roughness={.6}/></mesh>
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.01,0]}><ringGeometry args={[2.4,2.42,64]}/><meshBasicMaterial color="#607c9c" transparent opacity={.45}/></mesh>
      <group ref={attacker} position={[-.9,0,0]}><group rotation={[0,Math.PI/2,0]}><Figurine character={battle.attacker.character} attackPose={battle.kind==='attack' && (naruto||madara||reference)}/></group></group>
      <group position={[.88,0,0]} rotation={[0,-Math.PI/2,0]}><group ref={victim}><Figurine character={battle.victim.character}/></group></group>
      <group ref={orb}>
        {reference ? <TechniqueEnergy characterId={characterId} lowQuality={lowQuality} cinematic/> : naruto ? <>
          <mesh><sphereGeometry args={[.22,lowQuality?12:24,16]}/><meshBasicMaterial color="#caffff" transparent opacity={.95} blending={AdditiveBlending} depthWrite={false}/></mesh>
          {[0,1,2,3].map(i=><mesh key={i} rotation={[i*.85,i*.7,i]}><torusGeometry args={[.27+i*.025,.013,6,48]}/><meshBasicMaterial color={color} transparent blending={AdditiveBlending} depthWrite={false}/></mesh>)}
          {Array.from({length:lowQuality?12:28},(_,i)=><mesh key={i} position={[Math.sin(i*2.4)*.38,Math.cos(i*1.7)*.3,Math.cos(i*2.4)*.38]}><sphereGeometry args={[.016,6,4]}/><meshBasicMaterial color={color} blending={AdditiveBlending}/></mesh>)}
        </> : <group rotation={[0,0,-Math.PI/2]}>
          <mesh><boxGeometry args={[.25,.34,.1]}/><meshBasicMaterial color="#b5caff" transparent opacity={.8} wireframe/></mesh>
          {[-2,-1,0,1,2].map(i=><mesh key={i} position={[i*.065,.23,0]} rotation={[0,0,-i*.1]}><capsuleGeometry args={[.035,.23,3,6]}/><meshBasicMaterial color="#c4d2ff" transparent blending={AdditiveBlending}/></mesh>)}
        </group>}
        <pointLight color={color} intensity={3} distance={3}/>
      </group>
      <group ref={aura} position={[-1,0,-.4]}>
        {[0,1,2,3,4].map(i=><mesh key={i} position={[0,.65+i*.29,0]} rotation={[Math.PI/2,0,0]} scale={[.9-i*.08,.5,1]}><torusGeometry args={[.78,.035,6,40,Math.PI*1.8]}/><meshBasicMaterial color="#94b6ff" transparent opacity={.6} blending={AdditiveBlending} depthWrite={false}/></mesh>)}
        <mesh position={[0,2.3,0]} scale={[.65,1,.6]}><octahedronGeometry args={[.36]}/><meshBasicMaterial color="#bfd6ff" wireframe transparent opacity={.7}/></mesh>
      </group>
      {battle.kind==='defeat' && hasReferenceEffect(effectId) && isAnimatedCharacter(effectId) && <group position={[.88,0,0]}><TechniqueEnergy characterId={effectId} lowQuality={lowQuality} cinematic defeat/></group>}
      <group ref={impact} position={target} visible={false}>
        <mesh><sphereGeometry args={[.3,12,8]}/><meshBasicMaterial color={color} wireframe transparent blending={AdditiveBlending} depthWrite={false}/></mesh>
        {[0,1,2].map(i=><mesh key={i} rotation={[i*.8,Math.PI/2,i]}><torusGeometry args={[.45+i*.15,.025,6,32]}/><meshBasicMaterial color={color} transparent blending={AdditiveBlending} depthWrite={false}/></mesh>)}
        {Array.from({length:lowQuality?10:22},(_,i)=><mesh key={i} position={[Math.cos(i*2.4)*.8,Math.sin(i*1.3)*.5,Math.sin(i*2.4)*.65]} rotation={[i,i*.7,0]}><dodecahedronGeometry args={[.025+(i%3)*.015,0]}/><meshBasicMaterial color={i%2?color:'#a9b3c0'} transparent depthWrite={false}/></mesh>)}
      </group>
    </group>
  </>;
}
const RETURN_CUTOFF = 3.35;
