import * as T from 'three';
const canvas=document.querySelector<HTMLCanvasElement>('#demo')!;
const renderer=new T.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.shadowMap.enabled=true;
renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;
const scene=new T.Scene();scene.background=new T.Color('#101a23');
const camera=new T.PerspectiveCamera(36,1,.1,50);camera.position.set(3.1,2.7,6.5);camera.lookAt(0,.95,0);
scene.add(new T.HemisphereLight('#d6eeff','#243b34',2));
const light=new T.DirectionalLight('#fff0d5',4);light.position.set(-2,6,4);light.castShadow=true;light.shadow.mapSize.set(1024,1024);light.shadow.camera.far=20;light.shadow.normalBias=.04;scene.add(light);
const rim=new T.DirectionalLight('#69bbff',2);rim.position.set(2,3,-3);scene.add(rim);
const mat=(c:string)=>new T.MeshStandardMaterial({color:c,roughness:.65});
const skin=mat('#e8b397'),red=mat('#a92c31'),hair=mat('#181c22'),shorts=mat('#283747'),straw=mat('#d7b35c'),gold=mat('#e8c672');
function mesh(parent:T.Object3D,g:T.BufferGeometry,m:T.Material,x=0,y=0,z=0){const o=new T.Mesh(g,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
function body(parent:T.Group,luffy:boolean){
 const cloth=luffy?red:mat('#465a72');
 mesh(parent,new T.CylinderGeometry(.23,.19,.54,12),cloth,0,.95);
 mesh(parent,new T.SphereGeometry(.19,16,12),skin,0,1.48);
 mesh(parent,new T.SphereGeometry(.2,16,12,0,Math.PI*2,0,Math.PI*.55),hair,0,1.55,-.015);
 for(const side of [-1,1]){
  mesh(parent,new T.CylinderGeometry(.09,.075,.43,10),luffy?shorts:cloth,side*.13,.44);
  mesh(parent,new T.BoxGeometry(.14,.06,.24),luffy?straw:hair,side*.13,.17,.05);
  for(const y of [1.46])mesh(parent,new T.SphereGeometry(.018,8,6),hair,side*.07,y,.175);
 }
 mesh(parent,new T.BoxGeometry(.055,.018,.012),hair,0,1.38,.178);
 if(luffy){
  mesh(parent,new T.CylinderGeometry(.34,.34,.035,32),straw,0,1.66,-.015);
  mesh(parent,new T.SphereGeometry(.23,24,12,0,Math.PI*2,0,Math.PI/2),straw,0,1.67,-.015);
  mesh(parent,new T.CylinderGeometry(.231,.231,.05,24),red,0,1.69,-.015);
  mesh(parent,new T.BoxGeometry(.13,.43,.03),skin,0,.99,.19);
  for(const y of [.86,1.03,1.2])mesh(parent,new T.SphereGeometry(.022,8,6),gold,-.1,y,.2);
 }
 // Off-hand guard, deliberately separate from the stretching right arm.
 const left=new T.Group();left.position.set(-.22,1.17,.02);left.rotation.x=-1;parent.add(left);
 mesh(left,new T.CapsuleGeometry(.055,.28,4,8),skin,0,-.14);
 mesh(left,new T.SphereGeometry(.075,12,8),skin,0,-.33);
}
const actor=new T.Group();actor.position.x=-1.45;scene.add(actor);body(actor,true);
const opponent=new T.Group();opponent.position.x=1.35;opponent.rotation.y=-Math.PI/2;scene.add(opponent);body(opponent,false);
// Neutral training partner, not a claimed final character asset.
const right=new T.Group();right.position.set(.22,1.2,.02);actor.add(right);
const geometry=new T.CylinderGeometry(.055,.055,1,12,40,true);geometry.rotateX(Math.PI/2);geometry.translate(0,0,.5);
const pos=geometry.getAttribute('position'),indices:number[]=[],weights:number[]=[];
for(let i=0;i<pos.count;i++){
 const f=T.MathUtils.clamp(pos.getZ(i),0,1)*4;const lo=Math.min(3,Math.floor(f)),w=f-lo;
 indices.push(lo,lo+1,0,0);weights.push(1-w,w,0,0);
}
geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(indices,4));geometry.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));
const bones=Array.from({length:5},(_,i)=>{const bone=new T.Bone();bone.name=`Elastic arm ${i}`;if(i)bone.position.z=.25;return bone;});
for(let i=1;i<bones.length;i++)bones[i-1].add(bones[i]);
const arm=new T.SkinnedMesh(geometry,skin);arm.add(bones[0]);arm.bind(new T.Skeleton(bones));arm.castShadow=true;right.add(arm);
const fist=new T.Group();right.add(fist);mesh(fist,new T.SphereGeometry(.09,14,10),skin);
for(let i=0;i<4;i++)mesh(fist,new T.CapsuleGeometry(.028,.065,3,8),skin,(i-1.5)*.043,0,.045);
mesh(fist,new T.CapsuleGeometry(.032,.07,3,8),skin,-.085,-.035,.005);
const floor=mesh(scene,new T.CylinderGeometry(3,3.1,.1,80),mat('#1b2936'),0,.03);floor.receiveShadow=true;
const ring=mesh(scene,new T.TorusGeometry(2.8,.012,6,100),gold,0,.09);ring.rotation.x=Math.PI/2;
const impact=new T.Group();impact.position.set(1.25,1.13,.05);scene.add(impact);
for(let i=0;i<12;i++){const s=mesh(impact,new T.ConeGeometry(.02,.25,4),gold,0,Math.cos(i*Math.PI/6)*.25,Math.sin(i*Math.PI/6)*.25);s.rotation.x=i*Math.PI/6;}
const phase=document.querySelector('#phase')!,slider=document.querySelector<HTMLInputElement>('#scrub')!,button=document.querySelector('#play')!;
let paused=false,elapsed=0,previous=performance.now();const fixed=new URLSearchParams(location.search).get('t');
const smooth=(x:number)=>T.MathUtils.smoothstep(x,0,1);
function pose(t:number){
 const wind=smooth(t/.8),extend=smooth((t-.9)/.45),recoil=smooth((t-1.65)/.8),stretch=extend*(1-recoil);
 actor.rotation.y=Math.PI/2-Math.sin(wind*Math.PI/2)*.24*(1-extend)+.08*stretch;
 actor.position.x=-1.45+.12*stretch;
 actor.updateMatrixWorld(true);
 const goal=right.worldToLocal(new T.Vector3(1.28,1.16,.05));
 const rest=new T.Vector3(.03,-.23,.27-.43*wind*(1-extend));
 const end=rest.clone().lerp(goal,stretch);
 const points=Array.from({length:5},(_,i)=>{const u=i/4;return end.clone().multiplyScalar(u).add(new T.Vector3(-.08*Math.sin(u*Math.PI)*(1-stretch),-.14*Math.sin(u*Math.PI)*(1-stretch),0));});
 for(let i=0;i<5;i++)bones[i].position.copy(i?points[i].clone().sub(points[i-1]):points[0]);
 fist.position.copy(end);fist.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),end.clone().sub(points[3]).normalize());
 const hit=Math.sin(T.MathUtils.clamp((t-1.35)/.8,0,1)*Math.PI);
 opponent.rotation.z=-hit*.27;opponent.position.x=1.35+hit*.12;
 impact.visible=t>=1.35&&t<1.65;impact.scale.setScalar(1+(t-1.35)*2);
 phase.textContent=t<.9?'01 · Wind-up':t<1.35?'02 · Elastic extension':t<1.65?'03 · Contact':t<2.45?'04 · Recoil':'05 · Ready';
 slider.value=String(t);
}
button.addEventListener('click',()=>{paused=!paused;button.textContent=paused?'Play':'Pause';});
slider.addEventListener('input',()=>{paused=true;button.textContent='Play';elapsed=Number(slider.value);});
function resize(){renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}window.addEventListener('resize',resize);resize();
renderer.setAnimationLoop(()=>{const now=performance.now();if(!paused)elapsed+=(now-previous)/1000;previous=now;pose(fixed===null?elapsed%4:Number(fixed));renderer.render(scene,camera);});
// Read-only diagnostics for tests: proves this demo contains a real skeleton.
Object.assign(window,{elasticDemo:{arm,bones,pose,renderer,scene,camera}});
