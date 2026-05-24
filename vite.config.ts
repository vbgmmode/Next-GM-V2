import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/** Prod / main worktree dev server. */
const PROD_DEV_PORT = 5176;

export default defineConfig({
  plugins: [react()],
  server: {
    port: PROD_DEV_PORT,
    strictPort: true,
  },
  preview: {
    port: PROD_DEV_PORT,
    strictPort: true,
  },
});
