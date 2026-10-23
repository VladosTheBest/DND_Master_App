export function DeviceDraftControls({draft,label="черновик"}:{label?:string;draft:{candidates?:{key:string;savedAt:string;baseRevision:number}[];selectCandidate?:(key:string)=>void;status:string;candidate:{savedAt:string;baseRevision:number;memoryOnly?:boolean}|null;recover:()=>void;discard:()=>void;download:()=>void}}) {
  return <div className="card mini device-draft-controls" style={{overflowWrap:"anywhere"}} role="status">
    <p>{draft.status || "Изменений пока нет"}</p>
    {(draft.candidates?.length??0)>1&&<label>Копия черновика <select style={{maxWidth:"100%",minWidth:0}} onChange={e=>draft.selectCandidate?.(e.target.value)}>{draft.candidates?.map((item,index)=><option key={item.key} value={item.key}>{index+1} · {new Date(item.savedAt).toLocaleString()} · версия {item.baseRevision}</option>)}</select></label>}
    {draft.candidate && <>
      {draft.candidate.memoryOnly&&<p role="alert">Эта копия находится только в памяти текущей вкладки. Скачайте её перед закрытием браузера.</p>}
      <p>Найдена копия от {new Date(draft.candidate.savedAt).toLocaleString()}. Исходная версия: {draft.candidate.baseRevision}. Восстановление не отправляет данные на сервер.</p>
      <button className="ghost" style={{maxWidth:"100%",whiteSpace:"normal"}} type="button" onClick={draft.recover}>Восстановить {label}</button>
      <button className="ghost" style={{maxWidth:"100%",whiteSpace:"normal"}} type="button" onClick={draft.discard}>Удалить {label} с устройства</button>
    </>}
    <button className="ghost" style={{maxWidth:"100%",whiteSpace:"normal"}} type="button" onClick={draft.download}>Скачать {label}</button>
  </div>;
}
