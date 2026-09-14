import { useEffect, useState } from "react";
import { CharacterSheet } from "./CharacterSheet";
import {
  characterApi,
  characterURL,
  copyCharacterLink,
  type CharacterInvite,
  type SavedCharacter,
} from "./characters.api";
import "./characters.css";

export function CampaignCharacters({
  campaignId,
  onRefresh,
}: {
  campaignId: string;
  onRefresh: () => void;
}) {
  const [invite, setInvite] = useState<CharacterInvite | null>(null);
  const [sheets, setSheets] = useState<SavedCharacter[]>([]);
  const [selected, setSelected] = useState<SavedCharacter | null>(null);
  const [edition, setEdition] = useState<CharacterInvite["edition"]>("any");
  const [level, setLevel] = useState(1);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    setError("");
    setSelected(null);
    setInvite(null);
    setSheets([]);
    Promise.all([
      characterApi.getInvite(campaignId),
      characterApi.listSheets(campaignId),
    ])
      .then(([link, characters]) => {
        if (cancelled) return;
        setInvite(link);
        setSheets(characters || []);
        setEdition(link?.edition || "any");
        setLevel(link?.level || 1);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const shareURL = invite
    ? invite.url || characterURL(`join/${encodeURIComponent(invite.token)}`)
    : "";

  return (
    <section className="ch-campaign" aria-label="Листы персонажей кампании">
      <div className="ch-campaign-head">
        <div className="ch-campaign-icon" aria-hidden="true">
          ✦
        </div>
        <div>
          <span className="ch-kicker">Мастерская персонажей</span>
          <h2>Каждая легенда начинается с героя</h2>
          <p>
            Отправьте приглашение — игроки создадут персонажей по уровням, и их
            листы появятся здесь.
          </p>
        </div>
        <button
          className="ch-button ch-primary"
          type="button"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
        >
          {expanded ? "Свернуть" : "Пригласить игроков"}
          <span aria-hidden="true"> ↗</span>
        </button>
      </div>
      {expanded && (
        <div className="ch-invite-panel">
          <div className="ch-inline-fields">
            <label>
              Редакция
              <select
                value={edition}
                onChange={(event) =>
                  setEdition(event.target.value as CharacterInvite["edition"])
                }
                disabled={busy}
              >
                <option value="any">Игрок выбирает 2014 / 2024</option>
                <option value="2014">D&D 2014</option>
                <option value="2024">D&D 2024</option>
              </select>
            </label>
            <label>
              Стартовый уровень
              <select
                value={level}
                onChange={(event) => setLevel(Number(event.target.value))}
                disabled={busy}
              >
                {Array.from({ length: 20 }, (_, index) => (
                  <option key={index} value={index + 1}>
                    {index + 1} уровень
                  </option>
                ))}
              </select>
            </label>
            <button
              className="ch-button ch-primary"
              type="button"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const link = await characterApi.saveInvite(campaignId, {
                    edition,
                    level,
                  });
                  setInvite(link);
                  setNotice("Приглашение готово. Отправьте ссылку игрокам.");
                })
              }
            >
              {busy
                ? "Загружаем…"
                : invite
                  ? "Сохранить условия"
                  : "Создать приглашение"}
            </button>
          </div>
          {invite && (
            <>
              <div className="ch-share-field">
                <input
                  aria-label="Ссылка приглашения игроков"
                  readOnly
                  value={shareURL}
                  onFocus={(event) => event.target.select()}
                />
                <button
                  type="button"
                  className="ch-button"
                  onClick={() =>
                    void run(async () => {
                      await copyCharacterLink(shareURL);
                      setNotice("Ссылка скопирована");
                    })
                  }
                  disabled={busy}
                >
                  Копировать
                </button>
                <a
                  className="ch-button"
                  href={shareURL}
                  target="_blank"
                  rel="noreferrer"
                >
                  Открыть ↗
                </a>
              </div>
              <p className="ch-muted">
                По этой ссылке можно создать персонажа. Закрытые заметки мастера
                и чужие листы игрокам недоступны.
              </p>
              <div className="ch-inline-actions">
                <button
                  className="ch-text-button"
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      setInvite(
                        await characterApi.saveInvite(campaignId, {
                          edition,
                          level,
                          rotate: true,
                        }),
                      );
                      setNotice(
                        "Новая ссылка готова. Старое приглашение больше не действует.",
                      );
                    })
                  }
                >
                  Выпустить новую ссылку
                </button>
                <button
                  className="ch-text-button"
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await characterApi.revokeInvite(campaignId);
                      setInvite(null);
                      setNotice(
                        "Приглашение закрыто. Уже созданные листы сохранены.",
                      );
                    })
                  }
                >
                  Закрыть приглашение
                </button>
              </div>
            </>
          )}
        </div>
      )}
      <div className="ch-roster-toolbar">
        <strong>
          Листы игроков <span className="ch-count">{sheets.length}</span>
        </strong>
        <div className="ch-inline-actions">
          <a className="ch-text-button" href="#characters">
            Открыть генератор ↗
          </a>
          <button
            className="ch-text-button"
            type="button"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const updated =
                  (await characterApi.listSheets(campaignId)) || [];
                setSheets(updated);
                setSelected((current) =>
                  current
                    ? updated.find((sheet) => sheet.id === current.id) || null
                    : null,
                );
                onRefresh();
                setNotice("Листы обновлены");
              })
            }
          >
            Обновить
          </button>
        </div>
      </div>
      {sheets.length > 0 ? (
        <div className="ch-roster">
          {sheets.map((sheet) => (
            <button
              type="button"
              className={`ch-roster-card ${selected?.id === sheet.id ? "is-selected" : ""}`}
              key={sheet.id}
              onClick={() =>
                setSelected(selected?.id === sheet.id ? null : sheet)
              }
            >
              <span className="ch-roster-rune" aria-hidden="true">
                {sheet.draft.name.slice(0, 1)}
              </span>
              <span>
                <strong>{sheet.draft.name}</strong>
                <small>
                  {sheet.draft.playerName || "Игрок"} ·{" "}
                  {sheet.draft.targetLevel} ур. · {sheet.draft.edition}
                </small>
              </span>
              <span aria-hidden="true">↗</span>
            </button>
          ))}
        </div>
      ) : (
        !busy && (
          <p className="ch-muted">
            Пока нет листов из генератора. Первый герой появится после
            завершения создания по приглашению.
          </p>
        )
      )}
      {selected && (
        <div className="ch-roster-sheet">
          <button
            className="ch-text-button"
            type="button"
            onClick={() => setSelected(null)}
          >
            ← Свернуть лист
          </button>
          <CharacterSheet
            draft={selected.draft}
            savedLabel={`В кампании · ${selected.draft.playerName || "Игрок"}`}
          />
        </div>
      )}
      {error && (
        <p role="alert" className="ch-error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="ch-notice">
          {notice}
        </p>
      )}
    </section>
  );
}
