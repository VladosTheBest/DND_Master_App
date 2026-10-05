import { useEffect, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, RefreshCw, Search, ShieldCheck, LogOut } from "lucide-react";
import googleIcon from "../assets/oauth/google-g.png";
import "./admin-subscriptions.css";
import { AdminFeedback } from "./AdminFeedback";

type Subscription = { planId: string; status: string; currentPeriodStart: string; currentPeriodEnd: string };
type User = { id: string; username: string; labels: string[]; subscription: Subscription | null; active: boolean };
type Audit = { id: string; accountId: string; actorId: string; action: string; reason: string; at: string; next: Subscription | null };
type Data = { users: User[]; total: number; plans: { id: string; name: string; monthlyCents: number }[]; audits: Audit[] };
class AccessError extends Error {}
async function request<T>(url: string, body?: unknown): Promise<T> {
  const r = await fetch(url, { credentials: "include", method: body === undefined ? "GET" : "POST", headers: body === undefined ? {} : { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  if (r.status === 401 || r.status === 403) throw new AccessError("Войди через Google владельца кабинета.");
  const value = await r.json();
  if (!r.ok) throw new Error(value.error?.message || "Не удалось выполнить запрос.");
  return value.data as T;
}
const date = (value: string) => new Date(value).toLocaleString("ru-RU");

export function AdminSubscriptions() {
  const [tab, setTab] = useState<"subscriptions" | "feedback">("subscriptions");
  const [data, setData] = useState<Data | null>(null);
  const [denied, setDenied] = useState(false);
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<User | null>(null);
  const [planId, setPlan] = useState("starter");
  const [days, setDays] = useState(30);
  const [reason, setReason] = useState("");
  async function load(q = query, start = offset) {
    setBusy(true); setError("");
    try { setData(await request<Data>(`/api/admin/subscriptions?q=${encodeURIComponent(q)}&offset=${start}`)); setDenied(false); }
    catch (e) { if (e instanceof AccessError) { setDenied(true); setData(null); setSelected(null); } setError((e as Error).message); }
    finally { setBusy(false); }
  }
  useEffect(() => { void load("", 0); }, []);
  async function login() {
    setBusy(true); setError("");
    try { const result = await request<{url: string}>("/api/auth/oauth/google/start?admin=1", {}); window.location.assign(result.url); }
    catch (e) { setError((e as Error).message); setBusy(false); }
  }
  async function save(action: "grant" | "revoke") {
    if (!selected) return;
    const message = action === "grant" ? `Назначить ${planId.toUpperCase()} на ${days} дней с сегодняшнего дня пользователю ${selected.username}? Текущий срок будет заменён.` : `Отозвать подписку пользователя ${selected.username}?`;
    if (!window.confirm(message)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await request("/api/admin/subscriptions", {accountId: selected.id, action, planId, days, reason, expected: selected.subscription});
      setSelected(null); setReason(""); setNotice(action === "grant" ? "Подписка выдана." : "Подписка отозвана."); await load();
    } catch (e) { setError((e as Error).message); if (e instanceof AccessError) { setDenied(true); setData(null); setSelected(null); } }
    finally { setBusy(false); }
  }
  return <main className="admin-subscriptions">
    <header><a href="/" aria-label="Вернуться в приложение" title="Вернуться в приложение"><ArrowLeft size={20}/></a><div><span>Shadow Edge GM</span><h1>Кабинет владельца</h1></div><ShieldCheck size={26}/>{data && <button title="Выйти" aria-label="Выйти" onClick={async () => { try { await request("/api/auth/logout", {}); window.location.assign("/admin"); } catch { setError("Не удалось выйти."); } }}><LogOut size={20}/></button>}</header>
    {error && <p role="alert" className="admin-error">{error}</p>}
    {notice && <p role="status" className="admin-notice">{notice}</p>}
    {denied ? <section className="admin-login"><ShieldCheck size={40}/><h2>Вход владельца</h2><button onClick={() => void login()} disabled={busy}><img src={googleIcon} alt=""/>Войти через Google</button>{new URLSearchParams(location.search).get("oauth") === "forbidden" && <p role="alert">Эта учётная запись не имеет доступа.</p>}</section> : !data ? <p role="status">{busy ? "Загрузка…" : "Нет данных."}</p> : <>
      <nav className="admin-tabs" aria-label="Разделы кабинета"><button type="button" aria-pressed={tab === "subscriptions"} onClick={() => setTab("subscriptions")}>Подписки</button><button type="button" aria-pressed={tab === "feedback"} onClick={() => setTab("feedback")}>Отзывы</button></nav>
      {tab === "feedback" ? <AdminFeedback onDenied={() => { setDenied(true); setData(null); setSelected(null); }} /> : <>
      <form className="admin-search" onSubmit={e => {e.preventDefault(); setOffset(0); void load(query, 0);}}><Search size={18}/><input aria-label="Поиск пользователей" placeholder="Имя, ник или ID пользователя" value={query} onChange={e=>setQuery(e.target.value)}/><button disabled={busy} type="submit">Найти</button><button type="button" disabled={busy} title="Обновить" aria-label="Обновить" onClick={()=>void load()}><RefreshCw size={18}/></button></form>
      <div className="admin-workspace"><section><h2>Пользователи <small>{data.total}</small></h2><div className="admin-table"><table><thead><tr><th>Пользователь</th><th>Подписка</th><th>До</th><th/></tr></thead><tbody>{data.users.map(u=><tr key={u.id}><td><strong>{u.username}</strong><small>{u.labels.join(" · ")}</small><small>{u.id}</small></td><td>{u.subscription?.planId.toUpperCase() || "Нет"}<small>{u.active ? "Активна" : u.subscription ? "Неактивна" : ""}</small></td><td>{u.subscription ? date(u.subscription.currentPeriodEnd) : "—"}</td><td><button disabled={busy} onClick={()=>{setSelected(u);setPlan(u.subscription?.planId || "starter");setReason("");setNotice("");}}>Изменить</button></td></tr>)}</tbody></table></div>{!data.users.length && <p>Пользователи не найдены.</p>}<nav className="admin-pagination"><button title="Назад" aria-label="Предыдущие пользователи" disabled={busy || offset===0} onClick={()=>{setOffset(offset-50);void load(query,offset-50);}}><ChevronLeft size={18}/></button><span>{data.total ? offset+1 : 0}–{Math.min(offset+50,data.total)} / {data.total}</span><button title="Далее" aria-label="Следующие пользователи" disabled={busy || offset+50>=data.total} onClick={()=>{setOffset(offset+50);void load(query,offset+50);}}><ChevronRight size={18}/></button></nav></section>
      {selected && <aside><h2>Изменение подписки</h2><strong>{selected.username}</strong><form onSubmit={e=>{e.preventDefault();void save("grant");}}><label>Тариф<select value={planId} onChange={e=>setPlan(e.target.value)}>{data.plans.map(p=><option key={p.id} value={p.id}>{p.name} · ${p.monthlyCents/100}/мес.</option>)}</select></label><label>Дней с сегодняшнего дня<input type="number" min={1} max={366} required value={days} onChange={e=>setDays(Number(e.target.value))}/></label><label>Причина<textarea required maxLength={500} value={reason} onChange={e=>setReason(e.target.value)}/></label><button disabled={busy || !reason.trim()} type="submit">Выдать / заменить</button><button type="button" disabled={busy || !reason.trim() || !selected.subscription} onClick={()=>void save("revoke")}>Отозвать подписку</button><button type="button" disabled={busy} onClick={()=>setSelected(null)}>Отмена</button></form></aside>}</div>
      <section className="admin-audits"><h2>Последние изменения</h2>{!data.audits.length ? <p>Изменений пока нет.</p> : <ul>{data.audits.map(a=><li key={a.id}><time>{date(a.at)}</time><strong>{a.action === "grant" ? `Выдана ${a.next?.planId.toUpperCase()}` : "Отозвана"}</strong><span>{a.accountId}</span><p>{a.reason}</p></li>)}</ul>}</section>
      </>}
    </>}
  </main>;
}
