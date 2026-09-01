import type {
  CodexConnectionStatus,
  CodexDeviceCodeResult,
  CodexRateLimitSnapshot,
  CodexRateLimitWindow
} from "@shadow-edge/shared-types";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../app/api";

const stateLabel: Record<CodexConnectionStatus["state"], string> = {
  disabled: "Отключено сервером",
  unavailable: "Codex недоступен",
  disconnected: "Не подключён",
  connecting: "Ожидает входа",
  connected: "ChatGPT подключён",
  error: "Ошибка подключения"
};

const formatReset = (resetsAt?: number) => {
  if (!resetsAt) return "";
  const date = new Date(resetsAt * 1000);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" }).format(date);
};

function RateLimitBar({ label, window }: { label: string; window?: CodexRateLimitWindow }) {
  if (!window) return null;
  const percent = Math.max(0, Math.min(100, window.usedPercent));
  return (
    <div className="codex-limit-row">
      <div><span>{label}</span><small>{percent}% использовано{formatReset(window.resetsAt) ? ` · сброс ${formatReset(window.resetsAt)}` : ""}</small></div>
      <div className="codex-limit-track"><span style={{ width: `${percent}%` }} /></div>
    </div>
  );
}

function RateLimitCard({ snapshot }: { snapshot: CodexRateLimitSnapshot }) {
  if (!snapshot.primary && !snapshot.secondary) return null;
  return (
    <article className="codex-limit-card">
      <strong>{snapshot.limitName || snapshot.limitId || "Лимиты ChatGPT"}</strong>
      <RateLimitBar label="Основное окно" window={snapshot.primary} />
      <RateLimitBar label="Дополнительное окно" window={snapshot.secondary} />
      {snapshot.rateLimitReachedType ? <small className="codex-limit-warning">Достигнут лимит: {snapshot.rateLimitReachedType}</small> : null}
    </article>
  );
}

export function CodexConnectionPanel({
  campaignId,
  onPromptStarted
}: {
  campaignId?: string;
  onPromptStarted?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<CodexConnectionStatus | null>(null);
  const [ceremony, setCeremony] = useState<CodexDeviceCodeResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [includeImages, setIncludeImages] = useState(false);
  const [promptBusy, setPromptBusy] = useState(false);
  const [promptNotice, setPromptNotice] = useState("");

  const refresh = useCallback(async (silent = false) => {
    try {
      if (!silent) setBusy(true);
      const next = await api.getCodexConnectionStatus();
      setStatus(next);
      if (next.state === "connected") setCeremony(null);
      if (!silent) setError("");
    } catch (nextError) {
      if (!silent) setError(nextError instanceof Error ? nextError.message : "Не удалось проверить Codex App Server.");
    } finally {
      if (!silent) setBusy(false);
    }
  }, []);

  useEffect(() => {
    void refresh(true);
  }, [refresh]);

  useEffect(() => {
    if (status?.state !== "connecting" && !ceremony) return undefined;
    const interval = window.setInterval(() => void refresh(true), 2_500);
    return () => window.clearInterval(interval);
  }, [ceremony, refresh, status?.state]);

  const limits = useMemo(() => {
    const values = [status?.rateLimits, ...Object.values(status?.rateLimitsByLimitId ?? {})]
      .filter((value): value is CodexRateLimitSnapshot => Boolean(value));
    return Array.from(new Map(values.map((value, index) => [value.limitId || value.limitName || String(index), value])).values());
  }, [status]);

  const connect = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await api.connectCodexChatGPT();
      setCeremony(result);
      setStatus(result.status);
      setOpen(true);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Не удалось начать подключение ChatGPT.");
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    setError("");
    try {
      const next = await api.disconnectCodexChatGPT();
      setStatus(next);
      setCeremony(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Не удалось отключить ChatGPT.");
    } finally {
      setBusy(false);
    }
  };

  const copyCode = async () => {
    if (!ceremony?.userCode) return;
    try {
      await navigator.clipboard.writeText(ceremony.userCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_800);
    } catch {
      setError("Не удалось скопировать код. Выдели его вручную.");
    }
  };

  const runPrompt = async () => {
    const normalizedPrompt = prompt.trim();
    if (!normalizedPrompt) {
      setError("Опиши, какое предложение должен подготовить Codex.");
      return;
    }
    setPromptBusy(true);
    setError("");
    setPromptNotice("");
    try {
      const result = await api.runCodexPrompt({
        campaignId: campaignId || undefined,
        prompt: normalizedPrompt,
        includeImages
      });
      setPrompt("");
      setIncludeImages(false);
      const proposalSuffix = result.proposalIds.length
        ? ` ID: ${result.proposalIds.join(", ")}.`
        : "";
      const resultDetail = (result.message ?? "").trim();
      setPromptNotice(`Codex создал предложение для проверки.${proposalSuffix}${resultDetail ? ` ${resultDetail}` : ""}`);
      onPromptStarted?.();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Не удалось отправить задачу в Codex.");
    } finally {
      setPromptBusy(false);
    }
  };

  const currentState = status?.state ?? "unavailable";

  return (
    <section className={`codex-connection-panel ${currentState}`}>
      <button className="codex-connection-summary" onClick={() => setOpen((current) => !current)} type="button">
        <span className="codex-connection-orb" />
        <span>
          <small>Подключение AI</small>
          <strong>{status ? stateLabel[status.state] : "Проверяю Codex App Server…"}</strong>
        </span>
        {status?.planType ? <em>{status.planType}</em> : null}
        <b aria-hidden="true">{open ? "⌃" : "⌄"}</b>
      </button>

      {open ? (
        <div className="codex-connection-body">
          {status?.message ? <p className="codex-connection-message">{status.message}</p> : null}
          {error ? <div className="ai-proposal-alert danger">{error}</div> : null}

          {ceremony && status?.state !== "connected" ? (
            <div className="codex-device-card">
              <div>
                <small>Одноразовый код</small>
                <strong>{ceremony.userCode}</strong>
                <span>Открой официальный адрес, введи код и заверши вход в свой ChatGPT.</span>
              </div>
              <div className="actions">
                <button className="ghost" onClick={() => void copyCode()} type="button">{copied ? "Скопировано" : "Копировать код"}</button>
                <a className="primary codex-verification-link" href={ceremony.verificationUrl} rel="noreferrer" target="_blank">Открыть вход ChatGPT</a>
              </div>
            </div>
          ) : null}

          {limits.length ? <div className="codex-limits">{limits.map((limit, index) => <RateLimitCard key={limit.limitId || limit.limitName || index} snapshot={limit} />)}</div> : null}

          {status?.state === "connected" ? (
            <section className="codex-embedded-prompt">
              <div>
                <strong>Попросить Codex подготовить предложение</strong>
                <small>Codex использует те же MCP-инструменты: результат попадёт в AI-черновики и не применится сам.</small>
              </div>
              <textarea
                className="input textarea"
                disabled={promptBusy}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder={campaignId
                  ? "Например: подготовь новый квест для текущей кампании с двумя НПС и ключевой сценой."
                  : "Например: подготовь новую кампанию с мрачным северным сеттингом и первой игровой сценой."}
                value={prompt}
              />
              <div className="codex-embedded-prompt-actions">
                <label>
                  <input checked={includeImages} disabled={promptBusy} onChange={(event) => setIncludeImages(event.target.checked)} type="checkbox" />
                  <span>Изображения только для выбранных сущностей (арт / галерея)</span>
                </label>
                <button className="primary" disabled={promptBusy || !prompt.trim()} onClick={() => void runPrompt()} type="button">
                  {promptBusy ? "Codex начинает работу…" : "Отправить в Codex"}
                </button>
              </div>
              {promptNotice ? <div className="ai-proposal-alert success">{promptNotice}</div> : null}
            </section>
          ) : null}

          {status?.modes.length ? (
            <div className="codex-provider-modes">
              {status.modes.map((mode) => (
                <article className={mode.available ? "available" : "unavailable"} key={mode.id}>
                  <span>{mode.available ? "✓" : "—"}</span>
                  <div><strong>{mode.label}</strong><small>{mode.description}</small></div>
                </article>
              ))}
            </div>
          ) : null}

          <div className="ai-proposal-actions">
            <button className="ghost" disabled={busy} onClick={() => void refresh()} type="button">{busy ? "Проверяю…" : "Обновить статус"}</button>
            {status?.state === "connected" ? (
              <button className="ghost danger-action" disabled={busy} onClick={() => void disconnect()} type="button">Отключить ChatGPT</button>
            ) : (
              <button className="primary" disabled={busy || Boolean(ceremony) || !status?.enabled || !status.available || status.state === "connecting"} onClick={() => void connect()} type="button">
                {status?.state === "connecting" || ceremony ? "Ожидаю подтверждения…" : "Подключить свой ChatGPT"}
              </button>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
