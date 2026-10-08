// Native Foundry import/migration; isolated world, synthetic snapshot and image only.
const assert=require('node:assert/strict'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 if(!process.env.FOUNDRY_TEST_URL)throw Error('Disposable Foundry URL required');
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
  const page=await browser.newPage();await page.goto(process.env.FOUNDRY_TEST_URL);await page.locator('input[name=username]').fill('Gamemaster');await page.locator('button[name=join]').click();await page.waitForFunction(()=>game?.ready);
  const result=await page.evaluate(async()=>{
   const {MODULE,clone,authoringActor}=await import('/modules/shadow-edge-gm/scripts/core.mjs');
   const {actorPlan,persistentProjection}=await import('/modules/shadow-edge-gm/scripts/adapter.mjs');
   const {animationProfile}=await import('/modules/shadow-edge-gm/scripts/animations.mjs');
   const {saveState,loadState}=await import('/modules/shadow-edge-gm/scripts/storage.mjs');
   const {refresh,exportSite}=await import('/modules/shadow-edge-gm/scripts/main.mjs');
   const base='https://presentation-test.invalid',campaignId='presentation-'+Date.now(),image='/uploads/test/'+campaignId+'/portrait.png';
   const rows=[
    {key:'npc:marr',id:'marr',kind:'npc',title:'NPC presentation test',hash:'same',data:{title:'NPC presentation test',content:'Страж с верёвкой и книгой.',art:{url:image},gallery:[{title:'Gallery detail',url:image.replace('portrait','detail'),caption:'Player image'}],statBlock:{hitPoints:'25',armorClass:'14',actions:[{name:'Короткий меч',toHit:'+4',damage:'1d6+2 slashing'},{name:'Дальний выстрел',toHit:'+4',damage:'1d8+2 piercing'}]}}},
    {key:'monster:beast',id:'beast',kind:'monster',title:'Beast',hash:'same',data:{title:'Beast',rewardProfile:{loot:[{name:'Шкура',quantity:'2',check:'Выживание',dc:'12'}]}}},
    {key:'location:parent',id:'parent',kind:'location',title:'Parent',hash:'same',data:{title:'Parent',content:'Private location'}},
    {key:'location:child',id:'child',kind:'location',title:'Child',hash:'same',data:{title:'Child',parentId:'parent',content:'Child location'}},
    {key:'world-map:map',id:'map',kind:'world-map',title:'World map',hash:'same',data:{title:'World map',width:1000,height:1000,imageUrl:image,labels:[]}},
    {key:'session-map:map2',id:'map2',kind:'session-map',title:'Session map',hash:'same',data:{title:'Session map',levels:[{id:'floor',name:'Floor',width:1000,height:1000,imageUrl:image,walls:[],grid:{type:'none'}}]}},
    {key:'player:p',id:'p',kind:'player',title:'Player',hash:'same',data:{title:'Player',art:{url:base+image}}},
    {key:'character:p',id:'sheet',kind:'character',title:'Wizard portrait',hash:'same',data:{playerId:'p',draft:{name:'Wizard portrait',classId:'wizard',edition:'2024',targetLevel:1,levels:[]},stats:{abilities:{int:16},maxHp:8,armorClass:12,spellSlots:[2]}}}
   ];
   const state={base,campaignId,title:'Presentation',records:{}};
   // Reproduce the old import: flat folder, empty icons, melee feat for a distant shot.
   const plan=await actorPlan(rows[0],[]),oldFolder=await Folder.create({name:'Shadow Edge · Presentation',type:'Actor'});
   delete plan.projection.img;plan.projection.folder=oldFolder.id;plan.projection.flags[MODULE]={...plan.projection.flags[MODULE],site:base,campaignId};
   const old=await Actor.create({...plan.projection,system:{...plan.projection.system,attributes:{...plan.projection.system.attributes,hp:{max:25,value:7}}}});
   const baseline={};for(let i=0;i<2;i++){const source=clone(plan.items[i]);source.type='feat';delete source.img;source.system.activities[Object.keys(source.system.activities)[0]].attack.type.value='melee';source.flags[MODULE].importKey=`ability-${i}`;const [item]=await old.createEmbeddedDocuments('Item',[source]);baseline[`ability-${i}`]=persistentProjection(item,source)}
   state.records[rows[0].key]={uuid:old.uuid,record:clone(rows[0]),projection:clone(plan.projection),adapterVersion:8,itemBaselines:baseline,authoring:authoringActor(old)};await saveState(state);
   const fetchOriginal=window.fetch;let assetDownloads=0,exported;
   window.fetch=async(url,options)=>{
    if(!String(url).startsWith(base+'/api/integrations/foundry/'))return fetchOriginal(url,options);
    if(String(url).endsWith('v1/snapshot'))return new Response(JSON.stringify({data:{schemaVersion:1,campaignId,title:'Presentation',records:rows,spells:[]}}),{headers:{'Content-Type':'application/json'}});
    if(String(url).includes('v1/assets?')){assetDownloads++;const bytes=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6jkAAAAAASUVORK5CYII='),c=>c.charCodeAt(0));return new Response(bytes,{headers:{'Content-Type':'image/png'}})}
    if(String(url).includes('v1/export/')){const input=JSON.parse(options.body);exported=input.changes;return new Response(JSON.stringify({data:String(url).endsWith('/preview')?{items:input.changes.map(v=>({key:v.key,status:'update',title:v.data.title})),canCommit:true}:{mappings:Object.fromEntries(input.changes.map(v=>[v.key,v.id]))}}),{headers:{'Content-Type':'application/json'}})}
    throw Error('Unexpected request');
   };
   try{
    await refresh();const progress=document.querySelector('.shadow-edge-import-progress');if(!progress||!progress.textContent.includes('Осталось 0')||progress.querySelector('progress').value!==progress.querySelector('progress').max)throw Error('Import progress did not finish');progress.querySelector('button').click();if(document.querySelector('.shadow-edge-import-progress'))throw Error('Progress did not close');const imported=await loadState(),npc=await fromUuid(imported.records['npc:marr'].uuid),monster=await fromUuid(imported.records['monster:beast'].uuid),wizard=await fromUuid(imported.records['character:p'].uuid);
    const path=doc=>{const out=[];let f=doc.folder;while(f){out.unshift(f.name);f=f.folder}return out};
    const attack=npc.items.find(i=>i.name==='Дальний выстрел'),activity=attack.system.activities.contents[0];
    const first={actorPath:path(npc),monsterPath:path(monster),playerPath:path(wizard),childPath:path(await fromUuid(imported.records['location:child'].uuid)),scenePath:path(await fromUuid(imported.records['session-map:map2/floor'].uuid)),attackType:attack.type,attackMode:activity.attack.type.value,animation:animationProfile(attack,activity).key,portrait:npc.img,token:npc.prototypeToken.texture.src,wizardPortrait:wizard.img,icons:npc.items.map(i=>i.img),hp:npc.system.attributes.hp.value,reward:monster.items.find(i=>i.name==='Шкура')?.system.quantity,media:game.journal.filter(j=>j.flags[MODULE]?.campaignId===campaignId&&j.flags[MODULE]?.managedMedia).map(j=>({path:path(j),type:j.pages.contents[0].type,src:j.pages.contents[0].src,ownership:j.ownership.default})),actors:game.actors.filter(a=>a.flags[MODULE]?.campaignId===campaignId).length};
    const rope=npc.items.find(i=>i.name==='Верёвка');await rope.delete();const sword=npc.items.find(i=>i.name==='Короткий меч');await sword.update({'system.description.value':'Local custom item'});const qty=monster.items.find(i=>i.name==='Шкура');await qty.update({'system.quantity':1});
    const before={items:npc.items.size,journals:game.journal.size,actors:game.actors.size,downloads:assetDownloads};
    await refresh();await refresh();rows[0].hash='updated';rows[1].hash='updated';await refresh();
    const after={items:npc.items.size,journals:game.journal.size,actors:game.actors.size,downloads:assetDownloads};
    first.repeat={before,after,rope:npc.items.some(i=>i.name==='Верёвка'),sword:sword.system.description.value,rewardQuantity:qty.system.quantity};
    const successfulFetch=window.fetch,oldPortrait=rows[0].data.art.url,failedPortrait=oldPortrait.replace('portrait','retry-portrait');rows[0].data.art.url=failedPortrait;
    window.fetch=async(url,options)=>String(url).includes('v1/assets?')&&decodeURIComponent(String(url)).includes('retry-portrait')?new Response('missing',{status:404}):successfulFetch(url,options);
    await refresh();const failureState=await loadState();if(!failureState.records['npc:marr'].mediaPending||failureState.assets[failedPortrait]||!document.querySelector('.shadow-edge-import-progress').textContent.includes('HTTP 404'))throw Error('Image failure must be explained, uncached and retriable');
    window.fetch=successfulFetch;await refresh();const retryState=await loadState();if(retryState.records['npc:marr'].mediaPending||!retryState.assets[failedPortrait])throw Error('Image retry did not recover');rows[0].data.art.url=oldPortrait;await refresh();
    // Every imported image/icon must resolve from Foundry, not the remote site.
    const paths=new Set([...first.icons,first.portrait,first.wizardPortrait,...first.media.map(v=>v.src)]);for(const url of paths){const r=await fetchOriginal(url);if(!r.ok)throw Error('Missing imported image: '+url);const img=new Image();img.src=url;await img.decode()}
    const Dialog=foundry.applications.api.DialogV2,wait=Dialog.wait,confirm=Dialog.confirm;
    try{Dialog.wait=async options=>{const element=document.createElement('div');element.innerHTML=options.content;return options.buttons.find(b=>b.action==='preview').callback(null,null,{element})};Dialog.confirm=async()=>true;await exportSite()}finally{Dialog.wait=wait;Dialog.confirm=confirm}
    if(!exported?.length||exported.some(v=>v.kind==='lore'&&v.data.gallery)||exported.some(v=>v.key.includes('JournalEntry')))throw Error('Gallery must not be exported as editable text');
    if(exported.find(v=>v.kind==='npc')?.data.art?.url!==image)throw Error('Portrait must reuse original asset URL when exported');
    return first;
   }finally{window.fetch=fetchOriginal;for(const c of [game.scenes,game.journal,game.actors])for(const doc of [...c])if(doc.flags[MODULE]?.campaignId===campaignId)await doc.delete();for(const f of [...game.folders].reverse())if(f.flags[MODULE]?.campaignId===campaignId)await f.delete();await saveState({records:{}})}
  });
  assert.equal(result.attackType,'weapon');assert.equal(result.attackMode,'ranged');assert.equal(result.animation,'bow');assert.equal(result.hp,7);assert.equal(result.reward,2);assert.equal(result.actors,3);
  assert.equal(result.actorPath.at(-1),'НПС');assert.equal(result.monsterPath.at(-1),'Монстры');assert.equal(result.playerPath.at(-1),'Игроки');assert.deepEqual(result.childPath.slice(-2),['Локации','Parent']);assert.deepEqual(result.scenePath.slice(-2),['Карты сессий','Session map']);assert(decodeURI(result.portrait).includes('/Портреты/'));assert.equal(result.token,result.portrait);assert(decodeURI(result.wizardPortrait).includes('/Портреты/'));assert(result.media.length>=5);assert(result.media.every(v=>v.type==='image'&&v.ownership===0&&v.path.some(p=>p.startsWith('Галерея'))));assert(result.icons.every(v=>v&&v!=='icons/svg/item-bag.svg'));
  assert.deepEqual(result.repeat.before,result.repeat.after);assert.equal(result.repeat.rope,false);assert.equal(result.repeat.sword,'Local custom item');assert.equal(result.repeat.rewardQuantity,1);
  console.log('Native migration, actor/location/map/gallery folders, local images, progress, HTTP404 report/retry, ranged-arrow correction, loot, repeat caching and local edits preserved: PASS');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
