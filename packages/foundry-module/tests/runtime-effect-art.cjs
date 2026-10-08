// Disposable world only. Verify real textures, hit/miss distinction, looping vines and the local preview UI.
const assert=require('node:assert/strict'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 if(!process.env.FOUNDRY_TEST_URL)throw Error('Disposable Foundry URL required');
 const browser=await chromium.launch({headless:true,channel:'chrome'}),page=await browser.newPage({viewport:{width:1440,height:1000}});
 try{
  await page.goto(process.env.FOUNDRY_TEST_URL);await page.locator('input[name=username]').fill('Gamemaster');await page.locator('button[name=join]').click();await page.waitForFunction(()=>game?.ready);
  await page.evaluate(async()=>{const {createDemoScene}=await import('/modules/shadow-edge-gm/scripts/demo.mjs');const scene=await createDemoScene();await scene.activate();while(!canvas.ready||canvas.scene.id!==scene.id)await new Promise(r=>setTimeout(r,100));await canvas.animatePan({x:700,y:450,scale:1,duration:0});await Promise.all(['weapons','vines','magic','blood-slash'].map(n=>PIXI.Assets.load('/modules/shadow-edge-gm/assets/'+n+'.png')));globalThis.artTest={starts:[],hook:Hooks.on('shadow-edge-gm.animationStart',e=>artTest.starts.push(e))};});
  const result=await page.evaluate(async()=>{
   const {renderEffect,clearEffects}=await import('/modules/shadow-edge-gm/scripts/native-effects.mjs'),actor=game.actors.contents[0];
   const base={sceneId:canvas.scene.id,userId:game.user.id,actorUuid:actor.uuid,source:{x:450,y:350},size:130};
   renderEffect({...base,key:'sword-blood',id:'art-hit',targets:[{x:730,y:350,hit:true}]});
   renderEffect({...base,key:'axe-blood',id:'art-miss',source:{x:450,y:650},targets:[{x:730,y:650,hit:false}]});
   await new Promise(r=>setTimeout(r,1450));
   const textures=id=>artTest.starts.find(e=>e.id===id).graphics.parent.children.filter(c=>c.visible&&c.alpha>0&&c.texture?.baseTexture?.resource?.url).map(c=>c.texture.baseTexture.resource.url);
   return {hit:textures('art-hit'),miss:textures('art-miss')};
  });
  assert(result.hit.some(url=>url.includes('weapons.png')));assert(result.hit.some(url=>url.includes('blood-slash.png')));assert(result.miss.some(url=>url.includes('weapons.png')));assert(!result.miss.some(url=>url.includes('blood-slash.png')));
  await page.screenshot({path:'tmp/foundry-art-weapons.png'});
  const vines=await page.evaluate(async()=>{const {clearEffects}=await import('/modules/shadow-edge-gm/scripts/native-effects.mjs');clearEffects();const {artTexture}=await import('/modules/shadow-edge-gm/scripts/effect-art.mjs');for(let n=0;n<50&&!artTexture('vines');n++)await new Promise(r=>setTimeout(r,100));const {makeZonePainter}=await import('/modules/shadow-edge-gm/scripts/area-effects.mjs'),layer=new PIXI.Container();canvas.interface.addChild(layer);const p=makeZonePainter(layer,'entangle',[{type:'circle',x:650,y:430,radius:230}],100);p.draw(3,1);const sprites=()=>layer.children.flatMap(c=>c.children??[]).filter(c=>c.visible&&c.texture?.baseTexture?.resource?.url?.includes('vines.png'));const first=sprites().map(s=>s.rotation);p.draw(4,1);const second=sprites().map(s=>s.rotation);globalThis.artTest.vines=layer;return {count:first.length,moved:first.some((r,i)=>r!==second[i])}});
  assert(vines.count>0&&vines.moved);await page.screenshot({path:'tmp/foundry-art-vines.png'});
  await page.evaluate(()=>{artTest.vines.destroy({children:true});canvas.tokens.placeables[0].control();canvas.tokens.placeables[1].setTarget(true,{user:game.user,releaseOthers:true})});
  await page.evaluate(async()=>{const {renderEffect}=await import('/modules/shadow-edge-gm/scripts/native-effects.mjs');const actor=game.actors.contents[0];for(const [i,key]of ['meteor-strike','ice-lance','arcane-sigil','holy-smite'].entries())renderEffect({key,id:'art-magic-'+i,sceneId:canvas.scene.id,userId:game.user.id,actorUuid:actor.uuid,source:{x:350+(i%2)*500,y:300+Math.floor(i/2)*300},targets:[{x:600+(i%2)*500,y:300+Math.floor(i/2)*300}],size:150});await new Promise(r=>setTimeout(r,1050))});
  await page.screenshot({path:'tmp/foundry-art-magic.png'});await page.evaluate(async()=>{const {clearEffects}=await import('/modules/shadow-edge-gm/scripts/native-effects.mjs');clearEffects()});
  await page.evaluate(async()=>{const {showAnimationLibrary}=await import('/modules/shadow-edge-gm/scripts/animation-library.mjs');artTest.hp=game.actors.map(a=>[a.id,a.system.attributes.hp.value]);artTest.dialog=showAnimationLibrary(config=>foundry.applications.api.DialogV2.wait(config));});
  assert.equal(await page.locator('select[name=effect] option').count(),56);await page.locator('select[name=effect]').selectOption('arcane-sigil');await page.locator('button[data-action=preview]').click();await page.locator('select[name=effect]').waitFor();await page.locator('button[data-action=close]').last().click();
  const unchanged=await page.evaluate(()=>JSON.stringify(artTest.hp)===JSON.stringify(game.actors.map(a=>[a.id,a.system.attributes.hp.value])));assert(unchanged);
  await page.evaluate(()=>Hooks.off('shadow-edge-gm.animationStart',artTest.hook));
  console.log('Native texture frames, blood on hit only, animated textured vines and 56-option harmless preview: PASS');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exit(1)});
