import type { MouseEvent as ReactMouseEvent } from "react";
import type {
  EntityKind,
  KnowledgeEntity,
  LocationEntity,
  ModuleId,
  NpcEntity,
  QuestEntity
} from "@shadow-edge/shared-types";
import {
  badge,
  createPortraitSource,
  gradients,
  hasVisibleArt,
  kindTitle,
  sigil,
  truncateInlineText
} from "../app-shared";
import { usePageSearchHotkey } from "./hooks/usePageSearchHotkey";
import { resolveQuestSceneArtwork, questStatusTone, type QuestCombatEntrySummary } from "../quests";

type EntityDirectoryScreenProps = {
  activeModule: ModuleId;
  activeSectionLabel: string;
  defaultCreateKind: EntityKind;
  moduleDirectoryEntities: KnowledgeEntity[];
  moduleEntitySearch: string;
  onChangeSearch: (value: string) => void;
  onOpenEntity: (entityId: string) => void;
  onOpenEntityActionMenu: (entity: KnowledgeEntity, event: ReactMouseEvent<HTMLElement>) => void;
  onOpenEntityImage?: (entity: KnowledgeEntity, displayUrl?: string) => void;
  onOpenEntityModal: (kind: EntityKind) => void;
  onOpenQuestFocus: (questId: string) => void;
  onOpenRandomEventModal: () => void;
  resolveQuestIssuer: (quest: QuestEntity) => NpcEntity | null;
  resolveQuestLocation: (quest: QuestEntity) => LocationEntity | null;
  resolveQuestPreparedCombatEntries: (quest: QuestEntity) => QuestCombatEntrySummary[];
};

export function EntityDirectoryScreen({
  activeModule,
  activeSectionLabel,
  defaultCreateKind,
  moduleDirectoryEntities,
  moduleEntitySearch,
  onChangeSearch,
  onOpenEntity,
  onOpenEntityActionMenu,
  onOpenEntityImage,
  onOpenEntityModal,
  onOpenQuestFocus,
  onOpenRandomEventModal,
  resolveQuestIssuer,
  resolveQuestLocation,
  resolveQuestPreparedCombatEntries
}: EntityDirectoryScreenProps) {
  const searchInputRef = usePageSearchHotkey<HTMLInputElement>();

  return (
    <div className="stack wide">
      <section className="card section-card directory-screen">
        <div className="directory-head">
          <div>
            <p className="eyebrow">{activeSectionLabel}</p>
            <h2>Выбери запись</h2>
            <p className="copy">Сначала показываю весь список по разделу. Когда выберешь сущность, здесь откроется её полноценная страница.</p>
          </div>
          <div className="actions">
            {activeModule === "quests" ? (
              <button className="ghost" onClick={onOpenRandomEventModal} type="button">
                Сцена для зачитки
              </button>
            ) : null}
            <button className="primary" onClick={() => onOpenEntityModal(defaultCreateKind)} type="button">
              Создать сущность
            </button>
          </div>
        </div>

        <label className="field">
          <span>Поиск</span>
          <input
            className="input"
            ref={searchInputRef}
            onChange={(event) => onChangeSearch(event.target.value)}
            placeholder={`Поиск по разделу «${activeSectionLabel}»`}
            value={moduleEntitySearch}
          />
        </label>

        {moduleDirectoryEntities.length ? (
          <div className="directory-grid">
            {activeModule === "quests"
              ? moduleDirectoryEntities
                  .filter((entity): entity is QuestEntity => entity.kind === "quest")
                  .map((quest) => {
                    const location = resolveQuestLocation(quest);
                    const issuer = resolveQuestIssuer(quest);
                    const preparedEntries = resolveQuestPreparedCombatEntries(quest);
                    const preparedCombatCount = preparedEntries.reduce((sum, item) => sum + item.quantity, 0);
                    const sceneImage = resolveQuestSceneArtwork(quest, location, issuer, preparedEntries);

                    return (
                      <article
                        key={quest.id}
                        className="directory-card quest-directory-card"
                        onContextMenu={(event) => onOpenEntityActionMenu(quest, event)}
                      >
                        <button
                          aria-haspopup={onOpenEntityImage ? "dialog" : undefined}
                          aria-label={onOpenEntityImage ? `Открыть изображение «${quest.title}»` : undefined}
                          className={`directory-card-thumb ${onOpenEntityImage ? "entity-image-trigger" : ""}`.trim()}
                          disabled={!onOpenEntityImage}
                          onClick={() => onOpenEntityImage?.(quest, sceneImage)}
                          title={onOpenEntityImage ? `Открыть изображение «${quest.title}»` : undefined}
                          type="button"
                        >
                          <img alt={quest.title} className="directory-card-image" loading="lazy" src={sceneImage} />
                        </button>
                        <button className="directory-card-copy" onClick={() => onOpenQuestFocus(quest.id)} type="button">
                          <span className="directory-card-topline">
                            <strong>{quest.title}</strong>
                            <span className={badge(questStatusTone(quest.status))}>{quest.status}</span>
                          </span>
                          <small>{location?.title ?? issuer?.title ?? quest.subtitle}</small>
                          <p>{truncateInlineText(quest.summary, 150)}</p>
                          <span className="directory-meta">
                            <span>{quest.urgency}</span>
                            {preparedCombatCount ? <span>{preparedCombatCount} в бою</span> : null}
                          </span>
                        </button>
                      </article>
                    );
                  })
              : moduleDirectoryEntities.map((entity) => {
                  const displayUrl = hasVisibleArt(entity.art) ? createPortraitSource(entity) : undefined;
                  return (
                    <article
                      key={entity.id}
                      className="directory-card"
                      onContextMenu={(event) => onOpenEntityActionMenu(entity, event)}
                    >
                      <button
                        aria-haspopup={onOpenEntityImage ? "dialog" : undefined}
                        aria-label={onOpenEntityImage ? `Открыть изображение «${entity.title}»` : undefined}
                        className={`directory-card-thumb ${onOpenEntityImage ? "entity-image-trigger" : ""}`.trim()}
                        disabled={!onOpenEntityImage}
                        onClick={() => onOpenEntityImage?.(entity, displayUrl)}
                        title={onOpenEntityImage ? `Открыть изображение «${entity.title}»` : undefined}
                        type="button"
                      >
                        {displayUrl ? (
                          <img alt={entity.title} className="directory-card-image" loading="lazy" src={displayUrl} />
                        ) : (
                          <span className="sigil big" style={{ backgroundImage: gradients[entity.kind] }}>
                            {sigil(entity.title)}
                          </span>
                        )}
                      </button>
                      <button className="directory-card-copy" onClick={() => onOpenEntity(entity.id)} type="button">
                        <span className="directory-card-topline">
                          <strong>{entity.title}</strong>
                          <span className={badge()}>{kindTitle[entity.kind]}</span>
                        </span>
                        <small>{entity.subtitle}</small>
                        <p>{truncateInlineText(entity.summary, 150)}</p>
                      </button>
                    </article>
                  );
                })}
          </div>
        ) : (
          <div className="directory-empty">
            <h3>Ничего не найдено</h3>
            <p className="copy">Либо в разделе пока нет записей, либо текущий поиск/фильтр ничего не дал.</p>
          </div>
        )}
      </section>
    </div>
  );
}
