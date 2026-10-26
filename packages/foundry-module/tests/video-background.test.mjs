import test from 'node:test';import assert from 'node:assert/strict';
import {directVideo,prepareVideoBackground,registerVideoBackground} from '../scripts/video-background.mjs';
import {scenePlan} from '../scripts/adapter.mjs';import {sceneLevel,MODULE} from '../scripts/core.mjs';
test('video scene preserves source, normal geometry, door and light through import/export',()=>{
 const video={url:'https://youtu.be/SeaI-P8zXbQ',startSeconds:0,durationSeconds:300,maxHeight:1440};
 const level={id:'ground',name:'Ground',imageUrl:'',video,width:1920,height:1080,columns:30,rows:20,walls:[{id:'a',kind:'door',start:{x:.1,y:.2},end:{x:.3,y:.4}}],lights:[{id:'l',x:.4,y:.5,bright:15,dim:30,color:'#ffffff'}]};
 const projection=scenePlan({key:'session-map/test',kind:'session-map',title:'Test',data:{levels:[level]}},level);
 assert.deepEqual(projection.flags[MODULE].videoSource,video);assert.equal(projection.active,false);assert.equal(projection.walls[0].door,1);assert.equal(projection.lights[0].walls,true);
 const returned=sceneLevel({...projection,background:{src:'shadow-edge-gm/video-cache/example.mp4'}});assert.equal(returned.imageUrl,'');assert.deepEqual(returned.video,video);
});
test('direct source bypasses helper; YouTube sends source metadata only and uses Foundry cache path',async()=>{
 const original=globalThis.fetch;let calls=0;globalThis.fetch=async(url,options)=>{calls++;assert.equal(url,'http://127.0.0.1:4197/jobs');assert.equal(options.credentials,'omit');const body=JSON.parse(options.body);assert.equal(body.maxHeight,1440);assert.equal(body.previewUrl,undefined);return {ok:true,json:async()=>({state:'ready',result:{path:'shadow-edge-gm/video-cache/'+'a'.repeat(32)+'.mp4'}})}};
 globalThis.game={settings:{get:(_module,key)=>key==='videoHelperKey'?'local-helper-key':'http://127.0.0.1:4197'}};
 try{assert.equal(directVideo('https://cdn.test/map.mp4?key=example'),true);assert.equal(directVideo('https://user:pass@cdn.test/map.mp4'),false);assert.equal(await prepareVideoBackground({url:'https://cdn.test/map.webm'}),'https://cdn.test/map.webm');assert.equal(calls,0);const path=await prepareVideoBackground({url:'https://youtu.be/SeaI-P8zXbQ',startSeconds:0,durationSeconds:300,maxHeight:1440,previewUrl:'http://old-host/video.mp4'});assert.match(path,/^shadow-edge-gm\/video-cache\//);assert.equal(calls,1)}finally{globalThis.fetch=original;delete globalThis.game}
});
test('native video loop is muted, applies clip bounds and removes handlers on scene teardown',()=>{
 const hooks=new Map(),handlers=new Map();const video={currentTime:0,duration:3600,readyState:1,addEventListener:(n,f)=>handlers.set(n,f),removeEventListener:n=>handlers.delete(n)};
 globalThis.Hooks={on:(n,f)=>hooks.set(n,f)};globalThis.game={settings:{register:()=>{}},video:{getVideoSource:()=>video}};globalThis.canvas={scene:{flags:{[MODULE]:{videoSource:{url:'https://cdn.test/a.mp4',startSeconds:30,durationSeconds:300}}}},primary:{background:{}}};
 try{registerVideoBackground();hooks.get('canvasReady')();assert.equal(video.currentTime,30);assert.equal(video.muted,true);video.currentTime=330;handlers.get('timeupdate')();assert.equal(video.currentTime,30);hooks.get('canvasTearDown')();assert.equal(handlers.size,0)}finally{delete globalThis.Hooks;delete globalThis.game;delete globalThis.canvas}
});
