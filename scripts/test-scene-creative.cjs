const {build}=require('esbuild'),assert=require('node:assert/strict');
(async()=>{
const b=await build({entryPoints:['apps/web/src/features/world-maps/scene-creative.ts'],bundle:true,platform:'node',format:'cjs',write:false,define:{'import.meta.env':'{}'}});
const m={exports:{}};new Function('module','exports','require',b.outputFiles[0].text)(m,m.exports,require);
const drawing={version:1,background:'#eeeeee',grid:false,items:[{id:'room',kind:'room',x:800,y:500,w:1000,h:600,color:'#ffffff',rotation:0},{id:'old-door',kind:'portal',x:500,y:200,w:32,h:50,color:'#404139',rotation:0,points:[[450,200],[550,200]]}]};
const l={width:1600,height:1000,creative:JSON.stringify(drawing),walls:[{id:'new-door',kind:'door',start:{x:.6,y:.2},end:{x:.7,y:.2}}]};
const moved=m.exports.drawingWithSceneDoors(l);assert.deepEqual(moved.items.filter(i=>i.kind==='portal').map(i=>i.points),[[[960,200],[1120,200]]]);assert.equal(drawing.items[1].points[0][0],450);assert.deepEqual(moved.items[0],{...drawing.items[0],layerId:'dungeon'});
assert.equal(m.exports.drawingWithSceneDoors({...l,walls:[]}).items.filter(i=>i.kind==='portal').length,0);
const reopened=m.exports.drawingWithSceneDoors({...l,creative:JSON.stringify(moved)});assert.deepEqual(reopened,moved);
console.log('Creative scene: moved/deleted doorway, immutable source and save/reopen passed');
})();
