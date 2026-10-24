import { MediaThumbnail } from "../entity-images/MediaThumbnail";
import { MediaDraftFeedback } from "./MediaDraftFeedback";
import type { EntityMediaDraft } from "./useEntityMediaDraft";
import { AppModal } from "../../app/AppModal";
import { useEffect, useMemo, useState } from "react";
import type { GalleryImage, KnowledgeEntity } from "@shadow-edge/shared-types";
import { GalleryEditorSection } from "../../media";
import type { ProjectGalleryImageOption } from "./useEntityMediaController";

type EntityGalleryModalProps = {
  state:EntityMediaDraft;
  items: GalleryImage[];
  onAdd: () => void;
  onAddProjectImages: (items: GalleryImage[]) => void;
  onChange: (index: number, patch: Partial<GalleryImage>) => void;
  onClose: (pendingSelection?:boolean) => void;
  onRemove: (index: number) => void;
  onSave: () => Promise<void>;
  onUpload: (index: number, file: File) => Promise<void>;
  open: boolean;
  projectImages: ProjectGalleryImageOption[];
  saving: boolean;
  target: KnowledgeEntity | null;
  uploadDisabled: boolean;
  uploadingIndex: number | null;
};

export function EntityGalleryModal({
  state,
  items,
  onAdd,
  onAddProjectImages,
  onChange,
  onClose,
  onRemove,
  onSave,
  onUpload,
  open,
  projectImages,
  saving,
  target,
  uploadDisabled,
  uploadingIndex
}: EntityGalleryModalProps) {
  const [projectSearch, setProjectSearch] = useState("");
  const [selectedProjectImageKeys, setSelectedProjectImageKeys] = useState<string[]>([]);

  useEffect(() => {
    if (!open || !target) {
      return;
    }

    setProjectSearch("");
    setSelectedProjectImageKeys([]);
  }, [open, target?.id]);

  const visibleProjectImages = useMemo(() => {
    const normalized = projectSearch.trim().toLowerCase();
    if (!normalized) {
      return projectImages;
    }

    return projectImages.filter((item) =>
      [item.title, item.caption ?? "", item.sourceEntityTitle, item.sourceLabel]
        .join(" ")
        .toLowerCase()
        .includes(normalized)
    );
  }, [projectImages, projectSearch]);

  const selectedProjectImages = useMemo(
    () => projectImages.filter((item) => selectedProjectImageKeys.includes(item.key)),
    [projectImages, selectedProjectImageKeys]
  );

  const toggleProjectImage = (key: string) => {
    setSelectedProjectImageKeys((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]));
  };

  if (!open || !target) {
    return null;
  }

  const requestClose=()=>{if(!saving&&!uploadDisabled)onClose(Boolean(selectedProjectImageKeys.length));};
  const addSelected=()=>{onAddProjectImages(selectedProjectImages);setSelectedProjectImageKeys([]);};
  return (
    <AppModal label="Галерея записи" onClose={()=>void requestClose()}>
      <div className="panel palette form-modal combat-playlist-modal entity-media-modal" onClick={(event) => event.stopPropagation()} >
        <header className="record-block-heading">
          <div>
            <h2>Галерея записи</h2>
            <strong>{target.title}</strong>
          </div>
          <button className="ghost" disabled={saving||uploadDisabled} onClick={()=>void requestClose()} type="button">
            Закрыть
          </button>
        </header>

        <div className="entity-media-body"><MediaDraftFeedback state={state} field="gallery" items={items}/><fieldset disabled={saving||uploadDisabled} className="media-editor-fields"><GalleryEditorSection
          hint="Карты, письма и иллюстрации для игроков. Добавьте ссылку или загрузите файл."
          items={items}
          onAdd={onAdd}
          onChange={onChange}
          onRemove={onRemove}
          onUpload={onUpload}
          title="Изображения"
          uploadDisabled={uploadDisabled}
          uploadingIndex={uploadingIndex}
        />

        <section className="card npc-section form-subsection project-gallery-picker">
          <div className="row muted project-gallery-picker-head">
            <div className="stack compact">
              <span>Изображения кампании</span>
              <small>Выберите изображения из других записей и добавьте в эту галерею.</small>
            </div>
            <button
              className="ghost"
              disabled={!selectedProjectImages.length}
              onClick={addSelected}
              type="button"
            >
              {selectedProjectImages.length ? `Добавить выбранные (${selectedProjectImages.length})` : "Выберите изображения"}
            </button>
          </div>

          <label className="field">
            <span>Поиск по картинкам проекта</span>
            <input
              className="input"
              onChange={(event) => setProjectSearch(event.target.value)}
              placeholder="Карта, письмо, монстр, улика..."
              value={projectSearch}
            />
          </label>

          {visibleProjectImages.length ? (
            <div className="project-gallery-grid">
              {visibleProjectImages.map((item) => {
                const selected = selectedProjectImageKeys.includes(item.key);
                return (
                  <button
                    key={item.key}
                    className={`project-gallery-card ${selected ? "selected" : ""}`}
                    aria-pressed={selected}
                    aria-label={`Выбрать изображение «${item.title}»`}
                    onClick={() => toggleProjectImage(item.key)}
                    type="button"
                  >
                    <MediaThumbnail alt={item.caption || item.title} className="project-gallery-card-image" src={item.url} />
                    <span className="project-gallery-card-copy">
                      <strong>{item.title}</strong>
                      <small>{item.sourceEntityTitle}</small>
                      <span>{item.sourceLabel}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="copy">В проекте пока не нашлось подходящих картинок по этому запросу.</p>
          )}
        </section>

        </fieldset></div><footer className="actions">
          <button className="ghost" disabled={saving||uploadDisabled} onClick={()=>void requestClose()} type="button">
            Отмена
          </button>
          <button className="primary" disabled={saving||uploadDisabled||(!selectedProjectImages.length&&!state.canSave)||Boolean(state.draft.candidate)||Boolean(state.conflict)} onClick={()=>selectedProjectImages.length?addSelected():void onSave()} type="button">
            {saving?"Сохраняем…":selectedProjectImages.length?`Добавить в галерею · ${selectedProjectImages.length}`:"Сохранить галерею"}
          </button>
        </footer>
      </div>
    </AppModal>
  );
}
