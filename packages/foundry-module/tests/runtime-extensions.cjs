// Uses only disposable world documents; no real campaign or remote API.
const assert=require("node:assert/strict");
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||"playwright");
(async()=>{if(!process.env.FOUNDRY_TEST_URL)throw Error("Set FOUNDRY_TEST_URL to a launched disposable world.");const browser=await chromium.launch({headless:true,channel:"chrome"});try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});await page.goto(process.env.FOUNDRY_TEST_URL);if(await page.locator('select[name="userid"]').count())await page.selectOption('select[name="userid"]',{label:"Gamemaster"});else await page.locator('input[name="username"]').fill("Gamemaster");await page.locator('button[name="join"]').click();await page.waitForFunction(()=>typeof game!=="undefined"&&game.ready,null,{timeout:45000});
 const result=await page.evaluate(async()=>{
  const {basicAbility}=await import("/modules/shadow-edge-gm/scripts/adapter.mjs"),{authoringActor}=await import("/modules/shadow-edge-gm/scripts/core.mjs"),{importMapLabels,mapLabels}=await import("/modules/shadow-edge-gm/scripts/map-labels.mjs");
  const actor=await Actor.create({name:"Extension test",type:"npc"});let scene;
  try{
   const profiles=[{name:"Breath",damage:"4d6 fire",foundry:{kind:"save",saveAbility:"dex",saveDc:15,saveDamage:"half",range:30}},{name:"Heal",damage:"1d8+3",foundry:{kind:"heal",activation:"bonus"}},{name:"Bow",toHit:"+5",damage:"1d6 piercing",foundry:{kind:"attack",attackMode:"ranged",range:60}}];
   const items=await actor.createEmbeddedDocuments("Item",profiles.map(basicAbility));const dto=authoringActor(actor);
   const mechanics=profiles.map(p=>{const i=items.find(i=>i.name===p.name),a=i.system.activities.contents[0];return {type:a.type,saveDc:a.save?.dc?.value,range:a.range.value,formula:a.healing?.custom.formula,onSave:a.damage?.onSave}});
   const transported=await actor.createEmbeddedDocuments("Item",dto.items.map(basicAbility));const roundtrip=profiles.map(p=>transported.find(i=>i.name===p.name).system.activities.contents[0]?.type);
   scene=await Scene.create({name:"Label test",width:2000,height:1000,grid:{type:0}});
   await scene.view();for(let attempt=0;attempt<100&&!canvas.ready;attempt++)await new Promise(r=>setTimeout(r,100));
   if(!canvas.pendingRenderFlags)throw Error(`Canvas unavailable: ${JSON.stringify({ready:canvas.ready,initialized:canvas.initialized,scene:canvas.scene?.id,level:canvas.level?.id,levels:scene.levels?.size,noCanvas:game.settings.get("core","noCanvas"),renderer:canvas.app?.renderer?.constructor?.name})}`);
   const label={id:"town",text:"Город",x:.4,y:.5,size:20,rotation:0,font:"serif",color:"#ffffff",outline:"#000000",bold:false,italic:false,curve:15,span:200};const entry={};await importMapLabels(scene,[label],entry,async()=>false);await importMapLabels(scene,[label],entry,async()=>false);const count=scene.drawings.size;
   const drawing=scene.drawings.contents[0];await drawing.update({x:drawing.x+200,text:"Порт"});const exported=mapLabels(scene)[0];await importMapLabels(scene,[{...label,y:.7}],entry,async()=>false);const merged=mapLabels(scene)[0];
   await scene.activate();await new Promise(r=>setTimeout(r,750));await canvas.animatePan({x:1000,y:500,scale:.65,duration:0});
   return {mechanics,roundtrip,count,exported,merged,actorId:actor.id,sceneId:scene.id};
  }catch(e){if(scene)await scene.delete();await actor.delete();throw e}
 });
 try {
 assert.deepEqual(result.mechanics.map(x=>x.type),["save","heal","attack"]);assert.equal(result.mechanics[0].saveDc,15);assert.equal(result.mechanics[0].onSave,"half");assert.equal(result.mechanics[2].range,60);assert.equal(result.mechanics[1].formula,"1d8+3");assert.deepEqual(result.roundtrip,["save","heal","attack"]);assert.equal(result.count,1);assert.equal(result.exported.text,"Порт");assert(Math.abs(result.exported.x-.5)<1/2000);assert.equal(result.merged.text,"Порт");assert(Math.abs(result.merged.y-.7)<1e-8);
 if(process.env.FOUNDRY_SCREENSHOT)await page.screenshot({path:process.env.FOUNDRY_SCREENSHOT});
 console.log("Foundry extension smoke passed:",JSON.stringify({activities:result.roundtrip,labelCount:result.count}));
 }finally{await page.evaluate(async ids=>{await game.scenes.get(ids.sceneId)?.delete();await game.actors.get(ids.actorId)?.delete()},result)}
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
