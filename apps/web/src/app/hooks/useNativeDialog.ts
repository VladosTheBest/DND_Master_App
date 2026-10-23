import { useLayoutEffect, useRef } from "react";

export function useNativeDialog(open: boolean, initialFocus?:string) {
  const ref = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog) return;
    const previous = document.activeElement as HTMLElement | null;
    const keepEscapeLocal=(event:KeyboardEvent)=>{if(event.key==="Escape")event.stopPropagation();};
    dialog.addEventListener("keydown",keepEscapeLocal);
    dialog.showModal();
    if(initialFocus)dialog.querySelector<HTMLElement>(initialFocus)?.focus();
    return () => { dialog.removeEventListener("keydown",keepEscapeLocal); dialog.close(); if (previous?.isConnected) previous.focus(); };
  }, [open,initialFocus]);
  return ref;
}
