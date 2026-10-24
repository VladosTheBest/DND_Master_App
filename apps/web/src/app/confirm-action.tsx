import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNativeDialog } from "./hooks/useNativeDialog";

type Request = { message: string; resolve: (accepted: boolean) => void };
const queue: Request[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(listener => listener());

export function confirmAction(message: string): Promise<boolean> {
  return new Promise(resolve => { queue.push({ message, resolve }); emit(); });
}

export function ConfirmationHost() {
  const [request, setRequest] = useState<Request | undefined>(queue[0]);
  useEffect(() => { const update = () => setRequest(queue[0]); listeners.add(update); update(); return () => { listeners.delete(update); }; }, []);
  const dialog = useNativeDialog(Boolean(request));
  const finish = (accepted: boolean) => { const next = queue.shift(); next?.resolve(accepted); emit(); };
  if (!request) return null;
  const destructive = /^Удалить/i.test(request.message.trim());
  return createPortal(<dialog ref={dialog} className="app-native-dialog app-confirm-dialog" role="alertdialog" aria-label={destructive ? "Подтвердить удаление" : "Подтвердить действие"} onKeyDown={event=>{if(event.key==="Escape")event.stopPropagation();}} onCancel={event => { event.preventDefault(); event.stopPropagation(); finish(false); }}>
    <section className="panel palette"><h2>{destructive ? "Подтвердить удаление" : "Продолжить действие?"}</h2><p>{request.message}</p><div className="actions"><button className="ghost" autoFocus onClick={() => finish(false)}>Отмена</button><button className={destructive ? "ghost danger-action" : "primary"} onClick={() => finish(true)}>{destructive ? "Удалить" : "Продолжить"}</button></div></section>
  </dialog>, document.body);
}
