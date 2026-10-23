import { MonitorPlay, Swords, ListOrdered, Map } from "lucide-react";
import "./offline.css";

export function OfflineBetaNotice() {
  return <aside className="offline-beta-notice" role="note"><strong>Оффлайн <span className="beta-badge">Beta</span></strong><span>Инструменты для очной игры ещё в разработке: возможны ошибки. Для работы требуется интернет.</span></aside>;
}

export function OfflinePage({ campaignId, hasActiveCombat, onCombat, onMap, onTracker }: { campaignId: string; hasActiveCombat: boolean; onCombat: () => void; onMap: () => void; onTracker: () => void }) {
  return <div className="offline-page"><header><p className="eyebrow">Игра за одним столом</p><h1>Оффлайн <span className="beta-badge">Beta</span></h1><p className="copy">Бой, инициатива и карта на телевизоре — инструменты для мастера и игроков за одним столом.</p></header><OfflineBetaNotice/><div className="offline-tools">
    <article className="card"><Swords aria-hidden="true"/><h2>Бой</h2><p>Подготовка встречи, участники, хиты, условия, награды и музыка боя.</p><button className="primary" type="button" onClick={onCombat}>{hasActiveCombat ? "Продолжить бой" : "Подготовить бой"}</button></article>
    <article className="card"><MonitorPlay aria-hidden="true"/><h2>Карта на ТВ</h2><p>Карта с туманом войны, стенами и освещением на отдельном экране игроков.</p><button className="primary" type="button" onClick={onMap}>Открыть ТВ-карту</button></article>
    <article className="card"><ListOrdered aria-hidden="true"/><h2>Инициатива</h2><p>Очередь ходов текущего боя на отдельном экране.</p><button className="ghost" type="button" disabled={!hasActiveCombat} onClick={onTracker}>Открыть трекер</button>{!hasActiveCombat && <small>Сначала начните бой.</small>}</article>
    <article className="card"><Map aria-hidden="true"/><h2>Сцены</h2><p>Библиотека тактических сцен и разметка карты для Foundry.</p><a className="ghost" href={`/maps?campaign=${encodeURIComponent(campaignId)}&view=scenes`}>Открыть сцены</a></article>
  </div></div>;
}
