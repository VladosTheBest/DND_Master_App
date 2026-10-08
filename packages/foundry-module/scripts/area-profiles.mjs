import {MODULE} from './core.mjs';
export const areaProfiles={
 grease:{name:'Grease',persistent:true,color:0x96b44b,terrain:true},
 'wall-of-fire':{name:'Wall of Fire',persistent:true,color:0xff7020,obscures:true},
 'spike-growth':{name:'Spike Growth',persistent:true,color:0x62b84b,terrain:true},
 entangle:{name:'Entangle',persistent:true,color:0x4bc177,terrain:true},
 darkness:{name:'Darkness',persistent:true,color:0x35244f,obscures:true},
 'fog-cloud':{name:'Fog Cloud',persistent:true,color:0xc4dce8,obscures:true},
 web:{name:'Web',persistent:true,color:0xdce8ed,terrain:true},
 moonbeam:{name:'Moonbeam',persistent:true,color:0xa6d6ff},
 thunderwave:{name:'Thunderwave',color:0x89caff},shatter:{name:'Shatter',color:0xc6b7ff},
 'ice-storm':{name:'Ice Storm',color:0x8adbff},
 oil:{name:'Скользкое масло',persistent:true,color:0xa89035,terrain:true,duration:300},
 acid:{name:'Acid',color:0x96ff42},'alchemists-fire':{name:"Alchemist's Fire",color:0xff6b20}
};
export function areaProfile(item){if(!item?.flags?.[MODULE])return null;const key=item.flags[MODULE].areaProfile??item.flags[MODULE].spellId?.replace(/-(2014|2024)$/,'');return Object.hasOwn(areaProfiles,key)?{key,...areaProfiles[key]}:null}
export function durationSeconds(duration,fallback=60){const units={round:6,turn:6,second:1,minute:60,hour:3600,day:86400};const n=Number(duration?.value),unit=units[duration?.units];return unit&&Number.isFinite(n)&&n>0?Math.min(86400,n*unit):fallback}
export function validZoneShapes(shapes){return Array.isArray(shapes)&&shapes.length>0&&shapes.length<=10&&shapes.every(s=>{
 const finite=n=>Number.isFinite(n)&&Math.abs(n)<=100000;
 if(s.type==='polygon')return Array.isArray(s.points)&&s.points.length>=6&&s.points.length<=256&&s.points.every(finite);
 return ['circle','rectangle','ellipse','line'].includes(s.type)&&finite(s.x)&&finite(s.y)&&finite(s.rotation??0)&&(s.type==='circle'?finite(s.radius)&&s.radius>0:s.type==='line'?finite(s.length)&&s.length>0&&finite(s.width)&&s.width>0:finite(s.width)&&s.width>0&&finite(s.height)&&s.height>0);
})}
export function zoneGeometry(shapes){
 if(!validZoneShapes(shapes))return null;
 const points=[];for(const s of shapes){if(s.type==='polygon'){for(let i=0;i<s.points.length;i+=2)points.push({x:s.points[i],y:s.points[i+1]})}else if(s.type==='circle'){points.push({x:s.x-s.radius,y:s.y-s.radius},{x:s.x+s.radius,y:s.y+s.radius})}else{const a=(s.rotation??0)*Math.PI/180,corners=s.type==='line'?[[0,-s.width/2],[s.length,-s.width/2],[s.length,s.width/2],[0,s.width/2]]:[[0,0],[s.width,0],[s.width,s.height],[0,s.height]];for(const [x,y] of corners)points.push({x:s.x+x*Math.cos(a)-y*Math.sin(a),y:s.y+x*Math.sin(a)+y*Math.cos(a)})}}
 const minX=Math.min(...points.map(p=>p.x)),minY=Math.min(...points.map(p=>p.y)),width=Math.max(...points.map(p=>p.x))-minX,height=Math.max(...points.map(p=>p.y))-minY;
 return {x:minX,y:minY,width,height,cx:minX+width/2,cy:minY+height/2};
}
