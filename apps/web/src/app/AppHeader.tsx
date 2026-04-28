import type { KnowledgeEntity } from "@shadow-edge/shared-types";

type DefaultHeaderProps = {
  variant: "default";
  campaignTitle: string;
  inWorldDate: string;
  authBusy: boolean;
  hasActiveCombat: boolean;
  isCombatScreen: boolean;
  activeModule: string;
  isItemsRail: boolean;
  canOpenDirectory: boolean;
  pinnedEntities: KnowledgeEntity[];
  onOpenSearch: () => void;
  onOpenCombat: () => void;
  onOpenDirectory: () => void;
  onOpenPinnedEntity: (entityId: string) => void;
  onOpenRandomEvent: () => void;
  onLogout: () => void;
  onCreateEntity: () => void;
};

type CombatHeaderProps = {
  variant: "combat";
  campaignTitle: string;
  inWorldDate: string;
  authBusy: boolean;
  hasActiveCombat: boolean;
  activeCombatCount: number;
  combatTitle: string;
  isCombatPlaylistActive: boolean;
  initiativeShareBusy: boolean;
  saving: boolean;
  onReturnToApp: () => void;
  onPlayCombatPlaylist: () => void;
  onOpenCombatPlaylistModal: () => void;
  onOpenInitiativeTracker: () => void;
  onOpenPublicInitiativeTracker: () => void;
  onCopyPublicInitiativeTracker: () => void;
  onSyncCombatPortraits: () => void;
  onOpenCombatSetupModal: () => void;
  onLogout: () => void;
  onFinishCombat: () => void;
};

type AppHeaderProps = DefaultHeaderProps | CombatHeaderProps;

export function AppHeader(props: AppHeaderProps) {
  if (props.variant === "combat") {
    return (
      <header className="panel topbar combat-topbar">
        <div className="actions combat-topbar-left">
          <button className="ghost" onClick={props.onReturnToApp} type="button">
            Вернуться в приложение
          </button>
          <div className="topbar-campaign">
            <p className="eyebrow">Campaign</p>
            <strong>{props.campaignTitle}</strong>
            <small>{props.inWorldDate}</small>
          </div>
        </div>

        <div className="combat-screen-title">
          <p className="eyebrow">Combat Screen</p>
          <strong>{props.combatTitle}</strong>
          <small>{props.hasActiveCombat ? `${props.activeCombatCount} участников в сцене` : "Подготовка новой сцены боя"}</small>
        </div>

        <div className="chips">
          {props.hasActiveCombat ? <span className="chip active-combat-indicator">Активный бой • {props.activeCombatCount}</span> : null}
          <button className="ghost" onClick={props.onPlayCombatPlaylist} type="button">
            {props.isCombatPlaylistActive ? "Следующий трек боя" : "Случайный трек боя"}
          </button>
          <button className="ghost" onClick={props.onOpenCombatPlaylistModal} type="button">
            Плейлист боя
          </button>
          <button className="ghost" disabled={!props.hasActiveCombat} onClick={props.onOpenInitiativeTracker} type="button">
            Трекер
          </button>
          <button className="ghost" disabled={props.initiativeShareBusy} onClick={props.onOpenPublicInitiativeTracker} type="button">
            {props.initiativeShareBusy ? "Готовлю..." : "Публичный трекер"}
          </button>
          <button className="ghost" disabled={props.initiativeShareBusy} onClick={props.onCopyPublicInitiativeTracker} type="button">
            {props.initiativeShareBusy ? "Готовлю..." : "Копировать публичную ссылку"}
          </button>
          <button className="ghost" disabled={props.saving} onClick={props.onSyncCombatPortraits} type="button">
            Подтянуть фотки
          </button>
          <button className="ghost" onClick={props.onOpenCombatSetupModal} type="button">
            Добавить врага
          </button>
          <button className="ghost" disabled={props.authBusy} onClick={props.onLogout} type="button">
            {props.authBusy ? "Выходим..." : "Выйти"}
          </button>
          <button className="primary" disabled={!props.hasActiveCombat || props.saving} onClick={props.onFinishCombat} type="button">
            Завершить бой
          </button>
        </div>
      </header>
    );
  }

  return (
    <header className="panel topbar">
      <div className="topbar-campaign">
        <p className="eyebrow">Campaign</p>
        <strong>{props.campaignTitle}</strong>
        <small>{props.inWorldDate}</small>
      </div>

      <button className="search-btn" onClick={props.onOpenSearch} type="button">
        <span>Ctrl + K</span>
        <strong>Поиск сущностей, сцен и слухов</strong>
      </button>

      <div className="chips">
        <button className={`ghost ${props.isCombatScreen ? "active" : ""}`} onClick={props.onOpenCombat} type="button">
          Бой
        </button>
        {props.canOpenDirectory ? (
          <button className="ghost" onClick={props.onOpenDirectory} type="button">
            К списку
          </button>
        ) : null}
        {props.hasActiveCombat ? (
          <button className="chip active-combat-indicator" onClick={props.onOpenCombat} type="button">
            Активный бой
          </button>
        ) : null}
        {props.pinnedEntities.map((entity) => (
          <button key={entity.id} className="chip" onClick={() => props.onOpenPinnedEntity(entity.id)} type="button">
            {entity.title}
          </button>
        ))}
        {props.activeModule === "quests" && !props.isCombatScreen ? (
          <button className="ghost" onClick={props.onOpenRandomEvent} type="button">
            Случайное событие
          </button>
        ) : null}
        <button className="ghost" disabled={props.authBusy} onClick={props.onLogout} type="button">
          {props.authBusy ? "Выходим..." : "Выйти"}
        </button>
        {!props.isItemsRail ? (
          <button className="ghost" onClick={props.onCreateEntity} type="button">
            Создать
          </button>
        ) : null}
      </div>
    </header>
  );
}
