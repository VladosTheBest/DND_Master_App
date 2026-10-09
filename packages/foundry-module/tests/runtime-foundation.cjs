// Native 2014/2024 SRD import and real PIXI geometry, in a disposable world only.
const assert=require('node:assert/strict'),fs=require('node:fs'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{if(!process.env.FOUNDRY_TEST_URL)throw Error('Disposable world URL required');const browser=await chromium.launch({headless:true,channel:'chrome'});try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(process.env.FOUNDRY_TEST_URL);await page.locator('input[name=username]').fill('Gamemaster');await page.locator('button[name=join]').click();await page.waitForFunction(()=>game?.ready);
 const catalog=JSON.parse(fs.readFileSync('apps/server/internal/httpapi/character_catalog.json','utf8')).spells;
 const imported=await page.evaluate(async catalog=>{
  const {animationCatalog}=await import('/modules/shadow-edge-gm/scripts/animation-catalog.mjs'),{actorPlan}=await import('/modules/shadow-edge-gm/scripts/adapter.mjs'),{animationProfile}=await import('/modules/shadow-edge-gm/scripts/animations.mjs');const out={};
  for(const edition of ['2014','2024']){
   const keys=animationCatalog.filter(p=>p.foundation).map(p=>p.key),spells=keys.map(k=>({id:k+'-'+edition,method:'innate',dailyUses:0}));
   const record={kind:'monster',key:'foundation:'+edition,data:{title:'Disposable foundation '+edition,statBlock:{hitPoints:'30',abilityScores:{cha:18}},foundryAI:{id:'foundation-test',mode:'configure',edition,castingAbility:'cha',spellSaveDc:16,abilities:[],spells,skills:[],loot:[]}}};
   const plan=await actorPlan(record,catalog),actor=await Actor.create({...plan.projection,items:plan.items});
   try{out[edition]=actor.items.filter(i=>i.type==='spell').map(i=>({key:i.flags['shadow-edge-gm'].spellId.replace(/-(2014|2024)$/,''),level:i.system.level,profile:animationProfile(i)?.key,coverage:i.flags['shadow-edge-gm'].coverage,activities:Array.from(i.system.activities.values()).map(a=>({type:a.type,dc:a.save?.dc?.value,parts:a.damage?.parts?.length})),valid:i.validate()}))}finally{await actor.delete()}
  }return out;
 },catalog);
 for(const edition of ['2014','2024']){assert.equal(imported[edition].length,40);for(const item of imported[edition]){assert(item.valid);assert.equal(item.coverage,'partial');assert.equal(item.profile,item.key);assert(item.activities.length>0);assert(item.level<=6)}}
 assert.equal(imported['2014'].find(i=>i.key==='inflict-wounds').activities[0].type,'attack');assert.equal(imported['2024'].find(i=>i.key==='inflict-wounds').activities[0].type,'save');
 const visual=await page.evaluate(async()=>{
  const {createDemoScene}=await import('/modules/shadow-edge-gm/scripts/demo.mjs'),scene=await createDemoScene();await scene.activate();while(!canvas.ready||canvas.scene.id!==scene.id)await new Promise(r=>setTimeout(r,50));
  const {artTexture}=await import('/modules/shadow-edge-gm/scripts/effect-art.mjs');for(const name of ['wall-fire','jaw-top','jaw-bottom','weapons','magic','mace','spear','tail','tentacle']){for(let n=0;n<100&&!artTexture(name);n++)await new Promise(r=>setTimeout(r,50));if(!artTexture(name))throw Error('Texture did not load '+name)}
  const {makeZonePainter}=await import('/modules/shadow-edge-gm/scripts/area-effects.mjs'),{makeRichPainter}=await import('/modules/shadow-edge-gm/scripts/rich-effects.mjs');
  const root=new PIXI.Container(),bg=new PIXI.Graphics();bg.beginFill(0x1b2029);bg.drawRect(0,0,1440,1000);bg.endFill();root.addChild(bg);
  const label=(text,x,y)=>{const l=new PIXI.Text(text,{fontFamily:'Arial',fontSize:20,fill:0xffffff});l.position.set(x,y);root.addChild(l)};
  const wallLayer=new PIXI.Container();root.addChild(wallLayer);const wall=makeZonePainter(wallLayer,'wall-of-fire',[{type:'line',x:80,y:180,length:620,width:45,rotation:0},{type:'circle',x:1080,y:190,radius:120}],80);wall.draw(1.2,1);
  const meshes=wallLayer.children.flatMap(c=>c.children??[]).filter(c=>c.name==='shadow-edge-fire-wall');const before=Array.from(meshes[0].geometry.getBuffer('aVertexPosition').data);wall.draw(1.7,1);const moved=before.some((v,i)=>v!==meshes[0].geometry.getBuffer('aVertexPosition').data[i]);label('WALL OF FIRE — continuous line / ring',50,25);
  for(const [i,key]of ['bite','tentacle','mace','hold-person','mage-armor','sacred-flame','disintegrate','counterspell'].entries()){
   const x=50+(i%4)*350,y=400+Math.floor(i/4)*280,layer=new PIXI.Container(),g=new PIXI.Graphics();root.addChild(layer);layer.addChild(g);label(key,x,y-50);const painter=makeRichPainter(layer,g,{key});painter.draw({x:x+30,y:y+80},{x:x+180,y:y+80,hit:true},.53,115,1);
  }
  const image=await canvas.app.renderer.extract.base64(root);root.destroy({children:true});return {meshes:meshes.length,moved,image};
 });assert.equal(visual.meshes,2);assert(visual.moved);fs.writeFileSync('tmp/foundry-foundation.png',Buffer.from(visual.image.split(',')[1],'base64'));
 const renders=await page.evaluate(async()=>{const {animationCatalog}=await import('/modules/shadow-edge-gm/scripts/animation-catalog.mjs'),{renderEffect,effectFinished}=await import('/modules/shadow-edge-gm/scripts/native-effects.mjs');let n=0;for(let start=0;start<animationCatalog.length;start+=16){const pending=[];for(const [i,p]of animationCatalog.slice(start,start+16).entries()){const id='foundation-render-'+p.key;if(!renderEffect({id,key:p.key,sceneId:canvas.scene.id,userId:game.user.id,actorUuid:game.actors.contents[0].uuid,source:{x:100,y:100+i*30},targets:[{x:300,y:100+i*30,hit:true}],size:70}))throw Error('Failed render '+p.key);n++;pending.push(effectFinished(id))}await Promise.all(pending)}return n});assert.equal(renders,85);assert.deepEqual(errors,[]);
 console.log('PASS: 80 native spell imports, edition-specific mechanics, 40 animation mappings, all 85 effects render/finish without JS errors, animated continuous wall line/ring and creature/control VFX.');
 }finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
