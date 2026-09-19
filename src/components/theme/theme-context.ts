import { createContext } from "react";

export type ThemePreference = "dark" | "light" | "system";
export type ResolvedTheme = "dark" | "light";

export interface ThemeContextValue {
  /** What the user chose: dark, light or follow the operating system. */
  preference: ThemePreference;
  /** What is actually applied right now (system resolved to dark or light). */
  resolved: ResolvedTheme;
  setPreference: (next: ThemePreference) => void;
  /** Compact toggle: flips between dark and light. */
  toggle: () => void;
}

/** Per-user preference key, falling back to a device key before sign-in. */
export function themeStorageKey(userId: string | null | undefined): string {
  return `talent360-theme:${userId ?? "device"}`;
}

/**
 * Device-level key holding the theme that is actually on screen. The pre-paint
 * bootstrap script reads this so the correct theme is applied before the app
 * renders (no flash of the wrong theme).
 */
export const APPLIED_THEME_KEY = "talent360-theme-applied";

export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);
