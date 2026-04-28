import type { ComponentProps, MouseEvent as ReactMouseEvent } from "react";
import type {
  KnowledgeEntity,
  QuickFactTone,
  RelatedEntity
} from "@shadow-edge/shared-types";
import {
  badge,
  createHeroPanelStyle,
  gradients,
  isRewardableEntity,
  kindTitle
} from "../app-shared";
import { CombatEntityPreviewSummary, RewardSection } from "../combat-ui";
import { GallerySection, PlaylistSection } from "../media";
import { QuestPreviewPanel } from "../quests";

type QuestPreviewProps = ComponentProps<typeof QuestPreviewPanel>;

type AppPreviewContentProps = {
  composeVisibleQuickFacts: (entity: KnowledgeEntity) => Array<{ label: string; value: string; tone?: QuickFactTone }>;
  currentPlaybackTrackLabel: string;
  currentPlaybackTrackUrl: string;
  isEntityPlaylistActive: (entityId?: string) => boolean;
  onCopyImageLink: (url: string) => Promise<void>;
  onOpenEntityPage: (entityId: string) => void;
  onOpenEntityActionMenu: (entity: KnowledgeEntity, event: ReactMouseEvent<HTMLElement>) => void;
  onOpenGallery: (entity: KnowledgeEntity) => void;
  onOpenGalleryViewer: (entity: KnowledgeEntity, index: number) => void;
  onOpenPreviewEntity: QuestPreviewProps["onOpenEntity"];
  onOpenPlaylist: (entity: KnowledgeEntity) => void;
  onOpenRelatedEntity: (item: RelatedEntity) => void;
  onPlayNextPlaylistTrack: () => void;
  onPlayPlaylist: (entity: KnowledgeEntity, index?: number, advanceIfActive?: boolean) => void;
  onStopPlayback: () => void;
  onTogglePin: (entityId: string) => void;
  previewEntity: KnowledgeEntity | null;
  previewPinned: boolean;
  previewQuest: QuestPreviewProps["quest"] | null;
  previewQuestIssuer: QuestPreviewProps["issuer"];
  previewQuestLinkedEntities: QuestPreviewProps["linkedEntities"];
  previewQuestLocation: QuestPreviewProps["location"];
  previewQuestPreparedCombatEntries: QuestPreviewProps["preparedCombatEntries"];
  previewQuestRelatedQuests: QuestPreviewProps["relatedQuests"];
} & Pick<
  QuestPreviewProps,
  | "combatPartyLevelsText"
  | "combatPartySummary"
  | "effectiveCombatThresholds"
  | "hasActiveCombat"
  | "hasExplicitPartyLevels"
  | "onCombatPartyLevelsChange"
  | "onEdit"
  | "onOpenGallery"
  | "onOpenPlayerView"
  | "onOpenPlaylist"
  | "onOpenQuest"
  | "onOpenRandomEvent"
  | "onRunCombat"
>;

export function AppPreviewContent({
  combatPartyLevelsText,
  combatPartySummary,
  composeVisibleQuickFacts,
  currentPlaybackTrackLabel,
  currentPlaybackTrackUrl,
  effectiveCombatThresholds,
  hasActiveCombat,
  hasExplicitPartyLevels,
  isEntityPlaylistActive,
  onCombatPartyLevelsChange,
  onCopyImageLink,
  onEdit,
  onOpenEntityPage,
  onOpenEntityActionMenu,
  onOpenGallery,
  onOpenGalleryViewer,
  onOpenPlayerView,
  onOpenPreviewEntity,
  onOpenPlaylist,
  onOpenQuest,
  onOpenRandomEvent,
  onOpenRelatedEntity,
  onPlayNextPlaylistTrack,
  onPlayPlaylist,
  onRunCombat,
  onStopPlayback,
  onTogglePin,
  previewEntity,
  previewPinned,
  previewQuest,
  previewQuestIssuer,
  previewQuestLinkedEntities,
  previewQuestLocation,
  previewQuestPreparedCombatEntries,
  previewQuestRelatedQuests
}: AppPreviewContentProps) {
  if (previewQuest) {
    return (
      <QuestPreviewPanel
        combatPartyLevelsText={combatPartyLevelsText}
        combatPartySummary={combatPartySummary}
        effectiveCombatThresholds={effectiveCombatThresholds}
        hasActiveCombat={hasActiveCombat}
        hasExplicitPartyLevels={hasExplicitPartyLevels}
        issuer={previewQuestIssuer}
        linkedEntities={previewQuestLinkedEntities}
        location={previewQuestLocation}
        onCombatPartyLevelsChange={onCombatPartyLevelsChange}
        onEdit={onEdit}
        onOpenEntity={onOpenPreviewEntity}
        onOpenGallery={onOpenGallery}
        onOpenPlayerView={onOpenPlayerView}
        onOpenPlaylist={onOpenPlaylist}
        onOpenQuest={onOpenQuest}
        onOpenRandomEvent={onOpenRandomEvent}
        onRunCombat={onRunCombat}
        onTogglePin={onTogglePin}
        pinned={previewPinned}
        preparedCombatEntries={previewQuestPreparedCombatEntries}
        quest={previewQuest}
        relatedQuests={previewQuestRelatedQuests}
      />
    );
  }

  if (previewEntity) {
    const visibleFacts = composeVisibleQuickFacts(previewEntity).slice(0, 3);
    const combatProfileEntity =
      previewEntity.kind === "player" || previewEntity.kind === "npc" || previewEntity.kind === "monster" ? previewEntity : null;

    return (
      <div className="stack wide">
        <div className="row">
          <p className="eyebrow">Peek / Preview</p>
          <button className={badge(previewPinned ? "success" : "default")} onClick={() => onTogglePin(previewEntity.id)} type="button">
            {previewPinned ? "Pinned" : "Pin"}
          </button>
        </div>

        <section
          className="preview-hero"
          onContextMenu={(event) => onOpenEntityActionMenu(previewEntity, event)}
          style={createHeroPanelStyle(gradients[previewEntity.kind], previewEntity.art?.url)}
        >
          <span>{kindTitle[previewEntity.kind]}</span>
          <strong>{previewEntity.title}</strong>
          <small>{previewEntity.subtitle}</small>
        </section>

        <p className="copy">{previewEntity.summary}</p>

        <div className="facts preview-facts">
          {visibleFacts.map((fact) => (
            <article key={fact.label} className="card mini fact-box">
              <small>{fact.label}</small>
              <strong className="fact-value">{fact.value}</strong>
            </article>
          ))}
        </div>

        {combatProfileEntity ? <CombatEntityPreviewSummary entity={combatProfileEntity} /> : null}
        {isRewardableEntity(previewEntity) ? <RewardSection compact kind={previewEntity.kind} rewardProfile={previewEntity.rewardProfile} /> : null}

        <PlaylistSection
          action={
            <button className="ghost" onClick={() => onOpenPlaylist(previewEntity)} type="button">
              Настроить
            </button>
          }
          activeTrackLabel={currentPlaybackTrackLabel}
          activeTrackUrl={currentPlaybackTrackUrl}
          compact
          defaultCollapsed
          hint="Быстрый музыкальный запуск без ухода со страницы"
          isActive={isEntityPlaylistActive(previewEntity.id)}
          onNextRandom={onPlayNextPlaylistTrack}
          onPlayRandom={() => onPlayPlaylist(previewEntity)}
          onPlayTrack={(index) => onPlayPlaylist(previewEntity, index, false)}
          onStop={onStopPlayback}
          title="Плейлист"
          tracks={previewEntity.playlist ?? []}
        />

        <GallerySection
          action={
            <button className="ghost" onClick={() => onOpenGallery(previewEntity)} type="button">
              Настроить
            </button>
          }
          compact
          defaultCollapsed
          displayLimit={4}
          hint="Карты и handout-изображения можно открыть прямо отсюда"
          items={previewEntity.gallery ?? []}
          onCopyLink={onCopyImageLink}
          onOpenFullscreen={(index) => onOpenGalleryViewer(previewEntity, index)}
          title="Галерея"
        />

        <div className="stack">
          {previewEntity.related.slice(0, 4).map((item) => (
            <button key={`${item.id}-${item.label}`} className="ghost fill" onClick={() => onOpenRelatedEntity(item)} type="button">
              {item.label}
            </button>
          ))}
        </div>

        <button className="primary" onClick={() => onOpenEntityPage(previewEntity.id)} type="button">
          Открыть полностью
        </button>
      </div>
    );
  }

  return (
    <div className="stack">
      <p className="eyebrow">Preview</p>
      <h3>Контекст справа</h3>
      <p className="copy">Выбери запись в центре, кликни по `[[ссылке]]` или используй поиск, чтобы открыть карточку и синхронизировать preview.</p>
    </div>
  );
}
