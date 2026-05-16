const STORAGE_KEY = "next-gm-save";

export function saveGameState(state: unknown) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn("Could not save game state.", error);
  }
}

export function loadGameState<T = unknown>(): T | null {
  try {
    const savedState = localStorage.getItem(STORAGE_KEY);

    if (!savedState) {
      return null;
    }

    return JSON.parse(savedState) as T;
  } catch (error) {
    console.warn("Could not load game state.", error);
    return null;
  }
}

export function clearGameState() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn("Could not clear game state.", error);
  }
}
