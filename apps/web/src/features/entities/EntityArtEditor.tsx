import { createPortraitSource } from "../../app-shared";
import {
  acceptedImageUploadTypes
} from "./entity.utils";
import type { EntityEditorController } from "./useEntityEditorController";

type EntityArtEditorProps = {
  controller: EntityEditorController;
};

export function EntityArtEditor({ controller }: EntityArtEditorProps) {
  const {
    entityArtUploading,
    entityForm,
    updateEntityForm,
    uploadEntityArtFile
  } = controller;

  const isPortraitEntity =
    entityForm.kind === "player" ||
    entityForm.kind === "npc" ||
    entityForm.kind === "monster";

  return (
    <>
      <label className="field">
        <span>Ссылка на изображение</span>
        <input
          className="input"
          onChange={(event) =>
            updateEntityForm((current) => ({
              ...current,
              art: {
                ...(current.art ?? {}),
                url: event.target.value
              }
            }))
          }
          placeholder="https://..."
          value={entityForm.art?.url ?? ""}
        />
        <div className="actions entity-art-upload-actions">
          <label className={`ghost media-upload-trigger ${entityArtUploading ? "disabled" : ""}`}>
            <input
              accept={acceptedImageUploadTypes}
              className="media-upload-input"
              disabled={entityArtUploading}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) {
                  return;
                }
                void uploadEntityArtFile(file);
              }}
              type="file"
            />
            {entityArtUploading ? "Загружаю..." : "Загрузить в приложение"}
          </label>
          <small className="field-hint">Можно оставить внешний URL или загрузить файл прямо в приложение.</small>
        </div>
      </label>
      <label className="field">
        <span>Alt-текст</span>
        <input
          className="input"
          onChange={(event) =>
            updateEntityForm((current) => ({
              ...current,
              art: {
                ...(current.art ?? {}),
                alt: event.target.value
              }
            }))
          }
          value={entityForm.art?.alt ?? ""}
        />
      </label>
      <label className="field field-full">
        <span>Подпись к изображению</span>
        <input
          className="input"
          onChange={(event) =>
            updateEntityForm((current) => ({
              ...current,
              art: {
                ...(current.art ?? {}),
                caption: event.target.value
              }
            }))
          }
          value={entityForm.art?.caption ?? ""}
        />
      </label>

      {isPortraitEntity ? (
        <section className="card npc-section form-subsection field-full entity-art-editor">
          <div className="row muted">
            <span>Превью портрета</span>
            <span>
              {entityForm.art?.url?.trim()
                ? "Используется реальная ссылка на изображение"
                : "Пока используется заглушка, но после вставки URL портрет обновится сразу"}
            </span>
          </div>

          <div className="npc-top">
            <figure className="npc-portrait-frame">
              <img
                alt={
                  entityForm.art?.alt ??
                  (entityForm.title || (entityForm.kind === "monster" ? "Монстр" : entityForm.kind === "player" ? "Игрок" : "НПС"))
                }
                className="npc-portrait"
                src={createPortraitSource({
                  kind: entityForm.kind,
                  title: entityForm.title || (entityForm.kind === "monster" ? "Монстр" : entityForm.kind === "player" ? "Игрок" : "НПС"),
                  art: entityForm.art
                })}
              />
              <figcaption>
                {entityForm.art?.caption ??
                  (entityForm.kind === "monster"
                    ? "Для монстров из dnd.su ссылка на изображение подставится автоматически при импорте."
                    : entityForm.kind === "player"
                      ? "Портрет игрока будет виден в карточке персонажа и в трекере инициативы."
                      : "Для НПС вставь URL портрета, и он сразу появится в карточке персонажа.")}
              </figcaption>
            </figure>

            <div className="npc-overview">
              <div className="stack">
                <div>
                  <p className="eyebrow">Изображение</p>
                  <h2>
                    {entityForm.title ||
                      (entityForm.kind === "monster" ? "Новый монстр" : entityForm.kind === "player" ? "Новый игрок" : "Новый НПС")}
                  </h2>
                  <p className="npc-type-line">
                    {entityForm.art?.url?.trim()
                      ? "Изображение сохранится в сущности и будет видно в карточке, preview и боевом профиле."
                      : "Можно вставить внешний URL вручную или загрузить файл прямо в приложение."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
