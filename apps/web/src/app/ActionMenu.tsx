import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/** A disclosure of ordinary buttons: native tab navigation, Escape and outside dismissal. */
export function ActionMenu({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  return <div className="action-menu" ref={root}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}
    onKeyDown={event => { if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); } }}>
    <button className="ghost" ref={trigger} aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen(!open)} type="button">{label} <span aria-hidden="true">⌄</span></button>
    {open ? <div id={id} className="action-menu-popover" onClick={event => {
      if ((event.target as HTMLElement).closest("button,a")) { setOpen(false); trigger.current?.focus(); }
    }}>{children}</div> : null}
  </div>;
}
