import {MODULE} from './core.mjs';
export function savePromptOwner(actor,users){
 const active=users.filter(u=>u.active),players=active.filter(u=>!u.isGM&&actor.testUserPermission(u,'OWNER')).sort((a,b)=>a.id.localeCompare(b.id));
 return players[0]?.id??active.filter(u=>u.isGM).sort((a,b)=>a.id.localeCompare(b.id))[0]?.id;
}
const shown=new Set();
export function promptAreaSaves(message){
 const w=message.flags?.[MODULE]?.combat;
 if(!message.author?.isGM||!w?.area||w.type!=='save'||w.phase==='animation')return;
 const rows=w.rows.filter(r=>r.save===null).filter(r=>{const actor=fromUuidSync(r.actorUuid);return actor&&savePromptOwner(actor,game.users.contents)===game.user.id});
 if(!rows.length||shown.has(message.id))return;shown.add(message.id);if(shown.size>500)shown.delete(shown.values().next().value);
 const content=document.createElement('div'),intro=document.createElement('p');intro.textContent=`${w.name} · ${CONFIG.DND5E.abilities[w.ability]?.label??w.ability} · СЛ ${w.dc}`;content.append(intro);
 for(const row of rows){const token=fromUuidSync(row.tokenUuid),button=document.createElement('button');button.type='button';button.textContent=`${token?.name??'Существо'}: спасбросок`;button.onclick=async()=>{button.disabled=true;try{const current=game.messages.get(message.id)?.flags?.[MODULE]?.combat;if(current?.rows.find(r=>r.tokenUuid===row.tokenUuid)?.save!==null){button.textContent='Уже выполнен';return}const gm=game.users.activeGM;if(!gm)throw Error('Нужен активный мастер.');await ChatMessage.create({content:'Shadow Edge · запрос спасброска',whisper:[gm.id],flags:{[MODULE]:{combatRequest:{workflowUuid:message.uuid,action:'save',targetUuid:row.tokenUuid}}}});button.textContent='Запрос отправлен'}catch(e){button.disabled=false;ui.notifications.error(e.message)}};content.append(button)}
 const dialog=new foundry.applications.api.DialogV2({window:{title:'Спасброски от заклинания'},content:'<p></p>',buttons:[{action:'close',label:'Закрыть'}]});
 dialog.render(true).then(()=>dialog.element.querySelector('.dialog-content').replaceChildren(content)).catch(e=>console.error(`${MODULE}: save prompt`,e));
}
