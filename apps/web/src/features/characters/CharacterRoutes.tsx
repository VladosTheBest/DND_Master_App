import { lazy, Suspense, useEffect, useState } from "react";
const App = lazy(() => import("../../App"));

const CharacterPublicApp = lazy(() => import("./CharacterPublicApp"));

export function CharacterRoutes() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const update = () => setHash(window.location.hash);
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
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
    <Suspense
      fallback={
        <div className="boot" role="status">
          Открываем кабинет мастера…
        </div>
      }
    >
      <App />
    </Suspense>
  );
}
