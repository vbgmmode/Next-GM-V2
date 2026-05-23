import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  publicDir: path.resolve(__dirname, "../../public"),
  resolve: {
    alias: {
      "@game": path.resolve(__dirname, "../../src/game"),
      "@components": path.resolve(__dirname, "../../src/components"),
      "@dynasty": path.resolve(__dirname, "../wrestling-gm-dynasty/src"),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 5183,
    strictPort: false,
  },
  preview: {
    host: "127.0.0.1",
    port: 5183,
    strictPort: false,
  },
});
