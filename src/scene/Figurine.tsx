import { Component, Suspense, useMemo, type ReactNode } from 'react'
import { useGLTF } from '@react-three/drei'
import { posePlaceholderArms } from './placeholderPose'
import type { Character } from './types'

class ModelBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

function GLBFigurine({ url, attackPose = false }: { url: string; attackPose?: boolean }) {
  const { scene } = useGLTF(url)
  const model = useMemo(() => {
    const copy = scene.clone(true)
    copy.traverse(object => { object.castShadow = true; object.receiveShadow = true })
    if (attackPose) posePlaceholderArms(copy)
    return copy
  }, [scene, attackPose])
  return <primitive object={model} />
}

/** Lightweight geometry remains playable while replacement GLBs load. */
function ProceduralFigurine({ character }: { character: Character }) {
  const a = character.appearance
  const outfit = a?.outfit || (character.color === 'w' ? '#ded6bc' : '#252331')
  const hair = a?.hair || (character.color === 'w' ? '#edbf63' : '#ece8e4')
  const skin = a?.skin || '#e3ad8b'
  const scale = character.piece === 'p' ? .84 : 1
  return <group scale={scale}>
    <mesh castShadow position={[0,.055,0]}><cylinderGeometry args={[.29,.32,.11,24]}/><meshStandardMaterial color={character.color === 'w' ? '#e9ddbf' : '#26232c'} roughness={.3} metalness={.5}/></mesh>
    <mesh position={[0,.105,0]}><torusGeometry args={[.27,.013,6,24]}/><meshStandardMaterial color={character.accent} metalness={.7} roughness={.3}/></mesh>
    <group position={[0,.12,0]}>
      {[-1,1].map(side => <group key={side}>
        <mesh castShadow position={[side*.087,.16,0]}><cylinderGeometry args={[.058,.052,.29,8]}/><meshStandardMaterial color={outfit} roughness={.7}/></mesh>
        <mesh castShadow position={[side*.087,.024,.04]}><boxGeometry args={[.12,.07,.18]}/><meshStandardMaterial color="#292832" roughness={.7}/></mesh>
        <mesh castShadow position={[side*.18,.48,0]} rotation={[0,0,side*.16]}><capsuleGeometry args={[.048,.25,3,6]}/><meshStandardMaterial color={outfit} roughness={.7}/></mesh>
        <mesh castShadow position={[side*.204,.325,0]}><sphereGeometry args={[.049,8,6]}/><meshStandardMaterial color={skin}/></mesh>
      </group>)}
      <mesh castShadow position={[0,.43,0]}><cylinderGeometry args={[.135,.12,.33,8]}/><meshStandardMaterial color={outfit} roughness={.65}/></mesh>
      <mesh position={[0,.305,0]}><cylinderGeometry args={[.126,.126,.045,8]}/><meshStandardMaterial color={character.accent}/></mesh>
      <mesh castShadow position={[0,.738,0]}><sphereGeometry args={[.145,12,10]}/><meshStandardMaterial color={skin} roughness={.6}/></mesh>
      <mesh castShadow position={[0,.806,-.015]} scale={[1,.67,1]}><sphereGeometry args={[.158,12,8,0,Math.PI*2,0,Math.PI*.7]}/><meshStandardMaterial color={hair}/></mesh>
      {a?.style !== 'bald' && Array.from({length:7},(_,i) => <mesh castShadow key={i} position={[Math.sin(i*1.1)*.11,.87+Math.cos(i*2.3)*.03,Math.cos(i*1.1)*.08]} rotation={[Math.sin(i)*.4,0,Math.cos(i)*.4]}><coneGeometry args={[.065,.19,5]}/><meshStandardMaterial color={hair}/></mesh>)}
      {[-1,1].map(side => <mesh key={side} position={[side*.055,.75,.13]}><boxGeometry args={[.032,.014,.015]}/><meshStandardMaterial color="#22202b"/></mesh>)}
      {a?.cloak && <mesh castShadow position={[0,.43,-.08]} rotation={[.15,0,0]}><coneGeometry args={[.23,.58,8,1,true]}/><meshStandardMaterial color={outfit} side={2} roughness={.8}/></mesh>}
      {(a?.weapon === 'sword' || character.piece === 'b') && <group position={[.23,.39,.02]} rotation={[0,0,-.25]}><mesh castShadow position={[0,.24,0]}><boxGeometry args={[.025,.52,.035]}/><meshStandardMaterial color="#dbe5e8" metalness={.9} roughness={.2}/></mesh><mesh><boxGeometry args={[.11,.025,.055]}/><meshStandardMaterial color="#c5a565" metalness={.8}/></mesh></group>}
    </group>
  </group>
}

export default function Figurine({ character, attackPose = false }: { character: Character; attackPose?: boolean }) {
  const fallback = <ProceduralFigurine character={character}/>
  return character.modelUrl
    ? <ModelBoundary fallback={fallback}><Suspense fallback={fallback}><GLBFigurine url={character.modelUrl} attackPose={attackPose}/></Suspense></ModelBoundary>
    : fallback
}
