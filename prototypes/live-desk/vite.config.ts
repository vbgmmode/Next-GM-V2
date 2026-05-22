import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@game": path.resolve(__dirname, "../../src/game"),
      "@components": path.resolve(__dirname, "../../src/components"),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 5175,
  },
  preview: {
    host: "127.0.0.1",
    port: 5175,
  },
});
