import {MODULE} from "./core.mjs";
const effects={"fire-bolt":"jb2a.fire_bolt.orange", "ray-of-frost":"jb2a.ray_of_frost.blue", "magic-missile":"jb2a.magic_missile.blue", "cure-wounds":"jb2a.healing_generic.200px.green", "healing-word":"jb2a.healing_generic.200px.green",fireball:"jb2a.fireball.explosion.orange", "burning-hands":"jb2a.burning_hands.01.orange", "lightning-bolt":"jb2a.lightning_bolt.narrow.blue",bless:"jb2a.bless.200px.intro.yellow",shield:"jb2a.shield.01.intro.blue"};
export function registerAnimations(){
  const played=new Set();
  Hooks.on("midi-qol.RollComplete",async workflow=>{
    const owner=workflow.userId??workflow.user?.id;if(owner!==game.user.id)return;
    const id=workflow.uuid??workflow.id;if(!id||played.has(id))return;
    const meta=workflow.item?.flags?.[MODULE];if(!meta)return;played.add(id);if(played.size>500)played.delete(played.values().next().value);
    if(!globalThis.Sequence||!globalThis.Sequencer)return;
    const key=meta.spellId?.replace(/-(2014|2024)$/,"");const file=effects[key];if(!file||!Sequencer.Database.entryExists(file))return;
    const source=workflow.token,targets=Array.from(workflow.targets??[]);if(!source)return;
    try{const sequence=new Sequence();if(["fireball","burning-hands","lightning-bolt"].includes(key)&&workflow.templateUuid){const template=await fromUuid(workflow.templateUuid);if(template?.object)sequence.effect().file(file).atLocation(template.object).scaleToObject(1)}else for(const target of targets.length?targets:[source]){const effect=sequence.effect().file(file).atLocation(["bless","shield","cure-wounds","healing-word"].includes(key)?target:source);if(!["bless","shield","cure-wounds","healing-word"].includes(key))effect.stretchTo(target)}await sequence.play()}catch{ui.notifications.warn("Расчёт выполнен, но анимация недоступна.")}
  });
}
