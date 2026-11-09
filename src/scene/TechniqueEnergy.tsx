import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, CanvasTexture, BufferGeometry, DoubleSide, Float32BufferAttribute, Group, Mesh, TubeGeometry, CatmullRomCurve3, Vector3 } from 'three';
import HeroTechniqueEnergy from './HeroTechniqueEnergy';
import { heroTechniques, techniques, type HeroTechniqueId, type AnimatedCharacterId } from './techniques';

/** A tapered three-dimensional slash ribbon, rather than a closed neon hoop. */
function slashGeometry(radius: number, width: number, sweep: number, segments: number) {
  const vertices: number[] = [], indices: number[] = [];
  for (let i=0;i<=segments;i++) {
    const t=i/segments, angle=(t-.5)*sweep, taper=Math.pow(Math.sin(t*Math.PI),.65);
    for (const r of [radius-width*taper,radius]) vertices.push(Math.cos(angle)*r,Math.sin(angle)*r,0);
    if(i<segments){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
  }
  const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}

export default function TechniqueEnergy({ characterId, lowQuality, reducedMotion=false, cinematic=false, defeat=false }: {
  characterId: AnimatedCharacterId; lowQuality: boolean; reducedMotion?: boolean; cinematic?: boolean; defeat?: boolean;
}) {
  const root=useRef<Group>(null!), blade=useRef<Group>(null!), particles=useRef<Group>(null!);
  const started=useRef(performance.now());
  useEffect(()=>{root.current?.traverse(object=>{object.raycast=()=>{};});},[]);
  const halo=useMemo(()=>{
    const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
    const ctx=canvas.getContext('2d')!;
    const gradient=ctx.createRadialGradient(64,64,0,64,64,64);
    gradient.addColorStop(0,'rgba(255,255,255,.7)');
    gradient.addColorStop(.25,'rgba(255,255,255,.3)');
    gradient.addColorStop(.6,'rgba(255,255,255,.08)');
    gradient.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);
    return new CanvasTexture(canvas);
  },[]);
  useEffect(()=>()=>halo.dispose(),[halo]);
  const color=techniques[characterId].color;
  const asta=characterId==='asta',mikasa=characterId==='mikasa',nezuko=characterId==='nezuko';
  const ribbons=useMemo(()=>[slashGeometry(.72,.24,Math.PI*1.65,lowQuality?24:64),slashGeometry(.74,.025,Math.PI*1.68,lowQuality?24:64)],[lowQuality]);
  const bolts=useMemo(()=>Array.from({length:lowQuality?3:6},(_,i)=>{
    const points=Array.from({length:10},(_,j)=>new Vector3(Math.sin(j*4.1+i*2)*(.06+j*.008),j*.15-.55,Math.cos(j*3.3+i)*.09));
    return new TubeGeometry(new CatmullRomCurve3(points),lowQuality?16:36,.008,4,false);
  }),[lowQuality]);
  useEffect(()=>()=>{ribbons.forEach(g=>g.dispose());bolts.forEach(g=>g.dispose());},[ribbons,bolts]);
  useFrame(()=>{
    const t=(performance.now()-started.current)/1000;
    const duration=cinematic?3.35:2.4, p=Math.min(1,t/duration);
    const envelope=cinematic?Math.min(1,t/.7)*Math.max(0,1-(t-2.15)/1.2):Math.sin(p*Math.PI);
    root.current.visible=envelope>.015;
    root.current.scale.setScalar((cinematic?.9:.6)*(defeat?.75:1));
    root.current.traverse(object=>{
      const material=(object as Mesh).material;
      for(const mat of Array.isArray(material)?material:material?[material]:[]){
        if(mat.transparent)mat.opacity=envelope*(mat.userData.alpha??.85);
      }
    });
    if(!reducedMotion){
      // New Hero families animate internally: keep beams aimed at the target
      // and crescent / vortex faces visible instead of rotating them edge-on.
      if (characterId in heroTechniques) blade.current.rotation.set(0,0,0);
      else blade.current.rotation.set(mikasa?t*2.5:Math.sin(t*3)*.18,nezuko?t*1.8:t*.65,asta?-.65+Math.sin(t*4)*.3:t*.35);
      particles.current.rotation.y=t*(mikasa?-1.8:.6);
      particles.current.children.forEach((particle,i)=>{
        particle.position.y=.1+((t*.55+i*.19)%1.8);
        particle.scale.setScalar(.5+Math.sin(t*3+i)*.25);
      });
    }
  });
  const glow=(tone: string=color,alpha=.85)=><meshBasicMaterial color={tone} transparent opacity={alpha} userData={{alpha}} blending={AdditiveBlending} depthWrite={false} side={DoubleSide} toneMapped={false}/>;
  return <group ref={root} raycast={()=>null}>
    <group ref={blade} position={[0,.65,0]}>
      {characterId==='luffy' ? null : characterId in heroTechniques ? <HeroTechniqueEnergy characterId={characterId as HeroTechniqueId} lowQuality={lowQuality} reducedMotion={reducedMotion} defeat={defeat}/> : mikasa ? <>{[0,1,2].map(i=><group key={i} rotation={[i*.95,.3+i*.6,i*2.1]} scale={1+i*.13}>
        <mesh geometry={ribbons[0]}><meshBasicMaterial color="#4e0c08" side={DoubleSide} transparent userData={{alpha:.8}} depthWrite={false}/></mesh>
        <mesh geometry={ribbons[1]} position={[0,0,.008]}>{glow('#ffc16b')}</mesh>
        <mesh geometry={ribbons[1]} scale={.95} position={[0,0,.012]}>{glow('#fff2c2')}</mesh>
      </group>)}{[-1,1].map(side=><mesh key={side} position={[side*.52,0,0]} rotation={[0,0,side*.8]}><boxGeometry args={[.025,.8,.04]}/>{glow('#fff1d5')}</mesh>)}</> : nezuko ? <>
        <mesh><sphereGeometry args={[.36,lowQuality?16:32,20]}/><meshBasicMaterial color="#721148" transparent userData={{alpha:.45}} depthWrite={false}/></mesh>
        <mesh><sphereGeometry args={[.12,12,8]}/>{glow('#fff1ff')}</mesh>
        {[0,1,2].map(i=><mesh key={i} rotation={[i*.9,i*.7,.3]}><torusGeometry args={[.42+i*.04,.018,6,lowQuality?24:64,Math.PI*1.8]}/>{glow(i===0?'#fff1ff':color)}</mesh>)}
        {Array.from({length:lowQuality?6:12},(_,i)=><mesh key={i} position={[Math.cos(i*2.4)*.43,Math.sin(i*1.7)*.4,Math.sin(i*2.4)*.4]} rotation={[i,0,i*.7]} scale={[1,2,1]}><octahedronGeometry args={[.1,0]}/>{glow('#ff34c5',.65)}</mesh>)}
      </> : <>
        {/* Broad anti-magic blade vs paired shadow daggers. */}
        {(asta?[0]:[-1,1]).map(side=><group key={side} position={[side*.27,0,0]} rotation={[0,0,side*.4]}>
          <mesh position={[0,.18,0]}><boxGeometry args={[asta?.19:.09,asta?1.3:.94,.045]}/><meshStandardMaterial color={asta?'#14070b':'#252040'} metalness={.85} roughness={.25}/></mesh>
          <mesh position={[0,asta?.92:.72,0]}><coneGeometry args={[asta?.135:.065,.25,4]}/>{glow(asta?'#ff5e2e':'#dbcaff')}</mesh>
          {[-1,1].map(edge=><mesh key={edge} position={[edge*(asta?.105:.055),.2,0]}><boxGeometry args={[.012,asta?1.4:1.05,.055]}/>{glow(asta?'#ff6b2e':'#dbcaff')}</mesh>)}
          <mesh position={[0,-.45,0]}><boxGeometry args={[.33,.06,.12]}/><meshStandardMaterial color="#322b42" metalness={.75}/></mesh>
          {bolts.map((geometry,i)=><mesh key={i} geometry={geometry} position={[Math.sin(i*2)*.2,.2,Math.cos(i*2)*.12]} rotation={[0,i,0]}>{glow(i%2?color:asta?'#ffba30':'#e8caff')}</mesh>)}
        </group>)}
        {asta&&[0,1].map(i=><mesh key={i} geometry={ribbons[0]} rotation={[i*.8,.4,i*2]} scale={1.25}><meshBasicMaterial color="#360509" side={DoubleSide} transparent userData={{alpha:.8}} depthWrite={false}/></mesh>)}
      </>}
    </group>
    <sprite position={[0,.85,0]} scale={nezuko?[1.8,1.8,1]:[1.2,2,1]}><spriteMaterial map={halo} color={color} transparent blending={AdditiveBlending} userData={{alpha:.6}} depthWrite={false} toneMapped={false}/></sprite>
    <group ref={particles}>{Array.from({length:lowQuality?8:20},(_,i)=><mesh key={i} position={[Math.cos(i*2.4)*(.4+i%3*.12),i*.09,Math.sin(i*2.4)*(.4+i%3*.12)]} rotation={[i,i*.8,0]}><octahedronGeometry args={[nezuko?.07:.025,0]}/>{glow(i%3===0?'#fff0e2':color,.7)}</mesh>)}</group>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,.07,0]}><ringGeometry args={[.56,.59,lowQuality?24:64]}/>{glow(color,.55)}</mesh>
    {nezuko&&<mesh rotation={[-Math.PI/2,0,0]} position={[0,.08,0]} geometry={ribbons[0]} scale={1.2}>{glow('#ff42d5',.55)}</mesh>}
    <pointLight color={color} intensity={reducedMotion?.4:1.7} distance={2.7}/>
  </group>;
}
