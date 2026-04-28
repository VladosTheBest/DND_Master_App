import { EntityVisual, hasVisibleArt, kindTitle } from "../../app-shared";
import type { EntityLinkPickerModalProps } from "./entityLink.types";
import "./entity-links.css";

export function EntityLinkPickerModal({
  controller,
  onClose
}: EntityLinkPickerModalProps) {
  if (!controller.entityLinkModalOpen) {
    return null;
  }

  return (
    <div className="link-picker-backdrop" role="presentation">
      <div className="panel link-picker-modal" onClick={(event) => event.stopPropagation()} role="dialog">
        <div className="row">
          <div>
            <p className="eyebrow">Create Hyperlink</p>
            <strong>Выбери сущность, на которую будет вести выделенный текст</strong>
          </div>
          <button className="ghost" onClick={onClose} type="button">
            Esc
          </button>
        </div>

        <div className="field field-full">
          <span>Искать сущность</span>
          <input
            className="input"
            onChange={(event) => controller.setEntityLinkQuery(event.target.value)}
            placeholder="Начни вводить название локации, НПС, квеста или лора"
            value={controller.entityLinkQuery}
          />
        </div>

        <div className="link-picker-selection">
          <small>Выделенный текст</small>
          <strong>{controller.entityLinkSelection?.text.trim()}</strong>
        </div>

        <div className="link-picker-results">
          {controller.linkableEntities.length ? (
            controller.linkableEntities.slice(0, 12).map((entity) => (
              <button
                key={entity.id}
                className={`entity-row ${hasVisibleArt(entity.art) ? "has-thumb" : ""} ${controller.entityLinkTargetId === entity.id ? "active" : ""}`}
                onClick={() => controller.setEntityLinkTargetId(entity.id)}
                type="button"
              >
                <EntityVisual entity={entity} />
                <span className="entity-row-copy">
                  <strong>{entity.title}</strong>
                  <small>{kindTitle[entity.kind]} • {entity.subtitle}</small>
                </span>
              </button>
            ))
          ) : (
            <p className="copy">По текущему запросу сущности не нашлись.</p>
          )}
        </div>

        {controller.selectedEntityLinkTarget ? (
          <div className="link-picker-selection">
            <small>Ссылка будет вести на</small>
            <strong>{controller.selectedEntityLinkTarget.title}</strong>
          </div>
        ) : null}

        <div className="actions">
          <button className="ghost" onClick={onClose} type="button">
            Отмена
          </button>
          <button
            className="primary"
            disabled={!controller.entityLinkTargetId}
            onClick={controller.insertEntityLinkIntoContent}
            type="button"
          >
            Сохранить ссылку
          </button>
        </div>
      </div>
    </div>
  );
}
