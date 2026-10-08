// Disposable world: real dnd5e Region placement, template cleanup, animation-before-combat and Dice So Nice.
const assert=require('node:assert/strict'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 if(!process.env.FOUNDRY_TEST_URL)throw Error('Disposable world required');
 const browser=await chromium.launch({headless:true,channel:'chrome'}),page=await browser.newPage({viewport:{width:1440,height:900}});let initial;
 try{
  await page.goto(process.env.FOUNDRY_TEST_URL);await page.locator('input[name=username]').fill('Gamemaster');await page.locator('button[name=join]').click();await page.waitForFunction(()=>game?.ready&&game.dice3d?.box);await page.mouse.move(800,450);
  initial=await page.evaluate(async()=>{
   const {createDemoScene}=await import('/modules/shadow-edge-gm/scripts/demo.mjs');const scene=await createDemoScene();
   await canvas.animatePan({x:850,y:650,scale:.65,duration:0});await game.togglePause(false,true);await ui.sidebar.expand();await ui.sidebar.changeTab('chat','primary');
   const actors=canvas.tokens.placeables.map(t=>({id:t.actor.id,hp:t.actor.system.attributes.hp.value,temp:t.actor.system.attributes.hp.temp}));
   // This is an isolated demo world; remove stale templates left by interrupted test runs.
   for(const region of [...scene.regions])if(region.flags.dnd5e?.activity)await region.delete();
   const [unrelated]=await scene.createEmbeddedDocuments('Region',[{name:'Preserved region',shapes:[{type:'circle',x:1400,y:900,radius:50}]}]);
   window.__areaEvents=[];window.__dsnRolls=[];window.__areaGraphics=new Map();window.__areaRendered=new Set();
   Hooks.on('shadow-edge-gm.animationFrame',e=>{if(e.graphics.geometry?.graphicsData?.length>4||e.graphics.parent?.children.filter(c=>c.visible).length>10)window.__areaRendered.add(e.id)});
   Hooks.on('shadow-edge-gm.animationStart',e=>{window.__areaEvents.push({kind:'start',id:e.id,time:performance.now(),regions:canvas.scene.regions.size});window.__areaGraphics.set(e.id,e.graphics)});
   Hooks.on('shadow-edge-gm.animationEnd',e=>window.__areaEvents.push({kind:'end',id:e.id,time:performance.now()}));
   Hooks.on('diceSoNiceRollStart',(id,data)=>window.__dsnRolls.push({id,sides:data.roll.dice.map(d=>d.faces),time:performance.now()}));
   return {scene:scene.id,actors,unrelated:unrelated.id,regions:scene.regions.size};
  });
  for(const key of ['fireball-2024','burning-hands-2024','lightning-bolt-2024','thunderwave-2024','shatter-2024','ice-storm-2024']){
   await page.mouse.move(800,450);
   await page.evaluate(key=>{const caster=canvas.tokens.placeables.find(t=>t.name.startsWith('Тестовый маг'));caster.control();for(const t of game.user.targets)t.setTarget(false,{user:game.user});const item=caster.actor.items.find(i=>i.flags['shadow-edge-gm']?.spellId===key);window.__areaCast=item.system.activities.contents[0].use({},{configure:false})},key);
   await page.waitForFunction(()=>!!canvas.regions._placementContext?.preview);
   const point=await page.evaluate(key=>{const p=canvas.stage.toGlobal(new PIXI.Point(950,key==='fireball-2024'?650:550));return {x:p.x,y:p.y}},key);await page.mouse.click(point.x,point.y);
   await page.waitForFunction(()=>game.messages.some(m=>m.flags['shadow-edge-gm']?.combat?.phase==='animation'&&window.__areaEvents.some(e=>e.kind==='start'&&e.id===m.flags['shadow-edge-gm'].combat.origin)));
   const state=await page.evaluate(async()=>{const result=await window.__areaCast,card=game.messages.find(m=>m.flags['shadow-edge-gm']?.combat?.origin===result.message.uuid);return {id:card.id,origin:result.message.uuid,workflow:card.flags['shadow-edge-gm'].combat,regionUuid:result.templates[0].uuid,regions:canvas.scene.regions.size}});
   assert(state.workflow.rows.length>0);assert.equal(state.regions,initial.regions);assert.equal(await page.evaluate(uuid=>!!fromUuidSync(uuid),state.regionUuid),false);
   assert.equal(await page.locator(`[data-message-id="${state.id}"] [data-segm-action]`).count(),0);
   // Even a forged request during the animation must not roll a save.
   await page.evaluate(async state=>{await ChatMessage.create({content:'Early save request',whisper:[game.user.id],flags:{'shadow-edge-gm':{combatRequest:{workflowUuid:'ChatMessage.'+state.id,action:'save',targetUuid:state.workflow.rows[0].tokenUuid}}}})},state);
   await page.waitForFunction(id=>window.__areaRendered.has(id),state.origin);
   if(process.env.FOUNDRY_SCREENSHOT&&key==='fireball-2024'){await page.waitForFunction(id=>performance.now()-window.__areaEvents.find(e=>e.id===id&&e.kind==='start').time>1000,state.origin);await page.screenshot({path:process.env.FOUNDRY_SCREENSHOT})}
   await page.waitForFunction(id=>game.messages.get(id).flags['shadow-edge-gm'].combat.phase==='resolve',state.id);
   const outcome=await page.evaluate(({id,origin})=>({events:window.__areaEvents.filter(e=>e.id===origin),destroyed:window.__areaGraphics.get(origin).destroyed,rows:game.messages.get(id).flags['shadow-edge-gm'].combat.rows}),state);
   assert.equal(outcome.events.length,2);assert.equal(outcome.events[0].kind,'start');assert.equal(outcome.events[1].kind,'end');assert(outcome.events[1].time-outcome.events[0].time>=2700);assert(outcome.destroyed);assert(outcome.rows.every(r=>r.save===null));assert(await page.locator(`[data-message-id="${state.id}"] [data-segm-action=save]`).count()>0);
   if(key==='fireball-2024'){
    await page.locator(`[data-message-id="${state.id}"] [data-segm-action=save]`).first().click();await page.waitForFunction(()=>window.__dsnRolls.length>0);
    const dsn=await page.evaluate(()=>({rolls:window.__dsnRolls,custom:document.querySelectorAll('.shadow-edge-dice3d').length,canvas:!!document.querySelector('#dice-box-canvas')}));assert(dsn.rolls[0].sides.includes(20));assert.equal(dsn.custom,0);assert(dsn.canvas);
   }
   console.log(key+' real Region removed; 2.8s effect ends before saving throws');
  }
  assert(await page.evaluate(id=>!!canvas.scene.regions.get(id),initial.unrelated));
 }finally{if(initial)await page.evaluate(async initial=>{for(const a of initial.actors)await game.actors.get(a.id)?.update({'system.attributes.hp.value':a.hp,'system.attributes.hp.temp':a.temp});await game.scenes.get(initial.scene)?.regions.get(initial.unrelated)?.delete()},initial);await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
