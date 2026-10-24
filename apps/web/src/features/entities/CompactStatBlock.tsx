import type {KnowledgeEntity} from "@shadow-edge/shared-types";

export function CompactStatBlock({entity,onEdit}:{entity:KnowledgeEntity;onEdit?:()=>void}){
 if(entity.kind!=="npc"&&entity.kind!=="monster"&&entity.kind!=="player")return null;
 const stat=entity.statBlock;
 const translate=(value:string)=>({Tiny:"Крошечный",Small:"Маленький",Medium:"Средний",Large:"Большой",Huge:"Огромный",Gargantuan:"Громадный",humanoid:"гуманоид",beast:"зверь",undead:"нежить",dragon:"дракон",monstrosity:"монстр",construct:"конструкт",neutral:"нейтральный",unaligned:"без мировоззрения"} as Record<string,string>)[value]||value;
 const abilities=[["str","СИЛ"],["dex","ЛОВ"],["con","ТЕЛ"],["int","ИНТ"],["wis","МДР"],["cha","ХАР"]] as const;
 return <section className="compact-statblock" aria-label="Краткий статблок">
  <header><h2>Боевой профиль</h2>{onEdit&&<button className="ghost record-edit-action" type="button" onClick={onEdit}>{stat?"Изменить характеристики":"Добавить характеристики"}</button>}</header>
  {stat?<><p className="compact-statblock-type">{[stat.size,stat.creatureType,stat.alignment].filter(Boolean).map(translate).join(" · ")}</p>
  <dl className="compact-statblock-metrics">{[["Класс доспеха",stat.armorClass],["Хиты",stat.hitPoints],["Скорость",stat.speed],["Мастерство",stat.proficiencyBonus]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value||"—"}</dd></div>)}</dl>
  <dl className="compact-statblock-abilities">{abilities.map(([key,label])=>{const score=stat.abilityScores?.[key];const mod=typeof score==="number"?Math.floor((score-10)/2):null;return <div key={key}><dt>{label}</dt><dd>{score??"—"}{mod!==null&&<small>{mod>=0?"+":""}{mod}</small>}</dd></div>})}</dl>
  </>:<p className="copy">Добавьте КД, хиты, скорость и характеристики. Значения появятся в этом блоке.</p>}
 </section>;
}
