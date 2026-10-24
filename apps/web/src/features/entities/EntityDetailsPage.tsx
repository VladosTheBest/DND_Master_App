import { RecordIllustration } from "../entity-images/RecordIllustration";
import { EntityRelationsPanel } from "../entity-links/EntityRelationsPanel";
import { type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { useWorkspaceRoute, workspaceURL } from "../../app/workspace-route";
import type {
  CampaignData,
  CampaignShop,
  GalleryImage,
  KnowledgeEntity,
  PlayerFacingCard,
  QuickFactTone,
  QuestEntity,
  RelatedEntity
} from "@shadow-edge/shared-types";
import {
  CollapsibleSection,
  badge,
  buildEntityGalleryAlbum,
  EntityVisual,
  isRewardableEntity,
  kindTitle,
  toneClass
} from "../../app-shared";
import { CombatEntityStatSheet, RewardSection } from "../../combat-ui";
import { GallerySection, PlaylistSection } from "../../media";
import { PlayerFacingCardStrip } from "../../quests";
import { RichParagraphs } from "../../rich-text";

export type EntityDetailsRendererProps = {
  ownerId?:string;
  onCampaignChanged?:(campaign:CampaignData)=>void;
  activeEntity: KnowledgeEntity;
  activeEntityPinned: boolean;
  activeEntityPlayerCards: PlayerFacingCard[];
  activeNpcQuests: QuestEntity[];
  composeVisibleQuickFacts: (entity: KnowledgeEntity) => Array<{ label: string; value: string; tone?: QuickFactTone }>;
  currentPlaybackTrackLabel: string;
  currentPlaybackTrackUrl: string;
  entityByTitle: Map<string, KnowledgeEntity>;
  isEntityPlaylistActive: (entityId?: string) => boolean;
  locationShops: CampaignShop[];
  onCopyImageLink: (url: string) => Promise<void>;
  preparedCombatSection: ReactNode;
  onContentContextMenu: (event: ReactMouseEvent<HTMLElement>) => void;
  onCreatePlayerFacingCard: () => void;
  onDeletePlayerFacingCard: (card: PlayerFacingCard, index: number) => void;
  onEditEntity: (section?:string) => void;
  onEditWithAI?: () => void;
  onEditPlayerFacingCard: (card: PlayerFacingCard, index: number) => void;
  onOpenEntityActionMenu: (event: ReactMouseEvent<HTMLElement>) => void;
  onOpenEntityImage?: (entity: KnowledgeEntity, displayUrl?: string) => void;
  onOpenGallery: () => void;
  onOpenGalleryAlbum: (ownerId: string, ownerTitle: string, items: GalleryImage[], index: number) => void;
  onOpenGalleryViewer: (index: number) => void;
  onOpenNpcQuestModal: () => void;
  onOpenPlayerFacingCard: (card: PlayerFacingCard, index: number) => void;
  onOpenPlaylistEditor: () => void;
  onOpenPreview: () => void;
  onOpenRelatedEntity: (item: RelatedEntity) => void;
  onOpenShop: (shopId: string) => void;
  onPeekQuest: (questId: string) => void;
  onPlayNextPlaylistTrack: () => void;
  onPlayPlaylist: (index?: number, advanceIfActive?: boolean) => void;
  onResolveRelatedEntity: (item: Pick<RelatedEntity, "id" | "label">) => KnowledgeEntity | null;
  onStopPlayback: () => void;
  onTogglePin: () => void;
  readOnly?: boolean;
};

const formatShopNumber = (value: number) =>
  new Intl.NumberFormat("ru-RU", { maximumFractionDigits: value % 1 === 0 ? 0 : 2 }).format(value);

const formatShopGold = (value: number) => `${formatShopNumber(value)} зм`;

const resolveShopEntryPrice = (entry: CampaignShop["inventory"][number]) =>
  entry.priceMode === "manual" ? entry.manualPriceGp ?? null : entry.itemPriceGp ?? null;

const resolveShopInventoryTotal = (shop: CampaignShop) =>
  shop.inventory.reduce((total, entry) => {
    const price = resolveShopEntryPrice(entry);
    return price == null ? total : total + price * (entry.quantity ?? 1);
  }, 0);

function ShopRelationIcon() {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.75
  };

  return (
    <svg aria-hidden="true" className="location-shop-icon-svg" viewBox="0 0 20 20">
      <path {...common} d="M4.2 8.1h11.6l-1-3.4H5.2l-1 3.4Z" />
      <path {...common} d="M5.5 8.1v7.2h9V8.1" />
      <path {...common} d="M7.2 15.3v-4h2.2v4M11.2 11.3h1.9" />
    </svg>
  );
}

const hasDescription = (value: string) => Boolean(value.trim() && value.trim() !== "Описание пока не заполнено.");

function MasterKnowledgeCard({
  content,
  entityByTitle,
  onContextMenu,
  onMentionClick,
  title = "Информация для мастера",
  action
}: {
  content: string;
  entityByTitle: Map<string, KnowledgeEntity>;
  onContextMenu: (event: ReactMouseEvent<HTMLElement>) => void;
  onMentionClick: (id: string) => void;
  title?: string;
  action?: ReactNode;
}) {
  return (
    <section className="master-knowledge-reading" onContextMenu={onContextMenu}>
      <header className="record-block-heading"><h2>{title}</h2>{action}</header>
      {hasDescription(content) ? <RichParagraphs content={content} entityByTitle={entityByTitle} onMentionClick={onMentionClick} /> : <p className="copy">Сведения мастера пока не добавлены.</p>}
    </section>
  );
}

export function EntityDetailsRenderer({
  activeEntity,
  activeEntityPinned,
  activeEntityPlayerCards,
  activeNpcQuests,
  composeVisibleQuickFacts,
  currentPlaybackTrackLabel,
  currentPlaybackTrackUrl,
  entityByTitle,
  isEntityPlaylistActive,
  locationShops,
  onCopyImageLink,
  preparedCombatSection,
  onContentContextMenu,
  onCreatePlayerFacingCard,
  onDeletePlayerFacingCard,
  onEditEntity,
  onEditWithAI,
  onEditPlayerFacingCard,
  onOpenEntityActionMenu,
  onOpenEntityImage,
  onOpenGallery,
  onOpenGalleryAlbum,
  onOpenGalleryViewer,
  onOpenNpcQuestModal,
  onOpenPlayerFacingCard,
  onOpenPlaylistEditor,
  onOpenPreview,
  onOpenRelatedEntity,
  onOpenShop,
  onPeekQuest,
  onPlayNextPlaylistTrack,
  onPlayPlaylist,
  onResolveRelatedEntity,
  onStopPlayback,
  onTogglePin,
  readOnly = false
}: EntityDetailsRendererProps) {
  const visibleFacts = composeVisibleQuickFacts(activeEntity);
  const combatProfileEntity =
    activeEntity.kind === "player" || activeEntity.kind === "npc" || activeEntity.kind === "monster" ? activeEntity : null;
  const monsterGalleryAlbum = activeEntity.kind === "monster" ? buildEntityGalleryAlbum(activeEntity) : [];
  const dossierKind = activeEntity.kind === "player" || activeEntity.kind === "npc" || activeEntity.kind === "location" ? activeEntity.kind : null;
  const dossierLinks =
    activeEntity.kind === "npc"
      ? [
          ["npc-summary", "Сводка"],
          ["npc-handouts", "Игроки видят"],
          ["npc-quests", "Квесты"],
          ["npc-media", "Медиа"],
          ["npc-master-notes", "Мастеру"],
          ["record-relations", "Связи"],
          ["npc-stats", "Характеристики"]
        ]
      : activeEntity.kind === "location"
        ? [
            ["location-summary", "Сводка"],
            ["location-handouts", "Игроки видят"],
            ["location-shops", "Магазины"],
            ["location-media", "Медиа"],
            ["location-master-notes", "Мастеру"],
            ["record-relations", "Связи"]
          ]
        : [
            ["player-summary", "Сводка"],
            ["player-handouts", "Игроки видят"],
            ["player-media", "Медиа"],
            ["player-master-notes", "Мастеру"],
            ["record-relations", "Связи"],
            ["player-stats", "Характеристики"]
          ];

  const rewardProfile = isRewardableEntity(activeEntity) ? activeEntity.rewardProfile : undefined;
  const rewardsSection = !isRewardableEntity(activeEntity) ? null : rewardProfile?.summary || rewardProfile?.loot.length ? (
    <RewardSection kind={activeEntity.kind} rewardProfile={rewardProfile} action={!readOnly && <button className="ghost record-edit-action" type="button" onClick={() => onEditEntity("rewards")}>Редактировать награды</button>} />
  ) : !readOnly ? (
    <section className="record-empty-section">
      <header className="record-block-heading"><h2>Награды и добыча</h2><button className="ghost record-edit-action" type="button" onClick={() => onEditEntity("rewards")}>Добавить награды</button></header>
      <p className="copy">Награды за помощь, трофеи и другие находки.</p>
    </section>
  ) : null;

  const jumpToSection = (event: ReactMouseEvent<HTMLAnchorElement>, id: string) => {
    const target = event.currentTarget.closest(".entity-dossier-layout")?.querySelector<HTMLElement>(`#${id}`);
    if (!target) return;
    event.preventDefault();
    target.querySelector<HTMLButtonElement>(".collapsible-toggle[aria-expanded='false']")?.click();
    requestAnimationFrame(() => {
      target.scrollIntoView({ block: "start", behavior: "instant" });
      target.focus({ preventScroll: true });
    });
  };

  if (activeEntity.kind === "monster" && combatProfileEntity) {
    const openMonsterAlbum = () => {
      if (monsterGalleryAlbum.length) {
        onOpenGalleryAlbum(activeEntity.id, activeEntity.title, monsterGalleryAlbum, 0);
        return;
      }

      onOpenGallery();
    };
    const openMonsterImage = onOpenEntityImage
      ? () => onOpenEntityImage(activeEntity, monsterGalleryAlbum[0]?.url)
      : openMonsterAlbum;

    return (
      <div className="stack wide entity-details-page monster-details-page">
        <div id="monster-combat" onContextMenu={onOpenEntityActionMenu}>
          {!readOnly&&<button className="ghost record-edit-action" type="button" onClick={()=>onEditEntity("stats")}>Редактировать характеристики</button>}
          <CombatEntityStatSheet
            action={readOnly ? undefined : (
              <div className="npc-sheet-toolbar">
                <button className="ghost" onClick={openMonsterAlbum} type="button">
                  {monsterGalleryAlbum.length ? `Альбом (${monsterGalleryAlbum.length})` : "Добавить арт"}
                </button>
                <button className="ghost" onClick={onOpenGallery} type="button">
                  {monsterGalleryAlbum.length ? "Изменить альбом" : "Галерея"}
                </button>
                <button className="primary" onClick={()=>onEditEntity()} type="button">
                  Редактировать
                </button>
                {onEditWithAI ? (
                  <button className="ghost ai-edit-button" onClick={onEditWithAI} type="button">
                    Изменить с AI
                  </button>
                ) : null}
                <button className="ghost" onClick={onTogglePin} type="button">
                  {activeEntityPinned ? "Убрать закладку" : "В закладки"}
                </button>
                <button className="ghost" onClick={onOpenPreview} type="button">
                  Быстрый просмотр
                </button>
              </div>
            )}
            defaultCollapsed={false}
            entity={combatProfileEntity}
            expandSections
            onOpenPortraitGallery={openMonsterImage}
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

        <nav aria-label="Быстрые переходы по карточке монстра" className="player-details-jumpbar monster-details-jumpbar">
          <span>Быстро найти</span>
          <a href="#monster-combat">Боевой профиль</a>
          <a href="#monster-notes">Заметки</a>
          <a href="#monster-loot">Добыча</a>
          <a href="#monster-description">Описание</a>
        </nav>

        <div id="monster-notes">
        <PlayerFacingCardStrip
          cards={activeEntityPlayerCards}
          cardBadgeLabel="GM-only"
          cardBadgeTone="warning"
          contextMenuLabel="Заметка мастера"
          countLabel={activeEntityPlayerCards.length ? `${activeEntityPlayerCards.length} заметок` : "Заметки нужны"}
          createDescription="Короткая тактическая шпаргалка, скрытая заметка или подсказка для мастера. Откроется сразу в режиме редактирования."
          description="Храни здесь заметки мастера: тактику, фазы боя, скрытые триггеры и любые рабочие карточки, которые удобно открывать по одной."
          emptyDescription="Пока заметок нет. Создай первую карточку, чтобы быстро открывать подсказки мастера прямо во время сцены."
          emptyStateTitle="Заметок пока нет"
          entityId={activeEntity.id}
          onCreateCard={onCreatePlayerFacingCard}
          onDeleteCard={onDeletePlayerFacingCard}
          onEditCard={onEditPlayerFacingCard}
          onOpenCard={onOpenPlayerFacingCard}
          readOnly={readOnly}
          title="Заметки мастера"
        />
        </div>

        <div id="monster-loot">
          {rewardsSection}
        </div>

        <div id="monster-description">
      <MasterKnowledgeCard
          action={!readOnly&&<button className="ghost record-edit-action" type="button" onClick={()=>onEditEntity("content")}>{hasDescription(activeEntity.content)?"Редактировать сведения мастера":"Добавить сведения мастера"}</button>}
          content={activeEntity.content}
          entityByTitle={entityByTitle}
          onContextMenu={onContentContextMenu}
          onMentionClick={onOpenPreview}
          title="Описание и заметки мастера"
        />
        </div>
      </div>
    );
  }

  return (
    <div className={`stack wide entity-details-page ${dossierKind ? `${dossierKind}-details-page` : ""}`.trim()}>
      <div className={`record-intro ${activeEntity.kind === "npc" ? `npc-dossier-intro ${activeEntity.art?.url ? "has-portrait" : ""}` : ""}`} id={dossierKind ? `${dossierKind}-summary` : undefined} tabIndex={-1}>
      <section
        className={`card hero record-hero ${activeEntity.art?.url ? "record-with-art" : ""}`}
        data-long-title={activeEntity.title.length > 64 || undefined}
        onContextMenu={onOpenEntityActionMenu}
      >
        <div className="hero-head">
          <div className="hero-copy-block">
            <h1>{activeEntity.title}</h1>
            <div className="hero-tags">
              <span className={badge("accent")}>{kindTitle[activeEntity.kind]}</span>
              {activeEntity.tags.map((tag) => (
                <span key={tag} className={badge()}>
                  {tag}
                </span>
              ))}
            </div>
            {activeEntity.subtitle && <p className="hero-subtitle">{activeEntity.subtitle}</p>}
          </div>
        </div>

        {!readOnly ? <div className="actions record-actions">
          <button className="primary" onClick={()=>onEditEntity()} type="button">Редактировать</button>
          <details className="record-actions-more"><summary aria-label="Другие действия с записью">Действия</summary><div>
            {onEditWithAI ? <button className="ghost" onClick={onEditWithAI} type="button">Изменить с AI</button> : null}
            <button className="ghost" onClick={onTogglePin} type="button">{activeEntityPinned ? "Убрать закладку" : "В закладки"}</button>
            <button className="ghost" onClick={onOpenPreview} type="button">Быстрый просмотр</button>
            {activeEntity.playlist?.length ? <button className="ghost" onClick={() => onPlayPlaylist()} type="button">{isEntityPlaylistActive(activeEntity.id) ? "Следующий трек" : "Случайный трек"}</button> : null}
          </div></details>
        </div> : null}
      </section>
      <RecordIllustration key={activeEntity.art?.url||activeEntity.id} url={activeEntity.art?.url} title={activeEntity.title} alt={activeEntity.art?.alt||activeEntity.art?.caption} onReplace={readOnly?undefined:()=>onEditEntity("art")} onGallery={readOnly?undefined:onOpenGallery}/>
      <section className="record-overview" aria-label="Краткое описание">
        <header className="record-block-heading"><h2>Кратко</h2>{!readOnly&&<button className="ghost record-edit-action" type="button" onClick={()=>onEditEntity("summary")}>{hasDescription(activeEntity.summary)?"Редактировать описание":"Добавить описание"}</button>}</header>
        {hasDescription(activeEntity.summary) ? <p className="record-summary">{activeEntity.summary}</p> : <p className="copy">Добавьте роль в истории и главное, что стоит помнить об этой записи.</p>}
      </section>
      {visibleFacts.length ? <dl className="record-facts">
        {visibleFacts.map(fact => <div key={fact.label}><dt>{fact.label}</dt><dd className={toneClass[fact.tone ?? "default"]}>{({Tense:"Напряжённо",Safe:"Безопасно",Dangerous:"Опасно",Deadly:"Смертельно",Site:"Место",City:"Город",Region:"Регион",Dungeon:"Подземелье",POI:"Точка интереса",Active:"Активно",Reserve:"Резерв",Guest:"Гость",Critical:"Ключевой",Ally:"Союзник",Threat:"Угроза",Unknown:"Не определён",Neutral:"Нейтральный",Hostile:"Враждебный",Friendly:"Дружелюбный"} as Record<string,string>)[fact.value]||fact.value}</dd></div>)}
      </dl> : null}
      </div>
      {dossierKind ? (
        <nav aria-label="Быстрые переходы по карточке" className="player-details-jumpbar">
          <span>Разделы досье</span>
          {dossierLinks.map(([id, label]) => (
            <a key={id} href={`#${id}`} onClick={event=>jumpToSection(event,id)}>{label}</a>
          ))}
        </nav>
      ) : null}

      <div id={dossierKind ? `${dossierKind}-master-notes` : undefined} tabIndex={-1}>
      <MasterKnowledgeCard
        action={!readOnly&&<button className="ghost record-edit-action" type="button" onClick={()=>onEditEntity("content")}>{hasDescription(activeEntity.content)?"Редактировать сведения мастера":"Добавить сведения мастера"}</button>}
        content={activeEntity.content}
        entityByTitle={entityByTitle}
        onContextMenu={onContentContextMenu}
        onMentionClick={onOpenPreview}
      />
      </div>

      <div id={dossierKind ? `${dossierKind}-handouts` : undefined} tabIndex={-1}>
        <PlayerFacingCardStrip
          cards={activeEntityPlayerCards}
          createDescription="Внешность, реплика или описание сцены — текст, который можно показать или зачитать игрокам."
          description={
            activeEntity.kind === "location"
              ? "Описания сцен и материалы, которые можно показать игрокам."
              : "Внешность, реплики и подсказки без секретов мастера."
          }
          emptyDescription="Пока карточек нет. Создай первую, и она сразу появится в отдельном удобном просмотре для зачитывания игрокам."
          entityId={activeEntity.id}
          onCreateCard={onCreatePlayerFacingCard}
          onDeleteCard={onDeletePlayerFacingCard}
          onEditCard={onEditPlayerFacingCard}
          onOpenCard={onOpenPlayerFacingCard}
          readOnly={readOnly}
        />
      </div>

      {preparedCombatSection}

      {activeEntity.foundryCharacter ? (
        <section className="panel" aria-label="Импортированный лист Foundry">
          <h2>Лист Foundry</h2>
          <p>Импортированные постоянные параметры. Выборы нашего конструктора не восстановлены; текущее состояние боя остаётся в Foundry.</p>
          <p>HP: {activeEntity.foundryCharacter.maxHp} · КД: {activeEntity.foundryCharacter.armorClass} · Скорость: {activeEntity.foundryCharacter.speed}</p>
          <p>{Object.entries(activeEntity.foundryCharacter.abilities).map(([name,value]) => `${name.toUpperCase()}: ${value}`).join(" · ")}</p>
          {activeEntity.foundryCharacter.items.map((item,index) => (
            <details key={`${item.id}-${index}`}><summary>{item.name}</summary><RichParagraphs content={item.description} entityByTitle={entityByTitle} onMentionClick={onOpenPreview} /></details>
          ))}
        </section>
      ) : null}

      {activeEntity.kind === "location" ? (
        <div id="location-shops" tabIndex={-1}>
        <CollapsibleSection
          key={`${activeEntity.id}-shops`}
          defaultCollapsed={!locationShops.length}
          hint="Торговые точки, привязанные к этой локации"
          summary={
            <p className="copy">
              {locationShops.length ? `${locationShops.length} магазинов в этой локации.` : "Магазинов в этой локации пока нет."}
            </p>
          }
          title="Магазины локации"
        >
          {locationShops.length ? (
            <div className="location-shop-grid">
              {locationShops.map((shop) => {
                const total = resolveShopInventoryTotal(shop);
                return (
                  <button
                    key={shop.id}
                    className="location-shop-card"
                    onClick={() => onOpenShop(shop.id)}
                    type="button"
                  >
                    <span className="location-shop-mark">
                      <ShopRelationIcon />
                    </span>
                    <span className="location-shop-copy">
                      <strong>{shop.name}</strong>
                      <small>{shop.inventory.length} товаров</small>
                      {shop.description ? <span>{shop.description}</span> : null}
                    </span>
                    <span className="location-shop-meta">
                      <b>{total > 0 ? formatShopGold(total) : "без цен"}</b>
                      <small>витрина</small>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="copy">Привяжи магазин к этой локации во вкладке “Магазин”, и он появится здесь как связанная торговая точка.</p>
          )}
        </CollapsibleSection>
        </div>
      ) : null}

      <div className="player-detail-media-grid" id={dossierKind ? `${dossierKind}-media` : undefined} tabIndex={-1}>
      <PlaylistSection
        action={readOnly ? undefined : (
          <button className="ghost" onClick={onOpenPlaylistEditor} type="button">
            {(activeEntity.playlist??[]).length?"Редактировать плейлист":"Добавить музыку"}
          </button>
        )}
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
        action={readOnly ? undefined : (
          <button className="ghost" onClick={onOpenGallery} type="button">
            {(activeEntity.gallery??[]).length?"Редактировать галерею":"Добавить изображения"}
          </button>
        )}
        defaultCollapsed={!(activeEntity.gallery ?? []).length}
        hint="Карты, письма, handout-арты и любые изображения, которые можно быстро показать игрокам"
        items={activeEntity.gallery ?? []}
        onCopyLink={onCopyImageLink}
        onOpenFullscreen={onOpenGalleryViewer}
        title="Галерея"
      />
      </div>

      {activeEntity.kind === "npc" ? (
        <div id="npc-quests" tabIndex={-1}>
        <CollapsibleSection
          key={`${activeEntity.id}-quests`}
          defaultCollapsed={!activeNpcQuests.length}
          action={readOnly ? undefined : (
            <button className="ghost" onClick={onOpenNpcQuestModal} type="button">
              Создать квест
            </button>
          )}
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
                <article key={quest.id} className="card mini fill relation-card relation-card-with-visual">
                  <EntityVisual entity={quest} onOpenEntityImage={onOpenEntityImage} variant="relation" />
                  <button className="relation-card-body" onClick={() => onPeekQuest(quest.id)} type="button">
                    <span className={badge("warning")}>Квест</span>
                    <strong>{quest.title}</strong>
                    <p>{quest.summary}</p>
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <p className="copy">
              Пока этот НПС не привязан ни к одному квесту. Кнопка сверху сразу создаст новый квест с обратной ссылкой.
            </p>
          )}
        </CollapsibleSection>
        </div>
      ) : null}

      {rewardsSection}

      <div id={dossierKind ? `${dossierKind}-stats` : undefined} tabIndex={-1}>
        {combatProfileEntity ? (<>
          {!combatProfileEntity.statBlock ? <section className="record-empty-section"><header className="record-block-heading"><h2>Характеристики</h2>{!readOnly&&<button className="ghost record-edit-action" type="button" onClick={()=>onEditEntity("stats")}>Добавить характеристики</button>}</header><p className="copy">Боевой профиль пока не добавлен.</p></section> : <CombatEntityStatSheet
            action={!readOnly&&<button className="ghost record-edit-action" type="button" onClick={()=>onEditEntity("stats")}>Редактировать характеристики</button>}
            entity={combatProfileEntity}
            onOpenPortraitGallery={
              onOpenEntityImage
                ? () => onOpenEntityImage(combatProfileEntity, combatProfileEntity.art?.url?.trim() || undefined)
                : undefined
            }
            portraitActionLabel={onOpenEntityImage ? "Нажми на портрет, чтобы открыть изображение и действия." : undefined}
          />}
        </>) : null}
      </div>
    </div>
  );
}

export function EntityDetailsPage(props: EntityDetailsRendererProps) {
  const route = useWorkspaceRoute();

  return <div className="entity-dossier-layout">
    <EntityDetailsRenderer {...props} />
    <aside tabIndex={-1} id="record-relations" className="record-context" aria-label="Связи записи">
      <EntityRelationsPanel campaignId={route.campaignId||""} ownerId={props.ownerId||""} entity={props.activeEntity} onResolve={props.onResolveRelatedEntity} onOpen={props.onOpenRelatedEntity} onChanged={props.onCampaignChanged}/>
      {props.activeEntity.kind === "location" ? <section><h3>Карта и сцена</h3><p className="copy">Откройте атлас или создайте карту для этого места.</p><a className="ghost record-map-action" href={workspaceURL({campaignId: route.campaignId, section: "maps", view: "new", context: JSON.stringify({locationId: props.activeEntity.id})})}>Открыть карты и сцены</a></section> : null}
      {props.activeNpcQuests.length ? <section><h3>Квесты НПС</h3>{props.activeNpcQuests.map(quest => <button className="record-context-link" type="button" key={quest.id} onClick={() => props.onPeekQuest(quest.id)}><span><strong>{quest.title}</strong><small>{quest.summary}</small></span></button>)}</section> : null}
      <small className="record-context-state">{props.readOnly ? "Готовая кампания · материалы защищены, связи хранятся в прохождении" : "Сохранённая запись · изменения через редактор"}</small>
    </aside>
  </div>;
}
