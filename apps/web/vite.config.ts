import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Foundational UI must not be claimed transitively by a feature chunk.
const workspaceUiModules = [
  "/src/app-shared.tsx", "/src/rail-icon.tsx", "/src/app/api.ts", "/src/app/browser-storage.ts", "/src/app/format-duration.ts", "/src/app/AppModal.tsx", "/src/app/ActionMenu.tsx",
  "/src/app/action-menu-position.ts", "/src/app/DeviceDraftControls.tsx",
  "/src/app/device-drafts.ts", "/src/app/confirm-action.tsx", "/src/app/workspace-route.ts",
  "/src/app/hooks/useNativeDialog.ts", "/src/app/hooks/useDeviceDraft.ts",
  "/src/app/Workspace.module.css"
];

export default defineConfig({
  plugins: [react()],
  build: {
    manifest:true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalized = id.split("\\").join("/");

          if (
            /\/features\/characters\/(rules(?:-data)?|spell-names-ru)\.ts$/.test(
              normalized,
            )
          ) {
            return "character-rules";
          }

          if (
            normalized.includes("/node_modules/react/") ||
            normalized.includes("/node_modules/react-dom/") ||
            normalized.includes("/node_modules/scheduler/")
          ) {
            return "vendor-react";
          }

          if (normalized.includes("/node_modules/")) {
            return undefined;
          }

          if (normalized.endsWith("/src/auth-ui.tsx")) return "auth-ui";
          if (workspaceUiModules.some(path => normalized.endsWith(path))) return "workspace-ui";

          if (normalized.includes("/src/items")) {
            return "feature-items";
          }

          if (normalized.includes("/src/quests")) {
            return "feature-quests";
          }

          if (normalized.includes("/src/notes-events")) {
            return "feature-notes-events";
          }

          if (
            normalized.includes("/src/media") ||
            normalized.includes("/src/floating-player") ||
            normalized.includes("/src/playback")
          ) {
            return "feature-media";
          }

          if (normalized.includes("/src/combat-ui")) {
            return "feature-combat";
          }

          return undefined;
        },
      },
    },
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:8080",
      "/healthz": "http://127.0.0.1:8080",
      "/initiative": "http://127.0.0.1:8080",
      "/uploads": "http://127.0.0.1:8080",
    },
  },
});
