import {assetById} from './creative-assets';
import {emptyScene,sceneSize,hitItem,type CreativeScene,type CreativeItem,type Point} from './creative-map';

export const templates=[{id:'forest',name:'Лес'},{id:'camp',name:'Лагерь в лесу'},{id:'city',name:'Город'},{id:'village',name:'Деревня'},{id:'dungeon',name:'Подземелье'},{id:'cave',name:'Пещера'}] as const;
export type Template=typeof templates[number]['id'];
export function seededRandom(seed:number){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
const trees=['tree','pine','oak-1','oak-2','oak-3'];

/** Bounded rejection sampling leaves a visible gap, including between successive brush stamps. */
export function forestStamp(scene:CreativeScene,center:Point,radius:number,scale=1,random=Math.random,layerId='props',count=8):CreativeItem[]{
 const {width,height}=sceneSize(scene),unit=(scene.gridSize||50)/(scene.feetPerCell??5)/10,added:CreativeItem[]=[];
 for(let attempt=0;attempt<count*30&&added.length<count&&scene.items.length+added.length<1000;attempt++){
  const assetId=trees[Math.floor(random()*trees.length)],a=assetById.get(assetId)||assetById.get('tree')!,factor=unit*scale*(.75+random()*.5),w=Math.max(1,a.w*factor),h=Math.max(1,a.h*factor),angle=random()*Math.PI*2,r=Math.sqrt(random())*radius,x=center[0]+Math.cos(angle)*r,y=center[1]+Math.sin(angle)*r,pad=Math.hypot(w,h)/2;
  if(w>4096||h>4096||x<pad||y<pad||x>width-pad||y>height-pad)continue;
  if(scene.items.some(i=>(i.kind==='road'||i.kind==='river')&&hitItem({...i,w:i.w+Math.max(w,h)},[x,y])))continue;
  if([...scene.items,...added].some(i=>i.kind==='asset'&&Math.hypot(i.x-x,i.y-y)<(Math.max(i.w,i.h)+Math.max(w,h))*.55+6*unit))continue;
  added.push({id:crypto.randomUUID(),kind:'asset',assetId:a.id,x,y,w,h,rotation:random()*360-180,color:'#ffffff',layerId});
 }
 return added;
}

export function generateTemplate(kind:Template,base:CreativeScene,seed:number):CreativeScene{
 const random=seededRandom(seed),{width:w,height:h}=sceneSize(base),small=Math.min(w,h),unit=(base.gridSize||50)/(base.feetPerCell??5)/10;
 const underground=kind==='dungeon'||kind==='cave';
 const s:CreativeScene={...emptyScene(),width:w,height:h,gridSize:base.gridSize,feetPerCell:base.feetPerCell,mapType:underground?'dungeon':kind==='city'?'city':kind==='village'?'village':'wilderness',surface:underground?'':'grass',grid:underground,hatching:underground,background:underground?'#666b69':'#71865b',floorColor:'#c4c6bc',wallColor:'#292e2c',style:underground?'stone':'forest'};
 const add=(kind:CreativeItem['kind'],x:number,y:number,width:number,height:number,extra:Partial<CreativeItem>={})=>{s.items.push({id:crypto.randomUUID(),kind,x,y,w:Math.max(1,width),h:Math.max(1,height),rotation:0,color:'#ffffff',layerId:underground?'dungeon':'terrain',...extra});};
 const prop=(id:string,x:number,y:number,scale=1,rotation=0)=>{const a=assetById.get(id);if(!a)return;const width=Math.max(1,a.w*unit*scale),height=Math.max(1,a.h*unit*scale),pad=Math.hypot(width,height)/2;if(width>4096||height>4096||pad>Math.min(x,y,w-x,h-y))return;add('asset',x,y,width,height,{assetId:id,rotation,layerId:'props'});};
 const path=(kind:CreativeItem['kind'],points:Point[],width:number,material?:string)=>add(kind,points[0][0],points[0][1],width,width,{points,material});
 const plant=(count:number,exclude=0)=>{for(let n=0;n<count;n++){const p:Point=[random()*w,random()*h];if(Math.hypot(p[0]-w/2,p[1]-h/2)<exclude)continue;s.items.push(...forestStamp(s,p,small*.035,1,random,'props',1));}};
 if(kind==='forest'||kind==='camp'){
  const bend=.3+random()*.4;
  path('road',[[w*.06,h*.82],[w*.3,h*bend],[w*.5,h*.5],[w*.72,h*(1-bend)],[w*.94,h*.18]],small*.055,'forest-path');
  if(kind==='camp'){
   path('terrain',[[w*.44,h*.5],[w*.56,h*.5]],small*.3,'earth');
   prop('fire',w*.5,h*.5);for(let n=0;n<4;n++){const angle=n*Math.PI/2+random()*.25;prop('tent',w*.5+Math.cos(angle)*small*.2,h*.5+Math.sin(angle)*small*.2,1,angle*180/Math.PI%360-180);}
   prop('crate',w*.62,h*.63);prop('barrel',w*.64,h*.4);prop('table',w*.42,h*.55);plant(160,small*.32);
  }else plant(220);
 }else if(kind==='city'||kind==='village'){
  const city=kind==='city',road=small*.07,cols=city?5:3,rows=city?4:2;
  path('road',[[w*.05,h*.5],[w*.95,h*.5]],road,city?'cobble':'earth');path('road',[[w*.5,h*.05],[w*.5,h*.95]],road,city?'flagstone':'earth');
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
   const px=(x+.5)*w/cols,py=(y+.5)*h/rows;if(Math.abs(px-w/2)<road||Math.abs(py-h/2)<road)continue;
   prop(['cottage','slate-house','thatch-house'][Math.floor(random()*3)],px+(random()-.5)*w/cols*.18,py+(random()-.5)*h/rows*.18,city?1.5:1.2,random()<.5?0:90);
   prop('lantern',px+w/cols*.25,py);if(random()<.6)prop('barrel',px-w/cols*.25,py);
  }
  prop(city?'fountain':'well',w*.5,h*.5);plant(city?12:50,small*.15);
 }else if(kind==='dungeon'){
  const centers:Point[]=[];
  for(let y=0;y<2;y++)for(let x=0;x<3;x++){
   const cx=(x+.5)*w/3,cy=(y+.5)*h/2,rw=w*(.17+random()*.08),rh=h*(.24+random()*.09);centers.push([cx,cy]);add('room',cx,cy,rw,rh);prop(random()<.5?'table':'altar',cx,cy);prop('chest',cx+rw*.28,cy+rh*.25);
  }
  for(let n=1;n<centers.length;n++){const a=centers[n-1],b=centers[n];path('corridor',[a,[b[0],a[1]],b],small*.075);}
  prop('stairs',w/6,h*.18);
 }else{
  const centers:Point[]=Array.from({length:6},(_,n)=>[w*(.12+n*.15),h*(.25+random()*.5)]);
  centers.forEach((p,n)=>{add('ellipse',p[0],p[1],w*(.16+random()*.09),h*(.22+random()*.12));if(n)path('cave',[centers[n-1],p],small*.14);prop(n===5?'chest':'rock',p[0],p[1]);});
  prop('stairs',centers[0][0],centers[0][1]);
 }
 return s;
}
