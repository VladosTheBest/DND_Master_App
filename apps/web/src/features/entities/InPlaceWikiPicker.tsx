import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { KnowledgeEntity } from "@shadow-edge/shared-types";

/** Nonmodal counterpart of the textarea wiki picker; the editor selection stays intact. */
export function InPlaceWikiPicker({
  entities,
  label,
  x,
  y,
  onChoose,
  onClose,
}: {
  entities: Map<string, KnowledgeEntity>;
  label: string;
  x: number;
  y: number;
  onChoose: (entity: KnowledgeEntity, label: string) => void;
  onClose: () => void;
}) {
  const [linkLabel, setLinkLabel] = useState(label);
  const [query, setQuery] = useState(""),
    root = useRef<HTMLDivElement>(null),
    input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus();
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) onClose();
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [onClose]);
  const matches = [...entities.values()]
    .filter((e) =>
      `${e.title} ${e.kind}`
        .toLocaleLowerCase()
        .includes(query.trim().toLocaleLowerCase()),
    )
    .slice(0, 12);
  return createPortal(
    <div
      ref={root}
      className="inplace-wiki-picker"
      role="region"
      aria-label="Связать выделенный текст"
      style={{
        left: Math.max(8, Math.min(x, window.innerWidth - 336)),
        top: Math.max(8, Math.min(y, window.innerHeight - 330)),
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <header>
        <strong>Ссылка на запись</strong>
        <button
          className="ghost"
          aria-label="Закрыть выбор ссылки"
          onClick={onClose}
          type="button"
        >
          ×
        </button>
      </header>
      <label>
        Текст ссылки
        <input
          className="input"
          aria-label="Текст ссылки"
          value={linkLabel}
          onChange={(event) => setLinkLabel(event.target.value)}
        />
      </label>
      <input
        ref={input}
        className="input"
        type="search"
        aria-label="Найти запись для ссылки"
        placeholder="Название записи"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <div className="inplace-wiki-results">
        {matches.map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => onChoose(e, linkLabel)}
          >
            {e.title}
            <small>
              {
                {
                  location: "Локация",
                  npc: "НПС",
                  monster: "Монстр",
                  player: "Игрок",
                  quest: "Квест",
                  lore: "Заметка",
                }[e.kind]
              }
            </small>
          </button>
        ))}
        {!matches.length && <p>Записей не найдено.</p>}
      </div>
    </div>,
    document.body,
  );
}
