export type CreativeKind = 'brush'|'wall'|'room'|'water'|'tree'|'table'|'chair'|'bed'|'rock'|'door'|'stairs'|'chest'|'fire';
export type CreativeItem = {id:string;kind:CreativeKind;x:number;y:number;w:number;h:number;rotation:number;color:string;points?:number[][]};
export type CreativeScene = {version:1;background:string;grid:boolean;items:CreativeItem[]};
export const decorations: [CreativeKind,string][] = [['tree','Дерево'],['table','Стол'],['chair','Стул'],['bed','Кровать'],['rock','Камень'],['door','Дверь'],['stairs','Лестница'],['chest','Сундук'],['fire','Костёр']];
export const emptyScene=():CreativeScene=>({version:1,background:'#777568',grid:true,items:[]});
export function paintScene(canvas:HTMLCanvasElement,scene:CreativeScene,selected='') {
 const c=canvas.getContext('2d');if(!c)return;
 c.clearRect(0,0,1600,1000);c.fillStyle=scene.background;c.fillRect(0,0,1600,1000);
 for(const item of scene.items){
  c.save();c.translate(item.x,item.y);c.rotate(item.rotation*Math.PI/180);c.fillStyle=item.color;c.strokeStyle='#302e2b';c.lineWidth=4;
  const w=item.w,h=item.h;
  const box=(x:number,y:number,a:number,b:number)=>{c.fillRect(x,y,a,b);c.strokeRect(x,y,a,b);};
  const circle=(x:number,y:number,r:number)=>{c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();c.stroke();};
  if(item.kind==='brush'||item.kind==='wall'){
   c.strokeStyle=item.color;c.lineWidth=w;c.lineCap='round';c.lineJoin='round';c.beginPath();
   item.points?.forEach(([x,y],i)=>{if(i)c.lineTo(x-item.x,y-item.y);else c.moveTo(x-item.x,y-item.y);});c.stroke();
  }else if(item.kind==='room'){box(-w/2,-h/2,w,h);c.lineWidth=10;c.strokeRect(-w/2,-h/2,w,h);}
  else if(item.kind==='water'){c.beginPath();c.ellipse(0,0,w/2,h/2,0,0,Math.PI*2);c.fill();c.stroke();}
  else if(item.kind==='tree'){c.fillStyle='#345b38';circle(-w*.2,0,w*.3);circle(w*.2,0,w*.3);circle(0,-h*.2,w*.34);c.fillStyle='#65834a';circle(0,h*.1,w*.28);}
  else if(item.kind==='rock'){c.fillStyle='#8e9293';c.beginPath();c.moveTo(-w/2,0);c.lineTo(-w/4,-h/2);c.lineTo(w*.35,-h*.3);c.lineTo(w/2,h*.25);c.lineTo(-w*.2,h/2);c.closePath();c.fill();c.stroke();}
  else if(item.kind==='fire'){c.fillStyle='#82634c';box(-w/2,-h*.1,w,h*.2);c.fillStyle='#ed833e';circle(0,0,w*.3);c.fillStyle='#ffdf79';circle(0,0,w*.15);}
  else {c.fillStyle=item.kind==='bed'?'#c4bca4':'#aa8051';box(-w/2,-h/2,w,h);
   if(item.kind==='table'){c.beginPath();c.moveTo(-w/2+8,0);c.lineTo(w/2-8,0);c.stroke();}
   if(item.kind==='bed'){c.fillStyle='#f5ecd7';box(-w*.4,-h*.4,w*.8,h*.22);}
   if(item.kind==='chair'){box(-w/2,-h/2,w,h*.25);}
   if(item.kind==='chest'){c.fillStyle='#e2ba62';box(-w*.08,-h/2,w*.16,h);}
   if(item.kind==='stairs'){for(let y=-h/2;y<h/2;y+=12){c.beginPath();c.moveTo(-w/2,y);c.lineTo(w/2,y);c.stroke();}}
   if(item.kind==='door'){c.fillStyle='#ddb959';circle(w*.3,0,4);}
  }
  if(item.id===selected){c.strokeStyle='#bb8bff';c.lineWidth=3;c.setLineDash([7,5]);c.strokeRect(-w/2-7,-h/2-7,w+14,h+14);}
  c.restore();
 }
 if(scene.grid){c.strokeStyle='#ffffff28';c.lineWidth=1;c.beginPath();for(let x=0;x<=1600;x+=50){c.moveTo(x,0);c.lineTo(x,1000);}for(let y=0;y<=1000;y+=50){c.moveTo(0,y);c.lineTo(1600,y);}c.stroke();}
}
export async function creativePNG(scene:CreativeScene):Promise<Blob>{const canvas=document.createElement('canvas');canvas.width=1600;canvas.height=1000;paintScene(canvas,scene);return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Не удалось экспортировать холст.')),'image/png'));}
