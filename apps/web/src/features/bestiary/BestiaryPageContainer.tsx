import type { MouseEvent as ReactMouseEvent } from "react";
import type {
  KnowledgeEntity,
  MonsterEntity,
  QuickFactTone,
  RelatedEntity
} from "@shadow-edge/shared-types";
import {
  CollapsibleSection,
  EntityVisual,
  badge,
  createHeroPanelStyle,
  gradients,
  hasVisibleArt,
  isRewardableEntity,
  kindTitle,
  sigil,
  toneClass
} from "../../app-shared";
import { GallerySection, PlaylistSection } from "../../media";
import { RichParagraphs } from "../../rich-text";
import { PlayerFacingCardStrip } from "../../quests";
import { CombatEntityStatSheet, RewardSection } from "../../combat-ui";
import { normalizePlayerFacingCardsForClient, type PlayerFacingCardsController } from "../player-facing/usePlayerFacingCards";
import { BestiaryBrowseModal } from "./BestiaryBrowseModal";
import { BestiaryFilters } from "./BestiaryFilters";
import { BestiarySearchResults } from "./BestiarySearchResults";
import type { BestiaryController } from "./useBestiaryController";
import "./bestiary.css";

type BestiaryPageContainerProps = {
  activeMonster: MonsterEntity | null;
  activeMonsterPinned: boolean;
  activeTab: string;
  composeVisibleQuickFacts: (entity: KnowledgeEntity) => Array<{ label: string; value: string; tone?: QuickFactTone }>;
  controller: BestiaryController;
  currentPlaybackTrackLabel: string;
  currentPlaybackTrackUrl: string;
  entityByTitle: Map<string, KnowledgeEntity>;
  isEntityPlaylistActive: (entityId?: string) => boolean;
  onContentContextMenu: (entity: MonsterEntity, event: ReactMouseEvent<HTMLElement>) => void;
  onCopyImageLink: (url: string) => Promise<void>;
  onEditEntity: (entityId: string) => void;
  onOpenDirectory: () => void;
  onOpenEntity: (entityId: string) => void;
  onOpenEntityActionMenu: (entity: MonsterEntity, event: ReactMouseEvent<HTMLElement>) => void;
  onOpenGallery: (entity: MonsterEntity) => void;
  onOpenGalleryViewer: (entity: MonsterEntity, index: number) => void;
  onOpenPlaylist: (entity: MonsterEntity) => void;
  onOpenPreview: (entityId: string) => void;
  onOpenRelatedEntity: (item: RelatedEntity) => void;
  onPlayNextPlaylistTrack: () => void;
  onPlayPlaylist: (entity: MonsterEntity, index?: number, advanceIfActive?: boolean) => void;
  onResolveRelatedEntity: (item: Pick<RelatedEntity, "id" | "label">) => KnowledgeEntity | null;
  onStopPlayback: () => void;
  onTogglePin: (entityId: string) => void;
  playerFacing: PlayerFacingCardsController;
};

export function BestiaryPageContainer({
  activeMonster,
  activeMonsterPinned,
  activeTab,
  composeVisibleQuickFacts,
  controller,
  currentPlaybackTrackLabel,
  currentPlaybackTrackUrl,
  entityByTitle,
  isEntityPlaylistActive,
  onContentContextMenu,
  onCopyImageLink,
  onEditEntity,
  onOpenDirectory,
  onOpenEntity,
  onOpenEntityActionMenu,
  onOpenGallery,
  onOpenGalleryViewer,
  onOpenPlaylist,
  onOpenPreview,
  onOpenRelatedEntity,
  onPlayNextPlaylistTrack,
  onPlayPlaylist,
  onResolveRelatedEntity,
  onStopPlayback,
  onTogglePin,
  playerFacing
}: BestiaryPageContainerProps) {
  if (controller.isBrowseMode) {
    return (
      <div className="stack wide">
        <BestiaryFilters
          activeTab={activeTab}
          bestiary={controller.bestiary}
          browseLabel={controller.bestiaryBrowseLabel}
          loading={controller.bestiaryLoading}
          onChallengeChange={controller.setBestiaryChallenge}
          onSearchChange={controller.setBestiarySearch}
          onTypeChange={controller.setBestiaryType}
          search={controller.bestiarySearch}
          type={controller.bestiaryType}
          value={controller.bestiaryChallenge}
          variant="browse"
        />

        {controller.selectedBestiaryMonster ? (
          <BestiaryBrowseModal
            imported={controller.selectedBestiaryImported}
            importing={controller.importingBestiary}
            monster={controller.selectedBestiaryMonster}
            onImport={() => void controller.importSelectedBestiaryMonster()}
            onOpenSource={() => window.open(controller.selectedBestiaryMonster?.sourceUrl, "_blank", "noopener,noreferrer")}
            summary={controller.selectedBestiarySummary}
          />
        ) : (
          <section className="card section-card directory-screen">
            <div className="directory-head">
              <div>
                <p className="eyebrow">Bestiary Browser</p>
                <h2>{controller.bestiaryDetailLoading ? "Открываю карточку..." : "Каталог монстров"}</h2>
                <p className="copy">Сначала выбери запись из списка, а уже потом откроется полная карточка монстра.</p>
              </div>
              <span className={badge("accent")}>{controller.bestiary?.total ?? 0}</span>
            </div>

            <BestiarySearchResults
              emptyDescription="По текущему фильтру dnd.su ничего не нашлось."
              emptyTitle="Каталог пока пуст"
              items={controller.bestiary?.items ?? []}
              onSelect={controller.setSelectedBestiaryId}
              variant="browse"
            />
          </section>
        )}
      </div>
    );
  }

  if (activeMonster) {
    const monsterPlayerCards = normalizePlayerFacingCardsForClient(activeMonster.kind, activeMonster.playerCards, activeMonster.playerContent);
    const visibleFacts = composeVisibleQuickFacts(activeMonster);

    return (
      <div className="stack wide">
        <BestiaryFilters
          count={controller.filteredImportedMonsters.length}
          onChallengeChange={controller.setImportedMonsterChallenge}
          onSearchChange={controller.setImportedMonsterSearch}
          search={controller.importedMonsterSearch}
          value={controller.importedMonsterChallenge}
          variant="imported"
        />

        <section
          className="card hero"
          onContextMenu={(event) => onOpenEntityActionMenu(activeMonster, event)}
          style={createHeroPanelStyle(gradients[activeMonster.kind], activeMonster.art?.url)}
        >
          <div className="hero-head">
            <EntityVisual entity={activeMonster} variant="hero" />
            <div className="hero-copy-block">
              <div className="hero-tags">
                <span className={badge("accent")}>{kindTitle[activeMonster.kind]}</span>
                {activeMonster.tags.map((tag) => (
                  <span key={tag} className={badge()}>
                    {tag}
                  </span>
                ))}
              </div>
              <h1>{activeMonster.title}</h1>
              <p className="hero-subtitle">{activeMonster.subtitle}</p>
              <p className="copy">{activeMonster.summary}</p>
            </div>
          </div>

          <div className="actions">
            {activeMonster.playlist?.length ? (
              <button className="ghost" onClick={() => onPlayPlaylist(activeMonster)} type="button">
                {isEntityPlaylistActive(activeMonster.id) ? "Следующий трек" : "Случайный трек"}
              </button>
            ) : null}
            <button className="ghost" onClick={() => onEditEntity(activeMonster.id)} type="button">
              Редактировать
            </button>
            <button className="ghost" onClick={() => onTogglePin(activeMonster.id)} type="button">
              {activeMonsterPinned ? "Unpin" : "Pin"}
            </button>
            <button className="primary" onClick={() => onOpenPreview(activeMonster.id)} type="button">
              Открыть в preview
            </button>
          </div>
        </section>

        <PlayerFacingCardStrip
          cards={monsterPlayerCards}
          createDescription="Отдельная сцена, handout или короткая заметка для игроков. Откроется сразу в режиме редактирования."
          description="Храни здесь player-safe описания, речи, handout-карточки и любые отдельные тексты, которые удобно открывать по одной."
          emptyDescription="Пока карточек нет. Создай первую, и она сразу появится в отдельном удобном просмотре для зачитывания игрокам."
          entityId={activeMonster.id}
          onCreateCard={() => playerFacing.openNewPlayerFacingEditor(activeMonster)}
          onDeleteCard={(card, index) => playerFacing.requestPlayerFacingCardDeletion(activeMonster, card, index)}
          onEditCard={(card, index) => playerFacing.openPlayerFacingEditor(activeMonster, card, index)}
          onOpenCard={(card, index) => playerFacing.openPlayerFacingView(activeMonster, card, { cardIndex: index })}
        />

        {visibleFacts.length ? (
          <CollapsibleSection
            key={`${activeMonster.id}-facts`}
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
            <button className="ghost" onClick={() => onOpenPlaylist(activeMonster)} type="button">
              Настроить
            </button>
          }
          activeTrackLabel={currentPlaybackTrackLabel}
          activeTrackUrl={currentPlaybackTrackUrl}
          defaultCollapsed={!(activeMonster.playlist ?? []).length}
          hint="Запусти случайный трек для этой сцены или выбери конкретную композицию вручную"
          isActive={isEntityPlaylistActive(activeMonster.id)}
          onNextRandom={onPlayNextPlaylistTrack}
          onPlayRandom={() => onPlayPlaylist(activeMonster)}
          onPlayTrack={(index) => onPlayPlaylist(activeMonster, index, false)}
          onStop={onStopPlayback}
          title="Плейлист сцены"
          tracks={activeMonster.playlist ?? []}
        />

        <GallerySection
          action={
            <button className="ghost" onClick={() => onOpenGallery(activeMonster)} type="button">
              Настроить
            </button>
          }
          defaultCollapsed={!(activeMonster.gallery ?? []).length}
          hint="Карты, письма, handout-арты и любые изображения, которые можно быстро показать игрокам"
          items={activeMonster.gallery ?? []}
          onCopyLink={onCopyImageLink}
          onOpenFullscreen={(index) => onOpenGalleryViewer(activeMonster, index)}
          title="Галерея"
        />

        {isRewardableEntity(activeMonster) ? <RewardSection kind={activeMonster.kind} rewardProfile={activeMonster.rewardProfile} /> : null}

        <CollapsibleSection
          key={`${activeMonster.id}-knowledge`}
          hint="Полная версия для мастера: скрытые детали, связи, последствия и служебные заметки"
          summary={<p className="copy">{activeMonster.summary || activeMonster.content.slice(0, 180)}</p>}
          title="Информация для мастера"
        >
          <div onContextMenu={(event) => onContentContextMenu(activeMonster, event)}>
            <RichParagraphs content={activeMonster.content} entityByTitle={entityByTitle} onMentionClick={onOpenPreview} />
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          key={`${activeMonster.id}-related`}
          hint="Быстрые переходы без перегруза интерфейса"
          summary={
            <p className="copy">
              {activeMonster.related.length ? `${activeMonster.related.length} связанных сущностей` : "Связей пока не добавлено."}
            </p>
          }
          title="Связанные сущности"
        >
          {activeMonster.related.length ? (
            <div className="grid">
              {activeMonster.related.map((item) => {
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

        <CombatEntityStatSheet entity={activeMonster} />
      </div>
    );
  }

  return (
    <div className="stack wide">
      <section className="card section-card directory-screen">
        <div className="directory-head">
          <div>
            <p className="eyebrow">Монстры кампании</p>
            <h2>Выбери запись</h2>
            <p className="copy">Сначала показываю весь список импортированных монстров. Когда выберешь запись, здесь откроется полноценная страница монстра.</p>
          </div>
          <div className="actions">
            <button className="ghost" onClick={onOpenDirectory} type="button">
              К списку
            </button>
          </div>
        </div>

        <BestiaryFilters
          count={controller.filteredImportedMonsters.length}
          layout="inline"
          onChallengeChange={controller.setImportedMonsterChallenge}
          onSearchChange={controller.setImportedMonsterSearch}
          search={controller.importedMonsterSearch}
          value={controller.importedMonsterChallenge}
          variant="imported"
        />

        <BestiarySearchResults
          emptyDescription="Либо в разделе пока нет записей, либо текущий поиск/фильтр ничего не дал."
          emptyTitle="Ничего не найдено"
          items={controller.filteredImportedMonsters}
          onContextMenu={(monster, event) => onOpenEntityActionMenu(monster, event)}
          onOpen={onOpenEntity}
          variant="imported"
        />
      </section>
    </div>
  );
}
