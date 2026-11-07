/** Generate original stylized placeholder GLBs, not licensed character models.
 * Run: node scripts/generate-models.mjs (after npm install).
 * Asset palettes and silhouettes hint at the user roster; replace with licensed art.
 */
import * as THREE from 'three'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'
import { mkdir, writeFile, readFile } from 'node:fs/promises'

// GLTFExporter uses browser FileReader even when exporting buffers in Node.
globalThis.FileReader ??= class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(result => { this.result = result; this.onloadend?.(); this.onload?.(); }) }
  readAsDataURL(blob) { blob.arrayBuffer().then(result => { this.result = `data:${blob.type};base64,${Buffer.from(result).toString('base64')}`; this.onloadend?.(); this.onload?.(); }) }
}
const source = await readFile(new URL('../src/data/roster.ts', import.meta.url), 'utf8')
// Keep model inputs in the canonical roster rather than a second asset manifest.
const entries = [...source.matchAll(/^  \['([^']+)', '([^']+)', '([^']+)', '([^']+)', '([^']+)', '(#[^']+)', '(#[^']+)', '([^']+)'(?:, '([^']+)')?(?:, (true|false))?\],/gm)]
const hairBlock = source.slice(source.indexOf('const hair:'), source.indexOf('const role:'))
const hairColors = Object.fromEntries([...hairBlock.matchAll(/(?:'([^']+)'|([\w-]+)):\s*'(#[^']+)'/g)].map(m => [m[1] || m[2], m[3]]))
const output = new URL('../public/models/', import.meta.url)
await mkdir(output, { recursive: true })
function material(color, metalness = .12, roughness = .62) { return new THREE.MeshStandardMaterial({ color, metalness, roughness }) }
function add(group, geometry, mat, x, y, z, rotation) {
  const m = new THREE.Mesh(geometry, mat)
  m.position.set(x,y,z)
  if(rotation) m.rotation.set(...rotation)
  group.add(m)
  return m
}
function cylinder(group, radiusTop, radiusBottom, height, mat, x,y,z, sides=16) { return add(group,new THREE.CylinderGeometry(radiusTop,radiusBottom,height,sides),mat,x,y,z) }
function box(group,w,h,d,mat,x,y,z,rotation) { return add(group,new THREE.BoxGeometry(w,h,d),mat,x,y,z,rotation) }
function limb(group,a,b,r,mat) {
  const av=new THREE.Vector3(...a), bv=new THREE.Vector3(...b), mid=av.clone().add(bv).multiplyScalar(.5)
  const m = cylinder(group,r,r*.92,av.distanceTo(bv),mat,...mid.toArray(),8)
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),bv.sub(av).normalize())
}
for (const entry of entries) {
  const [,square,id,name,piece,anime,accent,outfit,style,weapon='none',cloak='false']=entry
  const white=Number(square[1])<3
  const group=new THREE.Group(); group.name=`Placeholder ${name}`
  const cloth=material(outfit), skin=material(id==='frieza'?'#8c8294':['meruem','lucifero'].includes(id)?'#cbd0bc':'#ddba9d',0,.72)
  const hair=material(hairColors[id]||'#24222c'), dark=material('#171c25'), bright=material(accent,.25,.45), brass=material(white?'#c6ab70':'#8e6b67',.75,.32), steel=material('#b6c4cf',.8,.2)
  const base=material(white?'#d7d3c5':'#282732',.32,.38)
  cylinder(group,.245,.27,.07,base,0,.035,0,28)
  cylinder(group,.237,.247,.024,brass,0,.08,0,28)
  cylinder(group,.205,.235,.035,base,0,.11,0,28)
  const figure = new THREE.Group(); group.add(figure)
  const scale = piece==='p'?.82:piece==='k'||piece==='q'?1.06:1
  figure.scale.setScalar(scale); figure.position.y=.125
  // Boots and articulated full-body pose.
  box(figure,.092,.065,.16,dark,-.071,.045,.014)
  box(figure,.092,.065,.16,dark,.071,.045,.014)
  limb(figure,[-.07,.075,0],[-.075,.32,-.01],.044,dark)
  limb(figure,[.07,.075,0],[.07,.32,.0],.044,dark)
  limb(figure,[-.075,.32,-.01],[-.058,.47,0],.056,cloth)
  limb(figure,[.07,.32,0],[.058,.47,0],.056,cloth)
  cylinder(figure,.11,.105,.13,cloth,0,.455,0,8)
  cylinder(figure,.135,.1,.245,cloth,0,.62,0,8)
  box(figure,.216,.04,.17,dark,0,.51,0)
  box(figure,.05,.041,.008,brass,0,.513,.092)
  // Lapels and costume accent bands.
  box(figure,.025,.21,.012,bright,-.043,.628,.098,[0,0,-.14])
  box(figure,.025,.21,.012,bright,.043,.628,.098,[0,0,.14])
  cylinder(figure,.034,.037,.065,skin,0,.78,0,10)
  const rightHand=weapon!=='none'?[.19,.48,.09]:[.2,.48,.035]
  limb(figure,[-.12,.715,0],[-.19,.59,.0],.045,cloth)
  limb(figure,[-.19,.59,0],[-.17,.465,.05],.037,skin)
  limb(figure,[.12,.715,0],[.2,.59,.02],.045,cloth)
  limb(figure,[.2,.59,.02],rightHand,.037,skin)
  add(figure,new THREE.SphereGeometry(.043,8,6),skin,-.17,.465,.05)
  add(figure,new THREE.SphereGeometry(.043,8,6),skin,...rightHand)
  // Angular head, nose, clear hair silhouette and small eyes.
  add(figure,new THREE.SphereGeometry(.106,12,10),skin,0,.865,.005).scale.set(.84,1.08,.87)
  box(figure,.022,.025,.025,skin,0,.858,.095)
  for(const x of [-.035,.035]) { box(figure,.033,.012,.009,dark,x,.878,.085); box(figure,.008,.009,.012,bright,x,.879,.092) }
  box(figure,.032,.007,.008,dark,0,.825,.091)
  if(style==='bald') {
    add(figure,new THREE.SphereGeometry(.073,12,8),hair,0,.936,.0).scale.set(1,.45,1)
    if(id==='meruem') { cylinder(figure,.098,.075,.06,hair,0,.95,0,6); box(figure,.2,.04,.05,bright,0,.958,.055) }
  } else {
    add(figure,new THREE.SphereGeometry(.11,12,8),hair,0,.916,-.005).scale.set(1,.75,.96)
    if(style==='spiky') {
      for(let i=0;i<7;i++) { const a=i*Math.PI*2/7; const spike=add(figure,new THREE.ConeGeometry(.041,.155,4),hair,Math.sin(a)*.072,.973+((i%2)*.02),Math.cos(a)*.062-.012); spike.rotation.z=-Math.sin(a)*.72; spike.rotation.x=Math.cos(a)*.55 }
    } else if(style==='long') {
      for(let i=0;i<6;i++) { const a=(i/5)*Math.PI; const spike=add(figure,new THREE.ConeGeometry(.044,.25,4),hair,Math.cos(a)*.095,.8,-.055-Math.sin(a)*.045); spike.rotation.z=Math.PI+(i-2.5)*.06 }
    } else if(style==='short') {
      for(let i=0;i<4;i++) { const spike=add(figure,new THREE.ConeGeometry(.04,.08,4),hair,(i-1.5)*.045,.909,.073); spike.rotation.z=Math.PI+.2 }
    }
    if(style==='hat') {
      const hatmat=material(id==='luffy'?'#d2ae5d':id==='blackbeard'?'#30262e':'#d4cec2')
      cylinder(figure,.177,.177,.025,hatmat,0,.953,0,24)
      cylinder(figure,.097,.115,.09,hatmat,0,1,0,20)
      cylinder(figure,.112,.115,.02,bright,0,.971,0,20)
    }
  }
  // Signature costume cues, kept deliberately simple for replaceable placeholders.
  if(['naruto','pain','asta'].includes(id)) { box(figure,.164,.032,.02,dark,0,.925,.07); box(figure,.065,.024,.024,steel,0,.925,.081) }
  if(id==='nezuko') { box(figure,.14,.026,.026,material('#7b9c5e'),0,.833,.097); box(figure,.04,.075,.014,bright,.095,.927,.025) }
  if(id==='obito') { add(figure,new THREE.SphereGeometry(.092,12,8),material('#b88c73'),0,.864,.043).scale.set(.9,1,.65); box(figure,.02,.012,.015,dark,.035,.88,.107) }
  if(id==='pitou') for(const x of [-.078,.078]) add(figure,new THREE.ConeGeometry(.035,.095,3),hair,x,1.008,0,[0,0,-x*2]);
  if(id==='lucifero') for(const x of [-.092,.092]) add(figure,new THREE.ConeGeometry(.035,.16,5),dark,x,1.01,0,[0,0,-x*4]);
  if(id==='mikasa') { box(figure,.18,.035,.14,material('#9f3c3b'),0,.775,0); box(figure,.06,.17,.025,material('#9f3c3b'),-.08,.70,-.03) }
  if(id==='mahito') for(let i=0;i<3;i++) box(figure,.025,.005,.009,dark,-.06+i*.04,.838+i*.015,.093);
  if(id==='gojo') box(figure,.176,.032,.034,dark,0,.884,.081)
  if(id==='tanjiro') for(let i=0;i<4;i++) for(let j=0;j<3;j++) if((i+j)%2===0) box(figure,.046,.05,.015,dark,(i-1.5)*.052,.57+j*.055,.103)
  if(['madara','kaido','antares'].includes(id)) for(let i=0;i<4;i++) { box(figure,.272,.04,.2,bright,0,.55+i*.045,0); }
  if(['sukuna','akaza'].includes(id)) for(let i=0;i<3;i++) box(figure,.08,.008,.011,bright,0,.84+i*.025,.092)
  if(cloak==='true') {
    const capeMat=material(id==='doflamingo'?'#e7a9ca':id==='zenitsu'?'#d9aa43':id==='nezuko'?'#453037':white?'#2d3838':'#28202d')
    const cape=add(figure,new THREE.ConeGeometry(.215,.58,8,1,true,0,Math.PI*1.18),capeMat,0,.435,-.05,[0,Math.PI*.41,0]); cape.material.side=THREE.DoubleSide
    box(figure,.3,.065,.19,capeMat,0,.711,-.012)
  }
  if(weapon==='sword') {
    const sword=new THREE.Group(); sword.position.set(.205,.49,.1); sword.rotation.z=-.16; figure.add(sword)
    box(sword,.027,.42,.016,steel,0,-.255,0)
    box(sword,.115,.025,.032,brass,0,-.025,0)
    cylinder(sword,.02,.02,.1,dark,0,.025,0,8)
    add(sword,new THREE.ConeGeometry(.019,.07,4),steel,0,-.5,0,[0,0,Math.PI])
  } else if(weapon==='staff') {
    cylinder(figure,.013,.013,.87,dark,.205,.46,.08,10)
    add(figure,new THREE.TorusGeometry(.064,.014,6,16),brass,.205,.94,.08)
  }
  if(id==='frieza') { const tail = add(figure,new THREE.TorusGeometry(.16,.027,6,14,Math.PI*1.4),hair,.08,.25,-.10,[Math.PI*.5,0,-1.3]); }
  group.updateMatrixWorld(true)
  const exporter = new GLTFExporter()
  const data = await exporter.parseAsync(group,{ binary:true, onlyVisible:true, trs:false })
  await writeFile(new URL(`${id}.glb`,output),Buffer.from(data))
}
console.log(`Generated ${entries.length} original placeholder GLB figurines.`)
