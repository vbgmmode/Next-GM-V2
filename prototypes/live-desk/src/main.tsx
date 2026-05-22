import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { LiveDeskApp } from "./LiveDeskApp";
import "./styles/tokens.css";
import "./styles/live-desk.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LiveDeskApp />
  </StrictMode>,
);
