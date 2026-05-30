import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const SANDBOX_DEV_PORT = 4000;
const PROD_DEV_PORT = 5176;

function getDevPort() {
  const envPort = Number.parseInt(process.env.NEXT_GM_DEV_PORT ?? "", 10);

  if (Number.isInteger(envPort) && envPort > 0) {
    return envPort;
  }

  return process.cwd().endsWith("Next GM V2 Sandbox") ? SANDBOX_DEV_PORT : PROD_DEV_PORT;
}

const DEV_PORT = getDevPort();

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
    port: DEV_PORT,
    strictPort: true,
  },
  preview: {
    port: DEV_PORT,
    strictPort: true,
  },
});
