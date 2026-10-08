export const MODULE = "shadow-edge-gm";
export const clone = value => structuredClone(value);
export function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${stable(value[k])}`).join(",")}}`;
  return JSON.stringify(value);
}
export const equal = (a,b) => stable(a) === stable(b);
export function mergeThree(base, local, remote, prefix="") {
  if (equal(local,base)) return {value:clone(remote), conflicts:[]};
  if (equal(remote,base) || equal(remote,local)) return {value:clone(local),conflicts:[]};
  if ([base,local,remote].every(v=>v && typeof v === "object" && !Array.isArray(v))) {
    const value={}, conflicts=[];
    for (const key of new Set([...Object.keys(base),...Object.keys(local),...Object.keys(remote)])) {
      const result=mergeThree(base[key],local[key],remote[key],prefix ? `${prefix}.${key}` : key);
      if (result.value!==undefined) value[key]=result.value;
      conflicts.push(...result.conflicts);
    }
    return {value,conflicts};
  }
  return {value:clone(local),conflicts:[prefix||"document"]};
}
export function validBaseURL(raw) {
  const u=new URL(raw);
  if (u.username||u.password||u.search||u.hash || u.pathname!=="/" || !(u.protocol==="https:" || u.protocol==="http:" && ["localhost","127.0.0.1","[::1]"].includes(u.hostname))) throw Error("Укажите HTTPS-адрес сайта (HTTP разрешён для localhost).");
  return u.origin;
}
export function scalarNumber(raw) {
  const m=String(raw??"").match(/^\s*(\d+)(?:\s|$|\()/);return m?Number(m[1]):null;
}
export function damageFormula(raw) {
  const value=String(raw??"").replace(/к/gi,"d").trim();
  const m=value.match(/(?:\(\s*)?(\d+d(?:4|6|8|10|12|20)(?:\s*[+-]\s*\d+)?)(?:\s*\))?/i);
  return m ? m[1].replace(/\s/g,"") : /^\d+$/.test(value) ? value : null;
}
export const attackBonus = raw => /^[+-]?\d+$/.test(String(raw).trim()) ? Number(raw) : null;
export const damageTypes={fire:"fire",огн:"fire",cold:"cold",холод:"cold",lightning:"lightning",элект:"lightning",thunder:"thunder",звук:"thunder",force:"force",силов:"force",poison:"poison",яд:"poison",acid:"acid",кислот:"acid",necrotic:"necrotic",некрот:"necrotic",radiant:"radiant",излуч:"radiant",psychic:"psychic",псих:"psychic",slashing:"slashing",рубящ:"slashing",piercing:"piercing",колющ:"piercing",bludgeoning:"bludgeoning",дробящ:"bludgeoning"};
export function damageType(text){return Object.entries(damageTypes).find(([key])=>String(text).toLowerCase().includes(key))?.[1]??null}
export function authoringActor(doc) {
  const s=doc.system??{};
  return {name:doc.name,edition:s.source?.rules??"2024",abilities:Object.fromEntries(["str","dex","con","int","wis","cha"].map(k=>[k,s.abilities?.[k]?.value??10])),maxHp:s.attributes?.hp?.max??0,armorClass:s.attributes?.ac?.value??10,speed:s.attributes?.movement?.walk??0,proficiencyBonus:s.attributes?.prof??2,
    items:Array.from(doc.items??[]).filter(i=>["spell","weapon","feat"].includes(i.type)).map(i=>{
      const activity=Object.values(i.system?.activities??{}).find(a=>["attack","save","heal","damage"].includes(a.type));
      const part=activity?.damage?.parts?.[0]??activity?.healing;
      return {id:i.id??i._id,name:i.name,description:plainText(i.system?.description?.value??""),type:i.type,spellId:i.flags?.[MODULE]?.spellId??"",attackBonus:activity?.attack?.flat?Number(activity.attack.bonus)||0:0,damage:part?.custom?.enabled?part.custom.formula:part?`${part.number}d${part.denomination}${part.bonus?`+${part.bonus}`:""}`:"",damageType:Array.from(part?.types??[])[0]??"",saveAbility:Array.from(activity?.save?.ability??[])[0]??"",saveDc:Number(activity?.save?.dc?.formula)||0,range:Number(i.system?.range?.value)||0};
    })};
}
export function exportEntity(source,actor) {
  const data=clone(source??{kind:"npc",title:actor.name,content:"",playerContent:"",summary:"",tags:[],quickFacts:[],related:[]});
  data.title=actor.name;
  const s=actor.system??{};const own=authoringActor(actor);
  if (data.kind==="player") {data.foundryCharacter=own;return data}
  const before=data.statBlock??{};
  data.statBlock={...before,armorClass:String(own.armorClass),hitPoints:String(own.maxHp),speed:String(own.speed),proficiencyBonus:String(own.proficiencyBonus),abilityScores:own.abilities};
  for(const section of ["actions","bonusActions","reactions","traits"]){
    const items=own.items.filter(i=>i.type!=="spell"&&(Array.from(actor.items??[]).find(d=>(d.id??d._id)===i.id)?.flags?.[MODULE]?.section??"actions")===section);
    data.statBlock[section]=items.map(i=>({...before[section]?.find(a=>a.name===i.name),name:i.name,description:i.description,toHit:String(i.attackBonus),damage:i.damage?`${i.damage} ${i.damageType}`:"",saveDc:i.saveDc?String(i.saveDc):""}));
  }
  const spells=own.items.filter(i=>i.type==="spell");if(spells.length)data.statBlock.spellcasting={...before.spellcasting,spells:spells.map(i=>i.name)};
  data.playerContent=plainText(s.details?.biography?.public??s.details?.biography?.value??data.playerContent);
  return data;
}
export function plainText(html) {
  if (typeof document === "undefined") return String(html??"");
  const root=document.createElement("div");root.innerHTML=String(html??"");
  root.querySelectorAll("script,style").forEach(el=>el.remove());
  root.querySelectorAll("br").forEach(el=>el.replaceWith("\n"));
  root.querySelectorAll("p,div,h1,h2,h3,li").forEach(el=>el.append("\n"));
  return root.textContent.trim();
}
export function exportJournal(source,doc) {
  const data=clone(source??{kind:"lore",title:doc.name,tags:[],quickFacts:[],related:[]});
  const pages=Array.from(doc.pages??[]);const text=pages.filter(p=>p.type==="text").map(p=>plainText(p.text?.content??"")).join("\n\n");
  if("name" in data && !("title" in data)){data.name=doc.name;data.description=text}else{data.title=doc.name;if("sceneText" in data)data.sceneText=text;else if("focus" in data)data.focus=text;else data.content=text}
  return data;
}
export function sceneLevel(doc,id="level") {
  const w=doc.width||doc.dimensions?.sceneWidth||1000,h=doc.height||doc.dimensions?.sceneHeight||1000;
  return {id,name:doc.name,imageUrl:doc.background?.src??"",width:w,height:h,walls:Array.from(doc.walls??[]).map(x=>({id:x.id??x._id,kind:x.door?"door":"wall",start:{x:x.c[0]/w,y:x.c[1]/h},end:{x:x.c[2]/w,y:x.c[3]/h},disabled:false})),grid:{type:doc.grid?.type===0?"none":"square",size:(doc.grid?.size??100)/w,color:doc.grid?.color??"#ffffff",opacity:doc.grid?.alpha??0.3},gridDistance:doc.grid?.distance??0};
}
