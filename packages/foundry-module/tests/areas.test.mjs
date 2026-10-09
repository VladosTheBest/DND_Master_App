import test from 'node:test';import assert from 'node:assert/strict';
import {durationSeconds,validZoneShapes,zoneGeometry} from '../scripts/area-profiles.mjs';
import {areaExpired} from '../scripts/persistent-areas.mjs';
import {sceneLevel} from '../scripts/core.mjs';
import {persistentProjection} from '../scripts/adapter.mjs';
test('persistent areas follow game duration and concentration rather than real clock',()=>{assert.equal(durationSeconds({value:'10',units:'minute'}),600);assert.equal(durationSeconds({value:'5',units:'round'}),30);assert.equal(durationSeconds({value:'Infinity',units:'hour'},300),300);assert.equal(areaExpired({expiresAt:60,concentrationUuid:null},59,null),false);assert(areaExpired({expiresAt:60},60,null));for(const effect of [null,{disabled:true},{isSuppressed:true},{duration:{expired:true}}])assert(areaExpired({expiresAt:600,concentrationUuid:'Actor.a.ActiveEffect.c'},10,effect));assert.equal(areaExpired({expiresAt:600,concentrationUuid:'c'},10,{disabled:false}),false)});
test('rotated and polygonal areas retain their geometry and reject unbounded socket shapes',()=>{const shapes=[{type:'rectangle',x:100,y:200,width:600,height:20,rotation:90}];const b=zoneGeometry(shapes);assert(Math.abs(b.width-20)<.001);assert(Math.abs(b.height-600)<.001);assert.equal(b.cy,500);assert(validZoneShapes([{type:'polygon',points:[0,0,100,0,100,100]}]));for(const shape of [{type:'circle',x:0,y:0,radius:-1},{type:'polygon',points:[0,0,Infinity,0,10,10]},{type:'executeScript',x:0,y:0,width:10,height:10}])assert.equal(validZoneShapes([shape]),false)});
test('temporary vision walls are excluded from authoring export and merge baselines',()=>{const scene={width:1000,height:500,walls:[{id:'normal',c:[0,0,100,100]},{id:'runtime',c:[100,100,200,200],flags:{'shadow-edge-gm':{areaRegion:'Scene.s.Region.r'}}}]};assert.deepEqual(sceneLevel(scene).walls.map(w=>w.id),['normal']);assert.deepEqual(persistentProjection(scene,{walls:[{c:[0,0,100,100]}]}),{walls:[{c:[0,0,100,100]}]})});


// Boundary vertices cannot move away and expose strips of the underlying region.
 test('continuous area surface stays bounded and moves internally',async()=>{
 const {surfaceVertex}=await import('../scripts/area-surface.mjs');
 for(const key of ['entangle','spike-growth','web','darkness']){
  for(const t of [0,3,10,10000])for(let i=0;i<=24;i++)for(let j=0;j<=24;j++){
   const u=i/24,v=j/24,[x,y]=surfaceVertex(u,v,t,key);assert(x>=-1e-9&&x<=1+1e-9&&y>=-1e-9&&y<=1+1e-9);
   if(i===0||j===0||i===24||j===24){assert(Math.abs(x-u)<1e-9);assert(Math.abs(y-v)<1e-9)}
  }
  assert.notDeepEqual(surfaceVertex(.4,.6,3,key),surfaceVertex(.4,.6,6,key));
 }
 });
