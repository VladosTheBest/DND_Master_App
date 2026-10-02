import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";

type AppPreviewPanelProps = {
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  children: ReactNode;
  onClose?: () => void;
};

export function AppPreviewPanel({ onPointerDown, children, onClose }: AppPreviewPanelProps) {
  return (
    <>
      <div className="resize-handle preview-handle" onPointerDown={onPointerDown} role="presentation" />
      <aside className="panel preview" aria-label="Быстрый просмотр">{onClose ? <button className="ghost preview-close" onClick={onClose} type="button">Закрыть просмотр ×</button> : null}{children}</aside>
    </>
  );
}
