import {zoneGeometry} from './area-profiles.mjs';
import {MODULE} from './core.mjs';
import {profiles,effectFinished} from './native-effects.mjs';
import {playEffectSound} from './sounds.mjs';

const prefixes={claw:['claws'], 'claw-blood':['claws'],bite:['bite'],tail:['impact.004'],horn:['impact.004'],slam:['impact.004'],impact:['impact.004'],sword:['melee_generic'], 'sword-blood':['melee_generic'],axe:['melee_generic'], 'axe-blood':['melee_generic'],mace:['melee_generic'],hammer:['melee_generic'],dagger:['melee_generic'],bow:['arrow'],crossbow:['arrow'], 'fire-bolt':['fire_bolt'], 'ray-of-frost':['ray_of_frost'], 'guiding-bolt':['guiding_bolt','energy_beam.normal'], 'eldritch-blast':['eldritch_blast'], 'magic-missile':['magic_missile'], 'chain-lightning':['chain_lightning'], 'mind-pulse':['toll_the_dead'], 'cure-wounds':['healing_generic'],shield:['shield']};
const pending=new Map();
export function sequencerReady(){
 try{return Boolean(game.settings.get(MODULE,'sequencerAnimations')!==false&&game.modules.get('sequencer')?.active&&globalThis.Sequence&&globalThis.Sequencer?.Database)}catch{return false}
}
export const validSequencerPath=path=>typeof path==='string'&&path.length<=180&&/^jb2a\.[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+){0,8}$/.test(path);
export function sequencerCatalog(){
 if(!sequencerReady())return [];
 try{return [...new Set(Sequencer.Database.getPathsUnder('jb2a').map(p=>p.startsWith('jb2a.')?p:`jb2a.${p}`).filter(validSequencerPath))].sort().slice(0,256)}catch{return []}
}
export function sequencerFile(key,selected,theme='',area=false){
 if(!sequencerReady())return null;
 for(const path of [...(validSequencerPath(selected)?[selected]:[]),...(theme==='cold'?(area?['ice_spikes','ice_storm']:['ray_of_frost','cone_of_cold']):theme==='fire'?['fireball','fire_bolt']:[]).map(p=>`jb2a.${p}`),...(prefixes[key]??[]).map(p=>`jb2a.${p}`)]){
  let files;try{files=Sequencer.Database.getAllFileEntries(path)}catch{continue}
  if(!Array.isArray(files))continue;
  const file=files.find(f=>typeof f==='string'&&/^modules\/[^?#]+\.webm$/i.test(f)&&!f.split('/').includes('..')&&(!area||!/ConeOfCold|RayOfFrost|FireBolt|SnowballToss|WallBurst/i.test(f))&&!/loop|outro/i.test(f)&&(!theme||(theme==='cold'?/ice|cold|frost|snow|freez/i.test(f):/fire|flame/i.test(f))));
  if(file)return file;
 }
 return null;
}
export const sequencerFinished=id=>pending.get(id)??Promise.resolve();
export function playSequencerEffect(p,fallback){
 // Regions and sustained loops keep their authoritative native lifecycle.
 if(pending.size>=40||p.loop||!p.template&&!p.targets.length||!p.template&&profiles[p.key]?.[0]==='zone'||!p.template&&p.targets.some(t=>t.hit===false))return false;
 if(p.template?.shapes?.some(s=>s.hole||!['circle','rectangle'].includes(s.type)||s.rotation))return false;
 if(p.template&&!p.template.shapes&&!(p.template.length>0))return false;
 const file=sequencerFile(p.key,p.sequencerAnimation,p.theme,Boolean(p.template));if(!file)return false;
 let stopSound;
 try{
  const sequence=new Sequence();let lastEffect;
  const bounds=p.template?.shapes?zoneGeometry(p.template.shapes):p.template?{cx:p.template.x,cy:p.template.y,width:p.template.length*2,height:p.template.length*2}:null;
  for(const target of bounds?[{x:bounds.cx,y:bounds.cy}]:p.targets){
   const effect=sequence.effect().file(file).name(`shadow-edge-${p.id}`).duration(2600).fadeIn(80).fadeOut(200).volume(0);
   if(bounds)effect.atLocation(target).size({width:bounds.width,height:bounds.height});
   else if(['projectile','ray'].includes(profiles[p.key]?.[0]))effect.atLocation(p.source).stretchTo(target);
   else effect.atLocation(target).size(p.size*2.5);
   if(p.color)effect.tint(p.color);
   lastEffect=effect;
  }
  lastEffect.waitUntilFinished();
  stopSound=playEffectSound(p.key,p.id);
  const completion=Promise.resolve(sequence.play({local:true})).catch(async()=>{stopSound?.();fallback();await effectFinished(p.id)}).finally(()=>{stopSound?.();pending.delete(p.id)});
  pending.set(p.id,completion);
  return true;
 }catch{stopSound?.();return false}
}
