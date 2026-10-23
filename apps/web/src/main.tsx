import { ConfirmationHost } from "./app/confirm-action";
import { installWorkspaceLinks } from "./app/workspace-route";
import React from "react";
import ReactDOM from "react-dom/client";
import { CharacterRoutes } from "./features/characters/CharacterRoutes";
import { SubscriptionDialog } from "./app/SubscriptionDialog";
import { AdminSubscriptions } from "./app/AdminSubscriptions";
import { FeedbackDialog } from "./app/FeedbackDialog";
import "./app.css";
import "./styles/fantasy-theme.css";
import "./styles/workspace.css";

installWorkspaceLinks();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConfirmationHost/>
    {window.location.pathname.replace(/\/$/, "") === "/admin" ? <AdminSubscriptions /> : <><CharacterRoutes /><SubscriptionDialog /><FeedbackDialog /></>}
  </React.StrictMode>
);
