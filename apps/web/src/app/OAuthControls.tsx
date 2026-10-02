import googleIcon from "../assets/oauth/google-g.png";
import discordIcon from "../assets/oauth/discord-symbol.svg";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { OAuthProviderStatus } from "@shadow-edge/shared-types";
import { api } from "./api";
import "./oauth.css";

const messages: Record<string, string> = {
  success: "Способ входа подтверждён. Аккаунт готов.",
  denied: "Вход отменён. Можно попробовать снова.",
  invalid_state: "Время подтверждения истекло или браузер изменился. Начни вход снова.",
  session_changed: "Сессия изменилась. Войди снова и повтори привязку.",
  provider_failed: "Провайдер не подтвердил вход. Попробуй снова.",
  already_linked: "Этот аккаунт провайдера уже привязан. Используй другой аккаунт или действие «Заменить».",
  save_failed: "Не удалось сохранить привязку. Прежние способы входа сохранены.",
  session_failed: "Не удалось создать сессию. Повтори вход."
};

function ProviderIcon({ provider }: { provider: "google" | "discord" }) {
 return <img aria-hidden="true" alt="" src={provider === "google" ? googleIcon : discordIcon} />;
}

export function OAuthControls({ account = false }: { account?: boolean }) {
  const [providers, setProviders] = useState<OAuthProviderStatus[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const status = new URLSearchParams(window.location.search).get("oauth");
  useEffect(() => {
    let active = true;
    api.getOAuthProviders().then(value => { if (active) setProviders(value); })
      .catch(() => { if (active) setError("Не удалось загрузить способы входа."); });
    return () => { active = false; };
  }, []);
  const start = async (provider: OAuthProviderStatus) => {
    setBusy(true); setError("");
    try {
      const result = await api.startOAuth(provider.provider, account, account && provider.linked);
      window.location.assign(result.url);
    } catch (e) { setError(e instanceof Error ? e.message : "Не удалось начать вход."); setBusy(false); }
  };
  return (
    <div className="oauth-controls">
      {status && messages[status] ? <p role="status" className={status === "success" ? "oauth-success" : "oauth-error"}>{messages[status]}</p> : null}
      {account ? <p className="oauth-hint">Привязанные способы входа открывают этот же аккаунт со всеми кампаниями. Для замены нужен вход за последние 10 минут.</p> : <p className="oauth-hint">Войти или зарегистрироваться</p>}
      {providers.map(provider => {
        const name = provider.provider === "google" ? "Google" : "Discord";
        return <div className="oauth-row" key={provider.provider}>
          <button type="button" className={`oauth-button oauth-${provider.provider}`} disabled={busy || !provider.enabled} onClick={() => void start(provider)}>
            <ProviderIcon provider={provider.provider}/><span>{account ? `${provider.linked ? "Заменить" : "Привязать"} ${name}` : `Продолжить с ${name}`}</span>
          </button>
          {account && provider.linked ? <span className="oauth-success">Привязан{provider.label ? `: ${provider.label}` : ""}</span> : null}
          {!provider.enabled ? <small className="oauth-hint">Пока недоступен</small> : null}
        </div>;
      })}
      {!account ? <p className="oauth-hint">Первый вход создаёт аккаунт. Уже есть логин и пароль? Войди с ними и привяжи провайдера в настройках аккаунта.</p> : null}
      {error ? <p role="alert" className="oauth-error">{error}</p> : null}
    </div>
  );
}

export function AccountSettings() {
  const [open, setOpen] = useState(new URLSearchParams(window.location.search).has("oauth"));
  const dialog = useRef<HTMLDialogElement>(null);
  const close = () => {
    setOpen(false);
    const url = new URL(window.location.href);
    url.searchParams.delete("oauth");
    window.history.replaceState(null, "", url);
  };
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);
  return <>
    <button className="ghost" type="button" onClick={() => setOpen(true)}>Настройки аккаунта</button>
    {createPortal(<dialog ref={dialog} className="panel oauth-settings" aria-label="Настройки аккаунта" onCancel={close}>
      {open ? <>
        <h2>Настройки аккаунта</h2>
        <OAuthControls account />
        <button className="ghost" type="button" onClick={close}>Закрыть</button>
      </> : null}
    </dialog>, document.body)}
  </>;
}
