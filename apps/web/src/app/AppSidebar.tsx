import { useState } from "react";
import { MessageSquare } from "lucide-react";
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
  onLogout
}: AppSidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const groups = [
    { label: "За столом", keys: ["dashboard", "sessions", "players"] },
    { label: "Мир и история", keys: ["quests", "locations", "npcs", "events", "notes", "shops"] },
    { label: "Справочники", keys: ["monsters", "items", "rules"] }
  ];
  return (
    <aside className={`panel rail ${mobileOpen ? "rail-open" : ""}`}>
      <button className="ghost rail-mobile-toggle" type="button" aria-expanded={mobileOpen} aria-controls="campaign-navigation" onClick={() => setMobileOpen(!mobileOpen)}>Меню · {items.find(item => item.key === activeRailKey)?.label ?? "Кампания"} <span aria-hidden="true">⌄</span></button>
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
              {campaigns.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
            <span className="rail-select-chevron" aria-hidden="true">
              <svg className="rail-icon-svg" viewBox="0 0 20 20">
                <path d="m6 8 4 4 4-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
              </svg>
            </span>
          </div>
        </section>

        <nav className="rail-group-nav" aria-label="Разделы кампании">
          <a className="rail-nav-item" href={`/chat?campaign=${encodeURIComponent(activeCampaignId)}`} style={{textDecoration:"none"}}>
            <span className="rail-nav-icon"><MessageSquare size={19}/></span><span className="rail-nav-label">AI-чат</span>
          </a>
          {groups.map(group => <section className="rail-group" key={group.label}>
            <p className="eyebrow">{group.label}</p>
            <div className="rail-nav">{group.keys.map(key => items.find(item => item.key === key)).filter((item): item is AppSidebarItem => Boolean(item)).map(item => (
              <button key={item.key} className={`rail-nav-item ${activeRailKey === item.key ? "active" : ""}`} aria-current={activeRailKey === item.key ? "page" : undefined}
                onClick={() => { item.onClick(); setMobileOpen(false); }} type="button">
                <span className="rail-nav-icon"><RailIcon name={item.icon} /></span><span className="rail-nav-label">{item.label}</span>
              </button>
            ))}</div>
          </section>)}
        </nav>
        <div className="meta rail-meta">
          <small>{settingName} · {inWorldDate}</small>
          <AccountSettings />
          <button className="ghost rail-logout" disabled={authBusy} onClick={onLogout} type="button">
            {authBusy ? "Выходим..." : "Выйти"}
          </button>
        </div>
      </div>
    </aside>
  );
}
