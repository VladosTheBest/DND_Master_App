import React from "react";
import ReactDOM from "react-dom/client";
import { CharacterRoutes } from "./features/characters/CharacterRoutes";
import { SubscriptionDialog } from "./app/SubscriptionDialog";
import { AdminSubscriptions } from "./app/AdminSubscriptions";
import { FeedbackDialog } from "./app/FeedbackDialog";
import { AIChatPage } from "./features/ai-jobs/AIChatPage";
import "./app.css";
import "./styles/fantasy-theme.css";
import "./styles/workspace.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {window.location.pathname.replace(/\/$/, "") === "/admin" ? <AdminSubscriptions /> : <>{window.location.pathname.replace(/\/$/, "") === "/chat" ? <AIChatPage/> : <CharacterRoutes />}<SubscriptionDialog /><FeedbackDialog /></>}
  </React.StrictMode>
);
