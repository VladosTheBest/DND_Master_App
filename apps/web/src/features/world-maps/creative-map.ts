import {assetById,paintAsset} from './creative-assets';
import {mapMediaURL} from './world-maps.api';
export const MAP_WIDTH=1600,MAP_HEIGHT=1000;
export type Point=[number,number];
export type CreativeKind='terrain'|'road'|'river'|'brush'|'wall'|'room'|'water'|'ellipse'|'polygon'|'corridor'|'cave'|'cut'|'asset'|'image'|'text'|'tree'|'table'|'chair'|'bed'|'rock'|'door'|'stairs'|'chest'|'fire';
export type CreativeItem={id:string;kind:CreativeKind;x:number;y:number;w:number;h:number;rotation:number;color:string;points?:Point[];material?:string;assetId?:string;imageUrl?:string;text?:string;layerId?:string;locked?:boolean;flipX?:boolean};
export type CreativeLayer={id:string;name:string;visible:boolean;locked:boolean;opacity:number};
export type CreativeScene={width?:number;height?:number;feetPerCell?:number;mapType?:string;surface?:string;version:1|2;background:string;grid:boolean;items:CreativeItem[];layers?:CreativeLayer[];style?:string;gridSize?:number;wallWidth?:number;floorColor?:string;wallColor?:string;hatching?:boolean};
export const floorKinds=new Set(['room','ellipse','polygon','corridor','cave','cut']);
export const styles=[
 {id:'classic',name:'Классическая тушь',background:'#e9e4d8',floor:'#faf7ed',wall:'#35352f'},
 {id:'parchment',name:'Старый пергамент',background:'#b8a27b',floor:'#e7d5af',wall:'#5b4336'},
 {id:'blueprint',name:'Синий чертёж',background:'#233e59',floor:'#315775',wall:'#c2dfeb'},
 {id:'stone',name:'Серый камень',background:'#666b69',floor:'#c4c6bc',wall:'#292e2c'},
 {id:'night',name:'Тёмное подземелье',background:'#242a32',floor:'#4d5860',wall:'#b9bec0'},
 {id:'forest',name:'Лесное убежище',background:'#6b7758',floor:'#d4d3a8',wall:'#414d35'},
];
export const defaultLayers=():CreativeLayer[]=>[
 {id:'terrain',name:'Земля и вода',visible:true,locked:false,opacity:1},
 {id:'dungeon',name:'Помещения',visible:true,locked:false,opacity:1},
 {id:'props',name:'Декорации',visible:true,locked:false,opacity:1},
 {id:'notes',name:'Подписи',visible:true,locked:false,opacity:1},
];
export const emptyScene=():CreativeScene=>({version:2,width:1600,height:1000,feetPerCell:5,background:styles[0].background,floorColor:styles[0].floor,wallColor:styles[0].wall,style:'classic',grid:true,gridSize:50,wallWidth:5,hatching:true,layers:defaultLayers(),items:[]});
export function normalizeScene(s:CreativeScene):CreativeScene {
 const layers=s.layers?.length?s.layers:defaultLayers();
 return {...emptyScene(),...s,version:2,layers,items:s.items.map(i=>({...i,layerId:i.layerId||(['water','brush','terrain','road','river'].includes(i.kind)?'terrain':floorKinds.has(i.kind)||i.kind==='wall'?'dungeon':i.kind==='text'?'notes':'props')}))};
}
export function sceneFromJSON(raw:string):CreativeScene {
 if(new TextEncoder().encode(raw).length>1024*1024)throw new Error('Проект больше 1 МБ.');
 const s=JSON.parse(raw) as CreativeScene,hex=/^#[a-f0-9]{6}$/i;
 if(!s||![1,2].includes(s.version)||!hex.test(s.background)||typeof s.grid!=='boolean'||!Array.isArray(s.items)||s.items.length>1000)throw new Error('Некорректный проект карты.');
 if((s.version===2||s.layers!==undefined)&&(!Array.isArray(s.layers)||!s.layers.length||s.layers.length>16||s.layers.some(l=>!l||typeof l.id!=='string'||!l.id||l.id.length>80||typeof l.name!=='string'||l.name.length>80||typeof l.visible!=='boolean'||typeof l.locked!=='boolean'||!Number.isFinite(l.opacity)||l.opacity<0||l.opacity>1)||new Set(s.layers.map(l=>l.id)).size!==s.layers.length))throw new Error('Некорректные слои.');
 for(const [key,min,max] of [['gridSize',10,200],['wallWidth',1,20]] as const){const n=s[key];if(n!==undefined&&(!Number.isFinite(n)||n<min||n>max))throw new Error('Некорректные настройки сетки или стен.');}
 if(s.style!==undefined&&!styles.some(v=>v.id===s.style)||s.floorColor!==undefined&&!hex.test(s.floorColor)||s.wallColor!==undefined&&!hex.test(s.wallColor))throw new Error('Некорректное оформление.');
 if(s.mapType!==undefined&&!mapTypes.some(t=>t.id===s.mapType)||s.surface!==undefined&&s.surface!==''&&!materials.some(m=>m.id===s.surface))throw new Error('Неизвестный тип местности.');
 const {width,height}=sceneSize(s);
 for(const value of [width,height])if(!Number.isInteger(value)||value<200||value>3200)throw new Error('Сторона карты: от 200 до 3200 пикселей.');
 if(s.feetPerCell!==undefined&&(!Number.isFinite(s.feetPerCell)||s.feetPerCell<1||s.feetPerCell>1000))throw new Error('Масштаб клетки: от 1 до 1000 футов.');
 const ids=new Set<string>();
 for(const i of s.items){
  if(!i||typeof i.id!=='string'||!i.id||i.id.length>80||ids.has(i.id)||!hex.test(i.color)||![i.x,i.y,i.w,i.h,i.rotation].every(Number.isFinite)||i.x<0||i.x>width||i.y<0||i.y>height||i.w<1||i.w>4096||i.h<1||i.h>4096||Math.abs(i.rotation)>180||!['terrain','road','river','brush','wall','room','water','ellipse','polygon','corridor','cave','cut','asset','image','text','tree','table','chair','bed','rock','door','stairs','chest','fire'].includes(i.kind))throw new Error('Некорректный объект.');
  if(i.material!==undefined&&!materials.some(m=>m.id===i.material))throw new Error('Неизвестный материал.');
  ids.add(i.id);
  if(s.version===2&&!s.layers?.some(l=>l.id===i.layerId))throw new Error('Не найден слой объекта.');
  if(i.kind==='asset'&&!assetById.has(i.assetId||''))throw new Error('Неизвестный ассет.');
  if(i.kind==='image'&&(typeof i.imageUrl!=='string'||!/^\/uploads\/[\w-]+\/[\w-]+\/[^/\\?#]+$/.test(i.imageUrl)))throw new Error('Загрузи изображение в текущую кампанию.');
  if(i.kind==='text'&&(typeof i.text!=='string'||!i.text.trim()||[...i.text].length>160))throw new Error('Подпись должна содержать 1–160 символов.');
  if(i.points!==undefined&&(!Array.isArray(i.points)||i.points.length>5000||i.points.some(p=>!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)||p[0]<0||p[0]>width||p[1]<0||p[1]>height)))throw new Error('Некорректный контур.');
  if(['terrain','road','river','polygon','brush','wall','cave','corridor','cut'].includes(i.kind)&&(!i.points||i.points.length<(i.kind==='polygon'?3:2)))throw new Error('Не хватает точек контура.');
 }
 return normalizeScene(s);
}
export function itemBounds(i:CreativeItem){
 if(i.points?.length){const xs=i.points.map(p=>p[0]),ys=i.points.map(p=>p[1]),pad=i.kind==='polygon'?0:i.w/2;return {x:Math.min(...xs)-pad,y:Math.min(...ys)-pad,w:Math.max(...xs)-Math.min(...xs)+2*pad,h:Math.max(...ys)-Math.min(...ys)+2*pad};}
 return {x:i.x-i.w/2,y:i.y-i.h/2,w:i.w,h:i.h};
}
export function moveItem(i:CreativeItem,dx:number,dy:number,scene?:CreativeScene):CreativeItem{
 const {width,height}=sceneSize(scene);
 const b=itemBounds(i);dx=Math.max(-Math.max(0,b.x),Math.min(width-Math.min(width,b.x+b.w),dx));dy=Math.max(-Math.max(0,b.y),Math.min(height-Math.min(height,b.y+b.h),dy));
 return {...i,x:Math.max(0,Math.min(width,i.x+dx)),y:Math.max(0,Math.min(height,i.y+dy)),...(i.points?{points:i.points.map(([x,y])=>[x+dx,y+dy] as Point)}:{})};
}
export function hitItem(i:CreativeItem,p:Point){
 if(i.kind==='polygon'&&i.points){let hit=false;for(let a=0,b=i.points.length-1;a<i.points.length;b=a++){const A=i.points[a],B=i.points[b];if((A[1]>p[1])!==(B[1]>p[1])&&p[0]<(B[0]-A[0])*(p[1]-A[1])/(B[1]-A[1])+A[0])hit=!hit;}return hit;}
 if(i.points)return i.points.some((q,index)=>{const a=i.points![Math.max(0,index-1)],dx=q[0]-a[0],dy=q[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(a[0]+t*dx-p[0],a[1]+t*dy-p[1])<i.w/2+7;});
 const a=-i.rotation*Math.PI/180,dx=p[0]-i.x,dy=p[1]-i.y;return Math.abs(dx*Math.cos(a)-dy*Math.sin(a))<=i.w/2+5&&Math.abs(dx*Math.sin(a)+dy*Math.cos(a))<=i.h/2+5;
}
function newCanvas(scale=1,scene?:CreativeScene){const {width,height}=sceneSize(scene);const c=document.createElement('canvas');c.width=width*scale;c.height=height*scale;return c;}
function geometry(c:CanvasRenderingContext2D,i:CreativeItem){
 c.save();c.translate(i.x,i.y);c.rotate(i.rotation*Math.PI/180);c.beginPath();
 if(i.points?.length&&['road','river','terrain'].includes(i.kind)){const pts=i.points;c.moveTo(pts[0][0]-i.x,pts[0][1]-i.y);for(let n=1;n<pts.length-1;n++){const p=pts[n],q=pts[n+1];c.quadraticCurveTo(p[0]-i.x,p[1]-i.y,(p[0]+q[0])/2-i.x,(p[1]+q[1])/2-i.y);}const end=pts.at(-1)!;c.lineTo(end[0]-i.x,end[1]-i.y);}
 else if(i.points?.length){i.points.forEach(([x,y],n)=>n?c.lineTo(x-i.x,y-i.y):c.moveTo(x-i.x,y-i.y));if(i.kind==='polygon')c.closePath();}
 else if(i.kind==='ellipse'||i.kind==='water')c.ellipse(0,0,i.w/2,i.h/2,0,0,Math.PI*2);
 else c.rect(-i.w/2,-i.h/2,i.w,i.h);
 if(i.points&&i.kind!=='polygon'){c.lineWidth=i.w;c.lineCap=i.kind==='corridor'?'square':'round';c.lineJoin='round';c.stroke();}else c.fill();c.restore();
}
// Merge the floor mask first: overlapping rooms/corridors have no interior seams.
// Subtractive strokes cut the mask, then wall and hatch rings follow its final shape.
const dungeonCache=new Map<string,HTMLCanvasElement>();
function dungeon(target:CanvasRenderingContext2D,items:CreativeItem[],scene:CreativeScene,scale=1){
  if(!items.length)return;const {width,height}=sceneSize(scene);
 const key=JSON.stringify([width,height,scale,items,scene.wallWidth,scene.wallColor,scene.floorColor,scene.hatching]);
 const cached=dungeonCache.get(key);if(cached){target.drawImage(cached,0,0,width,height);return;}
 const output=newCanvas(scale,scene),c=output.getContext('2d')!;c.scale(scale,scale);
 const mask=newCanvas(scale,scene),m=mask.getContext('2d')!;m.scale(scale,scale);m.fillStyle=m.strokeStyle='#ffffff';
 for(const i of items){m.globalCompositeOperation=i.kind==='cut'?'destination-out':'source-over';geometry(m,i);}
 const expand=(radius:number)=>{const out=newCanvas(scale,scene),o=out.getContext('2d')!;o.scale(scale,scale);for(let a=0;a<24;a++){const r=a*Math.PI/12;o.drawImage(mask,Math.cos(r)*radius,Math.sin(r)*radius,width,height);}o.drawImage(mask,0,0,width,height);return out;};
 const colorize=(cv:HTMLCanvasElement,color:string)=>{const ctx=cv.getContext('2d')!;ctx.globalCompositeOperation='source-in';ctx.fillStyle=color;ctx.fillRect(0,0,width,height);ctx.globalCompositeOperation='source-over';};
 if(scene.hatching){const halo=expand((scene.wallWidth||5)+18),h=halo.getContext('2d')!;h.globalCompositeOperation='source-in';const pattern=document.createElement('canvas');pattern.width=pattern.height=16;const p=pattern.getContext('2d')!;p.strokeStyle=scene.wallColor||'#35352f';p.lineWidth=1.4;p.beginPath();p.moveTo(-4,16);p.lineTo(16,-4);p.moveTo(4,20);p.lineTo(20,4);p.stroke();h.fillStyle=h.createPattern(pattern,'repeat')!;h.fillRect(0,0,width,height);c.drawImage(halo,0,0,width,height);}
 const wall=expand(scene.wallWidth||5);colorize(wall,scene.wallColor||'#35352f');c.drawImage(wall,0,0,width,height);
 colorize(mask,scene.floorColor||'#faf7ed');c.drawImage(mask,0,0,width,height);
 if(scale===1){dungeonCache.set(key,output);if(dungeonCache.size>4)dungeonCache.delete(dungeonCache.keys().next().value!);}target.drawImage(output,0,0,width,height);
}
const imageCache=new Map<string,HTMLImageElement>();
const pendingImages=new Map<string,Promise<void>>();
export async function prepareSceneImages(scene:CreativeScene){await Promise.all(scene.items.filter(i=>i.kind==='image').map(async i=>{
 const url=i.imageUrl!;if(imageCache.has(url))return;
 let job=pendingImages.get(url);if(!job){job=new Promise<void>((resolve,reject)=>{const image=new Image();image.crossOrigin='use-credentials';image.onload=()=>{imageCache.set(url,image);resolve();};image.onerror=()=>reject(new Error('Не удалось загрузить объект-изображение.'));image.src=mapMediaURL(url);});pendingImages.set(url,job);job.finally(()=>pendingImages.delete(url)).catch(()=>{});}await job;
}));}
export function paintScene(canvas:HTMLCanvasElement,raw:CreativeScene,selected:string|string[]=[],preview:Point[]=[]){
 const scene=normalizeScene(raw),c=canvas.getContext('2d');if(!c)return;const {width,height}=sceneSize(scene);const scale=canvas.width/width;c.save();c.scale(scale,scale);
 c.clearRect(0,0,width,height);c.fillStyle=scene.background;c.fillRect(0,0,width,height);if(scene.surface){c.fillStyle=materialPattern(c,scene.surface);c.fillRect(0,0,width,height);}
 for(const layer of scene.layers!){if(!layer.visible)continue;
 const items=scene.items.filter(i=>i.layerId===layer.id);if(!items.length)continue;const cv=newCanvas(scale,scene),l=cv.getContext('2d')!;l.scale(scale,scale);
 dungeon(l,items.filter(i=>floorKinds.has(i.kind)),scene,scale);
 for(const i of items.filter(i=>!floorKinds.has(i.kind))){
  l.save();
  if(['terrain','road','river'].includes(i.kind)){if(i.kind!=='terrain'){l.fillStyle=l.strokeStyle=i.kind==='river'?'#9d986e':'#716348';geometry(l,{...i,w:i.w+8});}l.fillStyle=l.strokeStyle=materialPattern(l,i.kind==='river'?'water':i.material||'earth');geometry(l,i);}
  else if(i.kind==='brush'||i.kind==='wall'||i.kind==='water'){l.fillStyle=l.strokeStyle=i.color;geometry(l,i);}
  else {l.translate(i.x,i.y);l.rotate(i.rotation*Math.PI/180);if(i.flipX)l.scale(-1,1);
   if(i.kind==='image'){const image=imageCache.get(i.imageUrl!);if(image)l.drawImage(image,-i.w/2,-i.h/2,i.w,i.h);else{l.fillStyle='#ba8d8d';l.fillRect(-i.w/2,-i.h/2,i.w,i.h);}}
   else if(i.kind==='text'){l.fillStyle=i.color;l.font=`600 ${i.h}px Georgia`;l.textAlign='center';l.textBaseline='middle';l.fillText(i.text||'',0,0,i.w);}
   else paintAsset(l,i.assetId||i.kind,i.w,i.h);
  }l.restore();
 }
 c.globalAlpha=layer.opacity;c.drawImage(cv,0,0,width,height);c.globalAlpha=1;
 }
 if(scene.grid){const size=scene.gridSize||50;c.strokeStyle=scene.wallColor||'#35352f';c.globalAlpha=.18;c.lineWidth=1;c.beginPath();for(let x=0;x<=width;x+=size){c.moveTo(x,0);c.lineTo(x,height);}for(let y=0;y<=height;y+=size){c.moveTo(0,y);c.lineTo(width,y);}c.stroke();c.globalAlpha=1;}
 const ids=Array.isArray(selected)?selected:[selected];
 for(const i of scene.items.filter(i=>ids.includes(i.id)&&scene.layers!.some(l=>l.id===i.layerId&&l.visible))){const b=itemBounds(i);c.save();c.strokeStyle='#8251d8';c.lineWidth=2;c.setLineDash([8,5]);c.strokeRect(b.x-5,b.y-5,b.w+10,b.h+10);c.restore();}
 if(preview.length){c.strokeStyle='#8251d8';c.lineWidth=3;c.beginPath();preview.forEach(([x,y],n)=>n?c.lineTo(x,y):c.moveTo(x,y));c.stroke();for(const [x,y] of preview){c.fillStyle='#8251d8';c.fillRect(x-4,y-4,8,8);}}
 c.restore();
}
export async function creativePNG(scene:CreativeScene,scale=1):Promise<Blob>{if(![1,2,3].includes(scale)||sceneSize(scene).width*sceneSize(scene).height*scale*scale>16000000)throw new Error('Экспорт ограничен 16 мегапикселями. Выбери меньшее разрешение.');await prepareSceneImages(scene);const canvas=newCanvas(scale,scene);paintScene(canvas,scene);return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Не удалось экспортировать холст.')),'image/png'));}
export const mapTypes=[{id:'dungeon',name:'Подземелье',surface:''},{id:'city',name:'Город',surface:'cobble'},{id:'village',name:'Деревня',surface:'grass'},{id:'wilderness',name:'Открытая местность',surface:'grass'}];
export const materials=[{id:'grass',name:'Луговая трава',color:'#819061'},{id:'earth',name:'Грунт',color:'#b19a73'},{id:'sand',name:'Песок',color:'#dac99c'},{id:'snow',name:'Снег',color:'#e1e8e6'},{id:'cobble',name:'Брусчатка',color:'#a4a39a'},{id:'water',name:'Вода',color:'#669eaa'}];
const textureCache=new Map<string,HTMLCanvasElement>();
function materialPattern(ctx:CanvasRenderingContext2D,id:string):CanvasPattern{
 let tile=textureCache.get(id);if(!tile){tile=document.createElement('canvas');tile.width=tile.height=128;const c=tile.getContext('2d')!,base=materials.find(m=>m.id===id)?.color||'#b19a73';c.fillStyle=base;c.fillRect(0,0,128,128);let seed=734;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 if(id==='cobble'){for(let row=0;row<8;row++)for(let col=-1;col<9;col++){const x=col*16+(row%2)*8,y=row*16;c.fillStyle=`rgba(${random()>.5?'255,255,255':'30,35,25'},${.04+random()*.1})`;c.beginPath();c.roundRect(x+1,y+1,14,14,3);c.fill();c.strokeStyle='#77786b';c.lineWidth=.6;c.stroke();}}
 else for(let i=0;i<650;i++){const x=random()*128,y=random()*128;c.strokeStyle=`rgba(${random()>.5?'255,255,235':'30,45,26'},${.04+random()*.13})`;c.lineWidth=.5+random();c.beginPath();c.moveTo(x,y);if(id==='water')c.bezierCurveTo(x+3,y-2,x+5,y+2,x+9,y);else c.lineTo(x+(id==='grass'?2:1),y+(id==='grass'?-4:1));c.stroke();}
 textureCache.set(id,tile);}
 return ctx.createPattern(tile,'repeat')!;
}

export function sceneSize(scene?:CreativeScene){return {width:scene?.width??1600,height:scene?.height??1000};}
export function distanceFeet(a:Point,b:Point,scene:CreativeScene){return Math.hypot(b[0]-a[0],b[1]-a[1])/(scene.gridSize||50)*(scene.feetPerCell??5);}
export const formatFeet=(n:number)=>`${Math.round(n*10)/10} фт`;

export function rescaleProps(scene:CreativeScene,gridSize:number,feetPerCell:number):CreativeScene{
 const factor=gridSize/(scene.gridSize||50)*(scene.feetPerCell??5)/feetPerCell;
 const items=scene.items.map(i=>i.kind==='image'||i.kind==='asset'||assetById.has(i.kind)?{...i,w:i.w*factor,h:i.h*factor}:i);
 if(items.some(i=>i.w<1||i.h<1||i.w>4096||i.h>4096))throw new Error('При таком масштабе предметы выходят за допустимые размеры. Выбери другой масштаб.');
 return {...scene,gridSize,feetPerCell,items};
}
