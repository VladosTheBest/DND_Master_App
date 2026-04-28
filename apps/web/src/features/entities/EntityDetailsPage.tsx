import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";
import type {
  KnowledgeEntity,
  PlayerFacingCard,
  QuickFactTone,
  QuestEntity,
  RelatedEntity
} from "@shadow-edge/shared-types";
import {
  CollapsibleSection,
  EntityVisual,
  badge,
  createHeroPanelStyle,
  gradients,
  isRewardableEntity,
  kindTitle,
  sigil,
  toneClass
} from "../../app-shared";
import { CombatEntityStatSheet, RewardSection } from "../../combat-ui";
import { GallerySection, PlaylistSection } from "../../media";
import { PlayerFacingCardStrip } from "../../quests";
import { RichParagraphs } from "../../rich-text";

type EntityDetailsPageProps = {
  activeEntity: KnowledgeEntity;
  activeEntityPinned: boolean;
  activeEntityPlayerCards: PlayerFacingCard[];
  activeNpcQuests: QuestEntity[];
  composeVisibleQuickFacts: (entity: KnowledgeEntity) => Array<{ label: string; value: string; tone?: QuickFactTone }>;
  currentPlaybackTrackLabel: string;
  currentPlaybackTrackUrl: string;
  entityByTitle: Map<string, KnowledgeEntity>;
  isEntityPlaylistActive: (entityId?: string) => boolean;
  onCopyImageLink: (url: string) => Promise<void>;
  preparedCombatSection: ReactNode;
  onContentContextMenu: (event: ReactMouseEvent<HTMLElement>) => void;
  onCreatePlayerFacingCard: () => void;
  onDeletePlayerFacingCard: (card: PlayerFacingCard, index: number) => void;
  onEditEntity: () => void;
  onEditPlayerFacingCard: (card: PlayerFacingCard, index: number) => void;
  onOpenEntityActionMenu: (event: ReactMouseEvent<HTMLElement>) => void;
  onOpenGallery: () => void;
  onOpenGalleryViewer: (index: number) => void;
  onOpenNpcQuestModal: () => void;
  onOpenPlayerFacingCard: (card: PlayerFacingCard, index: number) => void;
  onOpenPlaylistEditor: () => void;
  onOpenPreview: () => void;
  onOpenRelatedEntity: (item: RelatedEntity) => void;
  onPeekQuest: (questId: string) => void;
  onPlayNextPlaylistTrack: () => void;
  onPlayPlaylist: (index?: number, advanceIfActive?: boolean) => void;
  onResolveRelatedEntity: (item: Pick<RelatedEntity, "id" | "label">) => KnowledgeEntity | null;
  onStopPlayback: () => void;
  onTogglePin: () => void;
};

export function EntityDetailsPage({
  activeEntity,
  activeEntityPinned,
  activeEntityPlayerCards,
  activeNpcQuests,
  composeVisibleQuickFacts,
  currentPlaybackTrackLabel,
  currentPlaybackTrackUrl,
  entityByTitle,
  isEntityPlaylistActive,
  onCopyImageLink,
  preparedCombatSection,
  onContentContextMenu,
  onCreatePlayerFacingCard,
  onDeletePlayerFacingCard,
  onEditEntity,
  onEditPlayerFacingCard,
  onOpenEntityActionMenu,
  onOpenGallery,
  onOpenGalleryViewer,
  onOpenNpcQuestModal,
  onOpenPlayerFacingCard,
  onOpenPlaylistEditor,
  onOpenPreview,
  onOpenRelatedEntity,
  onPeekQuest,
  onPlayNextPlaylistTrack,
  onPlayPlaylist,
  onResolveRelatedEntity,
  onStopPlayback,
  onTogglePin
}: EntityDetailsPageProps) {
  const visibleFacts = composeVisibleQuickFacts(activeEntity);
  const combatProfileEntity =
    activeEntity.kind === "player" || activeEntity.kind === "npc" || activeEntity.kind === "monster" ? activeEntity : null;

  return (
    <div className="stack wide">
      <section
        className="card hero"
        onContextMenu={onOpenEntityActionMenu}
        style={createHeroPanelStyle(gradients[activeEntity.kind], activeEntity.art?.url)}
      >
        <div className="hero-head">
          <EntityVisual entity={activeEntity} variant="hero" />
          <div className="hero-copy-block">
            <div className="hero-tags">
              <span className={badge("accent")}>{kindTitle[activeEntity.kind]}</span>
              {activeEntity.tags.map((tag) => (
                <span key={tag} className={badge()}>
                  {tag}
                </span>
              ))}
            </div>
            <h1>{activeEntity.title}</h1>
            <p className="hero-subtitle">{activeEntity.subtitle}</p>
            <p className="copy">{activeEntity.summary}</p>
          </div>
        </div>

        <div className="actions">
          {activeEntity.playlist?.length ? (
            <button className="ghost" onClick={() => onPlayPlaylist()} type="button">
              {isEntityPlaylistActive(activeEntity.id) ? "Следующий трек" : "Случайный трек"}
            </button>
          ) : null}
          <button className="ghost" onClick={onEditEntity} type="button">
            Редактировать
          </button>
          <button className="ghost" onClick={onTogglePin} type="button">
            {activeEntityPinned ? "Unpin" : "Pin"}
          </button>
          <button className="primary" onClick={onOpenPreview} type="button">
            Открыть в preview
          </button>
        </div>
      </section>

      <PlayerFacingCardStrip
        cards={activeEntityPlayerCards}
        createDescription="Отдельная сцена, handout или короткая заметка для игроков. Откроется сразу в режиме редактирования."
        description={
          activeEntity.kind === "location"
            ? "Создавай сколько угодно отдельных карточек-сцен и handout-описаний для игроков."
            : "Храни здесь player-safe описания, речи, handout-карточки и любые отдельные тексты, которые удобно открывать по одной."
        }
        emptyDescription="Пока карточек нет. Создай первую, и она сразу появится в отдельном удобном просмотре для зачитывания игрокам."
        entityId={activeEntity.id}
        onCreateCard={onCreatePlayerFacingCard}
        onDeleteCard={onDeletePlayerFacingCard}
        onEditCard={onEditPlayerFacingCard}
        onOpenCard={onOpenPlayerFacingCard}
      />

      {preparedCombatSection}

      {visibleFacts.length ? (
        <CollapsibleSection
          key={`${activeEntity.id}-facts`}
          hint="Ключевые данные, которые стоит держать перед глазами"
          summary={
            <p className="copy">
              {visibleFacts
                .slice(0, 3)
                .map((fact) => `${fact.label}: ${fact.value}`)
                .join(" • ")}
            </p>
          }
          title="Быстрая сводка"
        >
          <div className="facts">
            {visibleFacts.map((fact) => (
              <article key={fact.label} className="card mini fact-box">
                <small>{fact.label}</small>
                <strong className={`fact-value ${toneClass[fact.tone ?? "default"]}`}>{fact.value}</strong>
              </article>
            ))}
          </div>
        </CollapsibleSection>
      ) : null}

      <PlaylistSection
        action={
          <button className="ghost" onClick={onOpenPlaylistEditor} type="button">
            Настроить
          </button>
        }
        activeTrackLabel={currentPlaybackTrackLabel}
        activeTrackUrl={currentPlaybackTrackUrl}
        defaultCollapsed={!(activeEntity.playlist ?? []).length}
        hint="Запусти случайный трек для этой сцены или выбери конкретную композицию вручную"
        isActive={isEntityPlaylistActive(activeEntity.id)}
        onNextRandom={onPlayNextPlaylistTrack}
        onPlayRandom={() => onPlayPlaylist()}
        onPlayTrack={(index) => onPlayPlaylist(index, false)}
        onStop={onStopPlayback}
        title="Плейлист сцены"
        tracks={activeEntity.playlist ?? []}
      />

      <GallerySection
        action={
          <button className="ghost" onClick={onOpenGallery} type="button">
            Настроить
          </button>
        }
        defaultCollapsed={!(activeEntity.gallery ?? []).length}
        hint="Карты, письма, handout-арты и любые изображения, которые можно быстро показать игрокам"
        items={activeEntity.gallery ?? []}
        onCopyLink={onCopyImageLink}
        onOpenFullscreen={onOpenGalleryViewer}
        title="Галерея"
      />

      {activeEntity.kind === "npc" ? (
        <CollapsibleSection
          key={`${activeEntity.id}-quests`}
          action={
            <button className="ghost" onClick={onOpenNpcQuestModal} type="button">
              Создать квест
            </button>
          }
          hint="Квесты, которые этот НПС выдаёт, сопровождает или к которым привязан"
          summary={
            <p className="copy">
              {activeNpcQuests.length ? `${activeNpcQuests.length} связанных квестов.` : "Связанных квестов пока нет."}
            </p>
          }
          title="Квесты НПС"
        >
          {activeNpcQuests.length ? (
            <div className="grid">
              {activeNpcQuests.map((quest) => (
                <button key={quest.id} className="card mini fill relation-card relation-card-with-visual" onClick={() => onPeekQuest(quest.id)} type="button">
                  <EntityVisual entity={quest} variant="relation" />
                  <span className={badge("warning")}>Квест</span>
                  <strong>{quest.title}</strong>
                  <p>{quest.summary}</p>
                </button>
              ))}
            </div>
          ) : (
            <p className="copy">
              Пока этот НПС не привязан ни к одному квесту. Кнопка сверху сразу создаст новый квест с обратной ссылкой.
            </p>
          )}
        </CollapsibleSection>
      ) : null}

      {isRewardableEntity(activeEntity) ? <RewardSection kind={activeEntity.kind} rewardProfile={activeEntity.rewardProfile} /> : null}

      <CollapsibleSection
        key={`${activeEntity.id}-knowledge`}
        hint="Полная версия для мастера: скрытые детали, связи, последствия и служебные заметки"
        summary={<p className="copy">{activeEntity.summary || activeEntity.content.slice(0, 180)}</p>}
        title="Информация для мастера"
      >
        <div onContextMenu={onContentContextMenu}>
          <RichParagraphs content={activeEntity.content} entityByTitle={entityByTitle} onMentionClick={onOpenPreview} />
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        key={`${activeEntity.id}-related`}
        hint="Быстрые переходы без перегруза интерфейса"
        summary={
          <p className="copy">
            {activeEntity.related.length ? `${activeEntity.related.length} связанных сущностей` : "Связей пока не добавлено."}
          </p>
        }
        title="Связанные сущности"
      >
        {activeEntity.related.length ? (
          <div className="grid">
            {activeEntity.related.map((item) => {
              const linkedEntity = onResolveRelatedEntity(item);
              return (
                <button
                  key={`${item.id}-${item.label}`}
                  className="card mini fill relation-card relation-card-with-visual"
                  onClick={() => onOpenRelatedEntity(item)}
                  type="button"
                >
                  {linkedEntity ? (
                    <EntityVisual entity={linkedEntity} variant="relation" />
                  ) : (
                    <span className="sigil" style={{ backgroundImage: gradients[item.kind] }}>
                      {sigil(item.label)}
                    </span>
                  )}
                  <span className={badge()}>{kindTitle[item.kind]}</span>
                  <strong>{item.label}</strong>
                  <p>{item.reason}</p>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="copy">Пока здесь пусто. Связи можно добавлять через редактор или wiki-ссылки в тексте.</p>
        )}
      </CollapsibleSection>

      {combatProfileEntity ? <CombatEntityStatSheet entity={combatProfileEntity} /> : null}
    </div>
  );
}
