// Distinct silhouettes for control, protection and creature attacks; all coordinates are scene pixels.
const clamp=v=>Math.max(0,Math.min(1,v));
export function drawSignature({g,art,style,weapon,a,b,t,s,fade,color}){
 const arrival=clamp((t-.15)/.35),pulse=Math.sin(t*Math.PI),angle=Math.atan2(b.y-a.y,b.x-a.x);
 const line=(x,y,u,v,w,c=color,alpha=fade)=>{g.lineStyle(w,c,alpha);g.moveTo(x,y);g.lineTo(u,v)};
 const ring=(x,y,r,c=color,alpha=fade)=>{g.lineStyle(s*.025,c,alpha);g.drawCircle(x,y,Math.max(0,r))};
 if(['bite','tail','tentacle','horn','sting','slam','mace','staff'].includes(weapon)){
  const impact=clamp((t-.48)/.52),reach=clamp(t/.45),x=a.x+(b.x-a.x)*reach,y=a.y+(b.y-a.y)*reach;
  if(weapon==='bite'){
   const gap=s*(.42*(1-clamp((t-.2)/.3))+.06),width=s*1.65;
   for(const [name,sign]of [['jaw-top',-1],['jaw-bottom',1]])art.draw(name,x,y+sign*(gap+width*.12),width,0,fade);
  }else if(weapon==='tail'||weapon==='tentacle'){
   art.draw(weapon,x,y,s*1.8,angle-.65+reach*.85+Math.sin(t*9)*.08,fade,.75);
  }else if(weapon==='mace'){
   art.draw('mace',x,y,s*1.65,angle-1+clamp((t-.2)/.3)*1.8,fade,.7);
  }else if(weapon==='horn'||weapon==='sting'){
   const point=(along,side)=>[x+Math.cos(angle)*along-Math.sin(angle)*side,y+Math.sin(angle)*along+Math.cos(angle)*side];
   for(const side of weapon==='horn'?[-1,1]:[0]){g.beginFill(color,fade);g.drawPolygon([...point(-s*.7,side*s*.2-s*.13),...point(s*.25,side*s*.12),...point(-s*.55,side*s*.2+s*.13)]);g.endFill();const q=point(-s*.5,side*s*.2),r=point(s*.2,side*s*.12);line(...q,...r,s*.025,0xfff2d4)}
  }else if(weapon==='slam'){g.beginFill(0xa39279,fade);g.drawRoundedRect(x-s*.3,y-s*.24,s*.6,s*.48,s*.12);g.endFill();for(let j=0;j<4;j++)line(x-s*.23+j*s*.14,y-s*.22,x-s*.23+j*s*.14,y+s*.03,s*.03,0xe3d2bd)}
  else {const theta=angle-1+clamp((t-.2)/.3)*1.8,q={x:x-Math.cos(theta)*s*.6,y:y-Math.sin(theta)*s*.6},r={x:x+Math.cos(theta)*s*.5,y:y+Math.sin(theta)*s*.5};line(q.x,q.y,r.x,r.y,s*.065,0x705139);line(q.x,q.y,r.x,r.y,s*.018,0xd3b783);if(weapon==='mace'){g.beginFill(0xc5cdd1,fade);g.drawCircle(r.x,r.y,s*.18);g.endFill();for(let j=0;j<8;j++){const th=j*Math.PI/4;line(r.x,r.y,r.x+Math.cos(th)*s*.27,r.y+Math.sin(th)*s*.27,s*.045,0xe0e4e2)}}}
  if(impact>0){ring(b.x,b.y,s*(.3+impact),color,fade*(1-impact));if(b.hit===true&&['bite','horn','sting'].includes(weapon))art.draw('blood-slash',b.x,b.y,s*1.7,angle,fade*(1-impact));}
  return true;
 }
 if(!['column','grasp','ward','chains','portal','counter','dispel','spirits','haste','beam'].includes(style))return false;
 // Cast energy visibly travels from the caster before the target shape forms.
 const x=a.x+(b.x-a.x)*arrival,y=a.y+(b.y-a.y)*arrival;
 if(arrival<1){ring(x,y,s*.13,color,fade);line(a.x,a.y,x,y,s*.025,color,fade*.4)}
 const opacity=fade*arrival;
 if(['ward','chains','grasp','haste'].includes(style)){
  const rune=art.draw('rune',b.x,b.y,s*1.8*arrival,-t*.4,opacity*.38);if(rune){rune.tint=color;rune.blendMode=PIXI.BLEND_MODES.ADD}
  for(let j=0;j<20;j++){const th=j*2.399+t*1.5,r=s*(.5+.28*Math.sin(j*3))*arrival;g.beginFill(j%3?color:0xffffff,opacity*.7);g.drawCircle(b.x+Math.cos(th)*r,b.y+Math.sin(th)*r,s*.016);g.endFill()}
 }
 if(style==='beam'){
  for(let j=4;j>=0;j--)line(a.x,a.y,x,y,s*(.015+j*.045),j===0?0xf1ffe8:color,fade/(j+1));
  for(let j=0;j<28;j++){const th=j*2.4,r=s*clamp((t-.4)/.5)*(1+j%4*.25);g.beginFill(j%3?color:0xffffff,opacity*(1-t));g.drawRect(b.x+Math.cos(th)*r,b.y+Math.sin(th)*r,s*.035,s*.035);g.endFill()}
 }else if(style==='column'){
  for(let j=0;j<9;j++)line(b.x+(j-4)*s*.09,b.y-s*(2+(j%3)*.3),b.x+(j-4)*s*.09,b.y,s*.035,j%2?color:0xfffbe0,opacity*.55);
  art.draw('sun',b.x,b.y,s*1.6,0,opacity*.8);ring(b.x,b.y,s*.65*arrival,color,opacity);
 }else if(style==='portal'){
  for(const o of [a,b])for(let j=0;j<3;j++){g.lineStyle(s*(.04-j*.009),color,opacity/(j+1));g.drawEllipse(o.x,o.y,s*(.48+j*.1),s*(.7+j*.1));}art.draw('rune',b.x,b.y,s*1.6,t,opacity*.5);
 }else if(style==='ward'){
  for(let j=0;j<3;j++){g.lineStyle(s*.022,color,opacity*(.7-j*.15));g.drawEllipse(b.x,b.y,s*(.65+j*.1)*arrival,s*(.8+j*.1)*arrival)}
  for(let j=0;j<8;j++){const th=j*Math.PI/4+t;ring(b.x+Math.cos(th)*s*.65,b.y+Math.sin(th)*s*.8,s*.05,color,opacity)}
 }else if(style==='chains'||style==='grasp'){
  for(let arm=0;arm<4;arm++){const th=arm*Math.PI/2+t*.2;for(let j=0;j<10;j++){const r=s*(.9-j*.055)*arrival,q=th+j*.13;g.lineStyle(s*.028,color,opacity);g.drawEllipse(b.x+Math.cos(q)*r,b.y+Math.sin(q)*r,s*.085,style==='chains'?s*.04:s*.09)}}
  if(style==='grasp')for(let j=0;j<5;j++){const off=(j-2)*s*.13;line(b.x+off,b.y+s*.55,b.x+off*.7,b.y-s*.15,s*.05,color,opacity)}
 }else if(style==='spirits'){
  for(let j=0;j<7;j++){const th=j*Math.PI*2/7+t*5,r=s*(.85+.1*Math.sin(t*8+j));art.draw('sun',b.x+Math.cos(th)*r,b.y+Math.sin(th)*r,s*.5,th,opacity*.8)}ring(b.x,b.y,s*1.2,color,opacity*.5);
 }else if(style==='haste'){
  for(let j=0;j<5;j++){const off=(j-2)*s*.3*(1-t);g.lineStyle(s*.025,color,opacity*(1-j*.14));g.drawEllipse(b.x+off,b.y,s*.4,s*.65)}
  for(let j=0;j<12;j++){const q=j*2.4+t*8;line(b.x+Math.cos(q)*s*.7,b.y+Math.sin(q)*s*.7,b.x+Math.cos(q+.25)*s*.9,b.y+Math.sin(q+.25)*s*.9,s*.025,color,opacity)}
 }else{
  const r=s*(style==='counter'?1-arrival*.5:.3+t);art.draw('rune',b.x,b.y,r*2,t*(style==='counter'?-1:1),opacity*(1-t*.5));
  for(let j=0;j<12;j++){const th=j*Math.PI/6+t;line(b.x+Math.cos(th)*r,b.y+Math.sin(th)*r,b.x+Math.cos(th)*r*(1+pulse*.4),b.y+Math.sin(th)*r*(1+pulse*.4),s*.025,color,opacity)}
 }
 return true;
}
