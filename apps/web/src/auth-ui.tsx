import { useEffect, useState, type FormEvent } from "react";
import loginBgUrl from "./assets/login-bg.jpg";
import { OAuthControls } from "./app/OAuthControls";
import { formatPlaybackTime } from "./playback";
import { RailIcon } from "./rail-icon";

export function DndGenerationProgress({
  title,
  detail,
  steps
}: {
  title: string;
  detail: string;
  steps: string[];
}) {
  const normalizedSteps = steps.length ? steps : ["Идёт генерация"];
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const startedAt = Date.now();
    const tick = window.setInterval(() => {
      setElapsedMs(Date.now() - startedAt);
    }, 250);

    return () => {
      window.clearInterval(tick);
    };
  }, []);

  const completedStepIndex = Math.min(normalizedSteps.length - 1, Math.floor(elapsedMs / 2200));
  const runePulseIndex = Math.floor(elapsedMs / 900) % normalizedSteps.length;
  const elapsedLabel = formatPlaybackTime(elapsedMs / 1000);

  return (
    <section aria-live="polite" className="dnd-progress-panel">
      <div className="dnd-progress-head">
        <div className="stack compact">
          <p className="eyebrow">AI Generation</p>
          <strong>{title}</strong>
        </div>
        <span className="dnd-progress-time">{elapsedLabel}</span>
      </div>

      <p className="copy dnd-progress-copy">{detail}</p>

      <div aria-valuetext={`Идёт генерация: ${normalizedSteps[completedStepIndex]}`} className="dnd-progress-bar" role="progressbar">
        <span aria-hidden="true" className="dnd-progress-bar-fill" />
      </div>

      <div className="dnd-progress-steps">
        {normalizedSteps.map((step, index) => (
          <div
            key={`${title}-${step}`}
            className={`dnd-progress-step ${index <= completedStepIndex ? "active" : ""} ${index === runePulseIndex ? "pulse" : ""}`}
          >
            <span className="dnd-progress-step-rune">{index + 1}</span>
            <span>{step}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function LoginFieldGlyph({ kind }: { kind: "user" | "lock" | "eye" | "eye-off" | "spark" | "sun" | "moon" | "shield" | "users" | "arrow" }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.7
  };

  switch (kind) {
    case "user":
      return (
        <svg aria-hidden="true" className="login-glyph" viewBox="0 0 20 20">
          <circle {...common} cx="10" cy="6.7" r="2.7" />
          <path {...common} d="M4.8 15.2c1.1-2.4 2.9-3.6 5.2-3.6s4.1 1.2 5.2 3.6" />
        </svg>
      );
    case "lock":
      return (
        <svg aria-hidden="true" className="login-glyph" viewBox="0 0 20 20">
          <rect {...common} height="8.2" rx="2" width="10.2" x="4.9" y="8.1" />
          <path {...common} d="M6.8 8.1V6.7A3.2 3.2 0 0 1 10 3.5a3.2 3.2 0 0 1 3.2 3.2v1.4" />
        </svg>
      );
    case "eye":
      return (
        <svg aria-hidden="true" className="login-glyph" viewBox="0 0 20 20">
          <path {...common} d="M2.4 10s2.6-4.3 7.6-4.3 7.6 4.3 7.6 4.3-2.6 4.3-7.6 4.3S2.4 10 2.4 10Z" />
          <circle {...common} cx="10" cy="10" r="2.1" />
        </svg>
      );
    case "eye-off":
      return (
        <svg aria-hidden="true" className="login-glyph" viewBox="0 0 20 20">
          <path {...common} d="M2.8 2.8 17.2 17.2" />
          <path {...common} d="M7.8 6A8.6 8.6 0 0 1 10 5.7c5 0 7.6 4.3 7.6 4.3a14 14 0 0 1-2.9 3.1" />
          <path {...common} d="M5.3 7.2A13.4 13.4 0 0 0 2.4 10s2.6 4.3 7.6 4.3c.8 0 1.5-.1 2.2-.3" />
        </svg>
      );
    case "sun":
      return (
        <svg aria-hidden="true" className="login-glyph" viewBox="0 0 20 20">
          <circle {...common} cx="10" cy="10" r="3" />
          <path {...common} d="M10 2.8v1.6M10 15.6v1.6M2.8 10h1.6M15.6 10h1.6M4.9 4.9 6 6M14 14l1.1 1.1M15.1 4.9 14 6M6 14l-1.1 1.1" />
        </svg>
      );
    case "moon":
      return (
        <svg aria-hidden="true" className="login-glyph" viewBox="0 0 20 20">
          <path {...common} d="M14.9 12.9A5.8 5.8 0 0 1 7.1 5.1 6.5 6.5 0 1 0 14.9 12.9Z" />
        </svg>
      );
    case "shield":
      return (
        <svg aria-hidden="true" className="login-glyph" viewBox="0 0 20 20">
          <path {...common} d="M10 3.2 15 5v4.3c0 3.1-1.8 5.7-5 7.5-3.2-1.8-5-4.4-5-7.5V5l5-1.8Z" />
          <path {...common} d="m8 10 1.3 1.3L12.5 8" />
        </svg>
      );
    case "users":
      return (
        <svg aria-hidden="true" className="login-glyph" viewBox="0 0 20 20">
          <circle {...common} cx="8" cy="7.3" r="2.1" />
          <circle {...common} cx="13.4" cy="8.1" r="1.7" />
          <path {...common} d="M4.3 15.1c.8-2.1 2.2-3.1 4.2-3.1 1.9 0 3.2.9 4.1 2.8" />
          <path {...common} d="M11.7 13.4c.6-.8 1.5-1.2 2.5-1.2 1.2 0 2.2.6 2.9 1.8" />
        </svg>
      );
    case "arrow":
      return (
        <svg aria-hidden="true" className="login-glyph" viewBox="0 0 20 20">
          <path {...common} d="M4 10h11" />
          <path {...common} d="m11.2 6.2 3.8 3.8-3.8 3.8" />
        </svg>
      );
    default:
      return (
        <svg aria-hidden="true" className="login-glyph" viewBox="0 0 20 20">
          <path {...common} d="m10 2.8 1.2 4 4 1.2-4 1.2-1.2 4-1.2-4-4-1.2 4-1.2 1.2-4Z" />
          <path {...common} d="m15 12.8.6 2 .2.6.6.2 2 .6-2 .6-.6.2-.2.6-.6 2-.6-2-.2-.6-.6-.2-2-.6 2-.6.6-.2.2-.6.6-2Z" />
        </svg>
      );
  }
}

export function LoginScreen({
  username,
  password,
  passwordConfirm,
  onUsernameChange,
  onPasswordChange,
  onPasswordConfirmChange,
  onSubmit,
  busy,
  error
}: {
  username: string;
  password: string;
  passwordConfirm: string;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onPasswordConfirmChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>, mode: "login" | "register") => void;
  busy: boolean;
  error: string;
}) {
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const isRegistering = authMode === "register";
  const submitLabel = busy ? (isRegistering ? "Создаю аккаунт..." : "Открываю кабинет...") : isRegistering ? "Создать аккаунт" : "Войти в кабинет";
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const storedUsername = window.localStorage.getItem("shadow_edge_login_username");
    if (storedUsername && !username.trim()) {
      onUsernameChange(storedUsername);
    }
  }, []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (typeof window !== "undefined") {
      if (rememberMe && username.trim()) {
        window.localStorage.setItem("shadow_edge_login_username", username.trim());
      } else {
        window.localStorage.removeItem("shadow_edge_login_username");
      }
    }
    onSubmit(event, authMode);
  };

  return (
    <div className="login-screen">
      <div className="login-scene login-simplified" style={{ backgroundImage: `url(${loginBgUrl})` }}>
        <div className="login-scene-glow" aria-hidden="true" />
        <div className="login-frame">
          <header className="login-topbar">
            <div className="login-brand">
              <span className="login-brand-mark" aria-hidden="true">
                <RailIcon name="brand" />
              </span>
              <div className="login-brand-copy">
                <p className="eyebrow">Shadow Edge GM</p>
                <strong>Shadow Edge GM</strong>
              </div>
            </div>

          </header>

          <div className="login-shell">
            <section className="login-copy">
              <div className="login-copy-inner">
                <p className="eyebrow">Для мастеров D&D</p>
                <h1>Меньше подготовки.<br />Больше приключений.</h1>
                <p className="copy">Соберите игроков, подготовьте мир и ведите игру. Квесты, карты и заметки — в одной кампании.</p>
              </div>
              <a className="ghost" href="#characters" style={{ display: "block", textAlign: "center", padding: "14px", marginTop: "16px" }}>
                Я игрок · создать персонажа без регистрации
              </a>
            </section>

            <form className="panel login-card" onSubmit={handleSubmit}>
              <h2>{isRegistering ? "Создать аккаунт" : "Войти в Shadow Edge"}</h2>
              <p className="copy">
                {isRegistering
                  ? "Создайте аккаунт, чтобы сохранять свои кампании."
                  : "Войдите, чтобы продолжить свою кампанию."}
              </p>

              <div className="login-auth-switch" role="tablist" aria-label="Режим входа">
                <button
                  aria-selected={!isRegistering}
                  className={!isRegistering ? "active" : ""}
                  onClick={() => setAuthMode("login")}
                  role="tab"
                  type="button"
                >
                  Войти
                </button>
                <button
                  aria-selected={isRegistering}
                  className={isRegistering ? "active" : ""}
                  onClick={() => setAuthMode("register")}
                  role="tab"
                  type="button"
                >
                  Регистрация
                </button>
              </div>

              <label className="field login-field">
                <span>Логин</span>
                <div className="login-input-shell">
                  <span className="login-input-icon" aria-hidden="true">
                    <LoginFieldGlyph kind="user" />
                  </span>
                  <input
                    autoComplete="username"
                    className="input login-input"
                    onChange={(event) => onUsernameChange(event.target.value)}
                    placeholder="Ваш логин"
                    value={username}
                  />
                  {username ? (
                    <button aria-label="Очистить логин" className="login-input-action" onClick={() => onUsernameChange("")} type="button">
                      ×
                    </button>
                  ) : null}
                </div>
              </label>

              <label className="field login-field">
                <span>Пароль</span>
                <div className="login-input-shell">
                  <span className="login-input-icon" aria-hidden="true">
                    <LoginFieldGlyph kind="lock" />
                  </span>
                  <input
                    autoComplete={isRegistering ? "new-password" : "current-password"}
                    className="input login-input"
                    onChange={(event) => onPasswordChange(event.target.value)}
                    placeholder={isRegistering ? "Минимум 8 символов" : "Введите пароль"}
                    type={showPassword ? "text" : "password"}
                    value={password}
                  />
                  <button aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"} className="login-input-action" onClick={() => setShowPassword((current) => !current)} type="button">
                    <LoginFieldGlyph kind={showPassword ? "eye-off" : "eye"} />
                  </button>
                </div>
              </label>

              {isRegistering ? (
                <label className="field login-field">
                  <span>Повтор пароля</span>
                  <div className="login-input-shell">
                    <span className="login-input-icon" aria-hidden="true">
                      <LoginFieldGlyph kind="lock" />
                    </span>
                    <input
                      autoComplete="new-password"
                      className="input login-input"
                      onChange={(event) => onPasswordConfirmChange(event.target.value)}
                      placeholder="Повторите пароль"
                      type={showPasswordConfirm ? "text" : "password"}
                      value={passwordConfirm}
                    />
                    <button aria-label={showPasswordConfirm ? "Скрыть повтор пароля" : "Показать повтор пароля"} className="login-input-action" onClick={() => setShowPasswordConfirm((current) => !current)} type="button">
                      <LoginFieldGlyph kind={showPasswordConfirm ? "eye-off" : "eye"} />
                    </button>
                  </div>
                </label>
              ) : null}

              <div className="login-meta-row">
                <label className="login-remember">
                  <input checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} type="checkbox" />
                  <span className="login-checkbox" aria-hidden="true" />
                  <span>Запомнить логин</span>
                </label>
                <button className="login-link" onClick={() => setAuthMode(isRegistering ? "login" : "register")} type="button">
                  {isRegistering ? "Уже есть аккаунт?" : "Создать аккаунт"}
                </button>
              </div>

              {error ? <p className="login-error" role="alert">{error}</p> : null}

              <button className="primary login-submit" disabled={busy} type="submit">
                <LoginFieldGlyph kind="shield" />
                <span>{submitLabel}</span>
                <LoginFieldGlyph kind="arrow" />
              </button>

              <div className="login-divider" aria-hidden="true">
                <span />
                <small>или</small>
                <span />
              </div>

              <OAuthControls />
              <p className="copy login-player-hint">Играете у другого мастера? Откройте его ссылку-приглашение.</p>
            </form>
          </div>

          <footer className="login-footer">© 2026 Shadow Edge GM. Все права защищены.</footer>
        </div>
      </div>
    </div>
  );
}
