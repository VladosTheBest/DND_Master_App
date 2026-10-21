import test from 'node:test';
import assert from 'node:assert/strict';
import {createSceneAI,sceneAIRecord} from '../scripts/scene-ai.mjs';
import {sceneCreation,setSceneBackground,verifySceneImage} from '../scripts/scene-background.mjs';
import {persistentProjection} from '../scripts/adapter.mjs';
import {watchSceneJob} from '../scripts/scene-job-ui.mjs';
test('open generation dialog notices completion and stops checking on close',async()=>{
 let reads=0;
 const result=await watchSceneJob({job:{state:'running'},title:'Map',intervalMs:1,getJob:async()=>{reads++;return {state:'succeeded'}},waitClosed:config=>new Promise(resolve=>{
  const dialog=new EventTarget();dialog.element={querySelector:selector=>selector.startsWith('button')?{click:()=>resolve('check')}:{textContent:''}};config.render(null,dialog);
 })});assert.equal(result.state,'succeeded');assert.equal(reads,1);
 await watchSceneJob({job:{state:'running'},title:'Map',intervalMs:1,getJob:async()=>{reads++;return {state:'running'}},waitClosed:async config=>{
  const dialog=new EventTarget();config.render(null,dialog);dialog.dispatchEvent(new Event('close'));return 'later';
 }});await new Promise(resolve=>setTimeout(resolve,15));assert.equal(reads,1);
});
test('Foundry 14 stores the background in a native level and normalizes the import baseline',async()=>{
 globalThis.game={release:{generation:14}};
 const projection={name:'Map',background:{src:'local.png'},width:1000};
 const data=sceneCreation(projection);assert.equal(data.background,undefined);assert.equal(data.levels[0].background.src,'local.png');assert.equal(projection.background.src,'local.png');
 assert.equal(persistentProjection({toObject:()=>({...data,walls:[]})},projection).background.src,'local.png');
 const level={background:{src:null},update:async changes=>level.background.src=changes['background.src']};
 const scene={levels:{contents:[level]}};await setSceneBackground(scene,'local.png');assert.equal(level.background.src,'local.png');
});
test('broken background fails before creating an empty scene',async()=>{
 globalThis.Image=class {async decode(){throw Error('404')}};
 await assert.rejects(verifySceneImage('missing.png'),/пустая сцена не будет создана/);
 await assert.rejects(verifySceneImage(''),/отсутствует файл/);
});
test('scene requests are saved before transport, so a lost response can reuse the same request ID',async()=>{const state={records:{}},input={requestId:'stable',title:'Map',prompt:'A ruined tavern',columns:30,rows:20,distance:5},events=[];const ui=createSceneAI({connected:async()=>state,saveState:async()=>events.push('save'),waitClosed:async()=>input,request:async(_s,path,options)=>{events.push('request');assert.deepEqual(JSON.parse(options.body),input);throw Error('lost response')}});await assert.rejects(ui.launch(),/lost response/);assert.deepEqual(events,['save','request']);assert.equal(state.sceneAI.input.requestId,'stable')});
test('saved scene jobs resume without another generation request or synchronization timer',async()=>{const state={records:{},sceneAI:{jobId:'job',input:{title:'Map'}}},paths=[];const ui=createSceneAI({connected:async()=>state,saveState:async()=>{},waitClosed:async()=> 'later',request:async(_s,path)=>{paths.push(path);return {state:'running',stage:'Generating'}}});await ui.launch();assert.deepEqual(paths,['v1/scenes/ai/job']);assert.equal(state.sceneAI.jobId,'job');assert.deepEqual(sceneAIRecord({id:'map',title:'Map'}),{key:'session-map:map',id:'map',kind:'session-map',title:'Map',data:{id:'map',title:'Map'}})});
import {scenePlan} from '../scripts/adapter.mjs';
import {sceneLevel} from '../scripts/core.mjs';
import {doorAnimation,doorPlacementUpdates} from '../scripts/door-visual.mjs';
test('animated door survives export/import without adding visuals to old bitmaps',()=>{
 const visual={style:'wood',direction:-1,double:true,flip:false,strength:1,duration:700};
 const level={id:'g',name:'Map',width:1000,height:1000,walls:[{id:'d',kind:'door',start:{x:.4,y:.5},end:{x:.5,y:.5},doorVisual:visual},{id:'old',kind:'door',start:{x:.2,y:.5},end:{x:.3,y:.5}}]};
 const plan=scenePlan(sceneAIRecord({id:'map',title:'Map'}),level);
 assert.deepEqual(plan.walls[0].animation,doorAnimation(visual));assert.equal(plan.walls[1].animation,undefined);
 const back=sceneLevel(plan);assert.deepEqual(back.walls[0].doorVisual,visual);assert.equal(back.walls[1].doorVisual,undefined);
 const reopened=scenePlan(sceneAIRecord({id:'map',title:'Map'}),back);assert.deepEqual(reopened.walls[0].animation,plan.walls[0].animation);
});
test('door correction keeps connected jambs closed and does not move unrelated walls',()=>{
 const walls=[{id:'d',door:1,c:[100,100,200,100]},{id:'left',c:[0,100,100,100]},{id:'right',c:[200,100,300,100]},{id:'other',c:[0,0,100,0]}];
 const changes=doorPlacementUpdates(walls,'d',[110,120,210,120],{style:'iron'},true);
 assert.deepEqual(changes.map(x=>[x._id,x.c]),[['left',[0,100,110,120]],['right',[210,120,300,100]],['d',[210,120,110,120]]]);
 assert.equal(changes[2].animation.type,'swing');assert.deepEqual(walls[0].c,[100,100,200,100]);
 assert.throws(()=>doorPlacementUpdates(walls,'d',[1,1,1,1],{}),/4 px/);
});
import {createSceneMonitor,sceneEstimate,scenePreviewHTML} from '../scripts/scene-job-ui.mjs';
test('scene dimensions, doors, light radii and native weather survive projection and reverse',()=>{
 const level={id:'ground',name:'Church',imageUrl:'/map.png',width:1024,height:1024,columns:30,rows:20,grid:{size:1/30,type:'square'},gridDistance:5,weather:'storm',darkness:.6,walls:[{id:'d',kind:'door',start:{x:.2,y:.3},end:{x:.3,y:.3}}],lights:[{id:'l',x:.4,y:.5,bright:10,dim:20,color:'#ffbb77'}]};
 const plan=scenePlan(sceneAIRecord({id:'test',title:'Test'}),level);
 assert.equal(plan.width/plan.grid.size,30);assert.equal(plan.height/plan.grid.size,20);assert.equal(plan.padding,0);assert.equal(plan.weather,'rainStorm');assert.equal(plan.environment.darknessLevel,.6);assert.equal(plan.walls[0].door,1);assert.equal(plan.walls[0].ds,0);assert.equal(plan.lights[0].x,600);assert.equal(plan.lights[0].config.dim,20);
 const back=sceneLevel({...plan,lights:plan.lights.map(l=>({...l,id:'l'}))});assert.equal(back.weather,'storm');assert.equal(back.columns,30);assert.equal(back.rows,20);assert.equal(back.lights[0].x,.4);assert.equal(back.walls[0].kind,'door');
 assert.match(scenePreviewHTML('" onerror="bad',level,plan),/&quot;/);assert.match(sceneEstimate({createdAt:new Date(0).toISOString()},600000),/Дольше/);
});
test('background scene watcher resumes only pending jobs, notifies once, stops after completion',async()=>{
 let state={sceneAI:{jobId:'job'}},reads=0,notices=0,opened=0;
 const monitor=createSceneMonitor({readState:async()=>state,request:async()=>{reads++;return {state:reads===1?'running':'succeeded'}},notify:()=>notices++,onOpen:()=>opened++,intervalMs:1});
 await monitor.resume();await new Promise(resolve=>setTimeout(resolve,15));assert.equal(reads,2);assert.equal(notices,1);assert.equal(opened,0);await new Promise(resolve=>setTimeout(resolve,10));assert.equal(reads,2);
 state={};await monitor.resume();await new Promise(resolve=>setTimeout(resolve,10));assert.equal(reads,2);monitor.stop();
});
test('closing a watcher aborts stale completion and disconnected jobs do not retry',async()=>{
 let resolve,notices=0;const monitor=createSceneMonitor({readState:async()=>({sceneAI:{jobId:'job'}}),request:()=>new Promise(r=>resolve=r),notify:()=>notices++,onOpen:()=>{}});
 const pending=monitor.resume();await new Promise(r=>setTimeout(r,1));monitor.stop();resolve({state:'succeeded'});await pending;assert.equal(notices,0);
});

test('minimized card stays until opened, reports progress and distinguishes failure',async()=>{
 let opened=0,removed=0,reads=0;const updates=[];
 const monitor=createSceneMonitor({readState:async()=>({sceneAI:{jobId:'j',input:{title:'Dungeon'}}}),request:async()=>({state:++reads===1?'running':'succeeded',stage:'Drawing'}),notify:()=>{},onOpen:()=>opened++,intervalMs:1,createCard:open=>{monitor.openCard=open;return {update:(job,title)=>updates.push([job.state,title]),remove:()=>removed++}}});
 await monitor.resume();await new Promise(r=>setTimeout(r,20));assert.equal(reads,2);assert.equal(removed,0);assert.deepEqual(updates.at(-1),['succeeded','Dungeon']);monitor.openCard();assert.equal(opened,1);assert.equal(removed,1);
});
import {createSceneCard} from '../scripts/scene-job-ui.mjs';
test('card uses persistent text and color states, safe title text and a reopen action',()=>{
 const make=()=>({dataset:{},children:[],setAttribute(){},append(...children){this.children.push(...children)},remove(){this.removed=true}});const doc={body:make(),createElement:make};let opened=0;
 const card=createSceneCard(()=>opened++,doc),el=doc.body.children[0];card.update({state:'running',stage:'Drawing'},'<b>Map</b>');assert.equal(el.children[0].textContent,'<b>Map</b>');assert.equal(el.dataset.state,'running');assert.equal(el.children[2].hidden,false);
 card.update({state:'succeeded'},'Map');assert.equal(el.dataset.state,'ready');assert.match(el.children[1].textContent,/Сцена готова/);assert.equal(el.children[2].hidden,true);assert.equal(el.removed,undefined);el.children[4].onclick();assert.equal(opened,1);
 card.update({state:'failed'},'Map');assert.equal(el.dataset.state,'failed');assert.match(el.children[1].textContent,/Не удалось/);card.remove();assert.equal(el.removed,true);
});

test('failed generation retries immediately with preserved description and grid',async()=>{
 const input={requestId:'old',title:'Dungeon',prompt:'Seven connected rooms',columns:60,rows:40,distance:5,weather:'none'},state={records:{},sceneAI:{input,jobId:'old'}};let posts=0;
 const flow=createSceneAI({connected:async()=>state,saveState:async()=>{},request:async(_s,path,options)=>{if(options?.method==='POST'){posts++;const retry=JSON.parse(options.body);assert.equal(retry.prompt,input.prompt);assert.equal(retry.columns,60);assert.equal(retry.rows,40);assert.notEqual(retry.requestId,'old');return {id:'new'}}return path.endsWith('old')?{state:'failed',result:{error:{message:'Bad topology'}}}:{state:'running'}},waitClosed:async config=>config.window.title==='AI-сцена — ошибка'?'clear':'later'});
 await flow.launch();assert.equal(posts,1);assert.equal(state.sceneAI.jobId,'new');assert.equal(state.sceneAI.input.prompt,input.prompt);
});
import {replaceSceneTopology,topologySnapshot} from '../scripts/scene-topology.mjs';
test('scene creation uses accepted map directly without downloading the whole campaign',async()=>{
 const map={id:'fast',title:'Estate',levels:[{id:'g',name:'Estate',imageUrl:'/map.png',width:1200,height:600,columns:60,rows:30,grid:{size:1/60},gridDistance:5,weather:'storm',walls:[],lights:[]}]},state={title:'Campaign',base:'https://site',campaignId:'c',records:{},sceneAI:{jobId:'job',input:{title:'Estate'}}},paths=[];let created,viewed=0;
 globalThis.ui={notifications:{info(){}}};globalThis.Image=class {naturalWidth=1200;async decode(){}};
 globalThis.game={release:{generation:14},scenes:[],folders:[]};globalThis.Folder={create:async data=>({...data,id:'folder'})};
 globalThis.Scene={create:async data=>{created={...data,uuid:'Scene.fast',levels:{contents:data.levels},view:async()=>viewed++};return created}};
 const flow=createSceneAI({connected:async()=>state,saveState:async()=>{},localAsset:async()=>'/local.webp',waitClosed:async()=> 'create',request:async(_s,path)=>{paths.push(path);if(path.endsWith('/apply'))return map;if(path==='v1/scenes/ai/job')return {state:'succeeded',result:{data:map}};assert.fail('Unexpected campaign download: '+path)}});
 await flow.launch();assert.deepEqual(paths,['v1/scenes/ai/job','v1/scenes/ai/job/apply']);assert.equal(created.width,3000);assert.equal(created.height,1500);assert.equal(created.weather,'rainStorm');assert.equal(created.active,false);assert.equal(viewed,1);assert.equal(state.sceneAI,undefined);assert.deepEqual(state.records['session-map:fast/g'].record.data,map);
});
test('Foundry cancel action cannot become a generation request and old corrupt pending is repaired',async()=>{
 for(const pending of [undefined,{input:'cancel'}]){const state={sceneAI:pending,sceneDraft:{prompt:'Saved description'}};let forms=0;const flow=createSceneAI({connected:async()=>state,saveState:async()=>{},request:async()=>assert.fail('Cancel must not request AI'),waitClosed:async()=>{forms++;return 'cancel'}});await flow.launch();assert.equal(forms,1);assert.equal(state.sceneAI,undefined);assert.equal(state.sceneDraft.prompt,'Saved description');}
});
test('editing a failed request restores the draft without starting a new generation',async()=>{
 const input={title:'Dungeon',prompt:'Seven connected rooms',columns:60,rows:40,distance:5,weather:'none'},state={sceneAI:{input,jobId:'failed'}};let forms=0;
 const flow=createSceneAI({connected:async()=>state,saveState:async()=>{},request:async(_s,_p,options)=>{assert.equal(options?.method,undefined);return {state:'failed'}},waitClosed:async config=>{if(config.window.title==='AI-сцена — ошибка')return 'edit';forms++;const fields=Object.fromEntries(Object.keys(input).map(k=>[k,{value:''}]));config.render(null,{element:{querySelector:selector=>fields[selector.slice(6,-1)]}});assert.equal(fields.prompt.value,input.prompt);assert.equal(fields.columns.value,'60');assert.equal(fields.rows.value,'40');return null}});
 await flow.launch();assert.equal(forms,1);assert.equal(state.sceneAI,undefined);assert.deepEqual(state.sceneDraft,input);
});
test('topology replacement refuses edits made while AI was running',async()=>{
 const scene={walls:[],lights:[],environment:{darknessLevel:0}};const expected=topologySnapshot(scene);scene.environment.darknessLevel=.4;await assert.rejects(replaceSceneTopology(scene,expected,{}),/изменена/);
});

test('replacing topology rescales geometry and rolls back originals on failure',async()=>{
 function fixture(fail){const collection=items=>{const m=new Map(items.map(v=>[v._id,{...v,id:v._id,toObject(){const {_id,c}=this;return {_id,c}}}]));m[Symbol.iterator]=m.values.bind(m);return m};let n=0;return {width:200,height:100,walls:collection([{_id:'old',c:[0,0,10,0]}]),lights:collection([]),environment:{darknessLevel:0},async createEmbeddedDocuments(type,rows){if(fail&&type==='AmbientLight'&&rows.length)throw Error('light write failed');const m=type==='Wall'?this.walls:this.lights;return rows.map(row=>{const data={...row,id:row._id||`n${++n}`};data.toObject=()=>({...row,_id:data.id});m.set(data.id,data);return data})},async deleteEmbeddedDocuments(type,ids){const m=type==='Wall'?this.walls:this.lights;ids.forEach(id=>m.delete(id))},async update(data){this.environment.darknessLevel=data['environment.darknessLevel']}}}
 const plan={width:100,height:100,walls:[{c:[10,20,30,20]}],lights:[{x:10,y:20}],environment:{darknessLevel:.5}};
 const scene=fixture(false);await replaceSceneTopology(scene,topologySnapshot(scene),plan);assert.equal(scene.walls.has('old'),false);assert.deepEqual([...scene.walls][0].c,[20,20,60,20]);assert.equal([...scene.lights][0].x,20);
 const failed=fixture(true),before=topologySnapshot(failed);await assert.rejects(replaceSceneTopology(failed,before,plan),/light write failed/);assert.deepEqual(topologySnapshot(failed),before);
});
