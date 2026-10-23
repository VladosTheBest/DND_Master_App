import {useEffect,useState} from "react";
import {requestJson} from "@shadow-edge/api-client";
import {CodexConnectionPanel} from "../ai-proposals/CodexConnectionPanel";
import styles from "./personal-ai.module.css";
type Connection={mode:"codex"|"personal"|"server";provider?:string;baseUrl?:string;model?:string};
type Provider={id:string;name:string;baseUrl:string;keyUrl:string;help:string};
type Feature="text"|"images"|"sessionAnalysis";
type Settings={capabilities:Record<Feature,{available:boolean;reason:string}>;connection:Connection;revision:number;hasKey:boolean;providers:Provider[];keyStorageAvailable:boolean};
const endpoint=`${import.meta.env.VITE_API_BASE_URL||""}/api/account/ai`;
export function PersonalAISettings(){
 const [settings,setSettings]=useState<Settings|null>(null),[choice,setChoice]=useState("codex"),[key,setKey]=useState(""),[model,setModel]=useState(""),[baseUrl,setBaseUrl]=useState(""),[models,setModels]=useState<string[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 async function load(signal?:AbortSignal){const data=await requestJson<Settings>(endpoint,{signal});setSettings(data);setChoice(data.connection.mode==="personal"?data.connection.provider||"codex":"codex");setModel(data.connection.model||"");setBaseUrl(data.connection.baseUrl||"");setModels(data.connection.model?[data.connection.model]:[]);}
 useEffect(()=>{const abort=new AbortController();void load(abort.signal).catch(reason=>{if(!abort.signal.aborted)setError(reason instanceof Error?reason.message:"Не удалось открыть подключения.");});return()=>abort.abort();},[]);
 const provider=settings?.providers.find(item=>item.id===choice),personal=choice!=="codex";
 const payload=()=>({mode:personal?"personal":"codex",provider:choice,key,model,baseUrl,expectedRevision:settings?.revision});
 async function run(action:"check"|"save"|"disconnect"){
  setBusy(true);setError("");setNotice("");try{
   if(action==="check"){const result=await requestJson<{models:string[];message:string}>(endpoint+"/check",{method:"POST",body:JSON.stringify(payload())});const textModels=result.models.filter(id=>!/(embedding|embed-|whisper|tts|dall-e|image|imagine|audio|moderation|realtime|video)/i.test(id));setModels(textModels.length?textModels:result.models);setNotice(result.message);}
   else {await requestJson(endpoint,{method:action==="disconnect"?"DELETE":"POST",body:JSON.stringify(payload())});setKey("");await load();window.dispatchEvent(new Event("shadow-edge:ai-settings"));setNotice(action==="disconnect"?"Личный ключ удалён. Можно подключить Codex.":"Готово. Следующие текстовые запросы используют выбранное подключение.");}
  }catch(reason){setError(reason instanceof Error?reason.message:"Не удалось подключить сервис.");}finally{setBusy(false);}
 }
 function change(value:string){setChoice(value);setKey("");setModel("");setBaseUrl("");setModels([]);setError("");setNotice("");}
 return <section className={styles.panel} aria-label="Мой AI"><div className={styles.heading}><h3>Мой AI</h3>{settings&&<small>Сейчас: {settings.connection.mode==="personal"?settings.providers.find(p=>p.id===settings.connection.provider)?.name||"Свой сервис":settings.connection.mode==="server"?"AI сайта":"Codex · ChatGPT"}</small>}</div>
 {!settings&&!error&&<p role="status">Загружаю подключения…</p>}
 {settings&&<><label className={styles.field}>Кого использовать<select disabled={busy} value={choice} onChange={e=>change(e.target.value)}><option value="codex">Codex · мой ChatGPT</option>{settings.providers.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
 {personal?<div className={styles.form}>
 <p>Тексты, чат и черновики — через ваш аккаунт. Запросы оплачиваются у выбранного сервиса; подписка Shadow Edge не нужна.</p>
 <small>Текст запроса и выбранные материалы кампании будут отправлены этому сервису.</small>
 <details><summary>Где взять ключ?</summary><p>{provider?.help}</p>{provider?.keyUrl&&<a href={provider.keyUrl} target="_blank" rel="noreferrer">Открыть кабинет {provider.name} ↗</a>}<p>Ключ — секретная строка для подключения приложения. Пароль от аккаунта сюда вводить не нужно.</p></details>
 {choice==="custom"&&<label className={styles.field}>Адрес API<input type="url" placeholder="https://api.example.com/v1" value={baseUrl} onChange={e=>setBaseUrl(e.target.value)} autoComplete="off"/></label>}
 <label className={styles.field}>Ключ API<input type="password" autoComplete="off" spellCheck={false} value={key} placeholder={settings.hasKey&&settings.connection.provider===choice?"Ключ уже сохранён · можно оставить пустым":"Вставьте ключ из кабинета сервиса"} onChange={e=>setKey(e.target.value)}/></label>
 <div className={styles.actions}><button type="button" disabled={busy||!settings.keyStorageAvailable} onClick={()=>void run("check")}>{busy?"Проверяю…":"1. Проверить подключение"}</button></div>
 {models.length>0&&<label className={styles.field}>Текстовая модель<select value={model} onChange={e=>setModel(e.target.value)} disabled={busy}><option value="">Выберите из доступных</option>{models.map(id=><option key={id} value={id}>{id}</option>)}</select></label>}
 <div className={styles.actions}><button className="primary" type="button" disabled={busy||!model||!settings.keyStorageAvailable} onClick={()=>void run("save")}>2. Использовать этот AI</button>{settings.hasKey&&<button type="button" disabled={busy} onClick={()=>void run("disconnect")}>Удалить сохранённый ключ</button>}</div>
 <small>Проверка запрашивает только список моделей. Генерацию она не запускает. Ключ не сохраняется в браузере и не показывается повторно.</small>
 <small>Изображения и длинный анализ сессий пока требуют Codex. Автоматического переключения на другой платный сервис нет.</small>
 {!settings.keyStorageAvailable&&<p role="status">Сохранение личных ключей временно недоступно. Пока можно использовать Codex.</p>}
 </div>:<><p>Подключите ChatGPT без API-ключа. Используются доступные лимиты вашего аккаунта.</p>{settings.connection.mode!=="codex"&&<button className="primary" disabled={busy} onClick={()=>void run("save")}>Использовать Codex</button>}<CodexConnectionPanel connectionOnly/></>}
 </>}
 {error&&<p role="alert">{error} {!settings&&<button onClick={()=>void load().catch(reason=>setError(reason.message))}>Повторить</button>}</p>}{notice&&<p role="status">{notice}</p>}
 </section>;
}
export function AIConnectionSummary({feature="text",onAvailable}:{feature?:Feature;onAvailable?:(ready:boolean)=>void}){
 const [settings,setSettings]=useState<Settings|null>(null),[error,setError]=useState(false),[attempt,setAttempt]=useState(0);
 useEffect(()=>{let live=true;const update=()=>{void requestJson<Settings>(endpoint).then(data=>{if(live){setError(false);setSettings(data);onAvailable?.(data.capabilities[feature].available);}}).catch(()=>{if(live){setError(true);onAvailable?.(false);}});};update();window.addEventListener("shadow-edge:ai-settings",update);return()=>{live=false;window.removeEventListener("shadow-edge:ai-settings",update);};},[feature,onAvailable,attempt]);
 if(error)return <div className={styles.summary} role="status">Не удалось проверить доступность AI. <button type="button" onClick={()=>setAttempt(value=>value+1)}>Повторить</button></div>;
 if(!settings)return <div className={styles.summary} role="status">Проверяю подключение AI…</div>;const personal=settings.connection.mode==="personal";
 return <div className={styles.summary}>AI: <strong>{personal?settings.providers.find(p=>p.id===settings.connection.provider)?.name:settings.connection.mode==="server"?"AI сайта":"Codex · ChatGPT"}</strong>{personal&&<> · {settings.connection.model} · оплата в вашем сервисе</>}<span> · {settings.capabilities[feature].reason}</span>{!settings.capabilities[feature].available&&<button type="button" onClick={()=>window.dispatchEvent(new Event("shadow-edge:open-account-settings"))}>Подключить AI</button>}</div>;
}
