/**
 * Shared colour-theme store: light, dark, or follow the operating system.
 *
 * One source of truth for the whole app, so the hub header and the editor
 * toolbar can never disagree. The resolved theme is written to
 * `documentElement.classList` ("dark") and to the `color-scheme` property so
 * native controls, scrollbars and form widgets follow too.
 */

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "bsu-a11y-theme";

const listeners = new Set<() => void>();
let preference: ThemePreference = readStoredPreference();

function readStoredPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") {
      return stored;
    }
  } catch {
    /* Private mode or blocked storage: fall through to the system default. */
  }
  return "system";
}

function systemPrefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

export function resolveTheme(pref: ThemePreference): ResolvedTheme {
  if (pref === "system") return systemPrefersDark() ? "dark" : "light";
  return pref;
}

function apply(pref: ThemePreference) {
  const resolved = resolveTheme(pref);
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
  root.dataset.themePreference = pref;
}

export function getThemePreference(): ThemePreference {
  return preference;
}

export function setThemePreference(next: ThemePreference) {
  preference = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* Preference just won't survive the session; the UI still works. */
  }
  apply(next);
  listeners.forEach((listener) => listener());
}

export function subscribeToTheme(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Applies the stored preference and keeps "system" in step with the OS.
 * Returns a teardown function.
 */
export function initTheme(): () => void {
  apply(preference);

  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const onSystemChange = () => {
    if (preference === "system") {
      apply(preference);
      listeners.forEach((listener) => listener());
    }
  };
  media.addEventListener("change", onSystemChange);
  return () => media.removeEventListener("change", onSystemChange);
}
