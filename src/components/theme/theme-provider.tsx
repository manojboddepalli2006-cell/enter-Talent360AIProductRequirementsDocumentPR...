import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useAuthContext } from "@/hooks/use-auth-context";
import {
  APPLIED_THEME_KEY,
  ThemeContext,
  themeStorageKey,
  type ResolvedTheme,
  type ThemePreference,
} from "@/components/theme/theme-context";

function readPreference(key: string): ThemePreference {
  if (typeof window === "undefined") return "dark";
  const stored = window.localStorage.getItem(key);
  return stored === "dark" || stored === "light" || stored === "system" ? stored : "dark";
}

function systemPrefersDark(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return true;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/**
 * The single source of truth for the application theme.
 *
 * Mounted once at the root, so every page, modal, chart and AI surface reads the
 * same state and re-renders together. The preference is remembered per user (and
 * on the device before sign-in), and the applied theme is written to a device key
 * that the pre-paint bootstrap script reads to avoid a flash on startup.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuthContext();
  const key = themeStorageKey(user?.id);

  const [preference, setPreferenceState] = useState<ThemePreference>(() => readPreference(key));
  const [systemDark, setSystemDark] = useState<boolean>(systemPrefersDark);

  // Switch to the signed-in user's own preference as soon as the account is known.
  useEffect(() => {
    setPreferenceState(readPreference(key));
  }, [key]);

  // Follow the operating system while in system mode.
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    query.addEventListener("change", handler);
    return () => query.removeEventListener("change", handler);
  }, []);

  const resolved: ResolvedTheme = preference === "system" ? (systemDark ? "dark" : "light") : preference;

  // Apply the theme to the document, and remember it for the next cold start.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("light", resolved === "light");
    root.classList.toggle("dark", resolved === "dark");
    root.style.colorScheme = resolved;
    try {
      window.localStorage.setItem(key, preference);
      window.localStorage.setItem(APPLIED_THEME_KEY, resolved);
    } catch {
      // Storage can be unavailable in private modes; the theme still applies.
    }
  }, [resolved, preference, key]);

  const setPreference = useCallback((next: ThemePreference) => setPreferenceState(next), []);

  const toggle = useCallback(() => {
    setPreferenceState((current) => {
      const currentResolved = current === "system" ? (systemDark ? "dark" : "light") : current;
      return currentResolved === "dark" ? "light" : "dark";
    });
  }, [systemDark]);

  return (
    <ThemeContext.Provider value={{ preference, resolved, setPreference, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}
