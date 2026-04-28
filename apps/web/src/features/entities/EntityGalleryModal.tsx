import type { GalleryImage, KnowledgeEntity } from "@shadow-edge/shared-types";
import { GalleryEditorSection } from "../../media";

type EntityGalleryModalProps = {
  items: GalleryImage[];
  onAdd: () => void;
  onChange: (index: number, patch: Partial<GalleryImage>) => void;
  onClose: () => void;
  onRemove: (index: number) => void;
  onSave: () => Promise<void>;
  onUpload: (index: number, file: File) => Promise<void>;
  open: boolean;
  saving: boolean;
  target: KnowledgeEntity | null;
  uploadDisabled: boolean;
  uploadingIndex: number | null;
};

export function EntityGalleryModal({
  items,
  onAdd,
  onChange,
  onClose,
  onRemove,
  onSave,
  onUpload,
  open,
  saving,
  target,
  uploadDisabled,
  uploadingIndex
}: EntityGalleryModalProps) {
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
          hint="Точечная правка только для карт, писем и handout-изображений этой сущности. Без полного редактора и длинной формы."
          items={items}
          onAdd={onAdd}
          onChange={onChange}
          onRemove={onRemove}
          onUpload={onUpload}
          title="Галерея сущности"
          uploadDisabled={uploadDisabled}
          uploadingIndex={uploadingIndex}
        />

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
