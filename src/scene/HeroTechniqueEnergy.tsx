import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, CatmullRomCurve3, DoubleSide, Group, ShaderMaterial, Color, TubeGeometry, Vector3 } from 'three';
import { energyCrescent, lightningPath } from './heroGeometry';
import { heroTechniques, type HeroTechniqueId } from './techniques';

/** Full 3D, reference-inspired energy. All transforms are cosmetic and raycast-free. */
export default function HeroTechniqueEnergy({ characterId, lowQuality, reducedMotion, defeat }: {
  characterId: HeroTechniqueId; lowQuality: boolean; reducedMotion: boolean; defeat: boolean;
}) {
  const profile = heroTechniques[characterId], family = profile.family, color = profile.color;
  const root = useRef<Group>(null!), spiral = useRef<Group>(null!), strike = useRef<Group>(null!);
  const started = useRef(performance.now());
  const segments = lowQuality ? 28 : 64;
  const crescent = useMemo(() => energyCrescent(.85, .28, segments, family === 'fire', Math.PI * (family === 'slash' ? 1.12 : 1.6)), [segments, family]);
  const edge = useMemo(() => energyCrescent(.87, .035, segments, family === 'fire', Math.PI * (family === 'slash' ? 1.12 : 1.6)), [segments, family]);
  const lightning = useMemo(() => Array.from({length: lowQuality ? 3 : 6}, (_, i) => new TubeGeometry(new CatmullRomCurve3(lightningPath(i)), lowQuality ? 18 : 40, .012, 4)), [lowQuality]);
  const vortex = useMemo(() => Array.from({length: lowQuality ? 3 : 5}, (_, i) => {
    const points = Array.from({length: 48}, (_, j) => {
      const t = j / 47, a = t * Math.PI * 3.5 + i * Math.PI * 2 / 5, r = .12 + t * .8;
      return new Vector3(Math.cos(a) * r, Math.sin(a) * r, t * .25);
    });
    return new TubeGeometry(new CatmullRomCurve3(points), segments, .016 + i * .002, 5);
  }), [segments, lowQuality]);
  const vortexMaterial = useMemo(() => new ShaderMaterial({
    transparent: true, depthWrite: false, side: DoubleSide, blending: AdditiveBlending,
    uniforms: { time: {value: 0}, opacity: {value: .7}, tint: {value: new Color(color)} },
    vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `varying vec2 vUv; uniform float time; uniform float opacity; uniform vec3 tint;
      void main(){
        vec2 p=(vUv-.5)*2.; float r=length(p); float a=atan(p.y,p.x);
        float spiral=pow(.5+.5*sin(a*5.-log(r+.08)*8.+time*1.5),2.);
        float wisps=.65+.35*sin(p.x*21.+sin(p.y*17.)+time);
        float mask=(1.-smoothstep(.65,1.,r))*smoothstep(.18,.38,r);
        float alpha=mask*(.16+spiral*.65)*wisps*opacity;
        vec3 tone=mix(tint,vec3(.95,.35,.9),spiral*.6);
        gl_FragColor=vec4(tone*(.6+spiral*.8),alpha);
        #include <colorspace_fragment>
      }`,
  }), [color]);
  useEffect(() => () => vortexMaterial.dispose(), [vortexMaterial]);
  useEffect(() => () => { crescent.dispose(); edge.dispose(); lightning.forEach(g => g.dispose()); vortex.forEach(g => g.dispose()); }, [crescent, edge, lightning, vortex]);
  useEffect(() => { root.current.traverse(object => { object.raycast = () => {}; }); }, []);
  useFrame(() => {
    const t = (performance.now() - started.current) / 1000;
    vortexMaterial.uniforms.opacity.value = vortexMaterial.opacity;
    vortexMaterial.uniforms.time.value = reducedMotion ? 0 : t;
    if (reducedMotion) return;
    spiral.current.rotation.z = t * (family === 'void' ? -2.4 : 1.5);
    spiral.current.rotation.y = family === 'wind' ? t * 1.2 : 0;
    strike.current.position.x = (family === 'punch' || family === 'charged-punch' || family === 'beam') ? Math.sin(Math.min(1, t / 1.2) * Math.PI / 2) * .3 : 0;
    const pulse = 1 + Math.sin(t * 4) * .04;
    root.current.scale.setScalar((defeat ? .65 : 1) * pulse);
  });
  const glow = (tone: string = color, alpha = .8) => <meshBasicMaterial color={tone} transparent userData={{alpha}} opacity={alpha} blending={AdditiveBlending} side={DoubleSide} depthWrite={false} toneMapped={false}/>;
  const dark = (tone = '#100c21') => <meshBasicMaterial color={tone} transparent userData={{alpha:.95}} opacity={.95} side={DoubleSide} depthWrite={false}/>;
  const slash = family === 'slash' || family === 'fire' || family === 'wind';
  const punch = family === 'punch' || family === 'charged-punch';
  return <group ref={root} data-hero-effect={characterId}>
    <group ref={spiral}>
      {slash && <>
        {Array.from({length:family === 'wind' ? 3 : 2}, (_, i) => <group key={i} rotation={[family === 'wind' ? i * .7 : .2, i * .45, family === 'slash' ? i * .08 : i * 2.1]} scale={1 - i * .15}>
          <mesh geometry={crescent}>{glow(color, .55)}</mesh>
          <mesh geometry={edge} position={[0,0,.015]}>{glow(family === 'fire' ? '#ffe483' : '#edffff')}</mesh>
          {[.8,.64].map((s,j)=><mesh key={s} geometry={edge} scale={s} position={[0,0,-.04-j*.06]}>{glow(color,.45-j*.1)}</mesh>)}
          {Array.from({length:lowQuality?4:10}, (_, j) => <mesh key={j} position={[Math.cos(j*.38-1.7)*.82,Math.sin(j*.38-1.7)*.82,-j*.03]} rotation={[0,0,j*.38]} scale={[family==='fire'?.12:.04,.3,.04]}><octahedronGeometry args={[1]}/>{glow(family==='fire'?'#ffcf61':color,.65)}</mesh>)}
        </group>)}
      </>}
      {family === 'void' && <>
        {/* Dark center plus luminous spiral arms recreate the supplied vortex silhouette. */}
        <mesh position={[0,0,-.03]}><planeGeometry args={[2.1,2.1]}/><primitive object={vortexMaterial} attach="material"/></mesh>
        <mesh><sphereGeometry args={[characterId==='yami'?.38:.28,lowQuality?16:32,16]}/>{dark('#090516')}</mesh>
        <mesh rotation={[Math.PI/2,0,0]}><torusGeometry args={[.33,.022,6,segments]}/>{glow('#f3d7ff')}</mesh>
        {vortex.map((geometry,i)=><mesh geometry={geometry} key={i} rotation={[.2,.25,i*.18]}>{glow(i%2 ? '#e99bff' : color,.4)}</mesh>)}
        {[0,1,2].map(i=><mesh key={i} rotation={[i*.75,.4,i]}><torusGeometry args={[.56+i*.15,.015,5,segments,Math.PI*1.7]}/>{glow(color,.45)}</mesh>)}
        {Array.from({length:lowQuality?6:14},(_,i)=><mesh key={i} position={[Math.cos(i*2.4)*.87,Math.sin(i*2.4)*.87,Math.sin(i)*.2]} rotation={[i,i,0]}><dodecahedronGeometry args={[.04+i%3*.02]}/>{dark('#615477')}</mesh>)}
      </>}
      {family === 'magic' && <group rotation={[0,.3,0]}>
        {[.35,.58,.76,.82].map((r,i)=><mesh key={r}><torusGeometry args={[r,.009+i*.002,4,segments]}/>{glow(i%2?color:'#d7ffc6',.65)}</mesh>)}
        {[0,Math.PI].map((r,i)=><mesh key={i} rotation={[0,0,r]}><ringGeometry args={[.53,.55,3]}/>{glow('#c7ffb0')}</mesh>)}
        {Array.from({length:lowQuality?12:24},(_,i)=><mesh key={i} position={[Math.cos(i*Math.PI/12)*.7,Math.sin(i*Math.PI/12)*.7,0]} rotation={[0,0,i*Math.PI/12]}><boxGeometry args={[.025,.07,.008]}/>{glow(color)}</mesh>)}
        {[0,1,2].map(i=><mesh key={i} geometry={edge} scale={.8} rotation={[i*.8,.5,i*2]}>{glow('#79efc6',.6)}</mesh>)}
      </group>}
    </group>
    <group ref={strike}>
      {family === 'beam' && <group rotation={[0,0,-Math.PI/2]}>
        <mesh position={[0,.55,0]}><cylinderGeometry args={[.18,.12,1.8,lowQuality?12:24,1,true]}/>{glow('#dbffff',.9)}</mesh>
        <mesh position={[0,.55,0]}><cylinderGeometry args={[.3,.21,1.8,16,1,true]}/>{glow(color,.3)}</mesh>
        {[-.35,.4,1.15].map((y,i)=><group key={y} position={[0,y,0]}>
          <mesh><sphereGeometry args={[i===2?.29:.24,16,12]}/>{glow('#dfffff',.65)}</mesh>
          <mesh rotation={[Math.PI/2,0,0]}><torusGeometry args={[.4+i*.08,.016,5,segments]}/>{glow(color,.65)}</mesh>
        </group>)}
        {lightning.map((geometry,i)=><mesh key={i} geometry={geometry} position={[Math.sin(i*2)*.3,.5,Math.cos(i*2)*.3]}>{glow(i%2?'#f1ffff':color,.7)}</mesh>)}
      </group>}
      {punch && <group position={[.25,0,0]} rotation={[0,0,-Math.PI/2]}>
        <mesh position={[0,-.35,0]}><cylinderGeometry args={[.16,.1,1.1,12]}/>{family === 'punch'?dark('#251e28'):glow('#ff9026',.45)}</mesh>
        <group position={[0,.3,0]}>
          <mesh><sphereGeometry args={[.36,16,12]}/>{family==='punch'?dark('#161a28'):glow('#ffb82e',.7)}</mesh>
          {[-1.5,-.5,.5,1.5].map((x,i)=><mesh key={x} position={[x*.145,.23,.08]} rotation={[.1,0,0]}><capsuleGeometry args={[.09,.17,3,8]}/>{family==='punch'?dark('#272e3c'):glow(i%2?'#ffe47a':'#ffb325')}</mesh>)}
          <mesh position={[-.26,.02,.2]} rotation={[0,0,.5]}><capsuleGeometry args={[.11,.2,3,8]}/>{family==='punch'?dark('#323b49'):glow('#fff0a3')}</mesh>
          {[-1,1].map(side=><mesh key={side} geometry={edge} scale={.55} rotation={[.3,side*.8,side]}>{glow(family==='punch'?'#ff5a3a':'#fff3a6',.8)}</mesh>)}
        </group>
        {[0,1,2].map(i=><mesh key={i} position={[0,-.4+i*.3,0]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[.26+i*.06,.012,4,segments]}/>{glow(color,.6)}</mesh>)}
      </group>}
      {family === 'lightning' && <>
        {lightning.map((geometry,i)=><group key={i} position={[Math.cos(i*2.4)*.35,0,Math.sin(i*2.4)*.25]} rotation={[0,0,characterId==='zenitsu'?Math.PI/2:.18*Math.sin(i)]}>
          <mesh geometry={geometry}>{glow(color,.7)}</mesh>
          <mesh geometry={geometry} scale={[.55,1,.55]}>{glow('#f2ffff',.95)}</mesh>
        </group>)}
        {[-.75,.75].map(y=><mesh key={y} position={[0,y,0]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[.31,.015,5,segments]}/>{glow(characterId==='zenitsu'?'#ffeaae':color)}</mesh>)}
      </>}
    </group>
  </group>;
}
