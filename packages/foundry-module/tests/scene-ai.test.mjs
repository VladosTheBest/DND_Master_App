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
