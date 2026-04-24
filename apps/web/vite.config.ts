import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalized = id.split("\\").join("/");

          if (normalized.includes("/node_modules/react/") || normalized.includes("/node_modules/react-dom/")) {
            return "vendor-react";
          }

          if (normalized.includes("/node_modules/")) {
            return "vendor";
          }

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
        }
      }
    }
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:8080",
      "/healthz": "http://127.0.0.1:8080",
      "/initiative": "http://127.0.0.1:8080"
    }
  }
});
