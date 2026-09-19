import { useCallback, useEffect, useState } from "react";
import { useAuthContext } from "@/hooks/use-auth-context";

export type ThemePreference = "dark" | "light" | "system";
export type ResolvedTheme = "dark" | "light";

const LEGACY_KEY = "talent360-theme";

function storageKey(userId: string | null | undefined): string {
  return `talent360-theme:${userId ?? "device"}`;
}

function readPreference(key: string): ThemePreference {
  if (typeof window === "undefined") return "dark";
  const stored = window.localStorage.getItem(key) ?? window.localStorage.getItem(LEGACY_KEY);
  return stored === "light" || stored === "system" || stored === "dark" ? stored : "dark";
}

function systemPrefersDark(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return true;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/**
 * Theme controller: Dark / Light / System, remembered per user.
 *
 * The dark palette is the base (`:root`), the light palette is applied by the
 * `light` class, and `dark` is also toggled so component-level `dark:` variants
 * stay in sync.
 */
export function useTheme() {
  const { user } = useAuthContext();
  const key = storageKey(user?.id);

  const [preference, setPreferenceState] = useState<ThemePreference>(() => readPreference(key));
  const [systemDark, setSystemDark] = useState<boolean>(systemPrefersDark);

  // Re-read the preference when the account changes (per-user preference).
  useEffect(() => {
    setPreferenceState(readPreference(key));
  }, [key]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    query.addEventListener("change", handler);
    return () => query.removeEventListener("change", handler);
  }, []);

  const resolved: ResolvedTheme = preference === "system" ? (systemDark ? "dark" : "light") : preference;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("light", resolved === "light");
    root.classList.toggle("dark", resolved === "dark");
    root.style.colorScheme = resolved;
    window.localStorage.setItem(key, preference);
  }, [resolved, preference, key]);

  const setPreference = useCallback((next: ThemePreference) => setPreferenceState(next), []);

  const toggleTheme = useCallback(() => {
    setPreferenceState((current) => {
      const currentResolved = current === "system" ? (systemDark ? "dark" : "light") : current;
      return currentResolved === "dark" ? "light" : "dark";
    });
  }, [systemDark]);

  // Backwards-compatible `theme` value for existing callers.
  return { preference, resolved, theme: resolved, setPreference, toggleTheme };
}
