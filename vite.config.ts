import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/** Sandbox dev server — intentionally not the prod port (5176). */
const SANDBOX_DEV_PORT = 4000;

export default defineConfig({
  plugins: [react()],
  server: {
    port: SANDBOX_DEV_PORT,
    strictPort: true,
  },
  preview: {
    port: SANDBOX_DEV_PORT,
    strictPort: true,
  },
});
