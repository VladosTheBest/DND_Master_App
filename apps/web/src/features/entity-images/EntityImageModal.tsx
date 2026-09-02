import type { AIProposal, KnowledgeEntity } from "@shadow-edge/shared-types";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortraitSource, kindTitle } from "../../app-shared";
import type { EntityImageGenerationResult } from "../ai-proposals/useAIProposalController";
import "./entity-images.css";

type ImageMode = "automatic" | "custom";

type EntityImageModalProps = {
  busyElsewhere: boolean;
  campaignId: string;
  displayUrl?: string;
  entity: KnowledgeEntity | null;
  onClose: () => void;
  onGenerate: (entity: KnowledgeEntity, direction?: string) => Promise<EntityImageGenerationResult>;
  onOpenAIInbox: () => void;
  onOpenProposal: (proposalId: string) => Promise<void> | void;
  onShowToPlayers: (input: { alt: string; caption?: string; title: string; url: string }) => Promise<string | void> | string | void;
  pendingProposals: readonly AIProposal[];
  showToPlayersBusy?: boolean;
};

const formatElapsed = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
};

const proposalPreview = (proposal: AIProposal | null) => {
  const candidates = proposal?.mediaIntents.filter((intent) =>
    intent.field === "art.url"
    && intent.selected !== false
    && intent.status === "staged"
    && Boolean(intent.previewUrl)
  ) ?? [];
  return candidates.length === 1 ? candidates[0] : undefined;
};

const entityImageStateKey = (campaignId: string, entity: KnowledgeEntity) => JSON.stringify([
  campaignId,
  entity.kind,
  entity.id,
  entity.revision ?? null,
  entity.art?.url?.trim() ?? "",
  entity.art?.alt?.trim() ?? "",
  entity.art?.caption?.trim() ?? ""
]);

export function EntityImageModal({
  busyElsewhere,
  campaignId,
  displayUrl,
  entity,
  onClose,
  onGenerate,
  onOpenAIInbox,
  onOpenProposal,
  onShowToPlayers,
  pendingProposals,
  showToPlayersBusy = false
}: EntityImageModalProps) {
  const [mode, setMode] = useState<ImageMode>("automatic");
  const [customPrompt, setCustomPrompt] = useState("");
  const [inFlightKey, setInFlightKey] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState("");
  const [shareError, setShareError] = useState("");
  const [result, setResult] = useState<EntityImageGenerationResult | null>(null);
  const [currentImageFailed, setCurrentImageFailed] = useState(false);
  const [previewImageFailed, setPreviewImageFailed] = useState(false);
  const backdropRef = useRef<HTMLDivElement | null>(null);
  const automaticModeRef = useRef<HTMLButtonElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const customModeRef = useRef<HTMLButtonElement | null>(null);
  const generationOptionsRef = useRef<HTMLElement | null>(null);
  const modalRef = useRef<HTMLElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const suppressReturnFocusRef = useRef(false);
  const previousEntityKeyRef = useRef<string | null>(null);
  const activeEntityKeyRef = useRef<string | null>(null);
  const inFlightStartedAtRef = useRef(0);
  const resultsByEntityRef = useRef(new Map<string, EntityImageGenerationResult>());
  const errorsByEntityRef = useRef(new Map<string, string>());
  const entityKey = entity ? entityImageStateKey(campaignId, entity) : null;
  const pendingProposalById = useMemo(
    () => new Map(pendingProposals.map((proposal) => [proposal.id, proposal])),
    [pendingProposals]
  );
  activeEntityKeyRef.current = entityKey;
  const generating = Boolean(entityKey && inFlightKey === entityKey);
  const requestInFlight = Boolean(inFlightKey);

  useEffect(() => {
    const nextKey = entityKey;
    if (nextKey && previousEntityKeyRef.current !== nextKey) {
      const cachedResult = resultsByEntityRef.current.get(nextKey);
      const currentProposal = cachedResult ? pendingProposalById.get(cachedResult.proposal.id) : undefined;
      const synchronizedResult = cachedResult && currentProposal
        ? { ...cachedResult, proposal: currentProposal }
        : null;
      if (synchronizedResult) {
        resultsByEntityRef.current.set(nextKey, synchronizedResult);
      } else {
        resultsByEntityRef.current.delete(nextKey);
      }
      returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setMode("automatic");
      setCustomPrompt("");
      setElapsedSeconds(0);
      setError(errorsByEntityRef.current.get(nextKey) ?? "");
      setShareError("");
      setResult(synchronizedResult);
      setCurrentImageFailed(false);
      setPreviewImageFailed(false);
      window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    }
    if (!nextKey && previousEntityKeyRef.current && !suppressReturnFocusRef.current) {
      window.requestAnimationFrame(() => returnFocusRef.current?.focus());
    }
    if (!nextKey) suppressReturnFocusRef.current = false;
    previousEntityKeyRef.current = nextKey;
  }, [entityKey, pendingProposalById]);

  useEffect(() => {
    if (!entityKey) return;
    setResult((current) => {
      if (!current) return current;
      const currentProposal = pendingProposalById.get(current.proposal.id);
      if (!currentProposal) {
        resultsByEntityRef.current.delete(entityKey);
        return null;
      }
      if (currentProposal === current.proposal) return current;
      const synchronizedResult = { ...current, proposal: currentProposal };
      resultsByEntityRef.current.set(entityKey, synchronizedResult);
      return synchronizedResult;
    });
  }, [entityKey, pendingProposalById]);

  useEffect(() => {
    if (!entity) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(modalRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
      ) ?? []).filter((item) => !item.hasAttribute("hidden") && item.getAttribute("aria-hidden") !== "true");
      if (!focusable.length) {
        event.preventDefault();
        modalRef.current?.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (!modalRef.current?.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [entity, onClose]);

  useEffect(() => {
    if (!entity) return undefined;
    const backdrop = backdropRef.current;
    const parent = backdrop?.parentElement;
    if (!backdrop || !parent) return undefined;
    const siblings = Array.from(parent.children)
      .filter((node): node is HTMLElement => node instanceof HTMLElement && node !== backdrop)
      .map((node) => ({ node, inert: node.inert }));
    siblings.forEach(({ node }) => {
      node.inert = true;
    });
    return () => siblings.forEach(({ node, inert }) => {
      node.inert = inert;
    });
  }, [entity]);

  useEffect(() => {
    if (!inFlightKey) return undefined;
    const timer = window.setInterval(
      () => setElapsedSeconds(Math.floor((Date.now() - inFlightStartedAtRef.current) / 1000)),
      1000
    );
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("beforeunload", warnBeforeUnload);
    };
  }, [inFlightKey]);

  const preview = useMemo(() => proposalPreview(result?.proposal ?? null), [result]);
  useEffect(() => setPreviewImageFailed(false), [preview?.previewUrl]);
  useEffect(() => setCurrentImageFailed(false), [displayUrl, entity?.art?.url, entity?.id]);
  if (!entity) return null;

  const placeholderUrl = createPortraitSource({ ...entity, art: undefined });
  const configuredCurrentUrl = entity.art?.url?.trim() || displayUrl?.trim();
  const appliedOrDisplayedUrl = currentImageFailed ? placeholderUrl : configuredCurrentUrl || placeholderUrl;
  const rawPreviewUrl = preview?.previewUrl;
  const previewUrl = previewImageFailed ? undefined : rawPreviewUrl;
  const visibleUrl = previewUrl || appliedOrDisplayedUrl;
  const placeholderAlt = `${entity.title}: изображение-заглушка`;
  const currentAlt = configuredCurrentUrl && !currentImageFailed
    ? entity.art?.alt?.trim() || entity.title
    : placeholderAlt;
  const visibleAlt = previewUrl ? preview?.alt || preview?.caption || entity.title : currentAlt;
  const customModeInvalid = mode === "custom" && !customPrompt.trim();

  const generate = async () => {
    if (customModeInvalid || requestInFlight || busyElsewhere) return;
    const requestedKey = entityKey;
    if (!requestedKey) return;
    setInFlightKey(requestedKey);
    inFlightStartedAtRef.current = Date.now();
    setElapsedSeconds(0);
    setError("");
    errorsByEntityRef.current.delete(requestedKey);
    setResult(null);
    resultsByEntityRef.current.delete(requestedKey);
    try {
      const next = await onGenerate(entity, mode === "custom" ? customPrompt.trim() : undefined);
      resultsByEntityRef.current.set(requestedKey, next);
      if (activeEntityKeyRef.current === requestedKey) {
        setResult(next);
      }
    } catch (nextError) {
      const nextMessage = nextError instanceof Error ? nextError.message : "Не удалось подготовить изображение.";
      errorsByEntityRef.current.set(requestedKey, nextMessage);
      if (activeEntityKeyRef.current === requestedKey) {
        setError(nextMessage);
      }
    } finally {
      setInFlightKey((current) => current === requestedKey ? null : current);
    }
  };

  return (
    <div className="entity-image-backdrop" onMouseDown={onClose} ref={backdropRef} role="presentation">
      <section
        aria-describedby="entity-image-modal-description"
        aria-label={`Изображение: ${entity.title}`}
        aria-modal="true"
        className="panel entity-image-modal"
        onMouseDown={(event) => event.stopPropagation()}
        ref={modalRef}
        role="dialog"
        tabIndex={-1}
      >
        <header className="entity-image-modal-head">
          <div>
            <p className="eyebrow">{kindTitle[entity.kind]} · изображение карточки</p>
            <h2>{entity.title}</h2>
            <p className="copy" id="entity-image-modal-description">
              Генерация создаёт отдельный AI-черновик. Текущее изображение заменится только после твоего подтверждения.
            </p>
          </div>
          <button className="ghost" onClick={onClose} ref={closeButtonRef} type="button">
            {generating ? "Свернуть" : "Закрыть"}
          </button>
        </header>

        <div className={`entity-image-stage ${previewUrl ? "draft-preview" : "current-image"}`}>
          <img
            alt={visibleAlt}
            onError={() => {
              if (previewUrl) {
                setPreviewImageFailed(true);
              } else if (configuredCurrentUrl) {
                setCurrentImageFailed(true);
              }
            }}
            src={visibleUrl}
          />
          <div className="entity-image-stage-badge">
            <strong>{previewUrl ? "Предпросмотр AI-черновика" : configuredCurrentUrl && !currentImageFailed ? "Текущее изображение" : "Заглушка карточки"}</strong>
            <small>{previewUrl ? "Игроки увидят его только после применения" : "Можно показать игрокам прямо сейчас"}</small>
          </div>
        </div>

        <div className="entity-image-primary-actions">
          <button
            className="ghost"
            disabled={showToPlayersBusy}
            onClick={() => {
              setShareError("");
              void Promise.resolve(onShowToPlayers({
                alt: currentAlt,
                title: entity.title,
                url: appliedOrDisplayedUrl
              }))
                .then((nextError) => setShareError(typeof nextError === "string" ? nextError : ""))
                .catch((nextError) => setShareError(nextError instanceof Error ? nextError.message : "Не удалось показать изображение игрокам."));
            }}
            type="button"
          >
            {showToPlayersBusy ? "Показываю…" : previewUrl ? "Показать игрокам текущее" : "Поделиться с игроками"}
          </button>
          <button
            className="primary"
            disabled={requestInFlight || busyElsewhere}
            onClick={() => {
              if (entityKey) {
                resultsByEntityRef.current.delete(entityKey);
                errorsByEntityRef.current.delete(entityKey);
              }
              setResult(null);
              setError("");
              generationOptionsRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
              window.requestAnimationFrame(() => generationOptionsRef.current?.focus());
            }}
            type="button"
          >
            {busyElsewhere && !generating ? "Codex уже занят" : configuredCurrentUrl ? "Сгенерировать новое" : "Создать изображение"}
          </button>
        </div>

        <p className="entity-image-share-note">Игроки увидят текущее изображение и название карточки. Закрытое описание и AI-предпросмотр не отправляются.</p>
        {shareError ? <p className="entity-image-share-error" role="alert">{shareError}</p> : null}

        <section className="entity-image-generation" id="entity-image-generation-options" ref={generationOptionsRef} tabIndex={-1}>
          <header>
            <div>
              <strong>Как подготовить изображение?</strong>
              <small>В обоих режимах Codex читает карточку и сохраняет результат только в очередь черновиков.</small>
            </div>
            <button
              className="ghost compact"
              onClick={() => {
                if (entityKey) {
                  errorsByEntityRef.current.delete(entityKey);
                  setError("");
                }
                suppressReturnFocusRef.current = true;
                onOpenAIInbox();
              }}
              type="button"
            >Подключение и очередь</button>
          </header>

          <div
            aria-label="Режим генерации"
            className="entity-image-mode-grid"
            onKeyDown={(event) => {
              if (requestInFlight || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
              event.preventDefault();
              const nextMode: ImageMode = mode === "automatic" ? "custom" : "automatic";
              setMode(nextMode);
              window.requestAnimationFrame(() => (nextMode === "automatic" ? automaticModeRef : customModeRef).current?.focus());
            }}
            role="radiogroup"
          >
            <button
              aria-checked={mode === "automatic"}
              className={mode === "automatic" ? "selected" : ""}
              disabled={generating}
              onClick={() => setMode("automatic")}
              ref={automaticModeRef}
              role="radio"
              tabIndex={mode === "automatic" ? 0 : -1}
              type="button"
            >
              <strong>По карточке автоматически</strong>
              <span>AI прочитает тип, описание, факты, связи и контекст кампании и сам составит визуальный промпт.</span>
            </button>
            <button
              aria-checked={mode === "custom"}
              className={mode === "custom" ? "selected" : ""}
              disabled={generating}
              onClick={() => setMode("custom")}
              ref={customModeRef}
              role="radio"
              tabIndex={mode === "custom" ? 0 : -1}
              type="button"
            >
              <strong>По моему описанию</strong>
              <span>Ты задаёшь сцену, стиль или детали; AI дополнит их достоверной информацией из карточки.</span>
            </button>
          </div>

          {mode === "custom" ? (
            <label className="field entity-image-prompt-field">
              <span>Что должно быть на изображении</span>
              <textarea
                autoFocus
                className="input textarea"
                disabled={generating}
                maxLength={4000}
                onChange={(event) => setCustomPrompt(event.target.value)}
                placeholder="Например: ночная сцена у замёрзшей реки, широкоугольный кадр, тёплый свет таверны вдали, без текста и интерфейса."
                value={customPrompt}
              />
              <small>{customPrompt.length}/4000 · описание карточки добавится автоматически</small>
            </label>
          ) : (
            <div className="entity-image-context-summary">
              <span aria-hidden="true">✦</span>
              <p><strong>Самостоятельная генерация</strong><small>Codex сначала прочитает полную сущность «{entity.title}» и только затем выберет композицию.</small></p>
            </div>
          )}

          {generating ? (
            <div className="entity-image-progress">
              <span className="entity-image-status-announcement" role="status">Codex начал подготовку изображения и безопасного черновика.</span>
              <span className="entity-image-progress-orbit" aria-hidden="true"><i /><i /><i /></span>
              <div>
                <strong>Готовлю изображение и безопасный черновик · {formatElapsed(elapsedSeconds)}</strong>
                <span>Обычно 1–4 минуты. Можно свернуть это окно, но оставь вкладку открытой.</span>
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="entity-image-message danger" role="alert">
              <strong>Изображение не создано</strong>
              <span>{error}</span>
              <small>Кампания не изменилась. Проверь подключение в AI-черновиках и попробуй ещё раз.</small>
            </div>
          ) : null}

          {result ? (
            <div className={`entity-image-message ${previewUrl ? "success" : "warning"}`} role="status">
              <strong>{previewUrl ? "Изображение готово и сохранено в черновике" : rawPreviewUrl && previewImageFailed ? "Предпросмотр черновика не загрузился" : "Черновик сохранён без готового изображения"}</strong>
              <span>{previewImageFailed
                ? "Файл предпросмотра недоступен. Кампания не изменилась; открой черновик, отклони его и повтори генерацию."
                : result.warning || "Проверь результат крупно, затем примени его — только после этого изменится карточка."}</span>
              <button
                className="primary"
                onClick={() => {
                  suppressReturnFocusRef.current = true;
                  onClose();
                  void onOpenProposal(result.proposal.id);
                }}
                type="button"
              >
                {previewUrl ? "Открыть черновик и подтвердить" : "Открыть черновик и разобраться"}
              </button>
            </div>
          ) : null}

          <footer>
            <div>
              <strong>Сейчас ничего не заменяется</strong>
              <small>Старое изображение останется на месте, пока ты не нажмёшь «Применить выбранное» в черновике.</small>
            </div>
            <button
              className="primary"
              disabled={requestInFlight || busyElsewhere || customModeInvalid}
              onClick={() => void generate()}
              type="button"
            >
              {generating ? "Генерирую…" : "Сгенерировать в черновик"}
            </button>
          </footer>
        </section>
      </section>
    </div>
  );
}
