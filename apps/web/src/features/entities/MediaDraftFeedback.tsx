import {useLayoutEffect,useRef} from "react";
import {DeviceDraftControls} from "../../app/DeviceDraftControls";
import type {EntityMediaDraft} from "./useEntityMediaDraft";
import type {GalleryImage} from "@shadow-edge/shared-types";
export function MediaDraftFeedback({state,field,items}:{state:EntityMediaDraft;field:"gallery"|"playlist";items:GalleryImage[]}) {
 const notice=useRef<HTMLElement|null>(null);
 useLayoutEffect(()=>{if((state.error||state.conflict)&&notice.current){notice.current.scrollIntoView({block:"start"});notice.current.focus({preventScroll:true});}},[state.error,state.conflict]);
 const current=(state.conflict?.[field]??[]) as GalleryImage[];
 return <><fieldset disabled={state.busy} className="media-editor-fields"><DeviceDraftControls draft={state.draft} label={field==="gallery"?"галерею":"плейлист"}/></fieldset>
 {state.error&&!state.conflict&&<p ref={node=>{notice.current=node;}} tabIndex={-1} className="form-error" role="alert">{state.error}</p>}
 {state.conflict&&<section ref={node=>{notice.current=node;}} tabIndex={-1} className="card mini media-conflict" aria-label="Конфликт медиа" role="alert"><h3>Запись изменилась на сервере</h3><p>Ваши правки остались в окне. Сравните списки. Продолжение со своими правками заменит только {field==="gallery"?"галерею":"плейлист"} после отдельного нажатия «Сохранить».</p>
 <div className="media-comparison"><section tabIndex={0} aria-label="Мой список"><h4>Мой список · {items.length}</h4>{items.length?<ul>{items.map((item,i)=><li key={i}><strong>{item.title||`Запись ${i+1}`}</strong><small>{item.url}</small>{item.caption&&<small>{item.caption}</small>}</li>)}</ul>:<p>Пустой список</p>}</section><section tabIndex={0} aria-label="Список на сервере"><h4>На сервере · {current.length}</h4>{current.length?<ul>{current.map((item,i)=><li key={i}><strong>{item.title||`Запись ${i+1}`}</strong><small>{item.url}</small>{"caption" in item&&item.caption&&<small>{item.caption}</small>}</li>)}</ul>:<p>Пустой список</p>}</section></div>
 <p className="copy">Объединение сохранит все ссылки. Для одинаковых ссылок останутся ваши названия и подписи.</p><div className="actions"><button className="primary" type="button" onClick={()=>state.review("merge")}>Объединить списки</button><button className="ghost" type="button" onClick={()=>state.review("local")}>Продолжить с моими правками</button><button className="ghost" type="button" onClick={()=>state.review("server")}>Взять серверный список</button></div><p className="copy">Эти кнопки не отправляют изменения на сервер. Локальные копии остаются на устройстве.</p></section>}</>;
}
