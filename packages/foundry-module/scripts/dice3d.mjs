// Original perspective renderer; displays already evaluated rolls, never generates game results.
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),sub=(a,b)=>a.map((v,i)=>v-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=a=>{const n=Math.hypot(...a);return a.map(v=>v/n)};
const center=points=>points[0].map((_,i)=>points.reduce((s,p)=>s+p[i],0)/points.length);
export function convexFaces(vertices){
 const faces=new Map();for(let i=0;i<vertices.length;i++)for(let j=i+1;j<vertices.length;j++)for(let k=j+1;k<vertices.length;k++){
  let n=cross(sub(vertices[j],vertices[i]),sub(vertices[k],vertices[i]));if(Math.hypot(...n)<1e-6)continue;n=unit(n);let d=dot(n,vertices[i]);const ds=vertices.map(v=>dot(n,v)-d);if(ds.some(v=>v>1e-5)&&ds.some(v=>v<-1e-5))continue;if(ds.some(v=>v>1e-5)){n=n.map(v=>-v);d=-d}
  const ids=vertices.map((_,idx)=>idx).filter(idx=>Math.abs(dot(n,vertices[idx])-d)<1e-5),key=ids.join(',');if(faces.has(key))continue;
  const c=center(ids.map(idx=>vertices[idx])),u=unit(sub(vertices[ids[0]],c)),v=cross(n,u);ids.sort((a,b)=>Math.atan2(dot(sub(vertices[a],c),v),dot(sub(vertices[a],c),u))-Math.atan2(dot(sub(vertices[b],c),v),dot(sub(vertices[b],c),u)));faces.set(key,{ids,n,c});
 }return [...faces.values()];
}
const geometries=new Map();
export function dieGeometry(sides){
 if(geometries.has(sides))return geometries.get(sides);let vertices;
 const phi=(1+Math.sqrt(5))/2,ico=[];for(const a of [-1,1])for(const b of [-1,1])ico.push([0,a,b*phi],[a,b*phi,0],[b*phi,0,a]);
 if(sides===4)vertices=[[1,1,1],[1,-1,-1],[-1,1,-1],[-1,-1,1]];
 else if(sides===6){vertices=[];for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1])vertices.push([x,y,z])}
 else if(sides===8)vertices=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
 else if(sides===12)vertices=convexFaces(ico).map(f=>f.c);
 else if(sides===10||sides===100){const h=.1*(1+Math.cos(Math.PI/5))/(1-Math.cos(Math.PI/5));vertices=[[0,0,h],[0,0,-h],...Array.from({length:10},(_,i)=>[Math.cos(i*Math.PI/5),Math.sin(i*Math.PI/5),i%2?.1:-.1])]}
 else if(sides===20)vertices=ico;else return null;
 const radius=Math.max(...vertices.map(v=>Math.hypot(...v)));vertices=vertices.map(v=>v.map(x=>x/radius));const geometry={vertices,faces:convexFaces(vertices)};geometries.set(sides,geometry);return geometry;
}
export function rollDice(rolls){return rolls.flatMap(r=>(r.dice??[]).flatMap(d=>(d.results??[]).filter(v=>Number.isInteger(v.result)).map(v=>({sides:d.faces,result:v.result,discarded:Boolean(v.discarded||v.active===false)})))).filter(d=>dieGeometry(d.sides)).slice(0,30)}
let current;
export function showDice3d(rolls,id){
 const dice=rollDice(rolls);if(!dice.length||game.dice3d)return false;
 current?.();const canvas=document.createElement('canvas');canvas.className='shadow-edge-dice3d';canvas.width=window.innerWidth;canvas.height=window.innerHeight;canvas.setAttribute('aria-label',dice.map(d=>`d${d.sides}: ${d.result}`).join(', '));document.body.append(canvas);const ctx=canvas.getContext('2d');if(!ctx){canvas.remove();return false}
 let frame;const stop=()=>{cancelAnimationFrame(frame);canvas.remove();if(current===stop)current=null};current=stop;
 const start=performance.now();
 const rotate=(p,rx,ry)=>{const [x,y,z]=p,y1=y*Math.cos(rx)-z*Math.sin(rx),z1=y*Math.sin(rx)+z*Math.cos(rx);return [x*Math.cos(ry)+z1*Math.sin(ry),y1,-x*Math.sin(ry)+z1*Math.cos(ry)]};
 const draw=()=>{const t=(performance.now()-start)/1000;if(t>2){stop();return}ctx.clearRect(0,0,canvas.width,canvas.height);ctx.globalAlpha=t>1.6?(2-t)/.4:1;
  for(let index=0;index<dice.length;index++){const d=dice[index],g=dieGeometry(d.sides),winning=(d.result-1)%g.faces.length,n=g.faces[winning].n,rx=Math.atan2(n[1],n[2]),rotated=rotate(n,rx,0),ry=-Math.atan2(rotated[0],rotated[2]),spin=Math.max(0,1-t/1.25)**2;
   const verts=g.vertices.map(v=>rotate(v,rx+spin*(7+index),ry+spin*(9-index*.1))),faceData=g.faces.map((f,i)=>({f,i,c:center(f.ids.map(v=>verts[v])),normal:rotate(f.n,rx+spin*(7+index),ry+spin*(9-index*.1))})).filter(f=>f.normal[2]>0).sort((a,b)=>a.c[2]-b.c[2]);
   const columns=Math.min(6,dice.length),row=Math.floor(index/columns),col=index%columns,size=Math.min(52,canvas.width/(columns*3)),cx=canvas.width/2+(col-(columns-1)/2)*size*2.7+spin*Math.sin(index+2)*canvas.width*.25,cy=canvas.height*.6+row*size*2.6-Math.abs(Math.sin(t*9))*spin*180;
   const project=v=>[cx+v[0]*size*3/(3-v[2]),cy-v[1]*size*3/(3-v[2])];
   ctx.fillStyle='#0004';ctx.beginPath();ctx.ellipse(cx,cy+size*1.2,size*.8,size*.2,0,0,Math.PI*2);ctx.fill();
   for(const face of faceData){const light=.45+.55*Math.max(0,dot(face.normal,unit([-.3,.5,1]))),base=d.discarded?[90,90,100]:[95,57,156];ctx.fillStyle=`rgb(${base.map(v=>Math.round(v*light)).join(',')})`;ctx.strokeStyle='#dac6ff';ctx.lineWidth=1;ctx.beginPath();face.f.ids.forEach((v,i)=>{const p=project(verts[v]);if(i)ctx.lineTo(...p);else ctx.moveTo(...p)});ctx.closePath();ctx.fill();ctx.stroke();const p=project(face.c);ctx.fillStyle='#fff';ctx.font=`bold ${Math.max(11,size*(d.sides===20?.32:.4))}px serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(face.i===winning?d.result:d.sides===100?face.i*10:face.i+1),...p)}
  }Hooks.callAll('shadow-edge-gm.dice3dFrame',{id,dice});frame=requestAnimationFrame(draw);
 };draw();Hooks.callAll('shadow-edge-gm.dice3dStart',{id,dice});return true;
}
export function registerDice3d(){
 Hooks.on('createChatMessage',message=>{if(message.visible&&message.rolls?.length)showDice3d(message.rolls,message.id)});
 Hooks.on('canvasTearDown',()=>current?.());
}
