type Anchor = Pick<DOMRect, "top" | "bottom" | "right">;
export function actionMenuPosition(anchor: Anchor, contentHeight: number, viewport: {width:number;height:number}) {
  const margin = Math.min(16, viewport.width / 4, viewport.height / 4);
  const width = Math.max(1, Math.min(viewport.width <= 600 ? viewport.width - margin * 2 : 265, viewport.width - margin * 2));
  const maxHeight = Math.max(1, Math.min(viewport.height * .65, viewport.height - margin * 2));
  const height = Math.min(contentHeight, maxHeight);
  const below = viewport.height - anchor.bottom - margin - 8;
  const above = anchor.top - margin - 8;
  const preferredTop = below >= Math.min(height, above) ? anchor.bottom + 8 : anchor.top - height - 8;
  return {
    left: Math.max(margin, Math.min(anchor.right - width, viewport.width - width - margin)),
    top: Math.max(margin, Math.min(preferredTop, viewport.height - height - margin)),
    width,
    maxHeight
  };
}
