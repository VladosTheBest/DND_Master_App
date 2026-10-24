const {build}=require('esbuild'),assert=require('node:assert/strict');
(async()=>{
 const b=await build({stdin:{contents:`export * from './apps/web/src/features/world-maps/creative-wall-chain';export {emptyScene,sceneFromJSON,normalizeScene,hitItem} from './apps/web/src/features/world-maps/creative-map';export {creativeWalls,creativeStructure} from './apps/web/src/features/world-maps/creative-vtt';`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',write:false,define:{'import.meta.env':'{}'}});
 const m={exports:{}};new Function('module','exports','require',b.outputFiles[0].text)(m,m.exports,require);
 const {wallSegment,wallEndpoint,emptyScene,sceneFromJSON,creativeWalls,creativeStructure,hitItem}=m.exports;
 const points=[[100,100],[300,100],[300,300],[100,300],[100,100]],scene=emptyScene();
 for(let n=1;n<points.length;n++)scene.items.push(wallSegment(points[n-1],points[n],3,'#404139','dungeon',`w${n}`));
 assert.equal(wallSegment(points[0],points[0],3,'#404139','dungeon','zero'),null);
 assert.equal(scene.items.length,4);assert.equal(hitItem(scene.items[0],[200,115],7/.25),true);assert.equal(hitItem(scene.items[0],[200,115],7),false);assert.ok(scene.items.every(i=>i.w===3));
 // Shared endpoints survive persistence and the VTT conversion without thickness offsets.
 const reopened=sceneFromJSON(JSON.stringify(scene));assert.deepEqual(reopened.items,scene.items);assert.deepEqual(creativeWalls(reopened),points.slice(1).map((p,i)=>[points[i],p]));
 assert.deepEqual(creativeWalls({...scene,items:scene.items.slice(0,-1)}),points.slice(1,-1).map((p,i)=>[points[i],p]));
 const snapped=wallEndpoint(scene,[302,101],[300,100],10,true);assert.deepEqual(snapped,[300,100]);
 snapped[0]=99;assert.equal(scene.items[0].points[1][0],300);
 assert.deepEqual(wallEndpoint(scene,[302,101],[300,100],10,false),[302,101]);
 assert.deepEqual(wallEndpoint({...scene,layers:scene.layers.map(l=>({...l,visible:false}))},[102,102],[105,105],10,true),[105,105]);
 const offGrid={...scene,items:[{...scene.items[0],points:[[113,117],[313,117]]}]};
 assert.deepEqual(wallEndpoint(offGrid,[114,118],[125,125],10,true),[113,117]);
 const rotated={...scene,items:[{...scene.items[0],rotation:90}]};const rotationSnap=wallEndpoint(rotated,[101,302],[100,300],10,true);assert.ok(Math.abs(rotationSnap[0]-100)<1e-9);assert.equal(rotationSnap[1],300);
 // Door removes only its opening. Moving the door restores the previous wall span.
 const door={id:'door',kind:'portal',x:150,y:100,w:32,h:30,rotation:0,color:'#404139',layerId:'dungeon',points:[[140,100],[180,100]]};
 const first=creativeStructure({...scene,items:[...scene.items,door]});
 const moved=creativeStructure({...scene,items:[...scene.items,{...door,points:[[210,100],[250,100]]}]});
 assert.deepEqual(first.walls.slice(0,2),[[[100,100],[140,100]],[[180,100],[300,100]]]);assert.deepEqual(moved.walls.slice(0,2),[[[100,100],[210,100]],[[250,100],[300,100]]]);assert.deepEqual(moved.doors,[[[210,100],[250,100]]]);
 const legacy={...scene.items[0],w:30};assert.equal(sceneFromJSON(JSON.stringify({...scene,items:[legacy]})).items[0].w,30);
 console.log('Wall chain: thin closed segments, no zero walls, snap/off-grid/rotation/visibility, undo geometry, save/reopen, VTT and doors passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
