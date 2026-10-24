import { RecordIllustration } from "../entity-images/RecordIllustration";
import type { MouseEvent as ReactMouseEvent } from "react";
import type {
  GalleryImage,
  KnowledgeEntity,
  MonsterEntity,
  QuickFactTone,
  RelatedEntity
} from "@shadow-edge/shared-types";
import {
  CollapsibleSection,
  badge,
  buildEntityGalleryAlbum,
  isRewardableEntity
} from "../../app-shared";
import { CombatEntityStatSheet, RewardSection } from "../../combat-ui";
import { RichParagraphs } from "../../rich-text";
import { PlayerFacingCardStrip } from "../../quests";
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
  onEditEntity: (entityId: string,section?:string) => void;
  onEditWithAI: (entity: MonsterEntity) => void;
  onOpenDirectory: () => void;
  onOpenEntity: (entityId: string) => void;
  onOpenEntityActionMenu: (entity: MonsterEntity, event: ReactMouseEvent<HTMLElement>) => void;
  onOpenEntityImage?: (entity: KnowledgeEntity, displayUrl?: string) => void;
  onOpenGallery: (entity: MonsterEntity) => void;
  onOpenGalleryAlbum: (ownerId: string, ownerTitle: string, items: GalleryImage[], index: number) => void;
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
  controller,
  entityByTitle,
  onContentContextMenu,
  onEditEntity,
  onEditWithAI,
  onOpenDirectory,
  onOpenEntity,
  onOpenEntityActionMenu,
  onOpenEntityImage,
  onOpenGallery,
  onOpenGalleryAlbum,
  onOpenPreview,
  onTogglePin,
  playerFacing
}: BestiaryPageContainerProps) {
  if (controller.isBrowseMode) {
    if (controller.selectedBestiaryMonster) {
      return (
        <BestiaryBrowseModal
          imported={controller.selectedBestiaryImported}
          importing={controller.importingBestiary}
          monster={controller.selectedBestiaryMonster}
          onBack={() => controller.setSelectedBestiaryId("")}
          onImport={() => void controller.importSelectedBestiaryMonster()}
          onOpenGalleryAlbum={onOpenGalleryAlbum}
          onOpenSource={() => window.open(controller.selectedBestiaryMonster?.sourceUrl, "_blank", "noopener,noreferrer")}
          summary={controller.selectedBestiarySummary}
        />
      );
    }

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

        <section className="card section-card directory-screen">
          <div className="directory-head">
            <div>
              <h2>{controller.bestiaryDetailLoading ? "Открываю карточку..." : "Каталог монстров"}</h2>
            </div>
          </div>

          <BestiarySearchResults
            emptyDescription="По текущему фильтру dnd.su ничего не нашлось."
            emptyTitle="Каталог пока пуст"
            items={controller.bestiary?.items ?? []}
            onSelect={controller.setSelectedBestiaryId}
            variant="browse"
          />
        </section>
      </div>
    );
  }

  if (activeMonster) {
    const monsterPlayerCards = normalizePlayerFacingCardsForClient(activeMonster.kind, activeMonster.playerCards, activeMonster.playerContent);
    const monsterGalleryAlbum = buildEntityGalleryAlbum(activeMonster);
    const openMonsterAlbum = () => {
      if (monsterGalleryAlbum.length) {
        onOpenGalleryAlbum(activeMonster.id, activeMonster.title, monsterGalleryAlbum, 0);
        return;
      }

      onOpenGallery(activeMonster);
    };

    return (
      <div className="stack wide">
        {!activeMonster.statBlock&&<><section className="record-heading"><h1>{activeMonster.title}</h1><p className="copy">{activeMonster.summary}</p><div className="actions"><button className="primary" onClick={()=>onEditEntity(activeMonster.id)}>Редактировать</button><button className="ghost" onClick={()=>onEditEntity(activeMonster.id,"stats")}>Добавить характеристики</button></div></section><RecordIllustration url={activeMonster.art?.url} title={activeMonster.title} onReplace={()=>onEditEntity(activeMonster.id,"art")} onGallery={()=>onOpenGallery(activeMonster)}/></>}
        <div onContextMenu={(event) => onOpenEntityActionMenu(activeMonster, event)}>
          <CombatEntityStatSheet
            action={
              <div className="npc-sheet-toolbar">
                <button className="primary" onClick={() => onEditEntity(activeMonster.id,"stats")} type="button">Редактировать характеристики</button>
                <details className="record-actions-more"><summary aria-label="Другие действия с монстром">Действия</summary><div>
                  <button className="ghost" onClick={() => onEditEntity(activeMonster.id)} type="button">Редактировать запись</button>
                  <button className="ghost" onClick={() => onEditEntity(activeMonster.id,"art")} type="button">{activeMonster.art?.url ? "Заменить изображение" : "Добавить изображение"}</button>
                  <button className="ghost" onClick={() => onOpenGallery(activeMonster)} type="button">Галерея</button>
                  <button className="ghost" onClick={() => onEditWithAI(activeMonster)} type="button">Изменить с AI</button>
                  <button className="ghost" onClick={() => onTogglePin(activeMonster.id)} type="button">{activeMonsterPinned ? "Убрать закладку" : "В закладки"}</button>
                  <button className="ghost" onClick={() => onOpenPreview(activeMonster.id)} type="button">Быстрый просмотр</button>
                </div></details>
              </div>
            }
            defaultCollapsed={false}
            entity={activeMonster}
            expandSections
            onOpenPortraitGallery={onOpenEntityImage
              ? () => onOpenEntityImage(activeMonster, monsterGalleryAlbum[0]?.url)
              : openMonsterAlbum}
            portraitActionLabel={onOpenEntityImage ? "Нажми на портрет, чтобы открыть изображение и действия." : undefined}
            portraitOverride={
              monsterGalleryAlbum[0]
                ? {
                    alt: monsterGalleryAlbum[0].caption ?? monsterGalleryAlbum[0].title,
                    caption: monsterGalleryAlbum[0].caption,
                    url: monsterGalleryAlbum[0].url
                  }
                : undefined
            }
          />
        </div>

        <PlayerFacingCardStrip
          cards={monsterPlayerCards}
          cardBadgeLabel="GM-only"
          cardBadgeTone="warning"
          contextMenuLabel="Заметка мастера"
          countLabel={monsterPlayerCards.length ? `${monsterPlayerCards.length} заметок` : "Заметки нужны"}
          createDescription="Короткая тактическая шпаргалка, скрытая заметка или подсказка для мастера. Откроется сразу в режиме редактирования."
          description="Храни здесь заметки мастера: тактику, фазы боя, скрытые триггеры и любые рабочие карточки, которые удобно открывать по одной."
          emptyDescription="Пока заметок нет. Создай первую карточку, чтобы быстро открывать подсказки мастера прямо во время сцены."
          emptyStateTitle="Заметок пока нет"
          entityId={activeMonster.id}
          onCreateCard={() => playerFacing.openNewPlayerFacingEditor(activeMonster)}
          onDeleteCard={(card, index) => playerFacing.requestPlayerFacingCardDeletion(activeMonster, card, index)}
          onEditCard={(card, index) => playerFacing.openPlayerFacingEditor(activeMonster, card, index)}
          onOpenCard={(card, index) => playerFacing.openPlayerFacingView(activeMonster, card, { cardIndex: index })}
          title="Заметки мастера"
        />

        {isRewardableEntity(activeMonster) ? <RewardSection kind={activeMonster.kind} rewardProfile={activeMonster.rewardProfile} /> : null}

        <CollapsibleSection
          key={`${activeMonster.id}-knowledge`}
          hint="Полное описание монстра, поведенческие заметки и любые служебные пояснения мастера."
          summary={<p className="copy">{activeMonster.summary || activeMonster.content.slice(0, 180)}</p>}
          title="Описание"
        >
          <div onContextMenu={(event) => onContentContextMenu(activeMonster, event)}>
            <RichParagraphs content={activeMonster.content} entityByTitle={entityByTitle} onMentionClick={onOpenPreview} />
          </div>
        </CollapsibleSection>
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
          onOpenEntityImage={onOpenEntityImage}
          onOpen={onOpenEntity}
          variant="imported"
        />
      </section>
    </div>
  );
}
