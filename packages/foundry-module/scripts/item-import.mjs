import {MODULE,clone,equal} from './core.mjs';
import {persistentProjection} from './adapter.mjs';

function comparable(value){
 const data=clone(value);delete data._id;
 if(data.system?.uses)delete data.system.uses.spent;
 for(const activity of Object.values(data.system?.activities??{}))if(activity.uses)delete activity.uses.spent;
 return data;
}
export function sameImportedItem(a,b){return Boolean(a&&b&&equal(comparable(a),comparable(b)))}
function normalizedSource(source,actor){
 try{return persistentProjection(new CONFIG.Item.documentClass(clone(source),{parent:actor}),source)}catch{return null}
}
export async function importItems(actor,items,state){
 const previous=state.itemBaselines??{},next={...previous},sources={...state.itemSources},preserved=[];
 for(let index=0;index<items.length;index++){
  const source=clone(items[index]);if(source.system?.uses)delete source.system.uses.spent;
  for(const activity of Object.values(source.system?.activities??{}))if(activity.uses)delete activity.uses.spent;
  const key=source.flags?.[MODULE]?.inventoryKey??source.flags?.[MODULE]?.spellId??(source.flags?.[MODULE]?.sourceClass?'class':`ability-${index}`);
  let existing=actor.items.find(i=>i.flags?.[MODULE]?.importKey===key);
  if(!existing&&(source.flags?.[MODULE]?.inventoryKey||source.flags?.[MODULE]?.aiAdded)&&previous[key])continue;
  source.flags??={};source.flags[MODULE]={...source.flags[MODULE],importKey:key};
  if(existing){
   const template=clone(source);delete template._id;
   let baseline=previous[key];
   const local=persistentProjection(existing,baseline??template),normalized=normalizedSource(source,actor);
   // Missing browser history is not evidence of a manual edit. Adopt only an exact normalized match.
   if(!baseline&&sameImportedItem(local,normalized))baseline=local;
   if(!baseline||!sameImportedItem(local,baseline)){
    const incomingUnchanged=sameImportedItem(sources[key],source)||sameImportedItem(normalized,baseline);
    if(source.img&&(!existing.img||existing.img==='icons/svg/item-bag.svg'))await existing.update({img:source.img});
    // A local change alone is normal: report only a competing site revision or unverifiable history.
    if(!incomingUnchanged)preserved.push({actor:actor.name,item:existing.name,reason:baseline?'Изменения Foundry сохранены; версия сайта отличается.':'Нет истории сравнения в этом браузере; существующая запись сохранена.'});
    continue;
   }
   const spent=existing.system.uses?.spent;
   if(existing.type!==template.type){template.flags={...clone(existing.flags),...template.flags};const [replacement]=await actor.createEmbeddedDocuments('Item',[template]);try{await existing.delete()}catch(error){await replacement.delete();throw error}existing=replacement}
   else{for(const id of Object.keys(existing.system.activities??{}))if(!template.system?.activities?.[id])template[`system.activities.-=${id}`]=null;await existing.update(template)}
   if(spent!==undefined)await existing.update({'system.uses.spent':spent});
  }else{[existing]=await actor.createEmbeddedDocuments('Item',[source])}
  next[key]=persistentProjection(existing,source);sources[key]=clone(source);
 }
 state.itemBaselines=next;state.itemSources=sources;return preserved;
}
