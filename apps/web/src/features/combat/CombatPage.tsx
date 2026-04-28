import type {
  ActiveCombat,
  CampaignPreparedCombat,
  CampaignData,
  LastCombatSummary,
  MonsterEntity,
  NpcEntity,
  PlayerEntity
} from "@shadow-edge/shared-types";
import type { ReactNode } from "react";
import { EntityVisual, badge, kindTitle } from "../../app-shared";
import { PlaylistSection } from "../../media";
import { CombatTrackerPage, type CombatTrackerPageProps } from "./CombatTrackerPage";
import { CombatVictoryModal } from "./CombatVictoryModal";
import { getEntityChallenge } from "./combat.utils";

type CombatPageProps = {
  latestCombatSummary: LastCombatSummary | null;
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
  latestCombatSummary,
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
      <CombatVictoryModal latestCombatSummary={latestCombatSummary} />

      {activeCombat?.entries.length ? (
        <CombatTrackerPage {...trackerProps} />
      ) : (
        <>
          <PlaylistSection
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
          />

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
                <span>{hasConfiguredCombat ? "Сцена подготовлена" : "Нужна предварительная настройка"}</span>
              </div>
              <div className="stack">
                <h2>Подготовь сцену перед стартом</h2>
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
                        <button
                          key={`configured-player-${player.id}`}
                          className="card mini fill relation-card relation-card-with-visual"
                          onClick={() => onOpenEntityPreview(player.id)}
                          type="button"
                        >
                          <EntityVisual entity={player} variant="relation" />
                          <span className={badge("success")}>Игрок</span>
                          <strong>{player.title}</strong>
                          <p>{player.role || player.summary || "Персонаж партии"}</p>
                        </button>
                      ))}
                      {configuredCombatEnemies.map(({ entity, quantity }) => (
                        <button
                          key={`configured-enemy-${entity.id}`}
                          className="card mini fill relation-card relation-card-with-visual"
                          onClick={() => onOpenEntityPreview(entity.id)}
                          type="button"
                        >
                          <EntityVisual entity={entity} variant="relation" />
                          <span className={badge(entity.kind === "monster" ? "danger" : "accent")}>{kindTitle[entity.kind]}</span>
                          <strong>{entity.title}</strong>
                          <p>
                            {quantity} шт. • {getEntityChallenge(entity) || "CR не указан"}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
                <label className="field field-full">
                  <span>Уровень партии</span>
                  <small className="field-hint">Нужны только для расчёта сложности. На сам запуск боя они не влияют.</small>
                  <input
                    className="input"
                    onChange={(event) => onCombatPartyLevelsChange(event.target.value)}
                    placeholder="Например: 3"
                    value={resolvedCombatPartyLevelsText}
                  />
                </label>
                <p className="copy combat-inline-note">{combatPartySummary}</p>
                <div className="actions">
                  <button className="ghost" onClick={onOpenCombatSetupModal} type="button">
                    Настроить бой
                  </button>
                  <button className="primary" disabled={!canStartConfiguredCombat} onClick={onOpenCombatSetupModal} type="button">
                    К старту боя
                  </button>
                </div>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
