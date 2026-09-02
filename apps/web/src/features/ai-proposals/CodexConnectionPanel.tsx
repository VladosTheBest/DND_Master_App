import type {
  CodexConnectionStatus,
  CodexDeviceCodeResult,
  CodexRateLimitSnapshot,
  CodexRateLimitWindow
} from "@shadow-edge/shared-types";
import { isApiError } from "@shadow-edge/api-client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../app/api";

type PromptFailure = {
  title: string;
  message: string;
  reason: string;
  nextStep: string;
};

type ActivePrompt = {
  text: string;
  includeImages: boolean;
};

const promptSteps = [
  "Защищённое подключение",
  "Чтение контекста через MCP",
  "Подготовка содержания",
  "Проверка и сохранение черновика"
];

const formatElapsed = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  return `${minutes}:${String(safeSeconds % 60).padStart(2, "0")}`;
};

const proposalCountLabel = (count: number) => {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} проверяемый черновик`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} проверяемых черновика`;
  return `${count} проверяемых черновиков`;
};

const likelyPromptStep = (elapsedSeconds: number, includeImages: boolean) => {
  if (elapsedSeconds < 12) return 0;
  if (elapsedSeconds < 50) return 1;
  if (elapsedSeconds < (includeImages ? 170 : 135)) return 2;
  return 3;
};

const describePromptFailure = (error: unknown): PromptFailure => {
  if (isApiError(error)) {
    switch (error.code) {
      case "codex_proposal_tool_not_called":
        return {
          title: "Codex ответил, но не создал черновик",
          message: "Codex закончил текстовый ответ, не вызвав безопасный MCP-инструмент создания предложения.",
          reason: "Текст ответа сам по себе не может попасть в очередь: сайту нужен сохранённый proposal с проверяемым ID.",
          nextStep: "Повтори запрос. Для большой задачи можно явно попросить создать несколько отдельных черновиков: квест, НПС и локации."
        };
      case "codex_proposal_tool_failed":
        return {
          title: "Инструмент создания черновика не сработал",
          message: "Codex попытался сохранить предложение, но MCP-инструмент завершился с ошибкой.",
          reason: "Сервер не принял неполный результат, поэтому кампания и очередь остались в безопасном состоянии.",
          nextStep: "Обнови статус подключения и повтори запрос. Если ошибка повторяется, сократи задачу до одного типа сущности."
        };
      case "codex_proposal_not_verified":
        return {
          title: "Сайт не смог подтвердить новый черновик",
          message: "Codex вызвал инструмент, но сервер не нашёл подходящий новый pending-черновик для этой кампании.",
          reason: "Так бывает при неподходящем типе proposal, неполном результате или несовпадении кампании. Непроверенный результат намеренно не показывается как успешный.",
          nextStep: "Сначала проверь очередь, затем повтори запрос. Для существующей кампании проси отдельные черновики сущностей, а не новую кампанию."
        };
      case "codex_bridge_timeout":
        return {
          title: "Codex не успел завершить задачу",
          message: "Основной этап достиг серверного лимита примерно в четыре минуты и был остановлен.",
          reason: "Длинный составной запрос или генерация изображений могут не уложиться в один запуск.",
          nextStep: "Повтори без изображений или раздели задачу на несколько запросов — например, сначала квест, затем НПС и локации."
        };
      default:
        return {
          title: "Не удалось подготовить черновик",
          message: error.message || "Codex App Server завершил запрос с ошибкой.",
          reason: "Кампания не изменилась: сайт применяет только подтверждённые черновики после твоего отдельного согласия.",
          nextStep: "Проверь подключение ChatGPT, обнови очередь и повтори запрос."
        };
    }
  }
  return {
    title: "Не удалось подготовить черновик",
    message: error instanceof Error ? error.message : "Codex App Server завершил запрос с ошибкой.",
    reason: "Кампания не изменилась, потому что подтверждённый черновик не был получен.",
    nextStep: "Проверь подключение ChatGPT, обнови очередь и повтори запрос."
  };
};

function CodexPromptProgress({ activePrompt, elapsedSeconds }: { activePrompt: ActivePrompt; elapsedSeconds: number }) {
  const activeStep = likelyPromptStep(elapsedSeconds, activePrompt.includeImages);
  return (
    <section aria-busy="true" aria-label="Codex готовит проверяемый черновик" className="codex-prompt-progress">
      <header>
        <span aria-hidden="true" className="codex-working-sigil"><i /></span>
        <div aria-live="polite" role="status">
          <small>Запрос принят</small>
          <strong>Codex готовит проверяемый черновик</strong>
        </div>
        <time dateTime={`PT${elapsedSeconds}S`}>{formatElapsed(elapsedSeconds)}</time>
      </header>

      <p>
        Это не обычный чат: Codex читает нужный контекст, собирает сущности и связи, а затем сайт проверяет сохранённое предложение.
        Точного процента Codex не сообщает.
      </p>

      <div aria-label="Выполнение запроса Codex" aria-valuetext={promptSteps[activeStep]} className="codex-prompt-progress-track" role="progressbar">
        <span />
      </div>

      <small className="codex-prompt-stage-note">Ориентировочный этап · порядок зависит от задачи</small>
      <div className="codex-prompt-steps">
        {promptSteps.map((step, index) => (
          <span className={index === activeStep ? "active" : ""} key={step}>
            <i>{index + 1}</i>{step}
          </span>
        ))}
      </div>

      <div className="codex-prompt-guardrails">
        <div><strong>Можно свернуть окно</strong><span>Запрос продолжится, пока эта вкладка открыта.</span></div>
        <div className="warning"><strong>Не закрывай и не обновляй вкладку</strong><span>Иначе текущая работа будет прервана.</span></div>
        <div><strong>Ориентир по времени</strong><span>Обычно 1–3 минуты; основной этап ограничен примерно 4 минутами.</span></div>
      </div>

      <details className="codex-active-request">
        <summary>Что именно сейчас выполняется</summary>
        <p>{activePrompt.text}</p>
        <small>{activePrompt.includeImages ? "Включена подготовка выбранных изображений — это может занять больше времени." : "Изображения не генерируются."}</small>
      </details>
    </section>
  );
}

function CodexWorkflowGuide() {
  return (
    <div className="codex-workflow-guide">
      <div><strong>Как это работает</strong><span>Кампания изменится только после твоего нажатия «Применить».</span></div>
      <ol>
        <li><i>1</i><span><strong>Чтение</strong><small>Codex получает нужный контекст кампании через MCP.</small></span></li>
        <li><i>2</i><span><strong>Подготовка</strong><small>Создаёт один или несколько безопасных proposal-черновиков.</small></span></li>
        <li><i>3</i><span><strong>Проверка</strong><small>Сервер подтверждает владельца, кампанию и сохранённый ID.</small></span></li>
        <li><i>4</i><span><strong>Решение за тобой</strong><small>Ты сравниваешь изменения и отдельно применяешь или отклоняешь их.</small></span></li>
      </ol>
    </div>
  );
}

function CodexPromptFailure({ failure, onRefresh, onRetry }: { failure: PromptFailure; onRefresh: () => void; onRetry: () => void }) {
  return (
    <section className="codex-prompt-failure" role="alert">
      <header><span aria-hidden="true">!</span><div><small>Черновик не создан</small><strong>{failure.title}</strong></div></header>
      <p>{failure.message}</p>
      <div><strong>Что это значит</strong><span>{failure.reason}</span></div>
      <div><strong>Что делать</strong><span>{failure.nextStep}</span></div>
      <p className="codex-prompt-failure-safety">Ни одно изменение не применено к кампании.</p>
      <footer className="actions">
        <button className="ghost" onClick={onRefresh} type="button">Проверить очередь</button>
        <button className="primary" onClick={onRetry} type="button">Повторить запрос</button>
      </footer>
    </section>
  );
}

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
  onPromptOutcome,
  onPromptRunningChange,
  onPromptSettled,
  onProposalsCreated
}: {
  campaignId?: string;
  onPromptOutcome?: (outcome: "error" | "warning" | null) => void;
  onPromptRunningChange?: (running: boolean) => void;
  onPromptSettled?: () => void;
  onProposalsCreated?: (proposalIds: string[], hasWarning: boolean) => void;
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
  const [promptWarning, setPromptWarning] = useState("");
  const [promptFailure, setPromptFailure] = useState<PromptFailure | null>(null);
  const [promptStartedAt, setPromptStartedAt] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [activePrompt, setActivePrompt] = useState<ActivePrompt | null>(null);

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

  useEffect(() => {
    if (promptStartedAt === null) return undefined;
    const tick = () => setElapsedSeconds(Math.max(0, Math.floor((Date.now() - promptStartedAt) / 1000)));
    tick();
    const interval = window.setInterval(tick, 1_000);
    return () => window.clearInterval(interval);
  }, [promptStartedAt]);

  useEffect(() => {
    if (!promptBusy) return undefined;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [promptBusy]);

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
    const startedAt = Date.now();
    const requestSnapshot = { text: normalizedPrompt, includeImages };
    setPromptBusy(true);
    setPromptStartedAt(startedAt);
    setElapsedSeconds(0);
    setActivePrompt(requestSnapshot);
    onPromptRunningChange?.(true);
    setError("");
    setPromptNotice("");
    setPromptWarning("");
    setPromptFailure(null);
    onPromptOutcome?.(null);
    try {
      const result = await api.runCodexPrompt({
        campaignId: campaignId || undefined,
        prompt: normalizedPrompt,
        includeImages
      });
      setPrompt("");
      setIncludeImages(false);
      const elapsed = formatElapsed(Math.floor((Date.now() - startedAt) / 1000));
      const resultAction = result.warning ? "Проверь состав результата в очереди." : "Открываю результат для проверки.";
      setPromptNotice(`Готово за ${elapsed}: Codex создал ${proposalCountLabel(result.proposalIds.length)}. ${resultAction}`);
      setPromptWarning(result.warning || "");
      if (result.warning) setOpen(true);
      onPromptOutcome?.(result.warning ? "warning" : null);
      onProposalsCreated?.(result.proposalIds, Boolean(result.warning));
    } catch (nextError) {
      setPromptFailure(describePromptFailure(nextError));
      setOpen(true);
      onPromptOutcome?.("error");
    } finally {
      setPromptBusy(false);
      setPromptStartedAt(null);
      setActivePrompt(null);
      onPromptRunningChange?.(false);
      onPromptSettled?.();
    }
  };

  const currentState = status?.state ?? "unavailable";
  const promptOutcomeLabel = promptFailure
    ? "Codex: требуется проверка"
    : promptWarning
      ? "Codex: проверь состав результата"
      : "";

  return (
    <section className={`codex-connection-panel ${currentState} ${promptBusy ? "working" : ""}`.trim()}>
      <button className="codex-connection-summary" onClick={() => setOpen((current) => !current)} type="button">
        <span className="codex-connection-orb" />
        <span>
          <small>Подключение AI</small>
          <strong>{promptBusy ? `Codex готовит черновик · ${formatElapsed(elapsedSeconds)}` : promptOutcomeLabel || (status ? stateLabel[status.state] : "Проверяю Codex App Server…")}</strong>
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
            <section aria-busy={promptBusy} className="codex-embedded-prompt">
              <div>
                <strong>Попросить Codex подготовить предложение</strong>
                <small>Результат появится в очереди только после безопасного MCP-вызова и серверной проверки. Сам он ничего не применит.</small>
              </div>
              <CodexWorkflowGuide />

              {promptBusy && activePrompt ? (
                <CodexPromptProgress activePrompt={activePrompt} elapsedSeconds={elapsedSeconds} />
              ) : (
                <>
                  <textarea
                    className="input textarea"
                    onChange={(event) => setPrompt(event.target.value)}
                    placeholder={campaignId
                      ? "Например: подготовь новый квест для текущей кампании. Если нужны новые НПС и локации — создай для них отдельные черновики."
                      : "Например: подготовь новую кампанию с мрачным северным сеттингом и первой игровой сценой."}
                    value={prompt}
                  />
                  <div className="codex-prompt-expectations">
                    <span><strong>Обычно 1–3 минуты</strong><small>Сложные запросы и изображения могут занять почти весь лимит.</small></span>
                    <span><strong>Можно свернуть это окно</strong><small>Но вкладку нужно оставить открытой до результата.</small></span>
                    <span><strong>Без автоприменения</strong><small>После создания ты увидишь сравнение «до / после».</small></span>
                  </div>
                  <div className="codex-embedded-prompt-actions">
                    <label>
                      <input checked={includeImages} onChange={(event) => setIncludeImages(event.target.checked)} type="checkbox" />
                      <span>Подготовить изображения для выбранных сущностей (дольше)</span>
                    </label>
                    <button className="primary" disabled={!prompt.trim()} onClick={() => void runPrompt()} type="button">
                      Отправить в Codex
                    </button>
                  </div>
                </>
              )}
              {promptFailure ? (
                <CodexPromptFailure
                  failure={promptFailure}
                  onRefresh={() => onPromptSettled?.()}
                  onRetry={() => void runPrompt()}
                />
              ) : null}
              {promptNotice ? <div className="ai-proposal-alert success"><strong>Черновик подтверждён</strong><span>{promptNotice}</span></div> : null}
              {promptWarning ? <div className="ai-proposal-alert warning" role="status"><strong>Проверь состав результата</strong><span>{promptWarning}</span></div> : null}
            </section>
          ) : null}

          {status?.modes.length ? (
            <details className="codex-provider-details">
              <summary>Технические режимы подключения AI</summary>
              <div className="codex-provider-modes">
                {status.modes.map((mode) => (
                  <article className={mode.available ? "available" : "unavailable"} key={mode.id}>
                    <span>{mode.available ? "✓" : "—"}</span>
                    <div><strong>{mode.label}</strong><small>{mode.description}</small></div>
                  </article>
                ))}
              </div>
            </details>
          ) : null}

          <div className="ai-proposal-actions">
            <button className="ghost" disabled={busy} onClick={() => void refresh()} type="button">{busy ? "Проверяю…" : "Обновить статус"}</button>
            {status?.state === "connected" ? (
              <button className="ghost danger-action" disabled={busy || promptBusy} onClick={() => void disconnect()} type="button">
                {promptBusy ? "Codex занят" : "Отключить ChatGPT"}
              </button>
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
