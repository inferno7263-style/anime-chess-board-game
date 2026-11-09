import { expect, test, type Page } from '@playwright/test';
import { PerspectiveCamera, Vector3 } from 'three';
import { getSceneFov, sceneCameraPosition, sceneCameraTarget } from '../src/scene/camera';
const square=(page:Page,id:string)=>page.getByRole('button',{name:new RegExp(`^${id}(?:,|$)`)});
async function open(page:Page){
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'Settings',exact:true}).click();
  await page.getByRole('combobox').selectOption('low');
  await page.getByRole('button',{name:'Close dialog',exact:true}).click();
}
async function preview(page:Page,id:string){
  await page.getByRole('button',{name:'Settings',exact:true}).click();
  await page.getByRole('button',{name:`Preview ${id} attack`,exact:true}).click();
}
async function move(page:Page,from:string,to:string){await square(page,from).click();await square(page,to).click();}

test('Naruto and Madara close-up battles complete and leave the chess position unchanged',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await open(page);
  for(const id of ['naruto','madara']){
    await preview(page,id);
    const battle=page.getByTestId('battle-cinematic');
    await expect(battle).toBeVisible();
    await expect(battle).toContainText(id==='naruto'?'RASENGAN':'SUSANOO STRIKE');
    await expect(page.getByRole('button',{name:'Skip animation'})).toBeVisible();
    if(id==='naruto'){
      await expect(battle).toHaveAttribute('data-phase',/strike|defeat/);
      await page.screenshot({path:'/tmp/naruto-finishing-closeup.png',fullPage:true});
    }
    await expect(battle).toHaveCount(0);
    await expect(page.locator('.count-badge')).toHaveText('00 MOVES');
  }
  expect(errors).toEqual([]);
});

test('skip restores board interaction and Stockfish continues working',async({page})=>{
  await open(page);await preview(page,'madara');
  await page.getByRole('button',{name:'Skip animation'}).click();
  await expect(page.getByTestId('battle-cinematic')).toHaveCount(0);
  await page.getByRole('button',{name:'2D accessible board',exact:true}).click();
  await page.getByRole('button',{name:'vs. Computer',exact:true}).click();
  await move(page,'e2','e4');
  await expect(page.locator('.count-badge')).toHaveText('02 MOVES',{timeout:30000});
  await expect(page.locator('.match-status strong')).toHaveText('Heroes to move');
});

test('a legal Naruto capture uses the actual victim and undo cancels the visual replay',async({page})=>{
  await open(page);
  await page.getByRole('button',{name:'2D accessible board',exact:true}).click();
  for(const [from,to] of [['e2','e4'],['d7','d5'],['e1','e2'],['d5','e4'],['e2','e3'],['a7','a6']]) await move(page,from,to);
  await page.getByRole('button',{name:'3D view',exact:true}).click();
  await page.waitForTimeout(500);
  const bounds=(await page.locator('canvas').boundingBox())!;
  const camera=new PerspectiveCamera(getSceneFov(bounds.width/bounds.height),bounds.width/bounds.height,.1,100);
  camera.position.set(...sceneCameraPosition);camera.lookAt(...sceneCameraTarget);camera.updateMatrixWorld();
  const project=(x:number,y:number,z:number)=>{const v=new Vector3(x,y,z).project(camera);return{x:bounds.x+(v.x+1)*bounds.width/2,y:bounds.y+(1-v.y)*bounds.height/2}};
  const from=project(.5,.8,1.5),to=project(.5,.5,.5);
  await page.mouse.click(from.x,from.y);
  await expect(page.locator('.selection-toast strong')).toContainText('Naruto');
  await page.mouse.click(to.x,to.y);
  await expect(page.getByTestId('battle-cinematic')).toContainText('Blackbeard');
  await expect(page.locator('.count-badge')).toHaveText('07 MOVES');
  await page.getByRole('button',{name:'Undo move',exact:true}).click();
  await expect(page.getByTestId('battle-cinematic')).toHaveCount(0);
  await page.getByRole('button',{name:'2D accessible board',exact:true}).click();
  await expect(square(page,'e3')).toHaveAttribute('aria-label',/Naruto/);
  await expect(square(page,'e4')).toHaveAttribute('aria-label',/Blackbeard/);
  await expect(page.locator('.count-badge')).toHaveText('06 MOVES');
});

test('reduced motion keeps the board camera and allows non-cinematic effects',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await open(page);await preview(page,'naruto');
  await expect(page.getByText('RASENGAN',{exact:true})).toBeVisible();
  await expect(page.getByTestId('battle-cinematic')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Skip animation'})).toHaveCount(0);
  await expect(page.locator('.count-badge')).toHaveText('00 MOVES');
});

test('Stockfish waits for the capture close-up then resumes its legal reply',async({page})=>{
  await open(page);
  await page.getByRole('button',{name:'2D accessible board',exact:true}).click();
  for(const [from,to] of [['e2','e4'],['d7','d5'],['e1','e2'],['d5','e4'],['e2','e3'],['a7','a6']]) await move(page,from,to);
  await page.getByRole('button',{name:'vs. Computer',exact:true}).click();
  await page.getByRole('button',{name:'3D view',exact:true}).click();
  await page.waitForTimeout(500);
  const bounds=(await page.locator('canvas').boundingBox())!;
  const camera=new PerspectiveCamera(getSceneFov(bounds.width/bounds.height),bounds.width/bounds.height,.1,100);
  camera.position.set(...sceneCameraPosition);camera.lookAt(...sceneCameraTarget);camera.updateMatrixWorld();
  const project=(x:number,y:number,z:number)=>{const v=new Vector3(x,y,z).project(camera);return{x:bounds.x+(v.x+1)*bounds.width/2,y:bounds.y+(1-v.y)*bounds.height/2}};
  const from=project(.5,.8,1.5),to=project(.5,.5,.5);
  await page.mouse.click(from.x,from.y);
  await expect(page.locator('.selection-toast strong')).toContainText('Naruto');
  await page.evaluate(()=>{
    (window as any).battleCounts=[];
    const observer=new MutationObserver(()=>{
      if(document.querySelector('[data-testid="battle-cinematic"]')) (window as any).battleCounts.push(document.querySelector('.count-badge')?.textContent);
    });
    observer.observe(document.body,{subtree:true,childList:true,characterData:true});
    (window as any).battleObserver=observer;
  });
  await page.getByRole('button',{name:'Capture to E4',exact:true}).click();
  await expect(page.getByTestId('battle-cinematic')).toContainText('Blackbeard');

  await expect(page.getByTestId('battle-cinematic')).toHaveCount(0);
  await expect(page.locator('.count-badge')).toHaveText('08 MOVES',{timeout:30000});
  await expect(page.locator('.match-status strong')).toHaveText('Heroes to move');
  const counts=await page.evaluate(()=>{(window as any).battleObserver.disconnect();return (window as any).battleCounts as string[];});
  expect(counts.length).toBeGreaterThan(0);
  expect(counts.every(value=>value==='07 MOVES')).toBe(true);
});

test('four reference-inspired attacks and defeats complete without changing chess state',async({page})=>{
  test.setTimeout(180000);
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await open(page);
  const names={asta:'BLACK DIVIDER',mikasa:'ODM · CROSS SLASH',nezuko:'EXPLODING BLOOD','sung-jinwoo':'SHADOW MONARCH · DAGGER RUSH'};
  for(const [id,name] of Object.entries(names)){
    for(const kind of ['attack','defeat']){
      await page.getByRole('button',{name:'Settings',exact:true}).click();
      await page.getByRole('button',{name:`Preview ${id} ${kind}`,exact:true}).click();
      const battle=page.getByTestId('battle-cinematic');
      await expect(battle).toBeVisible();
      await expect(battle).toContainText(kind==='attack'?name:'DEFEAT');
      if(kind==='attack'){
        await expect(battle).toHaveAttribute('data-phase',/strike|defeat/);
        await page.screenshot({path:`/tmp/${id}-reference-effect.png`});
      }
      await expect(battle).toHaveCount(0);
      await expect(page.locator('.count-badge')).toHaveText('00 MOVES');
    }
  }
  expect(errors).toEqual([]);
});

test('a confirmed Mikasa capture launches her cross slash and undo restores both figures',async({page})=>{
  await open(page);
  await page.getByRole('button',{name:'2D accessible board',exact:true}).click();
  await move(page,'c2','c4');await move(page,'d7','d5');
  await page.getByRole('button',{name:'3D view',exact:true}).click();
  await page.waitForTimeout(700);
  const bounds=(await page.locator('canvas').boundingBox())!;
  const camera=new PerspectiveCamera(getSceneFov(bounds.width/bounds.height),bounds.width/bounds.height,.1,100);
  camera.position.set(...sceneCameraPosition);camera.lookAt(...sceneCameraTarget);camera.updateMatrixWorld();
  const v=new Vector3(-1.5,.55,.5).project(camera);
  await page.mouse.click(bounds.x+(v.x+1)*bounds.width/2,bounds.y+(1-v.y)*bounds.height/2);
  await expect(page.locator('.selection-toast strong')).toContainText('Mikasa');
  await page.getByRole('button',{name:'Capture to D5',exact:true}).click();
  await expect(page.getByTestId('battle-cinematic')).toContainText('ODM · CROSS SLASH');
  await expect(page.getByTestId('battle-cinematic')).toContainText('Blackbeard');
  await expect(page.locator('.count-badge')).toHaveText('03 MOVES');
  await page.getByRole('button',{name:'Undo move',exact:true}).click();
  await expect(page.getByTestId('battle-cinematic')).toHaveCount(0);
  await page.getByRole('button',{name:'2D accessible board',exact:true}).click();
  await expect(square(page,'c4')).toHaveAttribute('aria-label',/Mikasa/);
  await expect(square(page,'d5')).toHaveAttribute('aria-label',/Blackbeard/);
});

test('all remaining Heroes play reference-inspired attacks and defeats without changing chess state',async({page})=>{
  test.setTimeout(360000);
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await open(page);
  const profiles = {
    ichigo:'GETSUGA TENSHO',gojo:'HOLLOW PURPLE',goku:'KAMEHAMEHA',luffy:'GUM-GUM · ELEPHANT GUN',
    zenitsu:'THUNDERCLAP AND FLASH',killua:'GODSPEED · THUNDERBOLT',tanjiro:'HINOKAMI KAGURA',
    gon:'JAJANKEN · ROCK',zoro:'THREE-SWORD STYLE · DRAGON TWISTER',yuno:'SPIRIT DIVE · WIND MAGIC',yami:'DARK MAGIC · BLACK HOLE',
  };
  for(const [id,name] of Object.entries(profiles)){
    for(const kind of ['attack','defeat']){
      await page.getByRole('button',{name:'Settings',exact:true}).click();
      await page.getByRole('button',{name:`Preview ${id} ${kind}`,exact:true}).click();
      const battle=page.getByTestId('battle-cinematic');
      await expect(battle).toBeVisible();
      await expect(battle).toContainText(kind==='attack'?name:'DEFEAT');
      await expect(battle).toHaveAttribute('data-phase',/charge|strike|defeat/);
      if(kind==='attack'&&['gojo','goku','luffy','tanjiro','yuno','ichigo'].includes(id)){
        await page.screenshot({path:`/tmp/hero-${id}-effect.png`});
      }
      if(id!=='yami'||kind!=='defeat'){
        const skip=page.getByRole('button',{name:'Skip animation',exact:true});
        if(await skip.count())await skip.click();
      }
      await expect(battle).toHaveCount(0);
      await expect(page.locator('.count-badge')).toHaveText('00 MOVES');
    }
  }
  expect(errors).toEqual([]);
});

test('new Hero beam, crescent and vortex shaders render with stable aim and no WebGL errors',async({page})=>{
  test.setTimeout(120000);
  const errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',message=>{if(message.type()==='error'&&/shader|WebGLProgram/i.test(message.text()))errors.push(message.text());});
  await page.setViewportSize({width:1100,height:1200});
  await open(page);
  for(const id of ['gojo','goku','ichigo']){
    await preview(page,id);
    await expect(page.getByTestId('battle-cinematic')).toHaveAttribute('data-phase',/charge|strike/);
    await page.screenshot({path:`/tmp/hero-final-${id}.png`,fullPage:true});
    const skip=page.getByRole('button',{name:'Skip animation',exact:true});
    if(await skip.count())await skip.click();
    await expect(page.getByTestId('battle-cinematic')).toHaveCount(0);
    await expect(page.locator('.count-badge')).toHaveText('00 MOVES');
  }
  expect(errors).toEqual([]);
});
