import {animationCatalog} from './animation-catalog.mjs';
import {playAnimation} from './animations.mjs';
import {MODULE} from './core.mjs';
export async function showAnimationLibrary(waitClosed){
 if(!game.user.isGM)return;
 let selected='sword-blood';
 while(true){
  const result=await waitClosed({window:{title:`Анимации · ${animationCatalog.length} эффектов`},content:`<p>Выделите токен исполнителя и отметьте цель. Здесь можно посмотреть эффекты без бросков и изменения хитов. Предпросмотр виден только вам.</p><label>Эффект<select name="effect">${animationCatalog.map(p=>`<option value="${p.key}" ${p.key===selected?'selected':''}>${p.label}</option>`).join('')}</select></label><label><input type="checkbox" name="hit" checked>Предпросмотр попадания (с кровью для режущего оружия)</label>`,buttons:[{action:'preview',label:'Показать',default:true,callback:(_e,_b,d)=>({key:d.element.querySelector('[name=effect]').value,hit:d.element.querySelector('[name=hit]').checked})},{action:'close',label:'Закрыть',callback:()=>null}]});
  if(!result)return;selected=result.key;
  const source=canvas.tokens?.controlled?.[0],target=[...game.user.targets][0]??canvas.tokens?.placeables.find(t=>t.id!==source?.id);
  if(!source?.actor||!target){ui.notifications.warn('Выделите токен исполнителя и разместите ещё один токен на сцене.');continue}
  const profile=animationCatalog.find(p=>p.key===result.key);
  await playAnimation({item:{actor:source.actor,flags:{[MODULE]:{aiAnimation:result.key}}},source,targets:[target],hit:result.hit,localOnly:true,waitForEnd:true,template:['zone','burst','cone','ray'].includes(profile.mode)?{document:{x:target.center.x,y:target.center.y,distance:10,direction:0}}:null});
 }
}
