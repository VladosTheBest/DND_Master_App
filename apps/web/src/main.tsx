import {WorkspaceBoundary} from "./app/WorkspaceBoundary";
import { ConfirmationHost } from "./app/confirm-action";
import { installWorkspaceLinks } from "./app/workspace-route";
import React, {lazy,Suspense} from "react";
import ReactDOM from "react-dom/client";
import { CharacterRoutes } from "./features/characters/CharacterRoutes";
import { SubscriptionDialog } from "./app/SubscriptionDialog";
const AdminSubscriptions=lazy(()=>import("./app/AdminSubscriptions").then(module=>({default:module.AdminSubscriptions})));
import { FeedbackDialog } from "./app/FeedbackDialog";
import "./app.css";
import "./styles/fantasy-theme.css";
import "./styles/workspace.css";
import "./styles/product-design.css";
import "./styles/workspace-polish.css";

installWorkspaceLinks();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConfirmationHost/><WorkspaceBoundary>
    {window.location.pathname.replace(/\/$/, "") === "/admin" ? <Suspense fallback={<p role="status">Загружаю администрирование…</p>}><AdminSubscriptions /></Suspense> : <><CharacterRoutes /><SubscriptionDialog /><FeedbackDialog /></>}
    </WorkspaceBoundary>
  </React.StrictMode>
);
