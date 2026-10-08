import {MODULE} from './core.mjs';

const categories={npc:'НПС',monster:'Монстры',player:'Игроки',character:'Игроки',location:'Локации',quest:'Квесты',lore:'Лор',event:'События',prep:'Подготовка',shop:'Магазины','world-map':'Карты мира','session-map':'Карты сессий'};
export const category=kind=>categories[kind]??'Прочие сущности';
export function inferAttackMode(v){
  const explicit=(v.foundry??v.mechanics)?.attackMode;
  if(explicit)return explicit;
  const text=`${v.name??''} ${v.description??''}`.toLowerCase();
  if(/дальн|выстрел|стрельб|стреляет|ranged|shoot|\bbow\b|crossbow|арбалет|лук/u.test(text))return 'ranged';
  return 'melee';
}
export function itemIcon(v){
  const text=`${v.spellId??''} ${v.name??''} ${v.damageType??''} ${v.damage??''}`.toLowerCase();
  if(/выстрел|дальн|лук|арбалет|bow|crossbow|arrow/u.test(text))return 'icons/weapons/bows/bow-recurve-black.webp';
  if(/меч|sword|рапир|rapier/u.test(text))return 'icons/weapons/swords/greatsword-blue.webp';
  if(/топор|axe|секир/u.test(text))return 'icons/weapons/axes/axe-battle-black.webp';
  if(/молот|hammer/u.test(text))return 'icons/weapons/hammers/hammer-double-bronze.webp';
  if(/кинжал|dagger/u.test(text))return 'icons/weapons/daggers/dagger-black.webp';
  if(/копь|spear/u.test(text))return 'icons/weapons/polearms/glaive-hooked-steel.webp';
  if(/fire|огн|плам/u.test(text))return 'icons/magic/fire/barrier-wall-flame-ring-yellow.webp';
  if(/heal|cure|леч|исцел/u.test(text))return 'icons/svg/heal.svg';
  if(/shield|щит/u.test(text))return 'icons/svg/mage-shield.svg';
  if(/cold|frost|холод|лед/u.test(text))return 'icons/svg/frozen.svg';
  if(/lightning|молни/u.test(text))return 'icons/svg/lightning.svg';
  if(/darkness|тьма/u.test(text))return 'icons/svg/blind.svg';
  if(v.type==='spell'||v.spellId)return 'icons/svg/book.svg';
  return v.type==='loot'||v.type==='equipment'?'icons/containers/bags/case-simple-brown.webp':'icons/svg/combat.svg';
}
export function isWeaponAbility(v){return !v.spellId&&/(меч|выстрел|лук|арбалет|топор|секир|кинжал|копь|молот|скимитар|булава|sword|bow|crossbow|axe|dagger|spear|hammer|scimitar|mace)/iu.test(v.name??'')}
export function lootItems(record){
  const d=record.data,items=[],seen=new Set();
  const add=(name,description,key,quantity=1,inferred=false)=>{if(!name||seen.has(name.toLowerCase()))return;seen.add(name.toLowerCase());items.push({name,type:'loot',img:itemIcon({name,type:'loot'}),system:{quantity,description:{value:description}},flags:{[MODULE]:{inventoryKey:key,inferredLoot:inferred}}})};
  for(const [i,v]of (d.rewardProfile?.loot??[]).entries()){
    const quantity=/^\d+$/.test(String(v.quantity))?Math.min(10000,Math.max(1,Number(v.quantity))):1;
    // Preserve harvest conditions as text; importing does not grant a successful check.
    add(v.name,[v.details,v.quantity&&`Количество: ${v.quantity}`,v.check&&`Получение: ${v.check}`,v.dc&&`Сложность: ${v.dc}`].filter(Boolean).join('\n'),`reward-${i}`,quantity);
  }
  if(d.foundryCharacter)return items;
  const text=[d.summary,d.subtitle,d.role,d.playerContent,d.content,d.draft?.notes,d.draft?.personality?.appearance,d.draft?.personality?.backstory].filter(Boolean).join(' ').toLowerCase();
  const rules=[['rope',/вер[её]вк|\brope\b/u,'Верёвка'],['torch',/факел|\btorch\b/u,'Факел'],['book',/книг|гримуар|\bbook\b/u,'Книга'],['tools',/кузнец|ремеслен|blacksmith|artisan/u,'Инструменты ремесленника'],['healer',/лекар|целител|healer/u,'Принадлежности лекаря'],['merchant',/торговец|merchant/u,'Торговые записи'],['soldier',/страж|солдат|guard|soldier/u,'Походные принадлежности']];
  for(const [id,re,name]of rules)if(re.test(text))add(name,'Предположение по описанию персонажа. Мастер может изменить или удалить предмет; цена и бонусы не назначены.',`description-${id}`,1,true);
  return items;
}
export function folderPath(record,records,type){
  if(type==='Actor')return [category(record.kind)];
  if(type==='Scene')return record.kind==='session-map'?[category(record.kind),record.title]:[category(record.kind)];
  const parents=[],seen=new Set([record.id]);let id=record.data.parentId;
  while(id&&!seen.has(id)){seen.add(id);const parent=records.find(r=>r.id===id);if(!parent)break;parents.unshift(parent.title);id=parent.data.parentId}
  if(!parents.length&&record.data.category)parents.push(record.data.category);
  return [category(record.kind),...parents];
}
export async function managedFolder(state,title,type,path){
  const names=[`Shadow Edge · ${title}`,...path];
  const max=game.collections?.get(type)?.maxFolderDepth??globalThis.CONST?.FOLDER_MAX_DEPTH??3;
  if(names.length>max)names.splice(max-1,names.length-max+1,names.slice(max-1).join(' / '));
  let parent=null;
  for(let i=0;i<names.length;i++){
    const key=names.slice(1,i+1).join('/');
    let f=game.folders.find(f=>f.type===type&&f.flags?.[MODULE]?.site===state.base&&f.flags?.[MODULE]?.campaignId===state.campaignId&&f.flags?.[MODULE]?.folderKey===key);
    f??=game.folders.find(f=>f.type===type&&f.name===names[i]&&(f.folder?.id??f.folder??null)===parent&&!f.flags?.[MODULE]?.campaignId);
    const data={name:names[i],type,folder:parent,sorting:'a',ownership:{default:0},flags:{[MODULE]:{site:state.base,campaignId:state.campaignId,folderKey:key}}};
    if(!f)f=await Folder.create(data);else if(f.name!==data.name||(f.folder?.id??f.folder??null)!==parent||f.sorting!=='a'||!f.flags?.[MODULE]?.campaignId)await f.update(data);
    parent=f.id;
  }return parent;
}
export function mediaEntries(record){
  const d=record.data,entries=[],seen=new Set();
  const add=(url,title,caption)=>{if(url&&!seen.has(url)){seen.add(url);entries.push({url,title:title||record.title,caption:caption??''})}};
  add(d.art?.url,record.title,d.art?.caption);
  for(const v of d.gallery??[])add(v.url,v.title,v.caption);
  if(record.kind==='world-map')add(d.imageUrl,record.title);
  for(const v of d.levels??[])add(v.imageUrl,v.name);
  return entries;
}
