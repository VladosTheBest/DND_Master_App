import type {CreateEntityInput} from "@shadow-edge/shared-types";
import {compareEntityFields,entityComparisonText,type ComparisonChoices,type ComparisonChoice,type ComparisonField} from "./entity-comparison";
type Props={base:CreateEntityInput|null;local:CreateEntityInput;server:CreateEntityInput;choices:ComparisonChoices;onChoose:(field:ComparisonField,choice:ComparisonChoice)=>void;onChooseAll:(choice:ComparisonChoice)=>void;onPrepare:()=>void;resolve:(id:string)=>string};
export function EntityConflictReview({base,local,server,choices,onChoose,onChooseAll,onPrepare,resolve}:Props){
 const rows=compareEntityFields(base,local,server),pending=rows.filter(row=>row.requiresChoice&&!choices[row.key]).length;
 return <section tabIndex={-1} className="card mini entity-conflict-review" aria-label="Сравнение версий">
 <h3>Запись изменилась в другом окне</h3><p>Ваши правки остались в редакторе. Ниже — изменившиеся поля. Остальные данные сохранятся с сервера.</p>
 {!base&&<p className="form-error">У этой старой копии нет исходного снимка. Для различающихся полей нужно явно выбрать вариант.</p>}
 {rows.length?<div className="entity-comparison-fields">{rows.map(row=>{
  const mine=entityComparisonText(row.local,row.key,resolve),remote=entityComparisonText(row.server,row.key,resolve),chosen=choices[row.key]??(row.localChanged?"local":"server");
  return <details key={row.key} className={`entity-comparison-field${row.requiresChoice?" needs-choice":""}`} open={row.requiresChoice||undefined}>
   <summary><strong>{row.label}</strong><small>{row.requiresChoice?(choices[row.key]?`Выбрано: ${chosen==="local"?"мой вариант":"серверный вариант"}`:"Нужно выбрать вариант"):row.localChanged?row.serverChanged?"Одинаковая правка в обоих окнах":"Моя правка":"Обновлено на сервере"}</small></summary>
   <div className="entity-comparison-values"><section tabIndex={0} aria-label={`Мой вариант: ${row.label}`}><h4>Мой вариант</h4><p>{mine}</p></section><section tabIndex={0} aria-label={`На сервере: ${row.label}`}><h4>На сервере</h4><p>{remote}</p></section></div>
   {mine===remote&&JSON.stringify(row.local)!==JSON.stringify(row.server)&&<p className="copy">Оформление или дополнительные данные отличаются. Полный вид доступен в технических данных ниже.</p>}
   {row.requiresChoice?<fieldset className="entity-comparison-choice"><legend>Что сохранить: {row.label}</legend><label><input type="radio" name={`compare-${row.key}`} checked={choices[row.key]==="local"} onChange={()=>onChoose(row.key,"local")}/>Мой вариант</label><label><input type="radio" name={`compare-${row.key}`} checked={choices[row.key]==="server"} onChange={()=>onChoose(row.key,"server")}/>Серверный вариант</label></fieldset>:<p className="copy">В объединении: {chosen==="local"?"мой вариант":"серверный вариант"}.</p>}
   {row.requiresChoice&&(Array.isArray(row.local)||Array.isArray(row.server)||typeof row.local==="object"&&row.local!==null)&&<p className="copy">Этот раздел сохраняется целиком. Выбор не объединяет элементы двух списков.</p>}
  </details>;
 })}</div>:<p>Значения полей совпадают. Обновилась только версия записи.</p>}
 {rows.some(row=>row.requiresChoice)&&<details className="entity-comparison-bulk"><summary>Выбрать сразу для всех спорных полей</summary><div className="actions"><button className="ghost" type="button" onClick={()=>onChooseAll("local")}>Мои варианты</button><button className="ghost" type="button" onClick={()=>onChooseAll("server")}>Серверные варианты</button></div></details>}
 <p role="status">{pending?`Выберите вариант ещё для ${pending} полей.`:"Все спорные поля разобраны. Можно подготовить изменения."}</p>
 <button className="primary" type="button" disabled={pending>0} onClick={onPrepare}>Подготовить изменения</button><p className="copy">Подготовка обновит только форму. Для записи на сервер затем нажмите «Сохранить изменения».</p>
 <details className="entity-comparison-technical"><summary>Технические данные (JSON)</summary><h4>Мой черновик</h4><pre>{JSON.stringify(local,null,2)}</pre><h4>На сервере</h4><pre>{JSON.stringify(server,null,2)}</pre></details>
 </section>;
}
