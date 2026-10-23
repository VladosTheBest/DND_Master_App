import { requestJson } from "@shadow-edge/api-client";
import { useRef, useState } from "react";
import { deriveCharacter, type CharacterDraft } from "./rules";

export async function normalizePortrait(source: Blob): Promise<string> {
  if (source.size > 20 * 1024 * 1024)
    throw new Error("Изображение должно быть меньше 20 МБ.");
  const bitmap = await createImageBitmap(source);
  try {
    if (bitmap.width * bitmap.height > 16000000)
      throw new Error("Изображение должно быть не больше 16 мегапикселей.");
    const scale = Math.min(1, 768 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Обработка изображения недоступна.");
    ctx.fillStyle = "#100e18";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const data = canvas.toDataURL("image/jpeg", 0.82);
    if (data.length > 900000)
      throw new Error(
        "Изображение слишком сложное. Выберите файл меньшего размера.",
      );
    return data;
  } finally {
    bitmap.close();
  }
}

export function CharacterPortrait({
  draft,
  onChange,
}: {
  draft: CharacterDraft;
  onChange: (portrait?: string) => void;
}) {
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const flight = useRef(false);
  async function perform(work: () => Promise<string>) {
    if (flight.current) return;
    flight.current = true;
    setBusy(true);
    setError("");
    try {
      onChange(await work());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось получить портрет.");
    } finally {
      flight.current = false;
      setBusy(false);
    }
  }
  async function generate() {
    const c = deriveCharacter(draft);
    const context = [
      draft.name,
      c.species?.name,
      c.class?.name,
      c.subclass?.name,
      draft.personality?.appearance,
      draft.personality?.backstory,
      description,
    ]
      .filter(Boolean)
      .join("\n");
    const result=await requestJson<{image:string}>(`${import.meta.env.VITE_API_BASE_URL || ""}/api/characters/portrait`,{method:"POST",body:JSON.stringify({description:context})});
    return normalizePortrait(await (await fetch(result.image)).blob());
  }
  return (
    <section
      className="ch-portrait-editor ch-bonus-section"
      aria-label="Портрет персонажа"
    >
      <h2>Портрет героя</h2>
      {draft.portrait && (
        <img
          src={draft.portrait}
          alt={`Портрет: ${draft.name}`}
          style={{ width: 220, maxWidth: "100%", borderRadius: 16 }}
        />
      )}
      <label className="ch-notes-field">
        Загрузить изображение
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void perform(() => normalizePortrait(file));
          }}
        />
      </label>
      <label className="ch-notes-field">
        Описание для генерации (необязательно)
        <textarea
          maxLength={2000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Оставьте пустым, чтобы использовать расу, класс, внешность и историю героя"
        />
      </label>
      <p>
        AI использует описание и контекст персонажа. Нужен вход с активной
        подпиской; загрузить свою картинку можно без входа.
      </p>
      <button
        type="button"
        className="chsheet-button"
        disabled={busy}
        onClick={() => void perform(generate)}
      >
        {busy ? "Готовим портрет…" : "Сгенерировать портрет"}
      </button>
      {draft.portrait && (
        <button
          type="button"
          className="chsheet-button"
          disabled={busy}
          onClick={() => onChange(undefined)}
        >
          Убрать портрет
        </button>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
