import { useEffect, useRef, useState } from "react";
import type { CampaignData, KnowledgeEntity, RelatedEntity } from "@shadow-edge/shared-types";
import { api } from "../../app/api";
import { AppModal } from "../../app/AppModal";
import { kindTitle } from "../../app-shared";
import { confirmAction } from "../../app/confirm-action";
import { useDeviceDraft } from "../../app/hooks/useDeviceDraft";
import { DeviceDraftControls } from "../../app/DeviceDraftControls";
import { useWorkspaceGuard } from "../../app/workspace-route";

type Props={campaignId:string;ownerId:string;entity:KnowledgeEntity;onOpen:(r:RelatedEntity)=>void;onResolve?:(r:RelatedEntity)=>KnowledgeEntity|null;onChanged?:(c:CampaignData)=>void};
export function EntityRelationsPanel(props:Props) {
  return <Relations key={`${props.campaignId}:${props.entity.id}`} {...props}/>;
}
function Relations({campaignId,ownerId,entity,onOpen,onResolve,onChanged}:Props) {
  const alive=useRef(true);useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  const [items,setItems]=useState<RelatedEntity[]>(entity.related),[revision,setRevision]=useState<number|null>(null);
  const [loadAttempt,setLoadAttempt]=useState(0);
  const [relatedQuery,setRelatedQuery]=useState(""),[visibleCount,setVisibleCount]=useState(8);
  const filtered=items.filter(item=>`${item.label} ${item.reason||""} ${kindTitle[item.kind]}`.toLocaleLowerCase().includes(relatedQuery.trim().toLocaleLowerCase()));
  const [open,setOpen]=useState(false),[editing,setEditing]=useState<string|null>(null),[selected,setSelected]=useState<Record<string,string>>({}),[reason,setReason]=useState("");
  const [q,setQ]=useState(""),[kind,setKind]=useState("all"),[results,setResults]=useState<KnowledgeEntity[]>([]),[cursor,setCursor]=useState(""),[page,setPage]=useState("");
  const [loading,setLoading]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState("");
  const dirty=open&&(Object.keys(selected).length>0||reason!== (items.find(i=>i.id===editing)?.reason||""));
  const draft=useDeviceDraft({ownerId,campaignId,target:`relations:${entity.id}`,revision:revision??0,value:{selected,reason,editing},dirty,enabled:open,restore:d=>{setSelected(d.value.selected);setReason(d.value.reason);setEditing(d.value.editing);}});
  useWorkspaceGuard(dirty||saving,"Есть несохранённые связи. Перейти без сохранения?");
  useEffect(()=>{const cancel=new AbortController();api.getEntityRelations(campaignId,entity.id,cancel.signal).then(d=>{setItems(d.items);setRevision(d.revision);}).catch(e=>{if(!cancel.signal.aborted)setError(e.message);});return()=>cancel.abort();},[campaignId,entity.id,entity.revision,loadAttempt]);
  useEffect(()=>{
    if(!open||editing)return;
    const cancel=new AbortController();setLoading(true);if(!page)setCursor("");
    const timer=setTimeout(()=>api.searchEntities(campaignId,{q,kind,exclude:entity.id,cursor:page},cancel.signal).then(d=>{if(!cancel.signal.aborted){setResults(old=>page?[...old,...d.items]:d.items);setCursor(d.nextCursor);}}).catch(e=>{if(!cancel.signal.aborted)setError(e.message);}).finally(()=>{if(!cancel.signal.aborted)setLoading(false);}),250);
    return()=>{clearTimeout(timer);cancel.abort();};
  },[open,editing,q,kind,page,campaignId,entity.id]);
  async function close(){if(saving)return;if(!dirty||await confirmAction("Закрыть окно? Несохранённые связи останутся в черновике на устройстве.")){draft.flush();setOpen(false);}}
  function begin(target?:RelatedEntity){setEditing(target?.id??null);setReason(target?.reason||"");setSelected({});setPage("");setResults([]);setError("");setOpen(true);}
  async function save(target?:string,remove=false){
    if(revision===null)return;setSaving(true);setError("");
    try {const c=await api.mutateEntityRelations(campaignId,entity.id,{expectedRevision:revision,targetIds:Object.keys(selected),reason},target,remove);if(!alive.current)return;onChanged?.(c);const d=await api.getEntityRelations(campaignId,entity.id);setItems(d.items);setRevision(d.revision);draft.clear();setSelected({});setOpen(false);}
    catch(e){setError(e instanceof Error?e.message:"Не удалось сохранить связи.");const d=await api.getEntityRelations(campaignId,entity.id).catch(()=>null);if(d){setRevision(d.revision);setItems(d.items);} /* Keep selection and note for explicit retry. */}
    finally{setSaving(false);}
  }
  return <section className="entity-relations-manager" aria-label="Управление связями">
    <div className="record-block-heading"><h2>Связи <small>{items.length}</small></h2><button type="button" className="ghost" onClick={()=>begin()} disabled={revision===null}>+ Добавить связь</button></div>
    {!open&&error&&<div><p role="alert">{error}</p>{revision===null&&<button className="ghost" onClick={()=>{setError("");setLoadAttempt(n=>n+1);}}>Повторить загрузку связей</button>}</div>}
    {items.length>8&&<input type="search" className="input" aria-label="Поиск по имеющимся связям" placeholder="Найти среди связей" value={relatedQuery} onChange={e=>{setRelatedQuery(e.target.value);setVisibleCount(8);}}/>}
    {items.length?filtered.slice(0,visibleCount).map(item=>{const linked=onResolve?.(item);return <div className="relation-row" key={item.id}>
      <button type="button" className="record-context-link" onClick={()=>onOpen(item)}>{linked?.art?.url&&<img src={linked.art.url} alt="" loading="lazy"/>}<span><small>{kindTitle[item.kind]}</small><strong>{item.label}</strong>{item.reason&&<small>{item.reason}</small>}</span></button>
      <button className="ghost" type="button" aria-label={`Изменить связь: ${item.label}`} onClick={()=>begin(item)}>Изменить</button>
    </div>}):revision===null&&!error?<p role="status" className="copy">Загружаем связи…</p>:<p className="copy">Свяжите записи, чтобы быстро переходить между местами, героями и сюжетами.</p>}
    {items.length>0&&!filtered.length&&<p className="copy">Таких связей нет.</p>}
    {filtered.length>visibleCount&&<button type="button" className="ghost" onClick={()=>setVisibleCount(n=>n+8)}>Показать ещё · {filtered.length-visibleCount}</button>}
    {open&&<AppModal initialFocus={editing?"textarea":"input[type=search]"} label={editing?"Изменить связь":"Добавить связи"} onClose={()=>void close()}><div className="relation-picker">
      <header className="record-block-heading"><h2>{editing?"Связь с записью":"Добавить связи"}</h2><button className="ghost" type="button" aria-label="Закрыть связи" onClick={()=>void close()}>Закрыть</button></header>
      <p className="copy">{editing?items.find(i=>i.id===editing)?.label:`Для «${entity.title}». Связи появятся у обеих записей.`}</p>
      {!editing&&<><div className="relation-search"><label>Поиск<input autoFocus className="input" type="search" value={q} onChange={e=>{setQ(e.target.value);setPage("");setResults([]);}} placeholder="Название, описание или тег"/></label><label>Тип записи<select className="input" value={kind} onChange={e=>{setKind(e.target.value);setPage("");setResults([]);}}><option value="all">Все записи</option>{(["location","npc","quest","player","monster","lore"] as const).map(k=><option key={k} value={k}>{k==="lore"?"Заметки":kindTitle[k]}</option>)}</select></label></div>
      <div className="relation-search-results" aria-busy={loading}>{results.map(e=>{const linked=items.some(i=>i.id===e.id);return <label className={`relation-result ${selected[e.id]?"selected":""}`} key={e.id}><input type="checkbox" disabled={linked||saving} checked={linked||Boolean(selected[e.id])} onChange={()=>setSelected(old=>{const next={...old};if(next[e.id])delete next[e.id];else next[e.id]=e.title;return next;})}/>{e.art?.url&&<img src={e.art.url} alt="" loading="lazy"/>}<span><small>{kindTitle[e.kind]}{linked?" · Уже связано":""}</small><strong>{e.title}</strong><small>{e.summary.slice(0,140)}</small></span></label>;})}{loading&&<p role="status">Ищем записи…</p>}{!loading&&!results.length&&<p>Записей по этому запросу нет.</p>}{cursor&&<button type="button" className="ghost" disabled={loading} onClick={()=>setPage(cursor)}>Показать ещё</button>}</div></>}
      {!editing&&Object.keys(selected).length>0&&<div className="relation-selected" aria-label="Выбранные записи">{Object.entries(selected).map(([id,title])=><button className="ghost" type="button" key={id} aria-label={`Убрать из выбора: ${title}`} onClick={()=>setSelected(old=>{const next={...old};delete next[id];return next;})}>{title} ×</button>)}</div>}
      <label>Пояснение <span className="muted">· необязательно</span><textarea className="input" maxLength={2000} rows={2} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Например: живёт здесь или выдаёт квест"/></label>
      {(draft.candidate||dirty)&&<DeviceDraftControls draft={draft} label="связи"/>}
      {error&&<p className="form-error" role="alert">{error} Выбор и пояснение сохранены в окне. Проверьте текущие связи и повторите сохранение.</p>}
      <footer className="actions">{editing&&<button className="ghost danger" type="button" disabled={saving} onClick={()=>void save(editing,true)}>Убрать связь</button>}<button className="ghost" type="button" disabled={saving} onClick={()=>void close()}>Отмена</button><button className="primary" type="button" disabled={saving||revision===null||(!editing&&!Object.keys(selected).length)} onClick={()=>void save(editing??undefined)}>{saving?"Сохраняем…":editing?"Сохранить пояснение":`Связать · ${Object.keys(selected).length}`}</button></footer>
    </div></AppModal>}
  </section>;
}
