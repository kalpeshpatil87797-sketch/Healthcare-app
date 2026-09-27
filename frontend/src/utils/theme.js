const THEME_STORAGE_KEY = "healthcare-app-theme";

export function getThemePreference() {
  const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (savedTheme === "dark" || savedTheme === "light") return savedTheme;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyThemePreference(theme) {
  const nextTheme = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = nextTheme;
  window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  return nextTheme;
}

export function applySavedTheme() {
  const theme = getThemePreference();
  document.documentElement.dataset.theme = theme;
  return theme;
}