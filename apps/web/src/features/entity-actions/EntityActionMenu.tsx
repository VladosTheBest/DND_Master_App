import type { KnowledgeEntity } from "@shadow-edge/shared-types";
import { kindTitle } from "../../app-shared";
import type { EntityActionMenuState } from "./entityActions.types";
import "./entity-actions.css";

type EntityActionMenuProps = {
  menu: EntityActionMenuState | null;
  target: KnowledgeEntity | null;
  onClose: () => void;
  onRequestDelete: (entity: KnowledgeEntity) => void;
};

export function EntityActionMenu({
  menu,
  target,
  onClose,
  onRequestDelete
}: EntityActionMenuProps) {
  if (!menu || !target) {
    return null;
  }

  return (
    <div className="entity-action-backdrop" onClick={onClose} role="presentation">
      <div
        className="entity-action-menu"
        onClick={(event) => event.stopPropagation()}
        role="menu"
        style={{ left: menu.x, top: menu.y }}
      >
        <div className="entity-action-menu-label">
          <small>{kindTitle[target.kind]}</small>
          <strong>{target.title}</strong>
        </div>
        <button className="ghost fill danger-action" onClick={() => onRequestDelete(target)} type="button">
          Удалить
        </button>
      </div>
    </div>
  );
}
