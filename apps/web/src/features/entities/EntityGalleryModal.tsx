import { useEffect, useMemo, useState } from "react";
import type { GalleryImage, KnowledgeEntity } from "@shadow-edge/shared-types";
import { GalleryEditorSection } from "../../media";
import type { ProjectGalleryImageOption } from "./useEntityMediaController";

type EntityGalleryModalProps = {
  items: GalleryImage[];
  onAdd: () => void;
  onAddProjectImages: (items: GalleryImage[]) => void;
  onChange: (index: number, patch: Partial<GalleryImage>) => void;
  onClose: () => void;
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

  return (
    <div className="overlay" role="presentation">
      <div className="panel palette form-modal combat-playlist-modal" onClick={(event) => event.stopPropagation()} role="dialog">
        <div className="row">
          <div>
            <p className="eyebrow">Entity Gallery</p>
            <strong>{target.title}</strong>
          </div>
          <button className="ghost" onClick={onClose} type="button">
            Esc
          </button>
        </div>

        <GalleryEditorSection
          hint="Можно добавлять ссылки, загружать картинки с компьютера и собирать handout-галерею отдельно для этой сущности."
          items={items}
          onAdd={onAdd}
          onChange={onChange}
          onRemove={onRemove}
          onUpload={onUpload}
          title="Галерея сущности"
          uploadDisabled={uploadDisabled}
          uploadingIndex={uploadingIndex}
        />

        <section className="card npc-section form-subsection project-gallery-picker">
          <div className="row muted project-gallery-picker-head">
            <div className="stack compact">
              <span>Выбрать из проекта</span>
              <small>Можно взять уже существующие картинки из других карточек и добавить сразу несколько.</small>
            </div>
            <button
              className="ghost"
              disabled={!selectedProjectImages.length}
              onClick={() => {
                onAddProjectImages(selectedProjectImages);
                setSelectedProjectImageKeys([]);
              }}
              type="button"
            >
              {selectedProjectImages.length ? `Добавить выбранные (${selectedProjectImages.length})` : "Выбери картинки"}
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
                    onClick={() => toggleProjectImage(item.key)}
                    type="button"
                  >
                    <img alt={item.caption || item.title} className="project-gallery-card-image" loading="lazy" src={item.url} />
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

        <div className="actions">
          <button className="ghost" onClick={onClose} type="button">
            Отмена
          </button>
          <button className="primary" disabled={saving || uploadDisabled} onClick={() => void onSave()} type="button">
            {saving ? "Сохраняю..." : "Сохранить галерею"}
          </button>
        </div>
      </div>
    </div>
  );
}
