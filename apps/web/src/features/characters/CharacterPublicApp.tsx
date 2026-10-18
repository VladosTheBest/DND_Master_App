import { useEffect, useRef, useState } from "react";
import { CharacterBuilder, DiceMark, isUsableDraft } from "./CharacterBuilder";
import { CharacterSheet } from "./CharacterSheet";
import {
  characterApi,
  characterURL,
  copyCharacterLink,
  type PublicCharacterInvite,
  type SavedCharacter,
} from "./characters.api";
import type { CharacterDraft } from "./rules";
import "./characters.css";

const localCharacterPrefix = "shadow-edge-finished-v1:";
function readLocalCharacters(): { id: string; draft: CharacterDraft }[] {
  const result: { id: string; draft: CharacterDraft }[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(localCharacterPrefix)) continue;
      try {
        const draft = JSON.parse(localStorage.getItem(key) || "null");
        if (isUsableDraft(draft))
          result.push({ id: key.slice(localCharacterPrefix.length), draft });
      } catch {
        /* Skip one corrupt record, preserving the remaining library. */
      }
    }
  } catch {
    /* Browser storage can be disabled. */
  }
  return result;
}
export default function CharacterPublicApp({ hash }: { hash: string }) {
  const route = hash.slice(1).split("/");
  const mode = route[1] || "new";
  const token = route[2] || "";
  const invalidRoute =
    route.length > 3 ||
    !["new", "join", "sheet"].includes(mode) ||
    (mode !== "new" && !token) ||
    (mode === "new" && !!token);
  const storageKey = `shadow-edge-character-v1:${mode === "join" ? token : mode === "sheet" ? `sheet-${token}` : "standalone"}`;
  const [invite, setInvite] = useState<PublicCharacterInvite>();
  const [saved, setSaved] = useState<SavedCharacter | null>(null);
  const [localSheet, setLocalSheet] = useState<CharacterDraft | null>(null);
  const [legacyDraft] = useState<CharacterDraft | null>(() => {
    try {
      const record = JSON.parse(
        localStorage.getItem("shadow-edge-character-v1:standalone") || "null",
      );
      return isUsableDraft(record?.draft) ? record.draft : null;
    } catch {
      return null;
    }
  });
  const [localCharacters, setLocalCharacters] = useState(readLocalCharacters);
  const [localId, setLocalId] = useState<string | null>(null);
  const [builderKey, setBuilderKey] = useState(0);
  const importInput = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(mode !== "new");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const savingRef = useRef(false);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Мастерская персонажа · Shadow Edge GM";
    let cancelled = false;
    const cleanup = () => {
      cancelled = true;
      document.title = previousTitle;
    };
    if (invalidRoute || mode === "new") {
      setLoading(false);
      return cleanup;
    }
    setLoading(true);
    setLoadError("");
    const request =
      mode === "join"
        ? characterApi.getPublicInvite(token)
        : characterApi.getSheet(token);
    request
      .then((value) => {
        if (cancelled) return;
        if (mode === "join") {
          const result = value as PublicCharacterInvite;
          if (
            !result ||
            !["2014", "2024", "any"].includes(result.edition) ||
            !Number.isInteger(result.level) ||
            result.level < 1 ||
            result.level > 20 ||
            typeof result.campaignName !== "string"
          )
            throw new Error(
              "Приглашение содержит неподдерживаемые параметры. Попросите мастера обновить ссылку.",
            );
          setInvite(result);
        } else {
          const result = value as SavedCharacter;
          if (!result || !isUsableDraft(result.draft))
            throw new Error(
              "Лист персонажа имеет неподдерживаемый формат. Обратитесь к мастеру кампании.",
            );
          setSaved(result);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setLoadError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return cleanup;
  }, [mode, token, invalidRoute, loadAttempt]);

  async function complete(draft: CharacterDraft) {
    if (savingRef.current || (mode === "join" && saved)) return;
    savingRef.current = true;
    setBusy(true);
    setError("");
    try {
      if (mode === "join") {
        const result = await characterApi.create(token, draft);
        if (!result.editToken) {
          setSaved({ ...result, draft });
          setNotice(
            "Персонаж сохранён в кампании, но сервер не вернул личную ссылку. Скачайте лист и обратитесь к мастеру за ссылкой для редактирования.",
          );
          return;
        }
        try {
          localStorage.removeItem(storageKey);
        } catch {
          /* A successful server save does not depend on local storage. */
        }
        window.location.replace(characterURL(`sheet/${result.editToken}`));
      } else if (mode === "sheet") {
        const result = await characterApi.update(token, draft);
        setSaved(result);
        setEditing(false);
        setNotice("Изменения сохранены. Мастер увидит обновлённый лист.");
      } else {
        setLocalSheet(draft);
        setEditing(false);
        saveLocal(draft);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      savingRef.current = false;
      setBusy(false);
    }
  }
  function saveLocal(
    draft: CharacterDraft,
    id = localId ||
      Array.from(crypto.getRandomValues(new Uint32Array(4)), (n) =>
        n.toString(16).padStart(8, "0"),
      ).join(""),
  ) {
    setLocalId(id);
    try {
      localStorage.setItem(localCharacterPrefix + id, JSON.stringify(draft));
      setLocalCharacters(readLocalCharacters());
      setNotice(
        "Персонаж сохранён в этом браузере. PDF и экспорт доступны при повторном открытии. Скачайте JSON для резервной копии.",
      );
    } catch {
      setNotice(
        "Не удалось сохранить персонажа в браузере: хранилище недоступно или заполнено. Скачайте JSON, чтобы не потерять персонажа.",
      );
    }
  }
  async function openCharacterFile(file: File) {
    try {
      if (file.size > 10 * 1024 * 1024)
        throw new Error("Файл слишком большой: максимум 10 МБ.");
      const data = JSON.parse(await file.text());
      const draft =
        data.format === "shadow-edge-character"
          ? data.character
          : (data.draft ?? data);
      if (!isUsableDraft(draft))
        throw new Error(
          "Нужен JSON персонажа, скачанный из мастерской. Из PDF восстановить все выборы нельзя.",
        );
      setLocalSheet(draft);
      setEditing(false);
      setError("");
      saveLocal(
        draft,
        Array.from(crypto.getRandomValues(new Uint32Array(4)), (n) =>
          n.toString(16).padStart(8, "0"),
        ).join(""),
      );
    } catch (err) {
      setError((err as Error).message);
    }
  }
  const sheet = saved?.draft || localSheet;

  return (
    <main className="ch-public">
      <header className="ch-public-header">
        <a href="#characters" className="ch-public-brand">
          <DiceMark small />
          <span>
            SHADOW EDGE <b>GM</b>
          </span>
        </a>
        <span className="ch-public-header-label">Мастерская персонажа</span>
        <a href="#" className="ch-text-button">
          Кабинет мастера <span aria-hidden="true">↗</span>
        </a>
      </header>
      {mode === "new" && !invalidRoute && (
        <section className="ch-local-library">
          <h2>Мои готовые персонажи</h2>
          <p>
            Откройте сохранённого героя, чтобы скачать PDF, поделиться им или
            экспортировать в Foundry. Этот список хранится в текущем браузере.
          </p>
          <div className="ch-inline-actions">
            {legacyDraft && localCharacters.length === 0 && (
              <button
                type="button"
                className="chsheet-button"
                onClick={() => {
                  setLocalSheet(legacyDraft);
                  setEditing(false);
                  saveLocal(
                    legacyDraft,
                    Array.from(
                      crypto.getRandomValues(new Uint32Array(4)),
                      (n) => n.toString(16).padStart(8, "0"),
                    ).join(""),
                  );
                }}
              >
                Открыть прежний локальный лист
              </button>
            )}
            {localCharacters.map((record) => (
              <button
                type="button"
                className="chsheet-button"
                key={record.id}
                onClick={() => {
                  setLocalId(record.id);
                  setLocalSheet(record.draft);
                  setEditing(false);
                  setNotice("");
                  setError("");
                }}
              >
                {record.draft.name || "Персонаж"} · {record.draft.targetLevel}{" "}
                ур.
              </button>
            ))}
            <button
              type="button"
              className="chsheet-button"
              onClick={() => importInput.current?.click()}
            >
              Открыть персонажа из JSON
            </button>
            <input
              ref={importInput}
              hidden
              type="file"
              accept=".json,application/json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void openCharacterFile(file);
              }}
            />
          </div>
          {error && !editing && (
            <p role="alert" className="ch-error">
              {error}
            </p>
          )}
        </section>
      )}
      {invalidRoute ? (
        <div className="ch-status-page">
          <DiceMark />
          <h1>Такого пути пока нет</h1>
          <p>
            Проверьте ссылку приглашения или создайте героя для своей истории.
          </p>
          <a href="#characters" className="ch-button ch-primary">
            Открыть генератор
          </a>
        </div>
      ) : loading ? (
        <div className="ch-status-page" role="status">
          <DiceMark />
          <h1>Открываем вашу историю…</h1>
          <p>
            Загружаем{" "}
            {mode === "join" ? "приглашение в кампанию" : "лист персонажа"}.
          </p>
        </div>
      ) : loadError ? (
        <div className="ch-status-page">
          <DiceMark />
          <h1>
            {mode === "join"
              ? "Приглашение недоступно"
              : "Не удалось открыть лист"}
          </h1>
          <p role="alert">{loadError}</p>
          <div className="ch-inline-actions">
            <button
              type="button"
              className="ch-button"
              onClick={() => setLoadAttempt((value) => value + 1)}
            >
              Повторить
            </button>
            <a href="#characters" className="ch-button ch-primary">
              Создать другого героя
            </a>
          </div>
        </div>
      ) : sheet && !editing ? (
        <div className="ch-finished">
          {mode === "sheet" && (
            <section className="ch-private-link">
              <div>
                <span className="ch-kicker">Персонаж в кампании</span>
                <h2>{saved?.campaignName}</h2>
                <p>
                  Сохраните личную ссылку: она открывает ваш лист и позволяет
                  его редактировать. Делитесь ею только с теми, кому доверяете
                  изменения.
                </p>
              </div>
              <div className="ch-share-field">
                <input
                  readOnly
                  aria-label="Личная ссылка на лист персонажа"
                  value={characterURL(`sheet/${token}`)}
                  onFocus={(event) => event.target.select()}
                />
                <button
                  type="button"
                  className="ch-button"
                  onClick={() => {
                    setNotice("");
                    void copyCharacterLink(characterURL(`sheet/${token}`))
                      .then(() => setNotice("Личная ссылка скопирована"))
                      .catch((err: Error) => setNotice(err.message));
                  }}
                >
                  Копировать
                </button>
              </div>
            </section>
          )}
          {notice && (
            <p role="status" className="ch-notice">
              {notice}
            </p>
          )}
          <CharacterSheet
            draft={sheet}
            onEdit={
              mode === "join"
                ? undefined
                : () => {
                    setError("");
                    setEditing(true);
                  }
            }
            onNew={() => {
              if (mode !== "new") window.location.hash = "characters";
              else {
                setLocalSheet(null);
                setLocalId(null);
                setEditing(false);
                try {
                  localStorage.removeItem(storageKey);
                } catch {
                  /* Optional storage. */
                }
                setBuilderKey((value) => value + 1);
                setNotice("");
              }
            }}
            savedLabel={saved ? "Сохранён в кампании" : "Готовый персонаж"}
          />
        </div>
      ) : (
        <CharacterBuilder
          key={builderKey}
          initialDraft={editing && sheet ? sheet : undefined}
          invite={invite}
          storageKey={storageKey}
          onComplete={(draft) => void complete(draft)}
          busy={busy}
          submitError={error}
          onCancel={editing ? () => setEditing(false) : undefined}
        />
      )}
      <footer className="ch-public-footer">
        <span>Shadow Edge GM · Создавайте истории вместе</span>
        <span>
          Правила Wizards of the Coast LLC:{" "}
          <a
            href="https://www.dndbeyond.com/srd"
            target="_blank"
            rel="noreferrer"
          >
            SRD 5.1 / 5.2.1
          </a>{" "}
          ·{" "}
          <a
            href="https://creativecommons.org/licenses/by/4.0/"
            target="_blank"
            rel="noreferrer"
          >
            CC BY 4.0
          </a>
        </span>
      </footer>
    </main>
  );
}
