import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { DynastyHQApp } from "./DynastyHQApp";
import "@dynasty/styles/tokens.css";
import "@dynasty/styles/dashboard.css";
import "./styles/bridge.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DynastyHQApp />
  </StrictMode>,
);
