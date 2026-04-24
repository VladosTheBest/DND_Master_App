import { useEffect, useState, type FormEvent } from "react";
import loginBgUrl from "./assets/login-bg.jpg";
import { formatPlaybackTime } from "./playback";
import { RailIcon, type RailIconName } from "./rail-icon";

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

function LoginFieldGlyph({ kind }: { kind: "user" | "lock" | "eye" | "eye-off" | "spark" }) {
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
  onUsernameChange,
  onPasswordChange,
  onSubmit,
  busy,
  error
}: {
  username: string;
  password: string;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  busy: boolean;
  error: string;
}) {
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [ritualMode, setRitualMode] = useState(false);
  const loginFeatures: Array<{ title: string; detail: string; icon: RailIconName }> = [
    { title: "Квесты", detail: "Веди истории и кампании", icon: "quest" },
    { title: "Инициатива", detail: "Удобные боевые сцены", icon: "player" },
    { title: "Карты", detail: "Локации и регионы", icon: "location" },
    { title: "Заметки", detail: "Твои записи и идеи", icon: "note" }
  ];

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
    onSubmit(event);
  };

  return (
    <div className="login-screen">
      <div className={`login-scene ${ritualMode ? "ritual-mode" : ""}`} style={{ backgroundImage: `url(${loginBgUrl})` }}>
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

            <button
              aria-label={ritualMode ? "Переключить на лунный тон" : "Переключить на ритуальный тон"}
              className="login-theme-toggle"
              onClick={() => setRitualMode((current) => !current)}
              type="button"
            >
              <span className={`login-theme-icon ${!ritualMode ? "active" : ""}`}>
                <LoginFieldGlyph kind="spark" />
              </span>
              <span className={`login-theme-icon ${ritualMode ? "active" : ""}`}>
                <LoginFieldGlyph kind="eye" />
              </span>
            </button>
          </header>

          <div className="login-shell">
            <section className="login-copy">
              <div className="login-copy-inner">
                <div className="login-kicker">
                  <span className="login-kicker-line" aria-hidden="true" />
                  <span className="eyebrow">Врата мастерской</span>
                  <span className="login-kicker-gem" aria-hidden="true">
                    <RailIcon name="brand" />
                  </span>
                  <span className="login-kicker-line" aria-hidden="true" />
                </div>

                <h1>
                  <span>Только</span>
                  <span>
                    для <em>мастера</em>
                  </span>
                </h1>
                <p className="copy">
                  Карты, квесты, заметки и боевые сцены теперь открываются только после входа.
                </p>
              </div>

              <div className="login-feature-grid">
                {loginFeatures.map((feature) => (
                  <article key={feature.title} className="login-feature-card">
                    <span className="login-feature-icon" aria-hidden="true">
                      <RailIcon name={feature.icon} />
                    </span>
                    <strong>{feature.title}</strong>
                    <small>{feature.detail}</small>
                  </article>
                ))}
              </div>

              <blockquote className="login-quote-card">
                <p>Мир ждёт твоей истории. Готов ли ты её написать?</p>
                <span className="login-quote-mark" aria-hidden="true">
                  <RailIcon name="brand" />
                </span>
              </blockquote>
            </section>

            <form className="panel login-card" onSubmit={handleSubmit}>
              <div className="login-card-ornament" aria-hidden="true">
                <span />
                <i />
                <span />
              </div>

              <h2>Войти в Shadow Edge</h2>
              <p className="copy">
                Один логин открывает кабинет мастера, а публичный трекер инициативы остаётся отдельной ссылкой для игроков.
              </p>

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
                    placeholder="vladyur4ik"
                    value={username}
                  />
                  {username ? (
                    <button className="login-input-action" onClick={() => onUsernameChange("")} type="button">
                      Г—
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
                    autoComplete="current-password"
                    className="input login-input"
                    onChange={(event) => onPasswordChange(event.target.value)}
                    placeholder="Введите пароль"
                    type={showPassword ? "text" : "password"}
                    value={password}
                  />
                  <button className="login-input-action" onClick={() => setShowPassword((current) => !current)} type="button">
                    <LoginFieldGlyph kind={showPassword ? "eye-off" : "eye"} />
                  </button>
                </div>
              </label>

              <div className="login-meta-row">
                <label className="login-remember">
                  <input checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} type="checkbox" />
                  <span className="login-checkbox" aria-hidden="true" />
                  <span>Запомнить меня</span>
                </label>
                <button className="login-link" onClick={() => onPasswordChange("")} type="button">
                  Забыли пароль?
                </button>
              </div>

              {error ? <p className="login-error">{error}</p> : null}

              <button className="primary login-submit" disabled={busy} type="submit">
                <span>{busy ? "Открываю кабинет..." : "Войти в кабинет"}</span>
                <span aria-hidden="true">→</span>
              </button>

              <div className="login-divider" aria-hidden="true">
                <span />
                <small>или</small>
                <span />
              </div>

              <div className="login-public-note">
                <div className="ghost login-secondary login-secondary-static" role="note">
                  <span>Публичный трекер для игроков открывается из боя</span>
                  <span aria-hidden="true">↗</span>
                </div>
              </div>
            </form>
          </div>

          <footer className="login-footer">© 2026 Shadow Edge GM. Все права защищены.</footer>
        </div>
      </div>
    </div>
  );
}

