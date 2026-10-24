import { useLayoutEffect, useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";

type AppPreviewPanelProps = {
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  children: ReactNode;
  onClose?: () => void;
};

export function AppPreviewPanel({ onPointerDown, children, onClose }: AppPreviewPanelProps) {
  const close = useRef<HTMLButtonElement>(null);
  const explicitPreview = Boolean(onClose);
  useLayoutEffect(() => {
    if (!explicitPreview) return;
    const previous = document.activeElement as HTMLElement|null;
    close.current?.focus({preventScroll:true});
    return () => { if (previous?.isConnected) previous.focus(); };
  }, [explicitPreview]);
  return (
    <>
      <div className="resize-handle preview-handle" onPointerDown={onPointerDown} role="presentation" />
      <aside className="panel preview" aria-label="Быстрый просмотр" onKeyDown={event=>{if(event.key==="Escape"&&onClose){event.preventDefault();event.stopPropagation();onClose();}}}>{onClose ? <button ref={close} className="ghost preview-close" onClick={onClose} type="button">Закрыть просмотр ×</button> : null}{children}</aside>
    </>
  );
}
