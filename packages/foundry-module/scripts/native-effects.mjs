// Original procedural textures and vector effects; no external media or renderer dependency.
import {playEffectSound} from './sounds.mjs';
import {areaProfiles,validZoneShapes} from './area-profiles.mjs';
import {makeZonePainter} from './area-effects.mjs';
export const profiles = {
  'fire-bolt': ['projectile',0xff8028], 'ray-of-frost':['projectile',0x80ddff],
  'magic-missile':['projectile',0xc082ff], 'cure-wounds':['target',0x55ffaa],
  'healing-word':['target',0x55ffaa], fireball:['burst',0xff7020],
  'burning-hands':['cone',0xff9028], 'lightning-bolt':['ray',0x80cfff],
  bless:['target',0xffdf66], shield:['self',0x70bcff],
  bow:['projectile',0xe5c695], crossbow:['projectile',0xc5d2db],
  sword:['melee',0xdbeaff], axe:['melee',0xffbd78], hammer:['melee',0xa6bfda],
  dagger:['melee',0xb8e7ff], spear:['melee',0xd1d9b2], claw:['melee',0xff7777],
  thrown:['projectile',0xcccddd], impact:['target',0x99bbff]
};
for(const [key,p] of Object.entries(areaProfiles))profiles[key]=[['acid','alchemists-fire'].includes(key)?'projectile':'zone',p.color];
export function validEffect(p){
  if(p?.color!==undefined&&(typeof p.color!=='string'||!/^#[0-9a-f]{6}$/i.test(p.color)))return false;
  if(p?.template?.shapes&&!validZoneShapes(p.template.shapes))return false;
  const point=v=>v&&Number.isFinite(v.x)&&Number.isFinite(v.y)&&Math.abs(v.x)<100000&&Math.abs(v.y)<100000;
  return Boolean(p&&Object.hasOwn(profiles,p.key)&&(p.loop===undefined||typeof p.loop==='boolean')&&(!p.loop||['cure-wounds','healing-word'].includes(p.key))&&typeof p.id==='string'&&p.id.length<=200&&typeof p.sceneId==='string'&&typeof p.userId==='string'&&typeof p.actorUuid==='string'&&p.actorUuid.length<200&&point(p.source)&&Array.isArray(p.targets)&&p.targets.length<=20&&p.targets.every(point)&&Number.isFinite(p.size)&&p.size>=10&&p.size<=1000&&(!p.template||(point(p.template)&&Number.isFinite(p.template.length)&&p.template.length>0&&p.template.length<=10000&&Number.isFinite(p.template.direction))));
}
const active=new Set();
const completions=new Map();
const endings=new Map();
export const effectDuration=p=>p.template||['burst','zone'].includes(profiles[p.key]?.[0])?2800:2600;
export const effectFinished=id=>completions.get(id)??Promise.resolve();
export const endEffect=id=>endings.get(id)?.();
export function clearEffects(){for(const stop of [...active])stop()}
let cloudTexture;
function softCloudTexture(){
 if(cloudTexture)return cloudTexture;
 const image=document.createElement('canvas');image.width=image.height=128;const ctx=image.getContext('2d'),data=ctx.createImageData(128,128);
 const hash=(x,y)=>{const n=Math.sin(x*127.1+y*311.7)*43758.5453;return n-Math.floor(n)};
 const noise=(x,y)=>{const ix=Math.floor(x),iy=Math.floor(y),u=x-ix,v=y-iy,a=u*u*(3-2*u),b=v*v*(3-2*v);return (hash(ix,iy)*(1-a)+hash(ix+1,iy)*a)*(1-b)+(hash(ix,iy+1)*(1-a)+hash(ix+1,iy+1)*a)*b};
 for(let y=0;y<128;y++)for(let x=0;x<128;x++){const r=Math.hypot((x-64)/64,(y-64)/64),n=.55*noise(x/19,y/19)+.3*noise(x/9,y/9)+.15*noise(x/4,y/4),i=(y*128+x)*4;data.data[i]=data.data[i+1]=data.data[i+2]=255;data.data[i+3]=Math.round(255*Math.max(0,1-r)**1.3*(.45+.75*n))}
 ctx.putImageData(data,0,0);cloudTexture=PIXI.Texture.from(image);return cloudTexture;
}
let bubbleTexture;
function shieldTexture(){
 if(bubbleTexture)return bubbleTexture;
 const image=document.createElement('canvas');image.width=image.height=192;const ctx=image.getContext('2d');
 const sphere=ctx.createRadialGradient(96,96,12,96,96,94);sphere.addColorStop(0,'rgba(70,150,255,0.03)');sphere.addColorStop(.65,'rgba(45,145,255,0.07)');sphere.addColorStop(.88,'rgba(60,170,255,0.28)');sphere.addColorStop(.96,'rgba(140,225,255,0.55)');sphere.addColorStop(1,'rgba(40,140,255,0)');ctx.fillStyle=sphere;ctx.fillRect(0,0,192,192);
 const light=ctx.createRadialGradient(66,51,0,66,51,40);light.addColorStop(0,'rgba(220,250,255,0.42)');light.addColorStop(1,'rgba(150,230,255,0)');ctx.fillStyle=light;ctx.fillRect(0,0,192,192);bubbleTexture=PIXI.Texture.from(image);return bubbleTexture;
}
export function renderShieldAura(token,id,isActive){
 if(!canvas.ready||active.size>=40)return null;
 const layer=new PIXI.Container(),sphere=new PIXI.Sprite(shieldTexture()),g=new PIXI.Graphics();layer.name=`shadow-edge-shield:${id}`;sphere.anchor.set(.5);layer.addChild(sphere,g);canvas.interface.addChild(layer);
 let frame,stopped=false;const start=performance.now();
 const stop=()=>{if(stopped)return;stopped=true;cancelAnimationFrame(frame);active.delete(stop);layer.parent?.removeChild(layer);layer.destroy({children:true});Hooks.callAll('shadow-edge-gm.shieldEnd',{id})};active.add(stop);
 const draw=()=>{
  if(!canvas.ready||!token.actor||token.destroyed||!isActive()){stop();return}
  const t=(performance.now()-start)/1000,r=Math.max(token.w,token.h)*.72,pulse=1+Math.sin(t*2)*.015;
  layer.visible=game.user.isGM||Boolean(token.visible&&!token.document.hidden);layer.position.set(token.center.x,token.center.y);
  sphere.width=r*2*pulse;sphere.height=r*2.12*pulse;sphere.alpha=.82+Math.sin(t*2)*.12;
  g.clear();g.lineStyle(2,0x7edfff,.45+Math.sin(t*2)*.12);g.drawEllipse(0,0,r*pulse,r*1.04*pulse);
  g.lineStyle(3,0xd6f8ff,.5);g.arc(-r*.12,-r*.1,r*.85,3.6,4.6);
  for(let j=0;j<8;j++){const theta=t*.3+j*Math.PI/4,x=Math.cos(theta)*r*.96,y=Math.sin(theta)*r*1.04;g.beginFill(0xb8f1ff,.35+.2*Math.sin(t*3+j));g.drawCircle(x,y,2.5);g.endFill()}
  Hooks.callAll('shadow-edge-gm.shieldFrame',{id,graphics:g,center:{x:token.center.x,y:token.center.y}});frame=requestAnimationFrame(draw);
 };draw();Hooks.callAll('shadow-edge-gm.shieldStart',{id,graphics:g});return {stop,graphics:g};
}
export function renderEffect(p){
  if(!validEffect(p)||!canvas.ready||canvas.scene.id!==p.sceneId||active.size>=40||completions.has(p.id))return false;
  const sourceToken=canvas.tokens.get(p.source.tokenId);
  if(!game.user.isGM&&(!sourceToken?.visible||sourceToken.document.hidden))return false;
  const targets=p.targets.filter(t=>game.user.isGM||(!canvas.tokens.get(t.tokenId)?.document.hidden&&canvas.tokens.get(t.tokenId)?.visible));
  if(!targets.length&&!p.template)return false;
  const [mode,baseColor]=profiles[p.key],color=p.color?Number.parseInt(p.color.slice(1),16):baseColor,g=new PIXI.Graphics(),layer=new PIXI.Container(),sprites=[];layer.name=`shadow-edge-effect:${p.id}`;layer.addChild(g);canvas.interface.addChild(layer);let spriteIndex=0;
  const zone=mode==='zone'?makeZonePainter(layer,p.key,p.template?.shapes??[{type:'circle',x:p.template?.x??targets[0]?.x,y:p.template?.y??targets[0]?.y,radius:p.template?.length??p.size}],p.size):null;
  let frame,finish,ending=null;const start=performance.now(),duration=effectDuration(p);
  endings.set(p.id,()=>{ending??=performance.now()});
  completions.set(p.id,new Promise(resolve=>{finish=resolve}));
  const stopSound=playEffectSound(p.key,p.id);
  const stop=()=>{cancelAnimationFrame(frame);stopSound?.();active.delete(stop);layer.parent?.removeChild(layer);layer.destroy({children:true});completions.delete(p.id);endings.delete(p.id);finish();Hooks.callAll('shadow-edge-gm.animationEnd',{id:p.id,key:p.key})};active.add(stop);
  Hooks.callAll('shadow-edge-gm.animationStart',{id:p.id,key:p.key,color,graphics:g,duration,source:p.source,loop:Boolean(p.loop)});
  const line=(a,b,width,c=color,alpha=1)=>{g.lineStyle(width,c,alpha);g.moveTo(a.x,a.y);g.lineTo(b.x,b.y)};
  const circle=(x,y,r,c=color,alpha=1)=>{g.beginFill(c,alpha);g.drawCircle(x,y,r);g.endFill()};
  const glow=(x,y,r,c,alpha)=>{let sprite=sprites[spriteIndex++];if(!sprite){sprite=new PIXI.Sprite(softCloudTexture());sprite.anchor.set(.5);sprite.blendMode=PIXI.BLEND_MODES.ADD;layer.addChildAt(sprite,layer.children.length-1);sprites.push(sprite)}sprite.visible=true;sprite.position.set(x,y);sprite.width=r*2;sprite.height=r*2.1;sprite.rotation=spriteIndex*2.399;sprite.tint=c;sprite.alpha=alpha};
  const cinematic=(t,s)=>{
    const mode=profiles[p.key][0],o=p.template??targets[0],radius=p.template?.length??s*1.5;
    if(!o)return;
    const fade=1-Math.max(0,(t-.62)/.38),ease=v=>1-(1-Math.min(1,Math.max(0,v)))**3;
    g.blendMode=PIXI.BLEND_MODES.ADD;
    if(mode==='cone'||mode==='ray'){
      if(t<.22){const travel=Math.min(1,t/.18),x=p.source.x+(o.x-p.source.x)*travel,y=p.source.y+(o.y-p.source.y)*travel;glow(p.source.x,p.source.y,s*.55,color,(1-travel)*.7);glow(x,y,s*.35,color,.8)}
      const angle=(o.direction??0)*Math.PI/180,progress=ease((t-.15)/.22),length=radius*progress;
      const point=(along,side)=>({x:o.x+Math.cos(angle)*along-Math.sin(angle)*side,y:o.y+Math.sin(angle)*along+Math.cos(angle)*side});
      if(mode==='ray'){
        for(let strand=0;strand<5;strand++){let last=point(0,0);for(let j=1;j<=24;j++){const v=point(length*j/24,j===24?0:Math.sin(j*19+strand*3+t*75)*s*(.10+strand*.035));line(last,v,s*(strand===0?.07:.025),strand===0?0xeaffff:0x548fff,fade);last=v}}
        for(let j=0;j<10;j++){const v=point(length*(j+.5)/10,0);glow(v.x,v.y,s*.55,0x62bfff,fade*.65)}
        glow(point(length,0).x,point(length,0).y,s*.8,0xffffff,fade*.6);
      }else{
        for(let j=0;j<48;j++){const along=length*(.12+(j%12)/14),width=along*.40,side=Math.sin(j*2.399+t*9)*width,v=point(along,side),r=s*.18+along*.10;glow(v.x,v.y,r*2.2,p.color?color:0xff3808,fade*.68);glow(v.x,v.y,r,p.color?color:0xffd33c,fade*.8)}
      }
      return;
    }
    const fire=p.key==='fireball',warm=fire&&!p.color?0xff590c:color,hot=p.color?0xffffff:fire?0xffd658:0xddeeff;
    const travel=Math.min(1,t/.18),explode=Math.max(0,(t-.18)/.82),expansion=ease(explode/.35),r=radius*expansion;
    if(t<.21){const x=p.source.x+(o.x-p.source.x)*travel,y=p.source.y+(o.y-p.source.y)*travel;for(let j=12;j>=0;j--)glow(x-(o.x-p.source.x)*j*.012,y-(o.y-p.source.y)*j*.012,s*(.22-j*.01),warm,.7);glow(x,y,s*.5,hot,.9)}
    if(!explode)return;
    glow(o.x,o.y,r*1.25,warm,fade*.95);
    for(let j=0;j<32;j++){const angle=j*2.399+Math.sin(j*7+explode*4)*.22,spread=Math.sqrt((j+.5)/32)*r*.78,x=o.x+Math.cos(angle)*spread,y=o.y+Math.sin(angle)*spread,r1=r*(.15+.10*(1+Math.sin(j*9+explode*11))/2);glow(x,y,r1*2.1,warm,fade*.82);glow(x,y,r1,hot,fade*.85)}
    glow(o.x,o.y,r*.7,hot,fade*.85);
    glow(o.x,o.y,r*.35,0xffffff,Math.max(0,1-explode*4)*.9);
    g.lineStyle(s*.04,hot,Math.max(0,1-explode*3)*.65);g.drawCircle(o.x,o.y,radius*ease(explode/.18));g.lineStyle(0);
    for(let j=0;j<52;j++){const angle=j*2.399,dist=r*(.6+explode*.55),x=o.x+Math.cos(angle)*dist,y=o.y+Math.sin(angle)*dist-explode*s*.45;circle(x,y,s*(.015+.025*(j%5)/5),hot,fade);if(j%3===0)line({x,y},{x:x-Math.cos(angle)*s*.1,y:y-Math.sin(angle)*s*.1},s*.012,warm,fade*.7)}
  };
  const draw=()=>{
    const elapsed=performance.now()-start,t=p.loop?(elapsed/duration)%1:Math.min(elapsed/duration,1),fade=p.loop?Math.min(1,elapsed/350):Math.min(1,t/.12,Math.max(0,(1-t)/.23)),s=p.size;
    if(!canvas.ready||canvas.scene.id!==p.sceneId||(!p.loop&&t>=1)||(p.loop&&elapsed>120000)||(ending!==null&&performance.now()-ending>=600)){stop();return}
    layer.alpha=ending===null?1:Math.max(0,1-(performance.now()-ending)/600);
    const source=canvas.tokens.get(p.source.tokenId);if(p.source.tokenId&&!source){stop();return}if(source?.center)Object.assign(p.source,source.center);
    layer.visible=game.user.isGM||Boolean(source?.visible&&!source.document.hidden);
    for(const target of targets){const token=canvas.tokens.get(target.tokenId);if(token?.center)Object.assign(target,token.center)}
    g.clear();
    spriteIndex=0;for(const sprite of sprites)sprite.visible=false;
    if(zone){const u=Math.min(1,t/.4),x=p.source.x+(zone.bounds.cx-p.source.x)*u,y=p.source.y+(zone.bounds.cy-p.source.y)*u;glow(x,y,s*.35,color,Math.max(0,1-t/.5));zone.draw(t*2.8,Math.min(1,Math.max(0,(t-.25)/.2))*fade);Hooks.callAll('shadow-edge-gm.animationFrame',{id:p.id,key:p.key,graphics:zone.graphics});frame=requestAnimationFrame(draw);return}
    if(p.template||mode==='burst'){cinematic(t,s);Hooks.callAll('shadow-edge-gm.animationFrame',{id:p.id,key:p.key,graphics:g});frame=requestAnimationFrame(draw);return}
    const dest=p.template?[{x:p.template.x,y:p.template.y}]:targets;
    for(const target of dest){
      const targetToken=canvas.tokens.get(target.tokenId);if(!p.template&&!game.user.isGM&&(!targetToken?.visible||targetToken.document.hidden))continue;
      let a=p.source,b=target;
      if(p.template&&['ray','cone'].includes(mode)){a=p.template;const r=p.template.direction*Math.PI/180;b={x:a.x+Math.cos(r)*p.template.length,y:a.y+Math.sin(r)*p.template.length}}
      const angle=Math.atan2(b.y-a.y,b.x-a.x),point=(x,y,origin=b)=>({x:origin.x+Math.cos(angle)*x-Math.sin(angle)*y,y:origin.y+Math.sin(angle)*x+Math.cos(angle)*y});
      if(mode==='projectile'){
        const missiles=p.key==='magic-missile'?3:1;
        for(let n=0;n<missiles;n++){
          const u=Math.min(t/.58,1),arc=Math.sin(u*Math.PI)*(n-1)*s*.85;
          const head={x:a.x+(b.x-a.x)*u-Math.sin(angle)*arc,y:a.y+(b.y-a.y)*u+Math.cos(angle)*arc};
          const flight=Math.max(0,1-(t-.58)/.12);
          for(let j=1;j<14;j++)glow(head.x-Math.cos(angle)*j*s*.08,head.y-Math.sin(angle)*j*s*.08,s*.13*(1-j/15),color,fade*flight*(1-j/15));
          glow(a.x,a.y,s*.5,color,Math.max(0,1-t/.3)*.65);
          if(['bow','crossbow','thrown'].includes(p.key)){line(point(-s*.6,0,head),head,s*.045,0xf3e6cf,fade*flight);line(head,point(-s*.16,s*.11,head),s*.05,color,fade*flight);line(head,point(-s*.16,-s*.11,head),s*.05,color,fade*flight)}
          else {glow(head.x,head.y,s*.25,color,fade*flight);glow(head.x,head.y,s*.12,0xffffff,fade*flight);for(let j=0;j<5;j++)circle(head.x+Math.sin(j*11+t*25)*s*.13,head.y+Math.cos(j*11+t*25)*s*.13,s*.022,0xffffff,fade*flight)}
        }
      }else if(mode==='melee'){
        const approach=Math.min(1,t/.35),swing=angle-1.6+Math.max(0,t-.35)*4,origin={x:a.x+(b.x-a.x)*approach*.7,y:a.y+(b.y-a.y)*approach*.7};
        const w=(r,v)=>({x:origin.x+Math.cos(swing)*r-Math.sin(swing)*v,y:origin.y+Math.sin(swing)*r+Math.cos(swing)*v});
        for(let j=0;j<5;j++){g.lineStyle(s*(.10-j*.015),color,fade*(.3-j*.04));g.arc(origin.x,origin.y,s*(.7+j*.05),swing-1.2,swing)}
        glow(origin.x,origin.y,s*.4,color,fade*.3);
        if(p.key==='claw'){for(let n=-1;n<=1;n++)line(w(s*.15,n*s*.13),w(s*.8,n*s*.13),s*.035,color,fade)}
        else {line(w(-s*.18,0),w(s*.52,0),s*.055,0xa48664,fade);
          g.beginFill(color,fade);const pts=p.key==='axe'?[w(s*.25,-s*.24),w(s*.62,-s*.2),w(s*.62,s*.2),w(s*.4,s*.08)]:p.key==='hammer'?[w(s*.4,-s*.2),w(s*.65,-s*.2),w(s*.65,s*.2),w(s*.4,s*.2)]:[w(s*.05,-s*.065),w(s*(p.key==='dagger'?.48:.85),0),w(s*.05,s*.065)];g.drawPolygon(pts.flatMap(v=>[v.x,v.y]));g.endFill();}
      }else if(mode==='ray'||mode==='cone'){
        if(mode==='ray'){let last=a;for(let j=1;j<=16;j++){const v=point((Math.hypot(b.x-a.x,b.y-a.y)*j/16),(j===16?0:Math.sin(j*13+t*40)*s*.13),a);line(last,v,s*.05,color,fade);last=v}}
        else{g.beginFill(color,fade*.3);g.drawPolygon([a.x,a.y,...Object.values(point(0,-Math.hypot(b.x-a.x,b.y-a.y)*.4)),...Object.values(point(0,Math.hypot(b.x-a.x,b.y-a.y)*.4))]);g.endFill()}
      }
      if(['target','self'].includes(mode)){
        const healing=['cure-wounds','healing-word'].includes(p.key),flow=p.loop?t:Math.min(1,t/.5);
        for(let j=0;j<36;j++){const u=(flow+j/36)%1;if(u>Math.min(1,elapsed/(duration*.48)))continue;const arc=Math.sin(u*Math.PI)*Math.sin(j*2.399+t*4)*s*.24,x=a.x+(b.x-a.x)*u-Math.sin(angle)*arc,y=a.y+(b.y-a.y)*u+Math.cos(angle)*arc;glow(x,y,s*.23,color,fade*.6);if(j%5===0)circle(x,y,s*.028,0xffffff,fade)}
        glow(a.x,a.y,s*.65,color,fade*.35);
        const arrival=Math.min(1,Math.max(0,((p.loop?elapsed/duration:t)-.32)/.18));glow(b.x,b.y,s*.95,color,fade*arrival*.65);
        for(let j=0;j<18;j++){const theta=j*2.399+t*5,r=s*(.25+(j%5)*.08),x=b.x+Math.cos(theta)*r,y=b.y+Math.sin(theta)*r-(healing?((t+j/18)%1)*s*.6:0);glow(x,y,s*.09,color,fade*arrival*.7);if(healing&&j%5===0){line({x:x-s*.06,y},{x:x+s*.06,y},s*.025,0xdcfff1,fade*arrival);line({x,y:y-s*.06},{x,y:y+s*.06},s*.025,0xdcfff1,fade*arrival)}}
        if(p.key==='shield'){g.lineStyle(s*.035,0x99ddff,fade);g.drawCircle(b.x,b.y,s*.65);g.lineStyle(s*.015,0xffffff,fade*.6);g.arc(b.x-s*.12,b.y-s*.10,s*.52,3.6,4.8)}
        if(p.key==='bless'){for(let j=0;j<2;j++){g.lineStyle(s*.023,0xffdc6b,fade*arrival*.75);g.drawEllipse(b.x,b.y-s*.25+j*s*.45,s*.58,s*.18)}for(let j=0;j<6;j++){const theta=j*Math.PI/3+t*2;line({x:b.x+Math.cos(theta)*s*.38,y:b.y+Math.sin(theta)*s*.38},{x:b.x+Math.cos(theta)*s*.52,y:b.y+Math.sin(theta)*s*.52},s*.025,0xfff4ba,fade*arrival)}}
      }
      if(t>.56&&['projectile','melee'].includes(mode)){const impact=Math.max(0,1-(t-.56)/.44);glow(b.x,b.y,s*(.45+(t-.56)),color,impact*.8);g.lineStyle(s*.03,color,impact);g.drawCircle(b.x,b.y,s*(.1+(t-.56)*1.5));for(let j=0;j<16;j++){const theta=j*2.399,r=(t-.56)*s*2;circle(b.x+Math.cos(theta)*r,b.y+Math.sin(theta)*r,s*.035,color,impact)}}
    }
    Hooks.callAll('shadow-edge-gm.animationFrame',{id:p.id,key:p.key,graphics:g});
    frame=requestAnimationFrame(draw);
  };draw();return true;
}
