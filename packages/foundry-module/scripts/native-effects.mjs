// Original vector effects, bundled with the module; no external media or renderer dependency.
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
export function clearEffects(){for(const stop of [...active])stop()}
export function renderEffect(p){
  if(!validEffect(p)||!canvas.ready||canvas.scene.id!==p.sceneId||active.size>=40)return false;
  const sourceToken=canvas.tokens.get(p.source.tokenId);
  if(!game.user.isGM&&(!sourceToken?.visible||sourceToken.document.hidden))return false;
  const targets=p.targets.filter(t=>game.user.isGM||(!canvas.tokens.get(t.tokenId)?.document.hidden&&canvas.tokens.get(t.tokenId)?.visible));
  if(!targets.length&&!p.template)return false;
  const [mode,color]=profiles[p.key],g=new PIXI.Graphics();canvas.interface.addChild(g);
  let frame;const start=performance.now(),duration=1100;
  const stopSound=playEffectSound(p.key,p.id);
  const stop=()=>{cancelAnimationFrame(frame);stopSound?.();active.delete(stop);g.parent?.removeChild(g);g.destroy()};active.add(stop);
  Hooks.callAll('shadow-edge-gm.animationStart',{id:p.id,key:p.key,graphics:g});
  const line=(a,b,width,c=color,alpha=1)=>{g.lineStyle(width,c,alpha);g.moveTo(a.x,a.y);g.lineTo(b.x,b.y)};
  const circle=(x,y,r,c=color,alpha=1)=>{g.beginFill(c,alpha);g.drawCircle(x,y,r);g.endFill()};
  const draw=()=>{
    const t=Math.min((performance.now()-start)/duration,1),fade=Math.sin(Math.PI*t),s=p.size;
    if(!canvas.ready||canvas.scene.id!==p.sceneId||t>=1){stop();return}
    g.clear();
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
