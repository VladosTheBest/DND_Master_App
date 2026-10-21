export const doorTextures={wood:'modules/shadow-edge-gm/assets/door-wood.svg',iron:'modules/shadow-edge-gm/assets/door-iron.svg'};
export function doorAnimation(visual){
 if(!visual||!doorTextures[visual.style])return null;
 return {type:'swing',texture:doorTextures[visual.style],direction:visual.direction===-1?-1:1,double:!!visual.double,flip:!!visual.flip,strength:visual.strength??1,duration:visual.duration??700};
}
export function doorVisual(wall){
 const a=wall.animation,style=Object.keys(doorTextures).find(k=>doorTextures[k]===a?.texture);
 return wall.door&&a?.type==='swing'&&style?{style,direction:a.direction,double:a.double,flip:a.flip,strength:a.strength,duration:a.duration}:undefined;
}
// Move the jamb endpoints with their connected walls so correcting a door does not leave holes.
export function doorPlacementUpdates(walls,doorId,coordinates,visual,reverse=false){
 const door=walls.find(w=>(w.id??w._id)===doorId);
 if(!door?.door)throw Error('Дверь больше не существует.');
 if(coordinates.length!==4||coordinates.some(v=>!Number.isFinite(v)||v<0)||Math.hypot(coordinates[2]-coordinates[0],coordinates[3]-coordinates[1])<4)throw Error('Укажите четыре координаты и длину двери не менее 4 px.');
 const c=coordinates.map(Math.round),updates=[];
 for(const wall of walls){
  const id=wall.id??wall._id;if(id===doorId)continue;
  const next=[...wall.c];let changed=false;
  for(const i of [0,2])for(const j of [0,2])if(Math.hypot(wall.c[i]-door.c[j],wall.c[i+1]-door.c[j+1])<=1){next[i]=c[j];next[i+1]=c[j+1];changed=true;break}
  if(changed)updates.push({_id:id,c:next});
 }
 updates.push({_id:doorId,c:reverse?[...c.slice(2),...c.slice(0,2)]:c,animation:doorAnimation(visual)});
 return updates;
}

export async function adjustSceneDoors(waitClosed){
 if(!game.user.isGM)throw Error('Настройка дверей доступна мастеру.');
 const scene=canvas.scene,doors=scene?.walls.filter(w=>w.door>0)??[];
 if(!doors.length){ui.notifications.info('На открытой сцене нет дверей.');return}
 const picked=await waitClosed({window:{title:'Двери сцены · выбрать'},content:`<label>Дверь<select name="door">${doors.map((d,i)=>`<option value="${i}">${i+1} · (${d.c[0]}, ${d.c[1]}) → (${d.c[2]}, ${d.c[3]})</option>`).join('')}</select></label><p>Координаты в пикселях сцены. В инструменте стен дверь можно также перемещать за концы.</p>`,buttons:[{action:'edit',label:'Настроить створку',callback:(_e,_b,d)=>Number(d.element.querySelector('[name=door]').value)},{action:'cancel',label:'Закрыть',callback:()=>null}]});
 if(picked===null||picked===undefined)return;
 const door=doors[picked],initial=door.toObject(),v=doorVisual(door)??{style:'wood',direction:1,double:false,flip:false,strength:1,duration:700};
 door.object?.control({releaseOthers:true});
 const input=await waitClosed({window:{title:`Створка двери ${picked+1}`},content:`<p>Створка и проход перемещаются вместе. Примыкающие концы стен следуют за проёмом. Первые X/Y — сторона петель.</p>${['X петель','Y петель','X края','Y края'].map((label,i)=>`<label>${label}<input name="c${i}" type="number" min="0" step="1" value="${door.c[i]}" required></label>`).join('')}<label>Створка<select name="style"><option value="wood" ${v.style==='wood'?'selected':''}>Дерево</option><option value="iron" ${v.style==='iron'?'selected':''}>Железо</option><option value="none" ${!door.animation?'selected':''}>Без изображения</option></select></label><label>Направление открытия<select name="direction"><option value="1" ${v.direction===1?'selected':''}>По часовой стрелке</option><option value="-1" ${v.direction===-1?'selected':''}>Против часовой стрелки</option></select></label><label><input name="reverse" type="checkbox">Перенести петли на другой конец</label><label><input name="double" type="checkbox" ${v.double?'checked':''}>Две створки</label><p>После сохранения нажмите штатный значок двери. Изображение, проход и обзор изменятся вместе.</p>`,buttons:[{action:'save',label:'Сохранить положение',default:true,callback:(_e,_b,d)=>{const get=n=>d.element.querySelector(`[name=${n}]`);return {c:[0,1,2,3].map(i=>Number(get('c'+i).value)),reverse:get('reverse').checked,visual:{...v,style:get('style').value,direction:Number(get('direction').value),double:get('double').checked}}}},{action:'cancel',label:'Отмена',callback:()=>null}]});
 if(!input)return;
 const current=scene.walls.get(door.id)?.toObject();
 if(!current||JSON.stringify(current.c)!==JSON.stringify(initial.c)||JSON.stringify(current.animation)!==JSON.stringify(initial.animation))throw Error('Дверь изменена во время настройки. Откройте её заново.');
 if(input.c.some((n,i)=>n>(i%2?scene.height:scene.width)))throw Error('Дверь должна оставаться внутри сцены.');
 await scene.updateEmbeddedDocuments('Wall',doorPlacementUpdates(Array.from(scene.walls),door.id,input.c,input.visual,input.reverse));
 ui.notifications.info('Створка и проём обновлены. Нажмите значок двери для открытия.');
}
