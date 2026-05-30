import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/** Prod / main worktree dev server. */
const PROD_DEV_PORT = 5176;

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/react") || id.includes("node_modules/react-dom")) {
            return "react-vendor";
          }

          if (id.includes("/data/")) {
            return "catalog-data";
          }

          if (id.includes("/src/game/savePerformance")) {
            return "save-system";
          }

          if (id.includes("/src/game/") || id.includes("/src/booking/")) {
            return "game-core";
          }

          if (id.includes("/src/roster/")) {
            return "roster";
          }

          if (id.includes("/src/social/")) {
            return "social";
          }

          if (id.includes("/src/setup/")) {
            return "setup";
          }

          return undefined;
        },
      },
    },
  },
  server: {
    port: PROD_DEV_PORT,
    strictPort: true,
  },
  preview: {
    port: PROD_DEV_PORT,
    strictPort: true,
  },
});
