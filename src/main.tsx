import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import "./styles.broadcast-typography.css";
import "./styles.dashboard-dynasty.css";

function isSaveLatencyReportRequested() {
  const env = (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env;

  if (!env?.DEV || typeof window === "undefined") {
    return false;
  }

  return new URLSearchParams(window.location.search).get("qa") === "save-latency";
}

async function getRootComponent() {
  if (isSaveLatencyReportRequested()) {
    const module = await import("./qa/SaveLatencyReport");
    return module.SaveLatencyReport;
  }

  return App;
}

void getRootComponent().then((Root) => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <Root />
    </StrictMode>,
  );
});
