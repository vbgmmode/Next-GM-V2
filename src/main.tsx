import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { isSaveLatencyReportEnabled, SaveLatencyReport } from "./qa/SaveLatencyReport";
import "./styles.css";
import "./styles.broadcast-typography.css";
import "./styles.dashboard-dynasty.css";
import "./booking/booking.css";
import "./roster/roster.css";

const Root = isSaveLatencyReportEnabled() ? SaveLatencyReport : App;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
