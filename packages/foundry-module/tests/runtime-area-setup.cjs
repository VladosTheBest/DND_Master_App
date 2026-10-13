// Real native activities, isolated temporary documents; no campaign actor changes.
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 if(!process.env.FOUNDRY_TEST_URL)throw Error('FOUNDRY_TEST_URL is required');
 const browser=await chromium.launch({headless:true,channel:'chrome'}),page=await browser.newPage();let ids;
 try{
  await page.goto(process.env.FOUNDRY_TEST_URL);await page.locator('input[name=username]').fill('Gamemaster');await page.locator('input[name=password]').fill(process.env.FOUNDRY_TEST_PASSWORD||'');await page.locator('button[name=join]').click();await page.waitForFunction(()=>globalThis.game?.ready);
  ids=await page.evaluate(async()=>{
   const {compendiumItem}=await import('/modules/shadow-edge-gm/scripts/adapter.mjs'),original=canvas.scene?.id;
   const caster=await Actor.create({name:'QA area caster',type:'npc',system:{abilities:{int:{value:18}},attributes:{spellcasting:'int'}}}),target=await Actor.create({name:'QA area target',type:'npc'});
   for(const name of ['Fireball','Grease']){const data=await compendiumItem(name,'2024','spell');data.flags??={};data.flags['shadow-edge-gm']={coverage:'partial',spellId:name.toLowerCase()+'-2024'};data.system.method='innate';await caster.createEmbeddedDocuments('Item',[data])}
   const scene=await Scene.create({name:'QA area temporary',width:1600,height:1200,grid:{size:100,distance:5},tokenVision:false,tokens:[{name:caster.name,actorId:caster.id,actorLink:true,x:200,y:300},{name:target.name,actorId:target.id,actorLink:true,x:900,y:300}]});await scene.view();
   return {caster:caster.id,target:target.id,scene:scene.id,original};
  });
  for(const spellName of ['Fireball','Grease']){
   const cast=await page.evaluate(async({ids,spellName})=>{
    const actor=game.actors.get(ids.caster),spell=actor.items.find(i=>i.name===spellName),activity=spell.system.activities.contents[0];canvas.tokens.placeables.find(t=>t.actor?.id===actor.id).control();
    const [region]=await canvas.scene.createEmbeddedDocuments('Region',[{name:'QA cast',shapes:[{type:'circle',x:950,y:350,radius:200}],flags:{core:{MeasuredTemplate:true},dnd5e:{activity:activity.uuid}}}]);
    // Avoid interactive placement only; native use, chat, coordinator and rolls are real.
    const h=Hooks.on('dnd5e.preUseActivity',a=>{if(a.item.id===spell.id)a._finalizeUsage=async(usage,result)=>{result.templates=[region]}});
    try{const result=await activity.use({create:{measuredTemplate:false}},{configure:false});return {origin:result.message.uuid,region:region.uuid}}finally{Hooks.off('dnd5e.preUseActivity',h)}
   },{ids,spellName});
   await page.waitForFunction(c=>game.messages.find(m=>m.flags['shadow-edge-gm']?.combat?.origin===c.origin)?.flags['shadow-edge-gm'].combat.phase==='resolve',cast);
   const button=page.getByRole('button',{name:'QA area target: спасбросок',exact:true});await button.click();
   await page.waitForFunction(c=>Number.isFinite(game.messages.find(m=>m.flags['shadow-edge-gm']?.combat?.origin===c.origin)?.flags['shadow-edge-gm'].combat.rows[0].save),cast);
   if(spellName==='Grease')await page.waitForFunction(c=>!!canvas.interface.getChildByName('shadow-edge-area:'+c.region)&&Date.now()-fromUuidSync(c.region).flags['shadow-edge-gm'].area.createdAt>3100,cast);
   const result=await page.evaluate(c=>{const r=fromUuidSync(c.region),w=game.messages.find(m=>m.flags['shadow-edge-gm']?.combat?.origin===c.origin).flags['shadow-edge-gm'].combat;return {exists:!!r,placement:!!r?.flags.core?.MeasuredTemplate,visibility:r?.visibility,save:w.rows[0].save,targets:w.rows.length}},cast);
   assert.equal(result.targets,1);assert(Number.isFinite(result.save));assert.equal(result.exists,spellName==='Grease');assert.equal(result.placement,false);if(result.exists)assert.equal(result.visibility,0);
   await page.evaluate(async()=>{for(const app of foundry.applications.instances.values())if(app.title==='Спасброски от заклинания')await app.close()});console.log(spellName,result);
  }
  const geometry=await page.evaluate(async()=>{
   const {areaTargets}=await import('/modules/shadow-edge-gm/scripts/combat.mjs');const region=new CONFIG.Region.documentClass({name:'QA holes',shapes:[{type:'circle',x:950,y:350,radius:300},{type:'circle',x:950,y:350,radius:100,hole:true}]},{parent:canvas.scene});
   const {sequencerFile}=await import('/modules/shadow-edge-gm/scripts/sequencer-effects.mjs');return {holeTargets:areaTargets(canvas.scene,region).length,file:sequencerFile('fireball','jb2a.fireball','cold',true)};
  });assert.equal(geometry.holeTargets,0);if(geometry.file)assert.match(geometry.file,/ice|cold|frost/i);console.log('Area setup passed',geometry);
 }finally{
  if(ids)await page.evaluate(async ids=>{const actorIds=[ids.caster,ids.target];await ChatMessage.deleteDocuments(game.messages.filter(m=>actorIds.includes(m.speaker.actor)).map(m=>m.id));if(ids.original)await game.scenes.get(ids.original)?.view();await game.scenes.get(ids.scene)?.delete();for(const id of actorIds)await game.actors.get(id)?.delete()},ids);
  await browser.close();
 }
})().catch(e=>{console.error(e);process.exitCode=1});
