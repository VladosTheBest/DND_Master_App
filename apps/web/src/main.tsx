import React from "react";
import ReactDOM from "react-dom/client";
import { CharacterRoutes } from "./features/characters/CharacterRoutes";
import "./app.css";
import "./styles/fantasy-theme.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <CharacterRoutes />
  </React.StrictMode>
);
