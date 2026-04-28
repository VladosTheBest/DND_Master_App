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
  pinnedCount,
  settingName,
  inWorldDate,
  items,
  onCampaignSelect,
  onCreateCampaign,
  onLogout
}: AppSidebarProps) {
  return (
    <aside className="panel rail">
      <div className="rail-shell">
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
            <button className="rail-plus-btn" onClick={onCreateCampaign} title="Новая кампания" type="button">
              +
            </button>
          </div>

          <div className="rail-select-shell">
            <select className="rail-select" onChange={(event) => onCampaignSelect(event.target.value)} value={activeCampaignId}>
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

        <section className="rail-group rail-group-nav">
          <p className="eyebrow">Навигация</p>
          <nav className="rail-nav" aria-label="Основная навигация">
            {items.map((item) => (
              <button
                key={item.key}
                className={`rail-nav-item ${activeRailKey === item.key ? "active" : ""}`}
                onClick={item.onClick}
                type="button"
              >
                <span className="rail-nav-icon">
                  <RailIcon name={item.icon} />
                </span>
                <span className="rail-nav-label">{item.label}</span>
              </button>
            ))}
          </nav>
        </section>

        <div className="meta rail-meta">
          <div className="rail-meta-row">
            <span>Мир</span>
            <strong>{settingName}</strong>
          </div>
          <div className="rail-meta-row">
            <span>Дата</span>
            <strong>{inWorldDate}</strong>
          </div>
          <div className="rail-meta-row">
            <span>Пины</span>
            <strong>{pinnedCount}</strong>
          </div>
          <button className="ghost rail-logout" disabled={authBusy} onClick={onLogout} type="button">
            {authBusy ? "Выходим..." : "Выйти"}
          </button>
        </div>
      </div>
    </aside>
  );
}
