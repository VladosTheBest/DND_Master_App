import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, CreditCard, Database, Mic, Sparkles, X } from "lucide-react";
import "./subscriptions.css";

type Plan = { id: string; name: string; monthlyCents: number; generations: number; storageGB: number; recordingHours: number; discordServers: number };
type StorageUsage = { available: boolean; totalBytes: number; mediaBytes: number; stagingBytes: number; databaseBytes: number; objectCount: number; limitBytes: number | null };
type SubscriptionInfo = { plans: Plan[]; active: boolean; subscription: { planId: string; currentPeriodEnd: string } | null; checkoutAvailable: boolean; storageUsage: StorageUsage | null };

function storageSize(bytes: number) {
  const unit = bytes >= 1e9 ? [1e9, "ГБ"] as const : bytes >= 1e6 ? [1e6, "МБ"] as const : bytes >= 1e3 ? [1e3, "КБ"] as const : [1, "Б"] as const;
  return `${(bytes / unit[0]).toLocaleString("ru-RU", { maximumFractionDigits: 2 })} ${unit[1]}`;
}

export function SubscriptionButton() {
  return <button type="button" className="subscription-trigger" onClick={() => window.dispatchEvent(new Event("shadow-edge:show-subscriptions"))}>
    <Sparkles size={16} aria-hidden="true" /> Подписка
  </button>;
}

export function SubscriptionDialog() {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [required, setRequired] = useState(false);
  const [info, setInfo] = useState<SubscriptionInfo | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const show = () => { setRequired(false); setOpen(true); };
    const requirePlan = () => { setRequired(true); setOpen(true); };
    window.addEventListener("shadow-edge:show-subscriptions", show);
    window.addEventListener("shadow-edge:subscription-required", requirePlan);
    return () => {
      window.removeEventListener("shadow-edge:show-subscriptions", show);
      window.removeEventListener("shadow-edge:subscription-required", requirePlan);
    };
  }, []);
  useEffect(() => {
    if (!open) { ref.current?.close(); return; }
    ref.current?.showModal();
    const controller = new AbortController();
    setInfo(null); setError("");
    fetch(`${import.meta.env.VITE_API_BASE_URL || ""}/api/auth/subscription`, { credentials: "include", signal: controller.signal })
      .then(async response => { if (!response.ok) throw new Error(); return response.json(); })
      .then(result => { if (!controller.signal.aborted) setInfo(result.data); })
      .catch(() => { if (!controller.signal.aborted) setError("Не удалось загрузить тарифы."); });
    return () => controller.abort();
  }, [open, attempt]);
  return createPortal(<dialog ref={ref} className="subscription-dialog" aria-labelledby="subscription-title" onCancel={() => setOpen(false)} onClose={() => setOpen(false)} onClick={event => { if (event.target === event.currentTarget) { const r = event.currentTarget.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) setOpen(false); } }}>
    <header className="subscription-heading">
      <div><p className="subscription-kicker">SHADOW EDGE GM</p><h2 id="subscription-title">Больше возможностей для вашей истории</h2></div>
      <button autoFocus type="button" className="subscription-close" title="Закрыть" aria-label="Закрыть тарифы" onClick={() => setOpen(false)}><X size={22} /></button>
    </header>
    <p className="subscription-intro">Генерации доступны только с активной подпиской. Кампании, ручное редактирование и просмотр сохранённых материалов остаются доступны без неё.</p>
    {required && <p className="subscription-notice" role="status"><Sparkles size={18} /> Для этой генерации нужна активная подписка Shadow Edge GM.</p>}
    {info?.active && <p className="subscription-notice" role="status"><Check size={18} /> Подписка активна до {new Date(info.subscription!.currentPeriodEnd).toLocaleDateString("ru-RU")}.</p>}
    {!info && !error && <p role="status">Загружаем тарифы…</p>}
    {error && <p role="alert">{error} <button type="button" className="ghost" onClick={() => setAttempt(value => value + 1)}>Повторить</button></p>}
    {info && <>
      {info.storageUsage && <section className="subscription-storage" aria-label="Занятое место">
        <div className="subscription-storage-heading"><h3><Database size={18} /> Ваше хранилище</h3><strong>{info.storageUsage.available ? storageSize(info.storageUsage.totalBytes) : "Учёт недоступен"}{info.storageUsage.available && info.storageUsage.limitBytes != null && ` из ${storageSize(info.storageUsage.limitBytes)}`}</strong></div>
        {info.storageUsage.available && <>
          {info.storageUsage.limitBytes != null && <progress aria-label="Использовано места" max={info.storageUsage.limitBytes} value={Math.min(info.storageUsage.totalBytes, info.storageUsage.limitBytes)} />}
          <dl><div><dt>Медиа и тайлы</dt><dd>{storageSize(info.storageUsage.mediaBytes)}</dd></div><div><dt>AI-черновики</dt><dd>{storageSize(info.storageUsage.stagingBytes)}</dd></div><div><dt>Данные кампаний и аккаунта</dt><dd>{storageSize(info.storageUsage.databaseBytes)}</dd></div></dl>
          <p>{info.storageUsage.objectCount.toLocaleString("ru-RU")} файлов · Объём данных без служебных копий. Ограничение места пока не включено.</p>
        </>}
      </section>}
      <div className="subscription-plans">
        {info.plans.map((plan, index) => <article key={plan.id} className={`subscription-plan subscription-plan-${index}`}>
          <div className="subscription-plan-label"><h3>{plan.name}</h3>{info.active && info.subscription?.planId === plan.id ? <span>Ваш тариф</span> : index === 1 ? <span>Для регулярных игр</span> : null}</div>
          <p className="subscription-price">${plan.monthlyCents / 100}<span>/ месяц</span></p>
          <ul>
            <li><Sparkles size={18} /><span><strong>{plan.generations}</strong> текстовых генераций</span></li>
            <li><Database size={18} /><span><strong>{plan.storageGB} ГБ</strong> для материалов</span></li>
            <li><Mic size={18} /><span><strong>{plan.recordingHours} ч</strong> записи и расшифровки<small>Облачный Discord-бот · скоро</small></span></li>
            <li><Check size={18} /><span>Discord-серверов: <strong>{plan.discordServers}</strong><small>После запуска бота</small></span></li>
          </ul>
          <p className="subscription-coming"><CreditCard size={16} /> Подключение скоро</p>
        </article>)}
      </div>
      <footer className="subscription-footer"><strong>Готовим запуск оплаты</strong><p>Сейчас оформить подписку нельзя. Показаны планируемые месячные пакеты; числовые квоты ещё не включены. Изображения и длинный AI-анализ будут учитываться отдельно. Облачная запись и расшифровка пока недоступны.</p><p>Личная подписка ChatGPT не заменяет подписку Shadow Edge GM.</p></footer>
    </>}
  </dialog>, document.body);
}
