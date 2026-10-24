import type {CreateEntityInput} from "@shadow-edge/shared-types";
export type ComparisonField=Exclude<keyof CreateEntityInput,"expectedRevision">;
export type ComparisonChoice="local"|"server";
export type ComparisonChoices=Partial<Record<ComparisonField,ComparisonChoice>>;
export const comparisonFieldLabels:Record<ComparisonField,string>={
 kind:"Тип записи",title:"Название",subtitle:"Подзаголовок",summary:"Краткое описание",content:"Сведения мастера",playerContent:"Текст для игроков",playerCards:"Карточки игроков",tags:"Теги",quickFacts:"Краткие сведения",related:"Связи в тексте",art:"Основное изображение",playlist:"Плейлист",gallery:"Галерея",category:"Категория",region:"Регион",danger:"Опасность",parentId:"Родительская локация",role:"Роль",status:"Статус",level:"Уровень",importance:"Значимость",locationId:"Локация",statBlock:"Характеристики и способности",questAppearance:"Оформление квеста",rewardProfile:"Награды и добыча",urgency:"Срочность",issuerId:"Кто выдаёт квест",preparedCombat:"Заготовка боя",preparedCombats:"Заготовки боёв",visibility:"Кто видит запись"
};
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
export const entityComparisonSignature=(local:unknown,server:unknown)=>JSON.stringify({local:JSON.stringify(local),server:JSON.stringify(server)});
export function compareEntityFields(base:CreateEntityInput|null,local:CreateEntityInput,server:CreateEntityInput){
 const keys=new Set([...Object.keys(local),...Object.keys(server),...Object.keys(base??{})]);
 return [...keys].filter(key=>key!=="expectedRevision").map(raw=>{
  const key=raw as ComparisonField;
  // Match the existing top-level merge: a missing local property cannot overwrite a server property.
  const localChanged=Object.hasOwn(local,key)&&!same(local[key],base?base[key]:server[key]);
  const serverChanged=!same(server[key],base?base[key]:local[key]);
  return {key,label:comparisonFieldLabels[key]??raw,localChanged,serverChanged,requiresChoice:localChanged&&serverChanged&&!same(local[key],server[key]),local:local[key],server:server[key]};
 }).filter(row=>row.localChanged||row.serverChanged);
}
export function mergeComparedEntity(base:CreateEntityInput|null,local:CreateEntityInput,server:CreateEntityInput,choices:ComparisonChoices={}){
 const merged={...server};
 for(const row of compareEntityFields(base,local,server))if(row.localChanged&&choices[row.key]!=="server")Object.assign(merged,{[row.key]:local[row.key]});
 return merged;
}
const nestedLabels:Record<string,string>={accentColor:"Цвет акцента",density:"Плотность блоков",textColor:"Цвет текста",backgroundColor:"Цвет карточки",name:"Название",title:"Название",subtitle:"Подпись",summary:"Описание",content:"Текст",url:"Ссылка",alt:"Описание изображения",caption:"Подпись",label:"Название",value:"Значение",reason:"Пояснение",quantity:"Количество",check:"Проверка",dc:"СЛ",details:"Детали",size:"Размер",creatureType:"Тип существа",alignment:"Мировоззрение",armorClass:"КБ",hitPoints:"ХП",speed:"Скорость",proficiencyBonus:"Бонус мастерства",challenge:"Опасность / CR",senses:"Чувства",languages:"Языки",savingThrows:"Спасброски",skills:"Навыки",resistances:"Сопротивления",immunities:"Иммунитеты",conditionImmunities:"Иммунитеты к состояниям",abilityScores:"Характеристики",str:"СИЛ",dex:"ЛОВ",con:"ТЕЛ",int:"ИНТ",wis:"МДР",cha:"ХАР",traits:"Способности",actions:"Действия",bonusActions:"Бонусные действия",reactions:"Реакции",spellcasting:"Магия",ability:"Базовая характеристика",saveDc:"СЛ спасброска",attackBonus:"Бонус атаки",slots:"Ячейки",spells:"Заклинания",description:"Описание",toHit:"Попадание",damage:"Урон",loot:"Добыча",level:"Уровень",partyLevel:"Уровень группы",playerIds:"Игроки",entityId:"Запись",items:"Участники",allies:"Союзники",foundry:"Настройки Foundry",id:"Запись",kind:"Тип записи",category:"Категория",tone:"Оформление"};
const enums:Record<string,Record<string,string>>={
 density:{compact:"Компактно",comfortable:"Свободно"},
 kind:{npc:"НПС",player:"Игрок",location:"Локация",monster:"Монстр",quest:"Квест",lore:"Заметка"},
 category:{City:"Город",Region:"Регион",Dungeon:"Подземелье",POI:"Точка интереса",History:"История",Rumor:"Слух",Religion:"Религия",Threat:"Угроза"},
 danger:{Safe:"Безопасно",Tense:"Напряжённо",Dangerous:"Опасно",Deadly:"Смертельно"},
 status:{active:"Активно",paused:"Приостановлено",completed:"Завершено",Active:"Активен",Retired:"Не участвует",Reserve:"В резерве",Guest:"Гость",Ally:"Союзник",Watcher:"Наблюдатель",Threat:"Угроза",Unknown:"Неизвестно",Hostile:"Враждебен",Territorial:"Защищает территорию",Summoned:"Призван",Neutral:"Нейтрален"},
 importance:{Background:"Фоновая",Major:"Важная",Critical:"Ключевая",Minion:"Приспешник",Standard:"Обычная",Elite:"Элитная",Boss:"Босс"},
 urgency:{Low:"Низкая",Medium:"Средняя",High:"Высокая",Critical:"Критическая"},visibility:{gm_only:"Только мастеру",player_safe:"Можно показать игрокам"}
};
const referenceFields=new Set(["parentId","locationId","issuerId","entityId","id","playerIds"]);
export function entityComparisonText(value:unknown,field:string,resolve:(id:string)=>string=id=>id):string{
 if(value===undefined||value===null||value==="")return "Не указано";
 if(typeof value==="boolean")return value?"Да":"Нет";
 if(typeof value==="number")return String(value);
 if(typeof value==="string")return referenceFields.has(field)?resolve(value):enums[field]?.[value]??value;
 if(Array.isArray(value))return value.length?value.map((item,index)=>`${index+1}. ${entityComparisonText(item,field,resolve)}`).join("\n\n"):"Список пуст";
 if(typeof value==="object"){
  const object=value as Record<string,unknown>;
  const entries=Object.entries(object).filter(([key,v])=>key!=="contentHtml"&&v!==undefined&&v!==null&&v!=="");
  const rows=entries.map(([key,v])=>`${nestedLabels[key]??comparisonFieldLabels[key as ComparisonField]??key}: ${entityComparisonText(v,key,resolve)}`);
  // Rich text is displayed as text, never executed. Full markup remains in the explicit technical disclosure.
  if(object.contentHtml&&!object.content&&typeof object.contentHtml==="string")rows.push("Текст: "+object.contentHtml.replace(/<script[\s\S]*?<\/script>/gi,"").replace(/<style[\s\S]*?<\/style>/gi,"").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim());
  return rows.length?rows.join("\n"):"Нет данных";
 }
 return String(value);
}
