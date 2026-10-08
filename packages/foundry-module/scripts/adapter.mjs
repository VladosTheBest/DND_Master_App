import {MODULE,clone,scalarNumber,authoringActor,sceneLevel} from "./core.mjs";
import {abilityActivity} from "./mechanics.mjs";

export const supportedSpells=new Set(["fire-bolt","ray-of-frost","magic-missile","cure-wounds","healing-word","burning-hands","fireball","lightning-bolt","bless","shield"]);
export const englishName=name=>String(name).split(" · ").at(-1).trim();
export function spellKey(id){return String(id).replace(/-(2014|2024)$/,"")}
export function safeHTML(text){return `<p>${String(text??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll("\n","<br>")}</p>`}
const indexCache=new Map();
export async function compendiumItem(name,edition,type="spell"){
  const english=englishName(name).toLowerCase();
  for(const pack of game.packs.values()){
    if(pack.metadata.packageName!=="dnd5e" || pack.documentName!=="Item")continue;
    // Keep editions separate, even when names match.
    const modern=/24$/.test(pack.metadata.name);if(modern!==(edition==="2024"))continue;
    let index=indexCache.get(pack.collection);if(!index){index=await pack.getIndex({fields:["type","system.identifier"]});indexCache.set(pack.collection,index)}
    const hit=index.find(i=>i.type===type && i.name.toLowerCase()===english);if(hit){const item=(await pack.getDocument(hit._id)).toObject();delete item._id;delete item._stats;return item}
  }
  return null;
}
export function basicAbility(v,index=0){
  const a=abilityActivity(v,index),m=v.foundry??v.mechanics;
  return {name:v.name??"Способность",type:["feat","weapon","spell"].includes(v.type)?v.type:"feat",system:{description:{value:safeHTML(v.description)},activities:a?{[a._id]:a}:{},range:{value:m?.range??v.range??null,units:"ft"},identifier:`shadow-edge-${index}`},flags:{[MODULE]:{abilityIndex:index,spellId:v.spellId||undefined,coverage:a?"partial":"manual",reason:a?"Базовая механика настроена; сложные условия и эффекты требуют проверки.":"Неоднозначный статблок: автоматический расчёт не назначен."}}};
}
async function spellItems(record,catalog){
  let selected=[];const d=record.data;
  if(record.kind==="character")selected=[...new Set(d.draft.levels.flatMap(l=>[...(l.spellIds??[]),...(l.cantripIds??[]),...(l.preparedSpellIds??[])]))];
  else selected=catalog.filter(s=>(d.statBlock?.spellcasting?.spells??[]).some(n=>[s.name,englishName(s.name),s.name.split(" · ")[0]].includes(n))).map(s=>s.id);
  const edition=d.draft?.edition??"2014",items=[];
  for(const id of selected){const s=catalog.find(s=>s.id===id);if(!s)continue;const spellEdition=id.endsWith("-2024")?"2024":id.endsWith("-2014")?"2014":edition;
    let item=await compendiumItem(s.name,spellEdition);
    const configured=Boolean(item&&supportedSpells.has(spellKey(id)));
    item??={type:"spell",system:{level:s.level,description:{value:safeHTML(s.description)},activities:{}}};
    item.name=s.name;item.flags??={};item.flags[MODULE]={spellId:id,coverage:configured?"partial":"manual",reason:configured?"Механика взята из SRD системы; требуется проверка сложных эффектов в целевой связке.":"Вне проверяемого набора или нет совпадения в SRD."};
    // Only our Sequencer hook owns imported spell animations.
    item.flags.autoanimations={isEnabled:false};items.push(item);
  }return items;
}
export async function actorPlan(record,catalog){
  const d=record.data,native=record.kind==="character",external=d.foundryCharacter,s=native?d.stats:external??d.statBlock??{};
  const abilityValues=native?s.abilities:external?s.abilities:s.abilityScores??{};
  const hp=native?s.maxHp:external?s.maxHp:scalarNumber(s.hitPoints),ac=native?s.armorClass:external?s.armorClass:scalarNumber(s.armorClass),speed=native?s.speed:external?s.speed:scalarNumber(s.speed);
  const projection={name:native?d.draft.name:d.title,type:native||record.kind==="player"?"character":"npc",system:{abilities:Object.fromEntries(["str","dex","con","int","wis","cha"].map(k=>[k,{value:abilityValues[k]??10}])),attributes:{ac:{calc:"flat",flat:ac??10},hp:{max:hp??1},movement:{walk:speed??30}},details:{biography:{value:safeHTML(d.playerContent??""),public:safeHTML(d.playerContent??"")}}},prototypeToken:{name:native?d.draft.name:d.title,actorLink:native||record.kind==="player",disposition:native||record.kind==="player"?1:-1},flags:{[MODULE]:{sourceKey:record.key,kind:record.kind,edition:d.draft?.edition??external?.edition??"2014"}}};
  if(d.art?.url)projection.img=d.art.url;
  let items=[];
  if(native){
    const classNames={barbarian:"Barbarian",bard:"Bard",cleric:"Cleric",druid:"Druid",fighter:"Fighter",monk:"Monk",paladin:"Paladin",ranger:"Ranger",rogue:"Rogue",sorcerer:"Sorcerer",warlock:"Warlock",wizard:"Wizard",artificer:"Artificer"};
    const item=await compendiumItem(classNames[d.draft.classId]??d.draft.classId,d.draft.edition,"class")??{name:classNames[d.draft.classId]??d.draft.classId,type:"class",system:{identifier:d.draft.classId}};
    item.system.levels=d.draft.targetLevel;item.system.advancement=[];item.flags??={};item.flags[MODULE]={sourceClass:true};items.push(item);
    projection.system.source={rules:d.draft.edition};
    projection.system.details.spellLevel=d.draft.targetLevel;
    for(const save of s.savingThrows??[])if(projection.system.abilities[save.ability])projection.system.abilities[save.ability].proficient=save.proficient?1:0;
    const caster={bard:"cha",cleric:"wis",druid:"wis",paladin:"cha",ranger:"wis",sorcerer:"cha",warlock:"cha",wizard:"int",artificer:"int"}[d.draft.classId];if(caster)projection.system.attributes.spellcasting=caster;
    projection.system.spells=Object.fromEntries((s.spellSlots??[]).map((n,i)=>[`spell${i+1}`,{override:n}]));
    if(s.pactSlots)projection.system.spells.pact={override:s.pactSlots,level:s.pactSlotLevel};
    const skillIDs={"animal-handling":"ani","sleight-of-hand":"slt",athletics:"ath",acrobatics:"acr",arcana:"arc",deception:"dec",history:"his",insight:"ins",intimidation:"itm",investigation:"inv",medicine:"med",nature:"nat",perception:"prc",performance:"prf",persuasion:"per",religion:"rel",stealth:"ste",survival:"sur"};
    projection.system.skills=Object.fromEntries((s.skills??[]).filter(x=>skillIDs[x.id]).map(x=>[skillIDs[x.id],{value:x.proficient?1:0}]));
  }else{
    let index=0;for(const section of ["actions","bonusActions","reactions","traits"])for(const v of s[section]??[]){const item=basicAbility(v,index++);item.flags[MODULE].section=section;if(!v.foundry?.activation)for(const activity of Object.values(item.system.activities))activity.activation.type=section==="bonusActions"?"bonus":section==="reactions"?"reaction":"action";items.push(item)}
    if(external)items=(external.items??[]).map((v,i)=>basicAbility({...v,toHit:String(v.attackBonus)},i));
  }
  items.push(...await spellItems(record,catalog));
  return {projection,items};
}
export function journalPlan(record){
  const d=record.data,text=d.content??d.sceneText??d.description??d.focus??d.summary??"";
  return {name:record.title,ownership:{default:0},pages:[{name:record.title,type:"text",text:{content:safeHTML(text),format:1}}],flags:{[MODULE]:{sourceKey:record.key,kind:record.kind}}};
}
export function scenePlan(record,level){
  const d=level??{name:record.title,imageUrl:record.data.imageUrl,width:record.data.width,height:record.data.height,walls:[],grid:{type:"none",size:0.1},id:"world"};
  const w=d.width,h=d.height;
  return {name:level?`${record.title} — ${d.name}`:record.title,width:w,height:h,background:{src:d.imageUrl},active:false,grid:{type:d.grid?.type==="none"?0:1,size:Math.max(50,Math.round((d.grid?.size??0.1)*w)),distance:d.gridDistance||5,units:"ft"},walls:(d.walls??[]).map(wall=>({c:[wall.start.x*w,wall.start.y*h,wall.end.x*w,wall.end.y*h],door:wall.kind==="door"?1:0})),flags:{[MODULE]:{sourceKey:record.key,kind:record.kind,levelId:d.id,scaleKnown:Boolean(d.gridDistance)}}};
}
export function persistentProjection(doc,template){
  const source=doc.toObject?doc.toObject():doc;
  function take(v,t){if(Array.isArray(t))return (v??[]).map((item,index)=>t[index]&&typeof t[index]==="object"?take(item,t[index]):t[0]&&typeof t[0]==="object"?take(item,t[0]):clone(item));if(t&&typeof t==="object"){const out={};for(const k of Object.keys(t))out[k]=take(v?.[k],t[k]);return out}return clone(v)}
  return take(source,template);
}
export function reverseRecord(record,doc){
  if(record?.kind==="character")return authoringActor(doc);
  if(doc.documentName==="Scene")return {title:record?.title??doc.name,revision:record?.data.revision??0,levels:[sceneLevel(doc,record?.data.levels?.[0]?.id??"level")]};
  return null;
}
