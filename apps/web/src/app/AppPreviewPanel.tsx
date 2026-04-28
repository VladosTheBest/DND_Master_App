import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";

type AppPreviewPanelProps = {
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  children: ReactNode;
};

export function AppPreviewPanel({ onPointerDown, children }: AppPreviewPanelProps) {
  return (
    <>
      <div className="resize-handle preview-handle" onPointerDown={onPointerDown} role="presentation" />
      <aside className="panel preview">{children}</aside>
    </>
  );
}
