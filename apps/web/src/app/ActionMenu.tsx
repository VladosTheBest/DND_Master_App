import { useEffect, useLayoutEffect, useId, useRef, useState, type ReactNode, type KeyboardEvent, type FocusEvent } from "react";
import { createPortal } from "react-dom";
import { actionMenuPosition } from "./action-menu-position";

/** Ordinary buttons with viewport placement, native Tab order and explicit dismissal. */
export function ActionMenu({ label, ariaLabel, children }: { label: string; ariaLabel?:string; children: ReactNode }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const popover = useRef<HTMLDivElement>(null);
  const [position,setPosition] = useState<ReturnType<typeof actionMenuPosition> | null>(null);
  const contains = (target: EventTarget | null) => target instanceof Node && Boolean(root.current?.contains(target) || popover.current?.contains(target));
  useLayoutEffect(() => {
    if (!open) { setPosition(null); return; }
    const place = () => {
      if (!trigger.current || !popover.current) return;
      const anchor = trigger.current.getBoundingClientRect();
      if (anchor.bottom <= 0 || anchor.top >= innerHeight) { setOpen(false); return; }
      const next = actionMenuPosition(anchor, popover.current.scrollHeight + 2, {width:innerWidth,height:innerHeight});
      setPosition(previous => previous && Object.keys(next).every(key => previous[key as keyof typeof next] === next[key as keyof typeof next]) ? previous : next);
    };
    place();
    window.addEventListener("resize",place);
    window.addEventListener("scroll",place,true);
    return () => { window.removeEventListener("resize",place); window.removeEventListener("scroll",place,true); };
  }, [open,position?.width,children]);
  const positioned = Boolean(position);
  useLayoutEffect(() => {
    if (open && positioned) popover.current?.querySelector<HTMLElement>("button:not([disabled]),a[href]")?.focus({preventScroll:true});
  }, [open,positioned]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!contains(event.target)) setOpen(false); };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  const blur = (event: FocusEvent) => { if (!contains(event.relatedTarget)) setOpen(false); };
  const keyDown = (event: KeyboardEvent) => {
    if (!open) return;
    if (event.key === "Escape") {
      event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus(); return;
    }
    if (event.key !== "Tab" || !popover.current?.contains(event.target as Node)) return;
    const items = [...popover.current.querySelectorAll<HTMLElement>("button:not([disabled]),a[href],[tabindex='0']")].filter(item=>item.getClientRects().length);
    if (event.shiftKey && document.activeElement === items[0]) {
      event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus();
    } else if (!event.shiftKey && document.activeElement === items.at(-1)) {
      event.preventDefault(); event.stopPropagation(); setOpen(false);
      const scope = trigger.current?.closest("dialog[open]") || document;
      const next = [...scope.querySelectorAll<HTMLElement>("button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex='0']")].filter(item=>item.tabIndex>=0 && item.getClientRects().length && !popover.current?.contains(item));
      const index = trigger.current ? next.indexOf(trigger.current) : -1;
      (index < 0 ? trigger.current : next[index+1] || trigger.current)?.focus();
    }
  };
  return <div className="action-menu" ref={root} onBlur={blur} onKeyDown={keyDown}>
    <button className="ghost" ref={trigger} aria-label={ariaLabel} aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen(!open)} type="button">{label} <span aria-hidden="true">⌄</span></button>
    {open ? createPortal(<div id={id} ref={popover} className="action-menu-popover" onBlur={blur} onKeyDown={keyDown}
      style={{position:"fixed",left:position?.left??16,top:position?.top??16,width:position?.width??(innerWidth<=600?Math.max(1,innerWidth-32):Math.min(265,innerWidth-32)),margin:0,maxHeight:position?.maxHeight??"65dvh",visibility:position?"visible":"hidden"}}
      onClick={event => { if ((event.target as HTMLElement).closest("button,a")) { setOpen(false); trigger.current?.focus(); } }}>{children}</div>,trigger.current?.closest("dialog[open]") || document.body) : null}
  </div>;
}
