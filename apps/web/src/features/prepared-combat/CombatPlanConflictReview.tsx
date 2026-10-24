import {useLayoutEffect,useRef} from "react";
import type {CampaignPreparedCombat,KnowledgeEntity,PreparedCombatPlan} from "@shadow-edge/shared-types";
import {isPreparedCombatHostEntity,resolveEntityPreparedCombats} from "../combat/combat.utils";
export function CombatPlanConflictReview({local,server,planIndex,entityMap,onPrepare}:{local:CampaignPreparedCombat;server:KnowledgeEntity;planIndex:number;entityMap:Map<string,KnowledgeEntity>;onPrepare:(useLocal:boolean)=>void}) {
 const root=useRef<HTMLElement>(null);
 useLayoutEffect(()=>{root.current?.scrollIntoView({block:"start",behavior:"instant"});root.current?.focus({preventScroll:true});},[server.revision]);
 const saved=isPreparedCombatHostEntity(server)?resolveEntityPreparedCombats(server)[planIndex]:undefined;
 const describe=(plan:PreparedCombatPlan|CampaignPreparedCombat|undefined)=>plan?<><strong>{plan.title||"Встреча без названия"}</strong><p>Игроки: {(plan.playerIds??[]).map(id=>entityMap.get(id)?.title||id).join(", ")||"Не выбраны"}</p><p>Союзники: {(plan.allies??[]).map(item=>(entityMap.get(item.entityId)?.title||item.entityId)+" × "+item.quantity).join(", ")||"Не выбраны"}</p><p>Противники: {plan.items.map(item=>(entityMap.get(item.entityId)?.title||item.entityId)+" × "+item.quantity).join(", ")||"Не выбраны"}</p></>:<p>Встречи на этой позиции больше нет. Ваш состав можно сохранить отдельной новой встречей.</p>;
 return <section ref={root} tabIndex={-1} className="combat-plan-conflict card" role="region" aria-label="Сравнение версий встречи">
 <h2>Квест изменился в другом окне</h2><p>Состав остался в редакторе. Сравните эту встречу перед сохранением. Остальные поля квеста и другие встречи сохранятся с сервера.</p>
 <div className="combat-plan-comparison"><article><h3>Мой состав</h3>{describe(local)}</article><article><h3>На сервере</h3>{describe(saved)}</article></div>
 <div className="actions"><button className="primary" type="button" onClick={()=>onPrepare(true)}>Подготовить мой состав</button><button className="ghost" type="button" disabled={!saved} onClick={()=>onPrepare(false)}>Взять серверный состав</button></div><p>Это обновит только форму. Затем нажмите «Сохранить».</p>
 </section>;
}
