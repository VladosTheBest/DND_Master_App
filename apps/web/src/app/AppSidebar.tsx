import { SubscriptionButton } from "./SubscriptionDialog";
import { FeedbackButton } from "./FeedbackDialog";
import { useEffect, useRef, useState } from "react";
import { Map, MessageSquare, MonitorPlay, Home, Settings, Users, X, Menu } from "lucide-react";
import { AccountSettings } from "./OAuthControls";
import type { CampaignSummary } from "@shadow-edge/shared-types";
import { RailIcon, type RailIconName } from "../rail-icon";

export type AppSidebarItem = {
  key: string;
  label: string;
  icon: RailIconName;
  onClick: () => void;
};

type AppSidebarProps = {
  authBusy: boolean;
  authUsername: string;
  activeCampaignId: string;
  activeRailKey: string;
  campaigns: CampaignSummary[];
  pinnedCount: number;
  settingName: string;
  inWorldDate: string;
  items: AppSidebarItem[];
  onCampaignSelect: (campaignId: string) => void;
  onCreateCampaign: () => void;
  onOpenReadyCampaigns: () => void;
  onLogout: () => void;
};

export function AppSidebar({
  authBusy,
  authUsername,
  activeCampaignId,
  activeRailKey,
  campaigns,
  settingName,
  inWorldDate,
  items,
  onCampaignSelect,
  onCreateCampaign,
  onOpenReadyCampaigns,
  onLogout
}: AppSidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const activeLabel = activeRailKey === "maps" ? "Карты и сцены" : activeRailKey === "chat" ? "AI-чат" : items.find(item => item.key === activeRailKey)?.label ?? "Кампания";
  const toggleRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!mobileOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setMobileOpen(false); toggleRef.current?.focus(); }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [mobileOpen]);
  const groups = [
    { label: "За столом", keys: ["dashboard", "sessions", "players"] },
    { label: "Мир и история", keys: ["quests", "locations", "npcs", "events", "notes", "shops"] },
    { label: "Справочники", keys: ["monsters", "items", "rules"] }
  ];
  return (
    <aside className={`panel rail ${mobileOpen ? "rail-open" : ""}`}>
      <nav className="workspace-switcher" aria-label="Быстрые переходы">
        <span className="workspace-logo" title="Shadow Edge GM"><RailIcon name="brand" /></span>
        <button type="button" title="Стол мастера" aria-label="Стол мастера" aria-current={activeRailKey === "dashboard" ? "page" : undefined} onClick={() => items.find(item => item.key === "dashboard")?.onClick()}><Home size={20}/></button>
        <a href={`/maps?campaign=${encodeURIComponent(activeCampaignId)}`} title="Карты и сцены" aria-label="Карты и сцены" aria-current={activeRailKey === "maps" ? "page" : undefined}><Map size={20}/></a>
        <button type="button" title="Игроки" aria-label="Игроки" onClick={() => items.find(item => item.key === "players")?.onClick()}><Users size={20}/></button>
        <a href={`/chat?campaign=${encodeURIComponent(activeCampaignId)}`} title="AI-чат" aria-label="AI-чат" aria-current={activeRailKey === "chat" ? "page" : undefined}><MessageSquare size={20}/></a>
        <button className="workspace-account" type="button" title="Настройки аккаунта" aria-label="Настройки аккаунта" onClick={() => window.dispatchEvent(new Event("shadow-edge:open-account-settings"))}><Settings size={20}/></button>
      </nav>
      <button ref={toggleRef} className="ghost rail-mobile-toggle" type="button" aria-expanded={mobileOpen} aria-controls="campaign-navigation" onClick={() => setMobileOpen(!mobileOpen)}><Menu size={18}/> {activeLabel} {mobileOpen ? <X size={18}/> : <span>Меню</span>}</button>
      <div className="rail-shell" id="campaign-navigation">
        <div className="rail-brand">
          <span className="rail-brand-mark">
            <RailIcon name="brand" />
          </span>
          <div className="rail-brand-copy">
            <strong>Shadow Edge GM</strong>
            <small>{authUsername}</small>
          </div>
        </div>

        <section className="rail-group">
          <div className="rail-group-head">
            <p className="eyebrow">Кампания</p>
            <button className="rail-plus-btn" onClick={onCreateCampaign} aria-label="Новая кампания" title="Новая кампания" type="button">
              +
            </button>
          </div>

          <div className="rail-select-shell">
            <select aria-label="Кампания" className="rail-select" onChange={(event) => onCampaignSelect(event.target.value)} value={activeCampaignId}>
              {campaigns.filter(item => !item.readyCampaign).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
              {campaigns.some(item => item.readyCampaign) ? <optgroup label="Готовые Кампании">{campaigns.filter(item => item.readyCampaign).map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</optgroup> : null}
            </select>
            <span className="rail-select-chevron" aria-hidden="true">
              <svg className="rail-icon-svg" viewBox="0 0 20 20">
                <path d="m6 8 4 4 4-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
              </svg>
            </span>
          </div>
          <button className="ghost ready-campaign-open" onClick={onOpenReadyCampaigns} type="button">Готовые Кампании</button>
        </section>

        <nav className="rail-group-nav" aria-label="Разделы кампании">
          <a aria-current={activeRailKey==="chat"?"page":undefined} className={`rail-nav-item ${activeRailKey==="chat"?"active":""}`} href={`/chat?campaign=${encodeURIComponent(activeCampaignId)}`} onClick={() => setMobileOpen(false)} style={{textDecoration:"none"}}>
            <span className="rail-nav-icon"><MessageSquare size={19}/></span><span className="rail-nav-label">AI-чат</span>
          </a>
          <a aria-current={activeRailKey==="maps"?"page":undefined} className={`rail-nav-item ${activeRailKey==="maps"?"active":""}`} href={`/maps?campaign=${encodeURIComponent(activeCampaignId)}`} onClick={() => setMobileOpen(false)} style={{textDecoration:"none"}}>
            <span className="rail-nav-icon"><Map size={19}/></span><span className="rail-nav-label">Карты и сцены</span>
          </a>
          {items.find(item => item.key === "offline") && <button className={`rail-nav-item ${activeRailKey === "offline" ? "active" : ""}`} aria-current={activeRailKey === "offline" ? "page" : undefined} type="button" onClick={() => { items.find(item => item.key === "offline")?.onClick(); setMobileOpen(false); }}><span className="rail-nav-icon"><MonitorPlay size={19}/></span><span className="rail-nav-label">Оффлайн <span className="beta-badge">Beta</span></span></button>}
          {groups.map(group => <section className="rail-group" key={group.label}>
            <p className="eyebrow">{group.label}</p>
            <div className="rail-nav">{group.keys.map(key => items.find(item => item.key === key)).filter((item): item is AppSidebarItem => Boolean(item)).map(item => (
              <button key={item.key} className={`rail-nav-item ${activeRailKey === item.key ? "active" : ""}`} aria-current={activeRailKey === item.key ? "page" : undefined}
                onClick={() => { item.onClick(); setMobileOpen(false); }} type="button">
                <span className="rail-nav-icon"><RailIcon name={item.icon} /></span><span className="rail-nav-label">{item.key === "notes" && campaigns.find(c => c.id === activeCampaignId)?.readyCampaign ? "Книга приключения" : item.label}</span>
              </button>
            ))}</div>
          </section>)}
        </nav>
        <div className="meta rail-meta">
          <small>{settingName} · {inWorldDate}</small>
          <AccountSettings />
          {activeCampaignId&&<details><summary>Экспорт кампании</summary><small>JSON: записи, сцены, сессии и листы. Картинки и аудио остаются ссылками. Автоматическое восстановление из файла пока недоступно.</small><a href={`${import.meta.env.VITE_API_BASE_URL||""}/api/campaigns/${encodeURIComponent(activeCampaignId)}/export`} download>Скачать JSON</a></details>}
          <details className="rail-account-more"><summary>Аккаунт и помощь</summary><SubscriptionButton/><FeedbackButton/>
          <button className="ghost rail-logout" disabled={authBusy} onClick={onLogout} type="button">
            {authBusy ? "Выходим..." : "Выйти"}
          </button>
          </details>
        </div>
      </div>
    </aside>
  );
}
