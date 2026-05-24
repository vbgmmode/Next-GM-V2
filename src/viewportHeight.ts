const VIEWPORT_HEIGHT_VAR = "--app-viewport-height";
const MIN_VIEWPORT_HEIGHT = 400;

function readViewportHeight() {
  return Math.round(window.visualViewport?.height ?? window.innerHeight);
}

function applyViewportHeight() {
  const height = readViewportHeight();
  if (height < MIN_VIEWPORT_HEIGHT) {
    return;
  }

  document.documentElement.style.setProperty(VIEWPORT_HEIGHT_VAR, `${height}px`);
}

function scheduleDeferredSync() {
  applyViewportHeight();
  window.requestAnimationFrame(applyViewportHeight);

  for (const delay of [0, 100, 300]) {
    window.setTimeout(applyViewportHeight, delay);
  }
}

export function syncAppViewportHeight() {
  scheduleDeferredSync();

  const onViewportChange = () => applyViewportHeight();
  window.addEventListener("resize", onViewportChange, { passive: true });
  window.visualViewport?.addEventListener("resize", onViewportChange, { passive: true });
  window.visualViewport?.addEventListener("scroll", onViewportChange, { passive: true });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scheduleDeferredSync, { once: true });
  }

  window.addEventListener("load", scheduleDeferredSync, { once: true });

  return () => {
    window.removeEventListener("resize", onViewportChange);
    window.visualViewport?.removeEventListener("resize", onViewportChange);
    window.visualViewport?.removeEventListener("scroll", onViewportChange);
  };
}
