import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Billboard, Html, Line, OrbitControls, RoundedBox } from '@react-three/drei'
import { CanvasTexture, Group, MOUSE, PerspectiveCamera, Plane, SRGBColorSpace, Vector3 } from 'three'
import type { Square } from 'chess.js'
import Figurine from './Figurine'
import CharacterPerformance from './CharacterPerformance'
import BattleCinematic, { type CameraView } from './BattleCinematic'
import { captureBattle, type BattleEvent } from './battleTimeline'
import { capturePerformer, type CharacterAnimation } from './characterAnimation'
import type { BoardPiece, ChessSceneProps } from './types'
import { getSceneFov, sceneCameraPosition, sceneCameraTarget } from './camera'

export const squarePosition = (square: Square): [number, number, number] => [square.charCodeAt(0)-100.5,0,4.5-Number(square[1])]
const pointSquare = (point: Vector3): Square | null => {
  const file = Math.floor(point.x+4), rank = 8-Math.floor(point.z+4)
  return file >= 0 && file < 8 && rank >= 1 && rank <= 8 ? `${String.fromCharCode(97+file)}${rank}` as Square : null
}
const dragPlane = new Plane(new Vector3(0,1,0),-.1)

function marbleTexture(light: boolean) {
  const canvas = document.createElement('canvas'); canvas.width=256; canvas.height=256
  const context = canvas.getContext('2d')!
  context.fillStyle=light ? '#b7b5aa' : '#252b2b'; context.fillRect(0,0,256,256)
  let seed=light?13:78
  const rand=()=>{seed=(seed*16807)%2147483647;return seed/2147483647}
  for(let i=0;i<48;i++){
    context.beginPath(); const y=rand()*400-80
    context.moveTo(-20,y)
    context.bezierCurveTo(80,y+rand()*80-40,160,y+rand()*100,280,y+rand()*130)
    context.lineWidth=rand()*1.7+.2
    context.strokeStyle=light?`rgba(65,70,72,${rand()*.13})`:`rgba(155,173,163,${rand()*.09})`
    context.stroke()
  }
  const texture=new CanvasTexture(canvas); texture.colorSpace=SRGBColorSpace
  return texture
}

function Coordinate({ text, position, rotate=false }: {text:string;position:[number,number,number];rotate?:boolean}) {
  const texture=useMemo(()=>{
    const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128
    const context=canvas.getContext('2d')!;context.font='500 65px Georgia';context.textAlign='center';context.textBaseline='middle';context.fillStyle='#9e9580';context.fillText(text,64,68)
    const result=new CanvasTexture(canvas);result.colorSpace=SRGBColorSpace;return result
  },[text])
  useEffect(()=>()=>texture.dispose(),[texture])
  return <mesh position={position} rotation={[-Math.PI/2,0,rotate?Math.PI:0]}><planeGeometry args={[.32,.32]}/><meshBasicMaterial map={texture} transparent depthWrite={false}/></mesh>
}

function Board({selected,legalSquares,onSquareClick,lastMove,occupiedSquares,captureSquares=[]}:Pick<ChessSceneProps,'selected'|'legalSquares'|'onSquareClick'|'lastMove'|'captureSquares'>&{occupiedSquares:Square[]}) {
  const [preview,setPreview]=useState<Square|null>(null)
  const textures=useMemo(()=>[marbleTexture(true),marbleTexture(false)],[])
  useEffect(()=>()=>textures.forEach(t=>t.dispose()),[textures])
  return <group>
    {selected&&preview&&legalSquares.includes(preview)&&<Line points={[new Vector3(...squarePosition(selected)).setY(.14),new Vector3(...squarePosition(preview)).setY(.14)]} color={captureSquares.includes(preview)?'#ff8174':'#a2ffe4'} lineWidth={3} dashed dashSize={.16} gapSize={.09}/>}
    <RoundedBox args={[9.12,.44,9.12]} radius={.09} smoothness={3} position={[0,-.28,0]} receiveShadow castShadow><meshStandardMaterial color="#181b1c" metalness={.55} roughness={.32}/></RoundedBox>
    <RoundedBox args={[8.98,.025,8.98]} radius={.008} smoothness={2} position={[0,-.045,0]}><meshStandardMaterial color="#88744c" metalness={.85} roughness={.3}/></RoundedBox>
    <RoundedBox args={[8.85,.065,8.85]} radius={.012} smoothness={2} position={[0,-.025,0]} receiveShadow><meshStandardMaterial color="#252624" roughness={.36} metalness={.35}/></RoundedBox>
    {Array.from({length:64},(_,i)=>{
      const file=i%8,rank=Math.floor(i/8)+1,square=`${String.fromCharCode(97+file)}${rank}` as Square
      const position=squarePosition(square),light=(file+rank)%2===0,isSelected=selected===square,isLast=lastMove?.from===square||lastMove?.to===square
      return <group key={square} position={position}>
        <mesh position={[0,.025,0]} receiveShadow onPointerOver={()=>setPreview(legalSquares.includes(square)?square:null)} onPointerOut={()=>setPreview(null)} onClick={e=>{e.stopPropagation();onSquareClick(square)}}>
          <boxGeometry args={[.993,.055,.993]}/><meshStandardMaterial map={textures[light?0:1]} roughness={light?.48:.36} metalness={.12} color={isSelected?'#c5dcc3':isLast?'#c6b580':'#ffffff'} emissive={isSelected?'#7d9f75':isLast?'#6d5832':'#000000'} emissiveIntensity={isSelected?.14:isLast?.08:0}/>
        </mesh>
        {isSelected&&<mesh position={[0,.067,0]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[.48,.57,4,1,Math.PI/4]}/><meshBasicMaterial color="#b9f985" transparent opacity={1} depthWrite={false}/></mesh>}
        {legalSquares.includes(square)&&<group>
          <mesh position={[0,.068,0]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[.92,.92]}/><meshBasicMaterial color={captureSquares.includes(square)?'#ff746e':'#66e1c2'} transparent opacity={preview===square?.46:.23} depthWrite={false}/></mesh>
          <mesh position={[0,.075,0]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={captureSquares.includes(square)?[.39,.46,4,1,Math.PI/4]:[.16,.23,32]}/><meshBasicMaterial color={captureSquares.includes(square)?'#ff8174':'#a2ffe4'} depthWrite={false}/></mesh>
          <Html position={[0,.09,.31]} center style={{pointerEvents:'none'}} zIndexRange={[9,0]}><span className={`destination-tag ${captureSquares.includes(square)?'capture':''}`}>{captureSquares.includes(square)?'× ':''}{square.toUpperCase()}</span></Html>
        </group>}
      </group>
    })}
    {Array.from({length:8},(_,i)=><group key={i}>
      <Coordinate text={String.fromCharCode(97+i)} position={[i-3.5,.06,4.21]}/>
      <Coordinate text={String.fromCharCode(97+i)} position={[i-3.5,.06,-4.21]} rotate/>
      <Coordinate text={String(i+1)} position={[-4.21,.06,3.5-i]}/>
      <Coordinate text={String(i+1)} position={[4.21,.06,3.5-i]} rotate/>
    </group>)}
    <mesh position={[0,-.83,0]} receiveShadow rotation={[-Math.PI/2,0,0]}><planeGeometry args={[200,200]}/><meshStandardMaterial color="#0d1212" roughness={.95}/></mesh>
    <mesh position={[0,-.65,0]} receiveShadow castShadow><cylinderGeometry args={[5.85,6.15,.33,80]}/><meshStandardMaterial color="#101817" roughness={.55} metalness={.4}/></mesh>
  </group>
}

type Drag = {from:Square;id:string;startX:number;startY:number;point:Vector3;moved:boolean}

function PromotedRoleBadge({role}:{role:BoardPiece['character']['piece']}) {
  const texture=useMemo(()=>{
    const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128
    const ctx=canvas.getContext('2d')!
    ctx.beginPath();ctx.arc(64,64,59,0,Math.PI*2);ctx.fillStyle='#dfc886';ctx.fill()
    ctx.beginPath();ctx.arc(64,64,53,0,Math.PI*2);ctx.strokeStyle='#736133';ctx.lineWidth=3;ctx.stroke()
    ctx.font='75px serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#25231a'
    ctx.fillText(({q:'♛',r:'♜',b:'♝',n:'♞',p:'♟',k:'♚'})[role],64,67)
    const result=new CanvasTexture(canvas);result.colorSpace=SRGBColorSpace;return result
  },[role])
  useEffect(()=>()=>texture.dispose(),[texture])
  return <Billboard position={[0,1.38,0]}><mesh><planeGeometry args={[.32,.32]}/><meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false}/></mesh></Billboard>
}

function AnimatedPiece({piece,onSquareClick,onMove,onDragging,showAuras,selected,animation,lowQuality,reducedMotion}:{animation?:CharacterAnimation;lowQuality:boolean;reducedMotion:boolean;piece:BoardPiece;onSquareClick:ChessSceneProps['onSquareClick'];onMove:ChessSceneProps['onMove'];onDragging:(v:boolean)=>void;showAuras:boolean;selected:boolean}) {
  const group=useRef<Group>(null!),drag=useRef<Drag|null>(null)
  const [hovered,setHovered]=useState(false)
  const target=useMemo(()=>new Vector3(...squarePosition(piece.square)).setY(.06),[piece.square])
  const initialized=useRef(false)
  useFrame(({clock},delta)=>{
    if(!initialized.current){group.current.position.copy(target);initialized.current=true}
    const dest=drag.current?.moved?drag.current.point:target
    const distance=group.current.position.distanceTo(dest)
    group.current.position.lerp(dest,Math.min(1,delta*13))
    group.current.position.y=drag.current?.moved ? .35 : .06 + Math.min(.3,distance*.4)
    if(selected) group.current.position.y+=.03+Math.sin(clock.elapsedTime*2.8)*.014
  })
  const down=(e:ThreeEvent<PointerEvent>)=>{
    if(e.button!==0)return;e.stopPropagation()
    setHovered(false)
    drag.current={from:piece.square,id:piece.character.id,startX:e.clientX,startY:e.clientY,point:target.clone(),moved:false}
    onDragging(true);(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }
  const move=(e:ThreeEvent<PointerEvent>)=>{
    if(!drag.current)return;e.stopPropagation()
    if(Math.hypot(e.clientX-drag.current.startX,e.clientY-drag.current.startY)>5)drag.current.moved=true
    const point=new Vector3();if(e.ray.intersectPlane(dragPlane,point))drag.current.point.copy(point).setY(.35)
  }
  const up=(e:ThreeEvent<PointerEvent>)=>{
    if(!drag.current)return;e.stopPropagation()
    const current=drag.current;drag.current=null;onDragging(false)
    ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
    const point=new Vector3();const square=e.ray.intersectPlane(dragPlane,point)?pointSquare(point):null
    if(current.moved&&square&&square!==current.from)onMove(current.from,square)
    else if(!current.moved)onSquareClick(current.from)
  }
  return <group ref={group} onPointerDown={down} onPointerMove={move} onPointerUp={up} onClick={e=>e.stopPropagation()} onPointerOver={e=>{e.stopPropagation();if(!drag.current)setHovered(true);document.body.style.cursor='grab'}} onPointerOut={()=>{setHovered(false);document.body.style.cursor='auto'}}>
    <group rotation={[0,piece.character.color==='w'?0:Math.PI,0]}><CharacterPerformance character={piece.character} animation={animation} lowQuality={lowQuality} reducedMotion={reducedMotion}/></group>
    <PromotedRoleBadge role={piece.character.piece}/>
    {hovered&&<Html position={[0,1.55,0]} center zIndexRange={[20,0]} style={{pointerEvents:'none',whiteSpace:'nowrap'}}><div className="piece-tooltip" style={{background:'#14201ef0',border:'1px solid #8c7b4e',borderRadius:4,padding:'8px 11px',boxShadow:'0 6px 18px #0006',color:'#eee8d5',fontFamily:'Arial,sans-serif'}}><strong style={{display:'block',fontSize:11,fontWeight:600}}>{piece.character.name}</strong><span style={{display:'block',marginTop:4,fontSize:9,color:'#b2b6a6'}}>{piece.character.role} · {piece.square.toUpperCase()}</span></div></Html>}
    {showAuras&&<mesh position={[0,.015,0]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[selected?.31:.29,selected?.38:.315,32]}/><meshBasicMaterial color={piece.character.accent} transparent opacity={selected?.7:.28} toneMapped={false} depthWrite={false}/></mesh>}
  </group>
}

function CaptureBurst({piece,onDone}:{piece:BoardPiece;onDone:()=>void}) {
  const root=useRef<Group>(null!),body=useRef<Group>(null!),time=useRef(0)
  useFrame((_,delta)=>{
    time.current+=delta;const progress=Math.min(1,time.current/.85)
    root.current.scale.setScalar(1+progress*1.5);root.current.position.y=.06+progress*.4;root.current.rotation.y=progress*2
    root.current.traverse(object=>{
      const material=(object as unknown as {material?:{opacity:number;transparent:boolean}}).material
      if(material){material.transparent=true;material.opacity=1-progress}
    })
    body.current.scale.setScalar(Math.max(.001,1-progress*progress));body.current.rotation.z=progress*1.5;body.current.position.y=.06+Math.sin(progress*Math.PI)*.4
    if(progress>=1)onDone()
  })
  const [x,,z]=squarePosition(piece.square)
  return <group position={[x,0,z]}><group ref={body}><Figurine character={piece.character}/></group><group ref={root}>
    {Array.from({length:12},(_,i)=><mesh key={i} position={[Math.sin(i*2.4)*.55,.1+(i%4)*.2,Math.cos(i*2.4)*.55]} rotation={[i,i*2,0]}><octahedronGeometry args={[.06]}/><meshBasicMaterial color={piece.character.accent} toneMapped={false}/></mesh>)}
    <mesh rotation={[-Math.PI/2,0,0]}><torusGeometry args={[.38,.035,6,32]}/><meshBasicMaterial color={piece.character.accent} toneMapped={false}/></mesh>
  </group></group>
}

function Camera({flipped}:{flipped:boolean}) {
  const {camera,size}=useThree();const previous=useRef(flipped),transition=useRef(false)
  const destination=useMemo(()=>new Vector3(flipped?-sceneCameraPosition[0]:sceneCameraPosition[0],sceneCameraPosition[1],flipped?-sceneCameraPosition[2]:sceneCameraPosition[2]),[flipped])
  useEffect(()=>{
    // Fit the same board on a wide desktop arena and a narrow portrait canvas.
    // A vertical FOV alone crops the corners when the viewport becomes narrow.
    const perspective=camera as PerspectiveCamera
    const aspect=size.width/size.height
    perspective.fov=getSceneFov(aspect)
    perspective.updateProjectionMatrix()
  },[camera,size.width,size.height])
  useEffect(()=>{if(previous.current!==flipped){transition.current=true;previous.current=flipped}},[flipped])
  useFrame((_,delta)=>{if(transition.current){camera.position.lerp(destination,Math.min(1,delta*3));camera.lookAt(...sceneCameraTarget);if(camera.position.distanceTo(destination)<.05)transition.current=false}})
  return null
}

function World(props:ChessSceneProps) {
  const [dragging,setDragging]=useState(false),[captured,setCaptured]=useState<BoardPiece[]>([])
  const previous=useRef(props.pieces)
  const [animations,setAnimations]=useState<CharacterAnimation[]>([])
  const sequence=useRef(0)
  const [battle,setBattle]=useState<BattleEvent|null>(null)
  const {camera}=useThree()
  const originalView=useRef<CameraView|null>(null)
  useEffect(()=>{if(!battle)originalView.current=null},[Boolean(battle)])
  const [boardRevealed,setBoardRevealed]=useState(false)
  const beginBattle=(event:Omit<BattleEvent,'nonce'>)=>{if(!originalView.current)originalView.current={position:camera.position.clone(),rotation:camera.quaternion.clone(),fov:(camera as PerspectiveCamera).fov};setBoardRevealed(false);setCaptured([]);setBattle({...event,nonce:++sequence.current})}
  useEffect(()=>{props.onCinematicChange?.(Boolean(battle));return()=>props.onCinematicChange?.(false)},[Boolean(battle),props.onCinematicChange])
  useEffect(()=>{setBattle(null)},[props.skipCinematic,props.cinematicEffects])
  useEffect(()=>{setBattle(null);setAnimations([]);previous.current=props.pieces},[props.sceneKey])
  const reducedMotion=useMemo(()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches,[])
  const perform=(characterId:'naruto'|'madara',kind:'attack'|'defeat')=>setAnimations(old=>[...old.filter(a=>a.characterId!==characterId),{characterId,kind,nonce:++sequence.current}])
  useEffect(()=>{
    const preview=props.animationPreview
    if(!preview || props.cinematicEffects===false) return
    if(reducedMotion){perform(preview.characterId,preview.kind);return}
    const subject=props.pieces.find(p=>p.character.id===preview.characterId)
    const opponent=props.pieces.find(p=>p.character.piece==='k' && p.character.color!==subject?.character.color)
    if(subject && opponent) beginBattle({attacker:preview.kind==='attack'?subject:opponent,victim:preview.kind==='attack'?opponent:subject,kind:preview.kind,preview:true})
  },[props.animationPreview?.nonce])
  useEffect(()=>{
    if(!props.defeatedKing || props.cinematicEffects===false) return
    if(reducedMotion){perform(props.defeatedKing,'defeat');return}
    const victim=props.pieces.find(p=>p.character.id===props.defeatedKing)
    const attacker=props.pieces.find(p=>p.square===props.lastMove?.to && p.character.color!==victim?.character.color)
    if(victim && attacker) beginBattle({attacker,victim,kind:attacker.character.id==='naruto'||attacker.character.id==='madara'?'attack':'defeat'})
  },[props.defeatedKing,props.cinematicEffects])
  useEffect(()=>{
    const changed=previous.current.map(p=>p.character.id+':'+p.square).join('|')!==props.pieces.map(p=>p.character.id+':'+p.square).join('|')
    if(changed && battle) setBattle(null)
    if(previous.current.length===props.pieces.length+1){
      const attacker=capturePerformer(previous.current,props.pieces,props.lastMove)
      const event=captureBattle(previous.current,props.pieces,props.lastMove)
      if(props.cinematicEffects!==false && event && !reducedMotion && !props.defeatedKing) beginBattle(event)
      else {
        if(props.cinematicEffects!==false && attacker) perform(attacker,'attack')
        const ids=new Set(props.pieces.map(p=>p.character.id));setCaptured(old=>[...old,...previous.current.filter(p=>!ids.has(p.character.id))])
      }}
    if(props.pieces.length>previous.current.length){setAnimations([]);setBattle(null)}
    previous.current=props.pieces
  },[props.pieces])
  return <>
    <color attach="background" args={['#0b1110']}/><fog attach="fog" args={['#0b1110',24,55]}/>
    <ambientLight intensity={.8} color="#dce2dc"/>
    <hemisphereLight intensity={1.6} color="#dcece5" groundColor="#252a21"/>
    <directionalLight position={[-5,12,7]} intensity={3} color="#fff4db" castShadow shadow-mapSize={props.quality==='low'?[1024,1024]:[2048,2048]} shadow-camera-left={-7} shadow-camera-right={7} shadow-camera-top={7} shadow-camera-bottom={-7} shadow-camera-near={.5} shadow-camera-far={32} shadow-bias={-.00005} shadow-normalBias={.018} shadow-radius={3}/>
    <directionalLight position={[5,5,-7]} intensity={2.3} color="#8db6b6"/>
    <pointLight position={[-6,3,-3]} intensity={10} color="#718e79" distance={18}/>
    {(!battle || boardRevealed)&&<>
    <Board selected={props.selected} legalSquares={props.legalSquares} onSquareClick={props.onSquareClick} lastMove={props.lastMove} occupiedSquares={props.pieces.map(p=>p.square)} captureSquares={props.captureSquares}/>
    {props.pieces.map(piece=><AnimatedPiece key={piece.character.id} piece={piece} onSquareClick={props.onSquareClick} onMove={props.onMove} onDragging={setDragging} showAuras={props.showAuras} animation={props.cinematicEffects===false?undefined:animations.find(a=>a.characterId===piece.character.id)} lowQuality={props.quality==='low'} reducedMotion={reducedMotion} selected={props.selected===piece.square}/>)}
    {captured.map(piece=><CaptureBurst key={piece.character.id} piece={piece} onDone={()=>setCaptured(old=>old.filter(p=>p.character.id!==piece.character.id))}/>)}
    </>}
    {battle&&<BattleCinematic key={battle.nonce} originalView={originalView.current!} battle={battle} lowQuality={props.quality==='low'} onReveal={()=>setBoardRevealed(true)} onDone={()=>setBattle(null)}/>}
    {!battle&&<Camera flipped={props.flipped}/>}
    <OrbitControls makeDefault enabled={!battle} target={sceneCameraTarget} minDistance={11} maxDistance={25} minPolarAngle={.25} maxPolarAngle={1.12} enablePan={false} enableRotate={!dragging} enableDamping dampingFactor={.08} mouseButtons={{LEFT:undefined as unknown as MOUSE,MIDDLE:MOUSE.DOLLY,RIGHT:MOUSE.ROTATE}}/>
  </>
}

export default function ChessScene(props:ChessSceneProps) {
  return <Canvas shadows dpr={[1,props.quality==='low'?1:1.65]} camera={{position:sceneCameraPosition,fov:30,near:.1,far:100}} gl={{antialias:true,alpha:false,powerPreference:'high-performance'}} style={{touchAction:'none'}} onContextMenu={e=>e.preventDefault()}>
    <Suspense fallback={null}><World {...props}/></Suspense>
  </Canvas>
}
