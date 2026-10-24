import type { ReactNode, MouseEventHandler } from "react";
import { useNativeDialog } from "./hooks/useNativeDialog";
import styles from "./Workspace.module.css";

/** Shared modal surface: browser focus containment, inert background and focus return. */
export function AppModal({children,label,onClose,role="dialog",fullscreen=false,onSurfaceMouseDown,initialFocus}:{children:ReactNode;label:string;onClose:()=>void;role?:"dialog"|"alertdialog";fullscreen?:boolean;initialFocus?:string;onSurfaceMouseDown?:MouseEventHandler<HTMLDialogElement>}) {
  const dialog=useNativeDialog(true,initialFocus);
  return <dialog ref={dialog} className={`app-native-dialog ${styles.surface} ${fullscreen?styles.fullscreen:""}`} aria-label={label} role={role} onMouseDown={onSurfaceMouseDown}
    onKeyDown={event=>{if(event.key==="Escape")event.stopPropagation();}}
    onCancel={event=>{event.preventDefault();event.stopPropagation();onClose();}}
    onClick={event=>{if(event.target===event.currentTarget)onClose();}}>{children}</dialog>;
}
