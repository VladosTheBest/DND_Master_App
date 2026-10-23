import {WorkspaceEntry} from "./WorkspaceEntry";
import { lazy, Suspense, useEffect, useState } from "react";
const App = lazy(() => import("../../App"));

const CharacterPublicApp = lazy(() => import("./CharacterPublicApp"));

export function CharacterRoutes() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const update = () => setHash(window.location.hash);
    window.addEventListener("hashchange", update);
    window.addEventListener("workspace-navigation", update);
    window.addEventListener("popstate", update);
    return () => {
      window.removeEventListener("hashchange", update);
      window.removeEventListener("workspace-navigation", update);
      window.removeEventListener("popstate", update);
    };
  }, []);
  return /^#characters(?:\/|$)/.test(hash) ? (
    <Suspense
      fallback={
        <div className="boot" role="status">
          Открываем мастерскую персонажа…
        </div>
      }
    >
      <CharacterPublicApp key={hash} hash={hash} />
    </Suspense>
  ) : (
    <WorkspaceEntry><Suspense fallback={<div className="boot" role="status">Открываем кабинет мастера…</div>}><App /></Suspense></WorkspaceEntry>
  );
}
