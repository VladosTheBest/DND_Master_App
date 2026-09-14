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
        setNotice("Персонаж создан. Скачайте лист или распечатайте его.");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      savingRef.current = false;
      setBusy(false);
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
                setNotice("");
              }
            }}
            savedLabel={saved ? "Сохранён в кампании" : "Готовый персонаж"}
          />
        </div>
      ) : (
        <CharacterBuilder
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
