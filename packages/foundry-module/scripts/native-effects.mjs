// Original procedural textures and vector effects; no external media or renderer dependency.
import {playEffectSound} from './sounds.mjs';
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
export function validEffect(p){
  const point=v=>v&&Number.isFinite(v.x)&&Number.isFinite(v.y)&&Math.abs(v.x)<100000&&Math.abs(v.y)<100000;
  return Boolean(p&&Object.hasOwn(profiles,p.key)&&typeof p.id==='string'&&p.id.length<=200&&typeof p.sceneId==='string'&&typeof p.userId==='string'&&typeof p.actorUuid==='string'&&p.actorUuid.length<200&&point(p.source)&&Array.isArray(p.targets)&&p.targets.length<=20&&p.targets.every(point)&&Number.isFinite(p.size)&&p.size>=10&&p.size<=1000&&(!p.template||(point(p.template)&&Number.isFinite(p.template.length)&&p.template.length>0&&p.template.length<=10000&&Number.isFinite(p.template.direction))));
}
const active=new Set();
const completions=new Map();
export const effectDuration=p=>p.template||profiles[p.key]?.[0]==='burst'?2800:1100;
export const effectFinished=id=>completions.get(id)??Promise.resolve();
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
export function renderEffect(p){
  if(!validEffect(p)||!canvas.ready||canvas.scene.id!==p.sceneId||active.size>=40)return false;
  const sourceToken=canvas.tokens.get(p.source.tokenId);
  if(!game.user.isGM&&(!sourceToken?.visible||sourceToken.document.hidden))return false;
  const targets=p.targets.filter(t=>game.user.isGM||(!canvas.tokens.get(t.tokenId)?.document.hidden&&canvas.tokens.get(t.tokenId)?.visible));
  if(!targets.length&&!p.template)return false;
  const [mode,color]=profiles[p.key],g=new PIXI.Graphics(),layer=new PIXI.Container(),sprites=[];layer.addChild(g);canvas.interface.addChild(layer);let spriteIndex=0;
  let frame,finish;const start=performance.now(),duration=effectDuration(p);
  completions.set(p.id,new Promise(resolve=>{finish=resolve}));
  const stopSound=playEffectSound(p.key,p.id);
  const stop=()=>{cancelAnimationFrame(frame);stopSound?.();active.delete(stop);layer.parent?.removeChild(layer);layer.destroy({children:true});completions.delete(p.id);finish();Hooks.callAll('shadow-edge-gm.animationEnd',{id:p.id,key:p.key})};active.add(stop);
  Hooks.callAll('shadow-edge-gm.animationStart',{id:p.id,key:p.key,graphics:g,duration});
  const line=(a,b,width,c=color,alpha=1)=>{g.lineStyle(width,c,alpha);g.moveTo(a.x,a.y);g.lineTo(b.x,b.y)};
  const circle=(x,y,r,c=color,alpha=1)=>{g.beginFill(c,alpha);g.drawCircle(x,y,r);g.endFill()};
  const glow=(x,y,r,c,alpha)=>{let sprite=sprites[spriteIndex++];if(!sprite){sprite=new PIXI.Sprite(softCloudTexture());sprite.anchor.set(.5);sprite.blendMode=PIXI.BLEND_MODES.ADD;layer.addChildAt(sprite,layer.children.length-1);sprites.push(sprite)}sprite.visible=true;sprite.position.set(x,y);sprite.width=r*2;sprite.height=r*2.1;sprite.rotation=spriteIndex*2.399;sprite.tint=c;sprite.alpha=alpha};
  const cinematic=(t,s)=>{
    const mode=profiles[p.key][0],o=p.template??targets[0],radius=p.template?.length??s*1.5;
    if(!o)return;
    const fade=1-Math.max(0,(t-.62)/.38),ease=v=>1-(1-Math.min(1,Math.max(0,v)))**3;
    g.blendMode=PIXI.BLEND_MODES.ADD;
    if(mode==='cone'||mode==='ray'){
      const angle=(o.direction??0)*Math.PI/180,progress=ease(t/.22),length=radius*progress;
      const point=(along,side)=>({x:o.x+Math.cos(angle)*along-Math.sin(angle)*side,y:o.y+Math.sin(angle)*along+Math.cos(angle)*side});
      if(mode==='ray'){
        for(let strand=0;strand<5;strand++){let last=point(0,0);for(let j=1;j<=24;j++){const v=point(length*j/24,j===24?0:Math.sin(j*19+strand*3+t*75)*s*(.10+strand*.035));line(last,v,s*(strand===0?.07:.025),strand===0?0xeaffff:0x548fff,fade);last=v}}
        for(let j=0;j<10;j++){const v=point(length*(j+.5)/10,0);glow(v.x,v.y,s*.55,0x62bfff,fade*.65)}
        glow(point(length,0).x,point(length,0).y,s*.8,0xffffff,fade*.6);
      }else{
        for(let j=0;j<48;j++){const along=length*(.12+(j%12)/14),width=along*.40,side=Math.sin(j*2.399+t*9)*width,v=point(along,side),r=s*.18+along*.10;glow(v.x,v.y,r*2.2,0xff3808,fade*.68);glow(v.x,v.y,r,0xffd33c,fade*.8)}
      }
      return;
    }
    const fire=p.key==='fireball',warm=fire?0xff590c:color,hot=fire?0xffd658:0xddeeff;
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
    const t=Math.min((performance.now()-start)/duration,1),fade=Math.sin(Math.PI*t),s=p.size;
    if(!canvas.ready||canvas.scene.id!==p.sceneId||t>=1){stop();return}
    g.clear();
    spriteIndex=0;for(const sprite of sprites)sprite.visible=false;
    if(p.template||mode==='burst'){cinematic(t,s);Hooks.callAll('shadow-edge-gm.animationFrame',{id:p.id,key:p.key,graphics:g});frame=requestAnimationFrame(draw);return}
    const dest=p.template?[{x:p.template.x,y:p.template.y}]:targets;
    for(const target of dest){
      let a=p.source,b=target;
      if(p.template&&['ray','cone'].includes(mode)){a=p.template;const r=p.template.direction*Math.PI/180;b={x:a.x+Math.cos(r)*p.template.length,y:a.y+Math.sin(r)*p.template.length}}
      const angle=Math.atan2(b.y-a.y,b.x-a.x),point=(x,y,origin=b)=>({x:origin.x+Math.cos(angle)*x-Math.sin(angle)*y,y:origin.y+Math.sin(angle)*x+Math.cos(angle)*y});
      if(mode==='projectile'){
        const missiles=p.key==='magic-missile'?3:1;
        for(let n=0;n<missiles;n++){
          const u=Math.min(t*1.45,1),arc=Math.sin(u*Math.PI)*(n-1)*s*.6;
          const head={x:a.x+(b.x-a.x)*u-Math.sin(angle)*arc,y:a.y+(b.y-a.y)*u+Math.cos(angle)*arc};
          for(let j=1;j<9;j++)circle(head.x-Math.cos(angle)*j*s*.06,head.y-Math.sin(angle)*j*s*.06,s*.07*(1-j/10),color,fade*(1-j/10));
          if(['bow','crossbow','thrown'].includes(p.key)){line(point(-s*.38,0,head),head,s*.025,0xf3e6cf,fade);line(head,point(-s*.1,s*.07,head),s*.03,color,fade);line(head,point(-s*.1,-s*.07,head),s*.03,color,fade)}
          else circle(head.x,head.y,s*.095,color,fade);
        }
      }else if(mode==='melee'){
        const swing=angle-1.5+t*3,origin={x:b.x-Math.cos(angle)*s*.35,y:b.y-Math.sin(angle)*s*.35};
        const w=(r,v)=>({x:origin.x+Math.cos(swing)*r-Math.sin(swing)*v,y:origin.y+Math.sin(swing)*r+Math.cos(swing)*v});
        g.lineStyle(s*.07,color,fade*.6);g.arc(origin.x,origin.y,s*.62,swing-.8,swing);
        if(p.key==='claw'){for(let n=-1;n<=1;n++)line(w(s*.15,n*s*.13),w(s*.8,n*s*.13),s*.035,color,fade)}
        else {line(w(-s*.18,0),w(s*.52,0),s*.055,0xa48664,fade);
          g.beginFill(color,fade);const pts=p.key==='axe'?[w(s*.25,-s*.24),w(s*.62,-s*.2),w(s*.62,s*.2),w(s*.4,s*.08)]:p.key==='hammer'?[w(s*.4,-s*.2),w(s*.65,-s*.2),w(s*.65,s*.2),w(s*.4,s*.2)]:[w(s*.05,-s*.065),w(s*(p.key==='dagger'?.48:.85),0),w(s*.05,s*.065)];g.drawPolygon(pts.flatMap(v=>[v.x,v.y]));g.endFill();}
      }else if(mode==='ray'||mode==='cone'){
        if(mode==='ray'){let last=a;for(let j=1;j<=16;j++){const v=point((Math.hypot(b.x-a.x,b.y-a.y)*j/16),(j===16?0:Math.sin(j*13+t*40)*s*.13),a);line(last,v,s*.05,color,fade);last=v}}
        else{g.beginFill(color,fade*.3);g.drawPolygon([a.x,a.y,...Object.values(point(0,-Math.hypot(b.x-a.x,b.y-a.y)*.4)),...Object.values(point(0,Math.hypot(b.x-a.x,b.y-a.y)*.4))]);g.endFill()}
      }
      const radius=mode==='burst'?(p.template?.length??s*1.5):s*.48;
      if(['burst','target','self'].includes(mode)||t>.6){g.lineStyle(s*.025,color,fade);g.drawCircle(b.x,b.y,radius*(.5+t*.5));
        for(let j=0;j<12;j++){const r=j*2.399+t*.6,dist=radius*(.2+t*.9);circle(b.x+Math.cos(r)*dist,b.y+Math.sin(r)*dist,s*.035,color,fade)}
        if(p.key==='shield'){g.lineStyle(s*.045,color,fade);g.drawPolygon(Array.from({length:6},(_,j)=>[b.x+Math.cos(j*Math.PI/3)*radius,b.y+Math.sin(j*Math.PI/3)*radius]).flat())}
        if(['cure-wounds','healing-word','bless'].includes(p.key)){line({x:b.x-s*.15,y:b.y-t*s*.3},{x:b.x+s*.15,y:b.y-t*s*.3},s*.05,color,fade);line({x:b.x,y:b.y-t*s*.3-s*.15},{x:b.x,y:b.y-t*s*.3+s*.15},s*.05,color,fade)}
      }
    }
    Hooks.callAll('shadow-edge-gm.animationFrame',{id:p.id,key:p.key,graphics:g});
    frame=requestAnimationFrame(draw);
  };draw();return true;
}
