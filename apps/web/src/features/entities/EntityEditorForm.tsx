import type {
  CampaignData,
  CreateEntityInput,
  EntityKind
} from "@shadow-edge/shared-types";
import { badge } from "../../app-shared";
import { PlayerFacingFormattingIndicator } from "../../quests";
import { GalleryEditorSection, PlaylistEditorSection } from "../../media";
import { sanitizePartyLevel } from "../combat/combat.utils";
import { defaultPlayerFacingCardTitle } from "../player-facing/usePlayerFacingCards";
import { EntityArtEditor } from "./EntityArtEditor";
import { EntityPreparedCombatEditor } from "./EntityPreparedCombatEditor";
import { EntityRewardEditor } from "./EntityRewardEditor";
import { EntityStatBlockEditor } from "./EntityStatBlockEditor";
import {
  acceptedPlayerFacingHtmlUploadTypes,
  emptyEntityForm
} from "./entity.utils";
import type { EntityTextField } from "./entity.types";
import type { EntityEditorController } from "./useEntityEditorController";

type EntityEditorFormProps = {
  campaign: CampaignData | null;
  controller: EntityEditorController;
  onContentContextMenu: (field: EntityTextField, event: React.MouseEvent<HTMLTextAreaElement>) => void;
};

export function EntityEditorForm({
  campaign,
  controller,
  onContentContextMenu
}: EntityEditorFormProps) {
  const {
    addEntityGalleryItem,
    addEntityPlayerCard,
    addEntityPlaylistTrack,
    autoFormatEntityPlayerCard,
    clearEntityPlayerCardHtml,
    entityContentRef,
    entityForm,
    entityModalMode,
    entityPlayerContentRef,
    galleryUploadKey,
    handleEntityPlayerCardHtmlImport,
    isEditingEntity,
    openEntityPlayerCardHtmlImport,
    pasteEntityPlayerCardHtmlFromClipboard,
    playerCardFormattingIndex,
    playerCardImportInputRefs,
    removeEntityGalleryItem,
    removeEntityPlayerCard,
    removeEntityPlaylistTrack,
    setDraftPrompt,
    setEntityForm,
    setGeneratedQuestIssuerDraft,
    setGeneratedQuestIssuerNote,
    updateEntityForm,
    updateEntityGalleryItem,
    updateEntityPlayerCard,
    updateEntityPlaylistTrack,
    uploadEntityGalleryFile
  } = controller;

  return (
    <div className="form-grid">
      <label className="field">
        <span>Тип</span>
        <select
          className="input"
          disabled={isEditingEntity}
          onChange={(event) => {
            setGeneratedQuestIssuerDraft(null);
            setGeneratedQuestIssuerNote("");
            setDraftPrompt("");
            setEntityForm(emptyEntityForm(event.target.value as EntityKind));
          }}
          value={entityForm.kind}
        >
          <option value="location">Локация</option>
          <option value="player">Игрок</option>
          <option value="npc">НПС</option>
          <option value="monster">Монстр</option>
          <option value="quest">Квест</option>
          <option value="lore">Лор</option>
        </select>
      </label>
      <label className="field">
        <span>Название</span>
        <input
          className="input"
          onChange={(event) => setEntityForm((current) => ({ ...current, title: event.target.value }))}
          value={entityForm.title}
        />
      </label>
      <label className="field">
        <span>Подзаголовок</span>
        <input
          className="input"
          onChange={(event) => setEntityForm((current) => ({ ...current, subtitle: event.target.value }))}
          value={entityForm.subtitle}
        />
      </label>
      <label className="field">
        <span>Теги</span>
        <input
          className="input"
          onChange={(event) =>
            setEntityForm((current) => ({
              ...current,
              tags: event.target.value
                .split(",")
                .map((tag) => tag.trim())
                .filter(Boolean)
            }))
          }
          placeholder="порт, тьма, север"
          value={(entityForm.tags ?? []).join(", ")}
        />
      </label>

      <EntityArtEditor controller={controller} />

      {entityModalMode === "create" ? (
        <div className="field field-full">
          <PlaylistEditorSection
            hint="Во время создания можно сразу добавить музыку сцены. Для уже существующей сущности плейлист редактируется отдельно маленькой модалкой прямо из её карточки."
            onAdd={addEntityPlaylistTrack}
            onChange={updateEntityPlaylistTrack}
            onRemove={removeEntityPlaylistTrack}
            title="Плейлист сущности"
            tracks={entityForm.playlist ?? []}
          />
        </div>
      ) : null}
      {entityModalMode === "create" ? (
        <div className="field field-full">
          <GalleryEditorSection
            hint="Во время создания можно сразу прикрепить карты, письма, handout-арты и любые другие изображения. Для существующей сущности галерея потом редактируется отдельной маленькой модалкой."
            items={entityForm.gallery ?? []}
            onAdd={addEntityGalleryItem}
            onChange={updateEntityGalleryItem}
            onRemove={removeEntityGalleryItem}
            onUpload={uploadEntityGalleryFile}
            title="Галерея сущности"
            uploadDisabled={galleryUploadKey.startsWith("entity-form:")}
            uploadingIndex={galleryUploadKey.startsWith("entity-form:") ? Number.parseInt(galleryUploadKey.split(":")[1] ?? "-1", 10) : null}
          />
        </div>
      ) : null}

      {entityForm.kind === "location" ? (
        <>
          <label className="field">
            <span>Категория</span>
            <select
              className="input"
              onChange={(event) => setEntityForm((current) => ({ ...current, category: event.target.value as CreateEntityInput["category"] }))}
              value={entityForm.category ?? "City"}
            >
              <option value="City">City</option>
              <option value="Region">Region</option>
              <option value="Dungeon">Dungeon</option>
              <option value="POI">POI</option>
            </select>
          </label>
          <label className="field">
            <span>Регион</span>
            <input
              className="input"
              onChange={(event) => setEntityForm((current) => ({ ...current, region: event.target.value }))}
              value={entityForm.region ?? ""}
            />
          </label>
          <label className="field">
            <span>Опасность</span>
            <select
              className="input"
              onChange={(event) => setEntityForm((current) => ({ ...current, danger: event.target.value as CreateEntityInput["danger"] }))}
              value={entityForm.danger ?? "Tense"}
            >
              <option value="Safe">Safe</option>
              <option value="Tense">Tense</option>
              <option value="Dangerous">Dangerous</option>
              <option value="Deadly">Deadly</option>
            </select>
          </label>
        </>
      ) : null}

      {entityForm.kind === "player" ? (
        <>
          <label className="field">
            <span>Уровень</span>
            <input
              className="input"
              inputMode="numeric"
              max={20}
              min={1}
              onChange={(event) =>
                setEntityForm((current) => ({
                  ...current,
                  level: event.target.value ? sanitizePartyLevel(Number.parseInt(event.target.value, 10)) : undefined
                }))
              }
              placeholder="Например: 3"
              type="number"
              value={entityForm.level ?? ""}
            />
          </label>
          <label className="field">
            <span>Роль</span>
            <input
              className="input"
              onChange={(event) => setEntityForm((current) => ({ ...current, role: event.target.value }))}
              placeholder="Например: паладин, вор, маг, лицо партии"
              value={entityForm.role ?? ""}
            />
          </label>
          <label className="field">
            <span>Статус</span>
            <select
              className="input"
              onChange={(event) => setEntityForm((current) => ({ ...current, status: event.target.value as CreateEntityInput["status"] }))}
              value={entityForm.status ?? "Active"}
            >
              <option value="Active">Active</option>
              <option value="Reserve">Reserve</option>
              <option value="Guest">Guest</option>
            </select>
          </label>
        </>
      ) : null}

      {entityForm.kind === "npc" || entityForm.kind === "monster" ? (
        <>
          <label className="field">
            <span>Роль</span>
            <input
              className="input"
              onChange={(event) => setEntityForm((current) => ({ ...current, role: event.target.value }))}
              value={entityForm.role ?? ""}
            />
          </label>
          <label className="field">
            <span>Статус</span>
            <select
              className="input"
              onChange={(event) => setEntityForm((current) => ({ ...current, status: event.target.value as CreateEntityInput["status"] }))}
              value={entityForm.status ?? (entityForm.kind === "monster" ? "Hostile" : "Unknown")}
            >
              {entityForm.kind === "monster" ? (
                <>
                  <option value="Hostile">Hostile</option>
                  <option value="Territorial">Territorial</option>
                  <option value="Summoned">Summoned</option>
                  <option value="Neutral">Neutral</option>
                </>
              ) : (
                <>
                  <option value="Unknown">Unknown</option>
                  <option value="Ally">Ally</option>
                  <option value="Watcher">Watcher</option>
                  <option value="Threat">Threat</option>
                </>
              )}
            </select>
          </label>
          <label className="field">
            <span>Важность</span>
            <select
              className="input"
              onChange={(event) => setEntityForm((current) => ({ ...current, importance: event.target.value as CreateEntityInput["importance"] }))}
              value={entityForm.importance ?? (entityForm.kind === "monster" ? "Standard" : "Major")}
            >
              {entityForm.kind === "monster" ? (
                <>
                  <option value="Minion">Minion</option>
                  <option value="Standard">Standard</option>
                  <option value="Elite">Elite</option>
                  <option value="Boss">Boss</option>
                </>
              ) : (
                <>
                  <option value="Background">Background</option>
                  <option value="Major">Major</option>
                  <option value="Critical">Critical</option>
                </>
              )}
            </select>
          </label>
          <label className="field">
            <span>Локация</span>
            <select
              className="input"
              onChange={(event) => setEntityForm((current) => ({ ...current, locationId: event.target.value || undefined }))}
              value={entityForm.locationId ?? ""}
            >
              <option value="">Не привязано</option>
              {(campaign?.locations ?? []).map((location) => (
                <option key={location.id} value={location.id}>
                  {location.title}
                </option>
              ))}
            </select>
          </label>
        </>
      ) : null}

      <EntityPreparedCombatEditor campaign={campaign} controller={controller} />

      {entityForm.kind === "lore" ? (
        <>
          <label className="field">
            <span>Категория</span>
            <select
              className="input"
              onChange={(event) => setEntityForm((current) => ({ ...current, category: event.target.value as CreateEntityInput["category"] }))}
              value={entityForm.category ?? "History"}
            >
              <option value="History">History</option>
              <option value="Rumor">Rumor</option>
              <option value="Religion">Religion</option>
              <option value="Threat">Threat</option>
            </select>
          </label>
          <label className="field">
            <span>Видимость</span>
            <select
              className="input"
              onChange={(event) => setEntityForm((current) => ({ ...current, visibility: event.target.value as CreateEntityInput["visibility"] }))}
              value={entityForm.visibility ?? "gm_only"}
            >
              <option value="gm_only">gm_only</option>
              <option value="player_safe">player_safe</option>
            </select>
          </label>
        </>
      ) : null}

      <label className="field field-full">
        <span>Краткое описание</span>
        <textarea
          className="input textarea"
          onChange={(event) => setEntityForm((current) => ({ ...current, summary: event.target.value }))}
          value={entityForm.summary}
        />
      </label>

      {entityForm.kind === "location" ? (
        <section className="card npc-section form-subsection field-full player-card-editor-section">
          <div className="row muted">
            <span>Карточки для игроков</span>
            <button className="ghost" onClick={addEntityPlayerCard} type="button">
              Добавить карточку
            </button>
          </div>
          <p className="copy">
            Каждую карточку можно назвать по-своему и потом отдельно открыть игрокам прямо со страницы локации.
          </p>

          <div className="player-card-editor-list">
            {(entityForm.playerCards ?? []).length ? (
              (entityForm.playerCards ?? []).map((card, index) => (
                <article key={`player-card-editor-${index}`} className="entry-card player-card-editor">
                  <div className="player-card-editor-header">
                    <strong>{card.title.trim() || defaultPlayerFacingCardTitle(entityForm.kind, index)}</strong>
                    <div className="player-card-editor-actions">
                      <button className="ghost" onClick={() => openEntityPlayerCardHtmlImport(index)} type="button">
                        Импорт HTML
                      </button>
                      <button className="ghost" onClick={() => void pasteEntityPlayerCardHtmlFromClipboard(index)} type="button">
                        HTML из буфера
                      </button>
                      <button
                        className="ghost player-facing-ai-button"
                        disabled={playerCardFormattingIndex === index}
                        onClick={() => void autoFormatEntityPlayerCard(index)}
                        type="button"
                      >
                        {playerCardFormattingIndex === index ? <span aria-hidden="true" className="player-facing-button-spinner" /> : null}
                        {playerCardFormattingIndex === index ? "AI оформляет" : "AI автоформат"}
                      </button>
                      {card.contentHtml?.trim() ? (
                        <button className="ghost" onClick={() => clearEntityPlayerCardHtml(index)} type="button">
                          Сбросить стиль
                        </button>
                      ) : null}
                      <button className="ghost danger-action" onClick={() => removeEntityPlayerCard(index)} type="button">
                        Удалить
                      </button>
                    </div>
                  </div>

                  {playerCardFormattingIndex === index ? (
                    <PlayerFacingFormattingIndicator className="player-card-editor-ai-status" compact />
                  ) : null}

                  <input
                    accept={acceptedPlayerFacingHtmlUploadTypes}
                    className="player-card-editor-file-input"
                    onChange={(event) => void handleEntityPlayerCardHtmlImport(index, event)}
                    ref={(node) => {
                      playerCardImportInputRefs.current[index] = node;
                    }}
                    type="file"
                  />

                  <label className="field">
                    <span>Название карточки</span>
                    <input
                      className="input"
                      onChange={(event) => updateEntityPlayerCard(index, { title: event.target.value })}
                      placeholder={defaultPlayerFacingCardTitle(entityForm.kind, index)}
                      value={card.title}
                    />
                  </label>

                  <label className="field">
                    <span>Текст для игроков</span>
                    <textarea
                      className="input textarea textarea-lg"
                      onChange={(event) => updateEntityPlayerCard(index, { content: event.target.value })}
                      value={card.content}
                    />
                    <small className="field-hint">
                      Можно писать обычный текст, импортировать готовый HTML-фрагмент или попросить AI красиво оформить этот же текст.
                    </small>
                  </label>

                  {card.contentHtml?.trim() ? (
                    <div className="player-card-editor-status">
                      <span className={badge("success")}>HTML-стиль активен</span>
                      <span className="copy">При ручной правке текста оформление можно быстро собрать заново кнопкой AI или повторным импортом.</span>
                    </div>
                  ) : (
                    <div className="player-card-editor-status">
                      <span className={badge("default")}>Plain text</span>
                      <span className="copy">Сейчас карточка откроется как обычный чистый текст без встроенного HTML-оформления.</span>
                    </div>
                  )}
                </article>
              ))
            ) : (
              <div className="entry-card player-card-editor-empty">
                <p className="copy">Пока карточек нет. Добавь первую, чтобы показывать игрокам разные описания одной и той же локации.</p>
              </div>
            )}
          </div>
        </section>
      ) : (
        <label className="field field-full">
          <span>Что зачитывается при встрече</span>
          <small className="field-hint">
            Player-safe версия без мастерских секретов: речь NPC, описание первой встречи, слух, объявление о задании или любой текст, который удобно показать и зачитать игрокам.
          </small>
          <textarea
            className="input textarea textarea-lg"
            onContextMenu={(event) => onContentContextMenu("playerContent", event)}
            onChange={(event) => setEntityForm((current) => ({ ...current, playerContent: event.target.value }))}
            ref={entityPlayerContentRef}
            value={entityForm.playerContent ?? ""}
          />
        </label>
      )}

      <label className="field field-full">
        <span>Информация для мастера</span>
        <small className="field-hint">
          Полная GM-версия сущности: скрытые мотивы, правда, тайные связи, последствия и служебные заметки. Выдели текст и нажми правой кнопкой, чтобы привязать его к другой сущности.
        </small>
        <textarea
          className="input textarea textarea-lg"
          onContextMenu={(event) => onContentContextMenu("content", event)}
          onChange={(event) => setEntityForm((current) => ({ ...current, content: event.target.value }))}
          ref={entityContentRef}
          value={entityForm.content}
        />
      </label>

      <EntityStatBlockEditor controller={controller} />
      <EntityRewardEditor controller={controller} />
    </div>
  );
}
