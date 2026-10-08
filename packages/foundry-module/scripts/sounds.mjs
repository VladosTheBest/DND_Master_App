// Original synthesized sound library. No downloads or third-party recordings.
export const soundProfiles={
  bow:{noise:0.4,tone:190,fall:70,hit:0.62},crossbow:{noise:0.55,tone:115,fall:50,hit:0.62},
  sword:{noise:0.5,tone:740,fall:430,hit:0.48},axe:{noise:0.6,tone:340,fall:170,hit:0.48},
  hammer:{noise:0.5,tone:95,fall:40,hit:0.48},dagger:{noise:0.35,tone:1100,fall:700,hit:0.48},
  spear:{noise:0.4,tone:450,fall:250,hit:0.48},claw:{noise:0.75,tone:160,fall:80,hit:0.48},
  thrown:{noise:0.45,tone:240,fall:110,hit:0.62},impact:{noise:0.7,tone:100,fall:45,hit:0.05},
  'fire-bolt':{noise:0.7,tone:240,fall:90,hit:0.62},'ray-of-frost':{noise:0.3,tone:1400,fall:650,hit:0.62,chime:true},
  'magic-missile':{noise:0.12,tone:600,fall:1100,hit:0.62,chime:true},
  'cure-wounds':{noise:0.03,tone:523,fall:659,chime:true},'healing-word':{noise:0.03,tone:659,fall:784,chime:true},
  fireball:{noise:0.95,tone:75,fall:32,hit:0.18},'burning-hands':{noise:0.9,tone:140,fall:55,hit:0.15},
  'lightning-bolt':{noise:0.9,tone:1800,fall:80,hit:0.15},bless:{noise:0.02,tone:784,fall:1047,chime:true},
  shield:{noise:0.08,tone:392,fall:523,chime:true},
  grease:{noise:.25,tone:140,fall:65},oil:{noise:.3,tone:120,fall:45},
  'wall-of-fire':{noise:.8,tone:130,fall:45,hit:.4},'spike-growth':{noise:.4,tone:230,fall:120},
  entangle:{noise:.3,tone:350,fall:180},darkness:{noise:.15,tone:90,fall:50,chime:true},
  'fog-cloud':{noise:.4,tone:300,fall:120},web:{noise:.2,tone:550,fall:260},
  moonbeam:{noise:.03,tone:880,fall:1320,chime:true},thunderwave:{noise:.95,tone:80,fall:35,hit:.4},
  shatter:{noise:.65,tone:1600,fall:650,hit:.4},'ice-storm':{noise:.7,tone:1300,fall:500,hit:.4},
  acid:{noise:.6,tone:420,fall:130,hit:.6},'alchemists-fire':{noise:.75,tone:270,fall:80,hit:.6}
};
export function soundSamples(key,sampleRate=48000){
  if(!Object.hasOwn(soundProfiles,key)||!Number.isFinite(sampleRate)||sampleRate<8000||sampleRate>192000)return null;
  const p=soundProfiles[key],duration=2.6,samples=new Float32Array(Math.ceil(sampleRate*duration));
  let seed=Array.from(key).reduce((v,c)=>(v*31+c.charCodeAt(0))>>>0,123),phase=0,low=0;
  for(let i=0;i<samples.length;i++){
    const t=i/sampleRate,u=t/duration;seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    const noise=seed/2147483648-1;low+=0.13*(noise-low);
    const envelope=Math.min(1,t/0.015)*Math.pow(1-u,p.chime?1.4:3);
    phase+=2*Math.PI*(p.tone+(p.fall-p.tone)*u)/sampleRate;
    const tonal=p.chime?(Math.sin(phase)+0.4*Math.sin(phase*1.5)+0.2*Math.sin(phase*2)):Math.sin(phase)*Math.exp(-t*9);
    const hit=p.hit===undefined?0:Math.max(0,t-p.hit*duration);
    const impact=u>=p.hit?(Math.sin(2*Math.PI*65*hit)*0.5+low)*Math.exp(-hit*22):0;
    samples[i]=(p.noise*(p.tone<300?low:noise)*envelope+tonal*envelope*0.24+impact*0.35)*0.28;
  }
  return samples;
}
const buffers=new WeakMap();
export function playEffectSound(key,id){
  try{
    // Use Foundry's unlocked interface channel and its existing volume/mute control.
    // Do not queue stale sounds while the browser is locked.
    const ctx=game.audio?.interface;
    if(!ctx||ctx.state!=='running'||!ctx.gainNode||ctx.gainNode.gain.value<=0)return null;
    let cache=buffers.get(ctx);if(!cache){cache=new Map();buffers.set(ctx,cache)}
    let buffer=cache.get(key);
    if(!buffer){const samples=soundSamples(key,ctx.sampleRate);if(!samples)return null;buffer=ctx.createBuffer(1,samples.length,ctx.sampleRate);buffer.copyToChannel(samples,0);cache.set(key,buffer)}
    const source=ctx.createBufferSource();source.buffer=buffer;source.connect(ctx.gainNode);
    let ended=false;source.onended=()=>{ended=true;source.disconnect()};source.start();
    Hooks.callAll('shadow-edge-gm.soundStart',{id,key});
    return ()=>{if(!ended){ended=true;source.stop();source.disconnect()}};
  }catch{return null} // Audio availability must never interrupt an attack or animation.
}
