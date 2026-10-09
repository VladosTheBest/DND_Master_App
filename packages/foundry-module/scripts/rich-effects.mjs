import {makeArtSprites} from './effect-art.mjs';
import {animationCatalog} from './animation-catalog.mjs';
import {drawSignature} from './signature-effects.mjs';
const clamp=x=>Math.max(0,Math.min(1,x)),ease=x=>1-(1-clamp(x))**3;
export function makeRichPainter(layer,g,p){
 const art=makeArtSprites(layer),spec=animationCatalog.find(a=>a.key===p.key);
 const color=p.color?parseInt(p.color.slice(1),16):spec?.color??0x99bbff;
 const line=(a,b,width,c,alpha)=>{g.lineStyle(width,c,alpha);g.moveTo(a.x,a.y);g.lineTo(b.x,b.y)};
 const dot=(x,y,r,c,alpha)=>{g.beginFill(c,alpha);g.drawCircle(x,y,r);g.endFill()};
 const ring=(x,y,r,alpha,rotation=0)=>{for(let j=0;j<3;j++){g.lineStyle(1.5+j,color,alpha/(j+1));g.drawCircle(x,y,r*(1+j*.08))}for(let j=0;j<12;j++){const a=j*Math.PI/6+rotation,point=r*.92;line({x:x+Math.cos(a)*point,y:y+Math.sin(a)*point},{x:x+Math.cos(a)*r*.72,y:y+Math.sin(a)*r*.72},2,color,alpha)}};
 return {handlesTemplate:Boolean(spec?.style),reset:()=>art.reset(),burst(x,y,r,t,fade){if(p.key==='fireball'&&!p.color){const sprite=art.draw('flame',x,y,r*2,t*.35,fade*.7);if(sprite)sprite.blendMode=PIXI.BLEND_MODES.ADD}},draw(a,b,t,s,fade){
  const style=spec?.style??({'fire-bolt':'flame','ray-of-frost':'ice',bless:'radiant'}[p.key]??''),weapon=spec?.weapon??(['sword','axe','hammer','dagger','spear','claw'].includes(p.key)?p.key:null),angle=Math.atan2(b.y-a.y,b.x-a.x);
  const point=(x,y,o=b)=>({x:o.x+Math.cos(angle)*x-Math.sin(angle)*y,y:o.y+Math.sin(angle)*x+Math.cos(angle)*y});
  const impact=clamp((t-.46)/.54),arrival=ease((t-.28)/.22);
  if(drawSignature({g,art,style,weapon,a,b,t,s,fade,color}))return true;
  if(weapon){
   const wind=ease(t/.28),swing=ease((t-.28)/.24),theta=angle-1.5*wind+2.1*swing,reach=clamp(t/.45)*.65;
   const origin={x:a.x+(b.x-a.x)*reach,y:a.y+(b.y-a.y)*reach};
   for(let j=0;j<9;j++){g.lineStyle(s*(.075-j*.006),style==='flame'?0xff752c:color,Math.sin(swing*Math.PI)*fade*(.3-j*.028));g.arc(origin.x,origin.y,s*(.84+j*.02),theta-.9,theta)}
   const weaponAlpha=fade*(1-clamp((t-.7)/.24));
   if(['sword','axe','hammer','dagger','spear'].includes(weapon))art.draw(weapon,origin.x,origin.y,s*(weapon==='dagger'?.9:1.5),theta,weaponAlpha,.12);
   else if(weapon==='claw'){for(let j=-1;j<=1;j++){const q=point(-s*.4,j*s*.16),r=point(s*.45,j*s*.16);line(q,r,s*.04,0xffeee7,Math.sin(swing*Math.PI)*fade)}}
   else {const q=point(-s*.6,0,origin),r=point(s*.7,0,origin);line(q,r,s*.045,0x806042,weaponAlpha);g.beginFill(0xe4f2ff,weaponAlpha);const tip=point(s,0,origin),l=point(s*.65,s*.11,origin),v=point(s*.65,-s*.11,origin);g.drawPolygon([tip.x,tip.y,l.x,l.y,v.x,v.y]);g.endFill()}
   if(impact>0){
    if((spec?.blood||['sword','axe','dagger','claw'].includes(weapon))&&b.hit===true){
     art.draw('blood-slash',b.x,b.y,s*(1.35+impact*.7),angle+.15,Math.sin(Math.min(1,impact*2)*Math.PI/2)*(1-impact)**.65);
     for(let j=0;j<22;j++){const phase=j*2.399,travel=s*(.25+impact*(.4+(j%7)*.12)),q=point(Math.cos(phase)*travel*.6+impact*s*.4,Math.sin(phase)*travel);dot(q.x,q.y,s*(.018+(j%3)*.008)*(1-impact),j%3?0x9e071a:0xe63240,fade)}
    }else for(let j=0;j<18;j++){const th=j*2.399,q=point(Math.cos(th)*s*impact,Math.sin(th)*s*impact);line(q,point(Math.cos(th)*s*(impact+.1),Math.sin(th)*s*(impact+.1)),2,color,(1-impact)*fade)}
    if(style==='flame'||style==='frost'||style==='lightning')for(let j=0;j<16;j++){const u=j/16,q=point((u-.5)*s,Math.sin(j*3+t*20)*s*.16);dot(q.x,q.y,s*.06,color,fade*(1-impact))}
   }
   return true;
  }
  if(!style)return false;
  if(['sigil','radiant','psychic','shadow','vines'].includes(style)){
   const flow=clamp(t/.42),travel={x:a.x+(b.x-a.x)*flow,y:a.y+(b.y-a.y)*flow};
   for(let j=0;j<10;j++)dot(travel.x-Math.cos(angle)*j*s*.06,travel.y-Math.sin(angle)*j*s*.06,s*.09*(1-j/11),color,fade*(1-flow));
   if(style==='vines'){for(let j=0;j<3;j++)art.draw('vines',b.x,b.y,s*(1.6+j*.12)*ease(t/.45),Math.sin(t*4+j)*.08+j*2.1,fade*arrival/(1+j*.8));}
   else if(style==='shadow'){for(let j=0;j<30;j++){const th=j*2.4+t*4,r=s*(.12+(j%6)*.1)*arrival;dot(b.x+Math.cos(th)*r,b.y+Math.sin(th)*r,s*.13,color,fade*.4)}}
   else {if(['sigil','radiant','psychic'].includes(style)&&!p.color){const sprite=art.draw(style==='radiant'?'sun':'rune',b.x,b.y,s*2*arrival,t*.25,fade*arrival*.65);if(sprite)sprite.blendMode=PIXI.BLEND_MODES.ADD}ring(b.x,b.y,s*(.65+.13*Math.sin(t*4))*arrival,fade*arrival,t*(style==='psychic'?-1:1));if(style==='radiant'){for(let j=0;j<8;j++){const th=j*Math.PI/4+t*.3;line({x:b.x+Math.cos(th)*s*.2,y:b.y+Math.sin(th)*s*.2},{x:b.x+Math.cos(th)*s*1.2,y:b.y+Math.sin(th)*s*1.2},s*.03,color,fade*arrival*.8)}}}
   return true;
  }
  // Distinct travelling spells: faceted ice, branching lightning, whip, draining souls, toxic globes and meteors.
  const u=ease(t/.56),q={x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u},flight=1-clamp((t-.54)/.14);
  if(style==='whip'||style==='drain'||style==='lightning'){
   let last=a;for(let j=1;j<=28;j++){const v=j/28,u2=u*v,bend=Math.sin(v*Math.PI)*Math.sin(v*14-t*12)*s*.2,next={x:a.x+(b.x-a.x)*u2-Math.sin(angle)*bend,y:a.y+(b.y-a.y)*u2+Math.cos(angle)*bend};line(last,next,s*(style==='whip'?.04:.025),color,fade);if(style==='whip'&&j%3===0){const thorn=point(0,s*.13,next);line(next,thorn,s*.024,0xe4d9ae,fade)}if(style==='drain'&&j%4===0)dot(next.x,next.y,s*.08,0xcdffe4,fade);last=next}
  }else{
   for(let j=0;j<22;j++){const z=j/22,trail={x:q.x-Math.cos(angle)*z*s*1.6,y:q.y-Math.sin(angle)*z*s*1.6};dot(trail.x,trail.y,s*.14*(1-z),color,flight*fade*(1-z)*.5)}
   if(['meteor','flame','ice','holy','arcane'].includes(style)&&!p.color){const sprite=art.draw(style==='ice'?'crystal':style==='holy'?'sun':style==='arcane'?'rune':'flame',q.x,q.y,s*(style==='meteor'?1.35:.9),t*2,flight*fade*.9);if(sprite)sprite.blendMode=PIXI.BLEND_MODES.ADD}
   if(style==='ice'){g.beginFill(0xc5f6ff,flight*fade);const pts=[[s*.48,0],[-s*.25,-s*.13],[-s*.38,0],[-s*.25,s*.13]].map(([x,y])=>point(x,y,q));g.drawPolygon(pts.flatMap(v=>[v.x,v.y]));g.endFill();line(point(-s*.3,0,q),point(s*.4,0,q),s*.025,0xffffff,flight*fade)}
   else {dot(q.x,q.y,s*(style==='meteor'?.32:.2),color,flight*fade);dot(q.x-s*.04,q.y-s*.05,s*.08,0xfff4c8,flight*fade);for(let j=0;j<8;j++){const th=j*.8+t*13;dot(q.x+Math.cos(th)*s*.19,q.y+Math.sin(th)*s*.19,s*.045,color,flight*fade)}}
  }
  if(t>.5){const burst=clamp((t-.5)/.5);ring(b.x,b.y,s*(.15+burst*(style==='meteor'?1.7:.85)),fade*(1-burst));for(let j=0;j<24;j++){const th=j*2.399,r=s*burst*(.6+(j%4)*.25),q=point(Math.cos(th)*r,Math.sin(th)*r);dot(q.x,q.y,s*.055*(1-burst),color,fade)}}
  return true;
 }};
}
