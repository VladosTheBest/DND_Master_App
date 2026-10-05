import { ActionMenu } from "./ActionMenu";
import { SubscriptionButton } from "./SubscriptionDialog";
import { FeedbackButton } from "./FeedbackDialog";
import type { KnowledgeEntity } from "@shadow-edge/shared-types";

type DefaultHeaderProps = {
  readyCampaign?: boolean;
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
  pendingProposalCount: number;
  codexPromptOutcome: "error" | "warning" | null;
  codexPromptRunning: boolean;
  onOpenSearch: () => void;
  onOpenCombat: () => void;
  onOpenDirectory: () => void;
  onOpenPinnedEntity: (entityId: string) => void;
  onOpenRandomEvent: () => void;
  onOpenAIProposals: () => void;
  onLogout: () => void;
  onCreateEntity: () => void;
  onOpenPlayerSurveys: () => void;
  onOpenSessionMap: () => void;
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
            ← К кампании
          </button>
        </div>

        <div className="combat-screen-title">
          <p className="eyebrow">Сцена боя</p>
          <strong>{props.combatTitle}</strong>
          <small>{props.hasActiveCombat ? `Участников: ${props.activeCombatCount}` : "Подготовка новой сцены боя"}</small>
        </div>

        <div className="chips">
          <SubscriptionButton />
          <FeedbackButton />

          <button className="ghost" disabled={!props.hasActiveCombat} onClick={props.onOpenInitiativeTracker} type="button">Трекер</button>
          <button className="ghost" onClick={props.onOpenCombatSetupModal} type="button">{props.hasActiveCombat ? "Участники" : "Настроить бой"}</button>
          <ActionMenu label="Инструменты боя">
            <button className="ghost" onClick={props.onPlayCombatPlaylist} type="button">{props.isCombatPlaylistActive ? "Следующий трек" : "Включить музыку"}</button>
            <button className="ghost" onClick={props.onOpenCombatPlaylistModal} type="button">Плейлист боя</button>
            <button className="ghost" disabled={props.initiativeShareBusy} onClick={props.onOpenPublicInitiativeTracker} type="button">Экран игроков</button>
            <button className="ghost" disabled={props.initiativeShareBusy} onClick={props.onCopyPublicInitiativeTracker} type="button">Копировать ссылку для игроков</button>
            <button className="ghost" disabled={props.saving} onClick={props.onSyncCombatPortraits} type="button">Обновить портреты</button>
          </ActionMenu>
          <button className="ghost" disabled={!props.hasActiveCombat || props.saving} onClick={props.onFinishCombat} type="button">
            Завершить бой
          </button>
        </div>
      </header>
    );
  }

  return (
    <header className="panel topbar">
      <button className="search-btn" onClick={props.onOpenSearch} type="button">
        <strong>Найти в кампании или правилах</strong>
        <span>Ctrl K</span>
      </button>

      <div className="chips">
        <SubscriptionButton />
        <FeedbackButton />
        {props.canOpenDirectory ? <button className="ghost" onClick={props.onOpenDirectory} type="button">← К списку</button> : null}
        <button className={props.hasActiveCombat ? "primary active-combat-indicator" : "ghost"} onClick={props.onOpenCombat} type="button">
          {props.hasActiveCombat ? "Продолжить бой" : "Подготовить бой"}
        </button>
        {props.pinnedEntities.length ? <ActionMenu label={`Закладки · ${props.pinnedEntities.length}`}>
          {props.pinnedEntities.map(entity => <button key={entity.id} className="ghost" onClick={() => props.onOpenPinnedEntity(entity.id)} type="button">{entity.title}</button>)}
        </ActionMenu> : null}
        <ActionMenu label="Инструменты">
        {!(props.codexPromptRunning || props.codexPromptOutcome || props.pendingProposalCount) ? <button
          className={`ghost ai-proposal-inbox-button ${props.codexPromptRunning ? "working" : props.codexPromptOutcome ? "needs-attention" : ""}`.trim()}
          onClick={props.onOpenAIProposals}
          type="button"
        >
          <span aria-live="polite">
            {props.codexPromptRunning
              ? "Codex работает…"
              : props.codexPromptOutcome === "warning"
                ? "Codex: проверь результат"
                : props.codexPromptOutcome === "error"
                  ? "Codex: нужна проверка"
                  : "Черновики AI"}
          </span>
          {props.codexPromptRunning || props.codexPromptOutcome ? (
            <span aria-hidden="true" className={`ai-proposal-running-dot ${props.codexPromptOutcome || ""}`.trim()} />
          ) : null}
          {props.pendingProposalCount ? <span className="ai-proposal-count">{props.pendingProposalCount}</span> : null}
        </button> : null}
        <button className="ghost" onClick={props.onOpenPlayerSurveys} type="button">Анкеты игроков</button>
        <button className="ghost" onClick={props.onOpenSessionMap} type="button">Карта и экран игроков</button>
        {!props.readyCampaign && props.activeModule === "quests" ? <button className="ghost" onClick={props.onOpenRandomEvent} type="button">Сцена для зачитки</button> : null}
        {(!props.readyCampaign || props.activeModule === "players") && !props.isItemsRail && !["events", "notes", "lore", "sessions", "rules", "bestiary"].includes(props.activeModule) ? <button className="ghost" onClick={props.onCreateEntity} type="button">Создать запись</button> : null}
        </ActionMenu>
        {props.codexPromptRunning || props.codexPromptOutcome || props.pendingProposalCount ? <button className="ghost" onClick={props.onOpenAIProposals} type="button" aria-live="polite">
          {props.codexPromptRunning ? "AI работает…" : props.codexPromptOutcome ? "AI: проверьте результат" : `AI: ${props.pendingProposalCount} на проверке`}
        </button> : null}
      </div>
    </header>
  );
}
