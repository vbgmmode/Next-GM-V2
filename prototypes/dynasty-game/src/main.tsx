import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { DynastyGameApp } from "./DynastyGameApp";
import "@dynasty/styles/tokens.css";
import "@dynasty/styles/dashboard.css";
import "./styles/bridge.css";
import "./styles/pages.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DynastyGameApp />
  </StrictMode>,
);
