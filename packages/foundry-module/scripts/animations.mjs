import {MODULE,activityValues} from "./core.mjs";
export const effects={"fire-bolt":{file:"jb2a.fire_bolt.orange",mode:"projectile"},"ray-of-frost":{file:"jb2a.ray_of_frost.blue",mode:"projectile"},"magic-missile":{file:"jb2a.magic_missile.purple",mode:"projectile"},"cure-wounds":{file:"jb2a.healing_generic.200px.green",mode:"target"},"healing-word":{file:"jb2a.healing_generic.200px.green",mode:"target"},fireball:{file:"jb2a.fireball.explosion.orange",mode:"burst"},"burning-hands":{file:"jb2a.burning_hands.01.orange",mode:"cone"},"lightning-bolt":{file:"jb2a.lightning_bolt.narrow.blue",mode:"ray"},bless:{file:"jb2a.bless.200px.intro.yellow",mode:"target"},shield:{file:"jb2a.shield.01.intro.blue",mode:"self"}};
export function midiAnimationMode(){const m=game.modules.get("midi-qol");return Boolean(m?.active&&(Number.parseInt(game.system.version,10)<6||m.version?.startsWith("14.6.")))}
export function animationProfile(item,activity){
  if(!item?.flags?.[MODULE])return null;
  const spell=item.flags[MODULE].spellId?.replace(/-(2014|2024)$/,"");if(effects[spell])return effects[spell];
  activity??=activityValues(item.system?.activities)[0];
  if(activity?.type==="heal")return effects["cure-wounds"];
  if(activity?.type==="attack")return activity.attack?.type?.value==="ranged"?{file:"jb2a.arrow.physical.white",mode:"projectile"}:{file:"jb2a.impact.004.blue",mode:"target"};
  if(["save","damage"].includes(activity?.type))return {file:"jb2a.impact.004.blue",mode:"target"};
  return null;
}
export function animationStatus(){
  if(!game.modules.get("sequencer")?.active||!globalThis.Sequence)return "Включите Sequencer для анимаций.";
  if(!game.modules.get("JB2A_DnD5e")?.active&&!game.modules.get("jb2a_patreon")?.active)return "Включите JB2A Free для анимаций.";
  return `Анимации готовы · ${midiAnimationMode()?"Midi-QOL":"обычные способности dnd5e"}. Выделите свой токен и отметьте цель.`;
}
const tokenObject=t=>t?.object??t;
export async function playAnimation({item,activity,source,targets=[],template,id}){
  const profile=animationProfile(item,activity);source=tokenObject(source);targets=targets.map(tokenObject).filter(t=>t?.center);template=tokenObject(template);
  if(!profile||!source?.center||!globalThis.Sequence||!globalThis.Sequencer)return false;
  if(!Sequencer.Database.entryExists(profile.file)){ui.notifications.warn(`Нет файла анимации ${profile.file}. Проверьте JB2A.`);return false}
  if(profile.mode==="self")targets=[source];
  if(!targets.length&&!template&&profile.mode==="target"&&activity?.type==="heal")targets=[source];
  if(!targets.length&&!template&&profile.mode!=="self")return false;
  const sequence=new Sequence({moduleName:MODULE});
  const effect=()=>sequence.effect().file(profile.file).name(`${MODULE}:${id}`);
  if(template&&["burst","cone","ray"].includes(profile.mode)){
    const d=template.document??template,origin={x:d.x,y:d.y},length=(d.distance??activity?.target?.template?.size??20)*canvas.grid.size/canvas.scene.grid.distance;
    if(profile.mode==="burst")effect().atLocation(origin).size(length*2);
    else{const radians=(d.direction??0)*Math.PI/180,end={x:origin.x+Math.cos(radians)*length,y:origin.y+Math.sin(radians)*length};if(profile.mode==="ray")effect().atLocation(origin).stretchTo(end);else effect().atLocation(origin).size(length).anchor({x:0,y:.5}).rotate(d.direction??0)}
  }else for(const target of targets){const directional=["projectile","ray","cone"].includes(profile.mode),same=source.center.x===target.center.x&&source.center.y===target.center.y;const e=effect().atLocation(directional&&!same?source:target);if(directional&&!same)e.stretchTo(target);else{if(directional)e.file("jb2a.impact.004.blue");e.scaleToObject(profile.mode==="burst"?3:1.5)}}
  await sequence.play();return true;
}
let registered=false;
export function registerAnimations(){
  if(registered)return;registered=true;const played=new Set();
  const play=async data=>{if(!data.id||played.has(data.id))return;played.add(data.id);if(played.size>500)played.delete(played.values().next().value);try{await playAnimation(data)}catch{ui.notifications.warn("Не удалось воспроизвести анимацию. Способность остаётся доступной.")}};
  Hooks.on("dnd5e.postUseActivity",(activity,config,results)=>{
    if(midiAnimationMode()||!results?.message)return;
    const actor=activity.item?.actor,source=actor?.token?.object??actor?.getActiveTokens()?.find(t=>t.controlled)??actor?.getActiveTokens()?.[0];
    void play({item:activity.item,activity,source,targets:Array.from(game.user.targets??[]),template:results.templates?.[0],id:results.message.uuid??results.message.id});
  });
  Hooks.on("midi-qol.RollComplete",workflow=>{
    if(!midiAnimationMode()||(workflow.userId??workflow.user?.id)!==game.user.id)return;
    void (async()=>{const template=workflow.templateUuid?await fromUuid(workflow.templateUuid):null;await play({item:workflow.item,activity:workflow.activity,source:workflow.token,targets:Array.from(workflow.targets??[]),template,id:workflow.uuid??workflow.id})})().catch(()=>ui.notifications.warn("Не удалось воспроизвести анимацию Midi-QOL."));
  });
}
