import type {
  ActiveCombat,
  CampaignPreparedCombat,
  CampaignData,
  KnowledgeEntity,
  MonsterEntity,
  NpcEntity,
  PlayerEntity
} from "@shadow-edge/shared-types";
import type { ReactNode } from "react";
import { EntityVisual, badge, kindTitle } from "../../app-shared";
import { PlaylistSection } from "../../media";
import { CombatTrackerPage, type CombatTrackerPageProps } from "./CombatTrackerPage";
import { getEntityChallenge } from "./combat.utils";

type CombatPageProps = {
  activeCombat: ActiveCombat | null;
  combatSetupOpen: boolean;
  bootError: string;
  combatPortraitNotice: string;
  initiativePublishNotice: string;
  currentPlaybackTrackLabel: string;
  currentPlaybackTrackUrl: string;
  campaign: CampaignData;
  isCombatPlaylistActive: boolean;
  hasConfiguredCombat: boolean;
  canStartConfiguredCombat: boolean;
  configuredCombatPlayers: PlayerEntity[];
  configuredCombatEnemies: Array<{ entity: NpcEntity | MonsterEntity; quantity: number }>;
  configuredCombatEnemyCount: number;
  campaignPreparedCombat: CampaignPreparedCombat | null;
  resolvedCombatPartyLevelsText: string;
  combatPartySummary: string;
  onOpenEntityPreview: (entityId: string) => void;
  onOpenEntityImage?: (entity: KnowledgeEntity, displayUrl?: string) => void;
  onCombatPartyLevelsChange: (value: string) => void;
  onOpenCombatSetupModal: () => void;
  onOpenCombatPlaylistModal: () => void;
  onPlayCombatPlaylist: () => void;
  onPlayCombatTrack: (index: number) => void;
  onPlayNextRandomTrack: () => void;
  onStopPlayback: () => void;
  prepContent: ReactNode;
  trackerProps: CombatTrackerPageProps;
};

export function CombatPage({
  activeCombat,
  combatSetupOpen,
  bootError,
  combatPortraitNotice,
  initiativePublishNotice,
  currentPlaybackTrackLabel,
  currentPlaybackTrackUrl,
  campaign,
  isCombatPlaylistActive,
  hasConfiguredCombat,
  canStartConfiguredCombat,
  configuredCombatPlayers,
  configuredCombatEnemies,
  configuredCombatEnemyCount,
  campaignPreparedCombat,
  resolvedCombatPartyLevelsText,
  combatPartySummary,
  onOpenEntityPreview,
  onOpenEntityImage,
  onCombatPartyLevelsChange,
  onOpenCombatSetupModal,
  onOpenCombatPlaylistModal,
  onPlayCombatPlaylist,
  onPlayCombatTrack,
  onPlayNextRandomTrack,
  onStopPlayback,
  prepContent,
  trackerProps
}: CombatPageProps) {
  return (
    <div className={`stack wide ${combatSetupOpen && !activeCombat?.entries.length ? "combat-prep-only" : ""}`}>

      {activeCombat?.entries.length ? (
        <CombatTrackerPage {...trackerProps} onOpenEntityImage={onOpenEntityImage} />
      ) : (
        <>


          {combatPortraitNotice ? (
            <div className="card mini form-success" role="status">
              <strong>Портреты обновлены</strong>
              <p>{combatPortraitNotice}</p>
            </div>
          ) : null}

          {initiativePublishNotice ? (
            <div className="card mini form-success" role="status">
              <strong>Публичный трекер</strong>
              <p>{initiativePublishNotice}</p>
            </div>
          ) : null}

          {bootError && !combatSetupOpen ? (
            <div className="card mini form-error" role="status">
              <strong>Проблема в бою</strong>
              <p>{bootError}</p>
            </div>
          ) : null}

          {combatSetupOpen ? (
            prepContent
          ) : (
            <section className="card section-card combat-screen-shell">
              <div className="row muted">
                <span>Активного боя пока нет</span>
                <span>{hasConfiguredCombat ? "Сцена подготовлена" : "Выберите участников и инициативу"}</span>
              </div>
              <div className="stack">
                <h2>Новый бой</h2>
                <p className="copy">
                  {hasConfiguredCombat
                    ? "Состав боя уже подготовлен. Открой подготовку, впиши инициативу рядом с участниками и стартуй бой сразу."
                    : "Сначала настрой состав боя: выбери игроков партии и добавь врагов, которых хочешь держать заготовленными для быстрого старта."}
                </p>
                {hasConfiguredCombat ? (
                  <div className="stack compact">
                    <div className="row muted">
                      <span>{campaignPreparedCombat?.title?.trim() || "Подготовленная сцена"}</span>
                      <span>
                        {configuredCombatPlayers.length} {configuredCombatPlayers.length === 1 ? "игрок" : configuredCombatPlayers.length < 5 ? "игрока" : "игроков"} •{" "}
                        {configuredCombatEnemyCount} {configuredCombatEnemyCount === 1 ? "противник" : configuredCombatEnemyCount < 5 ? "противника" : "противников"}
                      </span>
                    </div>
                    <div className="grid">
                      {configuredCombatPlayers.map((player) => (
                        <article
                          key={`configured-player-${player.id}`}
                          className="card mini fill relation-card relation-card-with-visual"
                        >
                          <EntityVisual entity={player} onOpenEntityImage={onOpenEntityImage} variant="relation" />
                          <button className="relation-card-body" onClick={() => onOpenEntityPreview(player.id)} type="button">
                            <span className={badge("success")}>Игрок</span>
                            <strong>{player.title}</strong>
                            <p>{player.role || player.summary || "Персонаж партии"}</p>
                          </button>
                        </article>
                      ))}
                      {configuredCombatEnemies.map(({ entity, quantity }) => (
                        <article
                          key={`configured-enemy-${entity.id}`}
                          className="card mini fill relation-card relation-card-with-visual"
                        >
                          <EntityVisual entity={entity} onOpenEntityImage={onOpenEntityImage} variant="relation" />
                          <button className="relation-card-body" onClick={() => onOpenEntityPreview(entity.id)} type="button">
                            <span className={badge(entity.kind === "monster" ? "danger" : "accent")}>{kindTitle[entity.kind]}</span>
                            <strong>{entity.title}</strong>
                            <p>
                              {quantity} шт. • {getEntityChallenge(entity) || "CR не указан"}
                            </p>
                          </button>
                        </article>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="actions"><button className="primary" onClick={onOpenCombatSetupModal} type="button">{hasConfiguredCombat ? "Открыть подготовленный бой" : "Подготовить бой"}</button></div>
              </div>
            </section>
          )}
          {!combatSetupOpen ? <PlaylistSection
            action={
              <button className="ghost" onClick={onOpenCombatPlaylistModal} type="button">
                Настроить
              </button>
            }
            activeTrackLabel={currentPlaybackTrackLabel}
            activeTrackUrl={currentPlaybackTrackUrl}
            defaultCollapsed={!(campaign.combatPlaylist ?? []).length}
            hint="Один общий плейлист кампании для всех старых и новых боёв"
            isActive={isCombatPlaylistActive}
            onNextRandom={onPlayNextRandomTrack}
            onPlayRandom={onPlayCombatPlaylist}
            onPlayTrack={onPlayCombatTrack}
            onStop={onStopPlayback}
            title="Общий боевой плейлист"
            tracks={campaign.combatPlaylist ?? []}
          /> : null}

        </>
      )}
    </div>
  );
}
