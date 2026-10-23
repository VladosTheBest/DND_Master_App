import { useEffect, useRef, useState } from "react";
import { browserStorage } from "../browser-storage";

export type DeviceDraft<T> = { version: 1; baseRevision: number; savedAt: string; value: T };

// Contains no tokens or account credentials. Never submits anything to the server.
export function useDeviceDraft<T>({ ownerId, campaignId, target, revision, value, dirty, enabled, restore }:
  { ownerId: string; campaignId: string; target: string; revision: number; value: T; dirty: boolean; enabled: boolean; restore: (draft: DeviceDraft<T>) => void }) {
  const key = `shadow-edge.draft.v1:${JSON.stringify([ownerId, campaignId, target])}`;
  const [candidate, setCandidate] = useState<DeviceDraft<T> | null>(null);
  const [status, setStatus] = useState("");
  const bound = useRef("");
  const waiting = useRef(false);
  const skipWrite = useRef(false);
  const lastStored = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !ownerId || !campaignId) { bound.current = ""; return; }
    bound.current = key;
    skipWrite.current = true;
    let draft: DeviceDraft<T> | null = null;
    try {
      const raw = browserStorage.getItem(key);
      lastStored.current = raw;
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed?.version === 1 && typeof parsed.baseRevision === "number" && parsed.value && typeof parsed.savedAt === "string") draft = parsed;
    } catch { /* A malformed draft must not prevent editing server data. */ }
    waiting.current = Boolean(draft);
    setCandidate(draft);
    setStatus(draft ? "Найден черновик на этом устройстве." : "");
  }, [key, enabled, ownerId, campaignId]);

  useEffect(() => {
    if (skipWrite.current) { skipWrite.current = false; return; }
    if (!enabled || !dirty || !ownerId || bound.current !== key || waiting.current) return;
    if (browserStorage.getItem(key) !== lastStored.current) {
      setStatus("Ошибка: черновик на устройстве изменён в другом окне. Текущая форма сохранена в памяти; скачайте свою копию."); return;
    }
    const raw = JSON.stringify({ version: 1, baseRevision: revision, savedAt: new Date().toISOString(), value });
    const saved = browserStorage.setItem(key, raw);
    if (saved) lastStored.current = raw;
    setStatus(saved ? "Черновик на устройстве · на сервер ещё не сохранён" : "Ошибка: черновик не записан на устройство. Скачайте копию перед уходом.");
  }, [key, value, revision, dirty, enabled, ownerId]);

  useEffect(() => {
    if (!enabled || !dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [enabled, dirty]);

  const clear = () => {
    const removed = browserStorage.getItem(key) === lastStored.current ? browserStorage.removeItem(key) : false;
    if (removed) lastStored.current = null;
    waiting.current = false;
    setCandidate(null);
    setStatus(removed ? "Сохранено на сервере" : "Сохранено на сервере. Старый черновик на устройстве удалить не удалось.");
  };
  const download = () => {
    const snapshot = candidate ?? { version: 1, baseRevision: revision, savedAt: new Date().toISOString(), value };
    const url = URL.createObjectURL(new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "shadow-edge-draft.json"; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return { candidate, status, clear, download,
    recover: () => { if (candidate) restore(candidate); waiting.current = false; setCandidate(null); },
    discard: () => { browserStorage.removeItem(key); lastStored.current = null; waiting.current = false; setCandidate(null); setStatus(""); }
  };
}
