import type { EntityLinkContextMenuProps } from "./entityLink.types";
import "./entity-links.css";

export function EntityLinkContextMenu({ controller }: EntityLinkContextMenuProps) {
  if (!controller.entityLinkMenuOpen || !controller.entityLinkSelection) {
    return null;
  }

  return (
    <div className="link-context-backdrop" onClick={controller.closeEntityLinkContextMenu} role="presentation">
      <div
        className="link-context-menu"
        onClick={(event) => event.stopPropagation()}
        role="menu"
        style={{ left: controller.entityLinkSelection.x, top: controller.entityLinkSelection.y }}
      >
        <button className="ghost fill" onClick={controller.openEntityLinkModal} type="button">
          Создать ссылку
        </button>
      </div>
    </div>
  );
}
