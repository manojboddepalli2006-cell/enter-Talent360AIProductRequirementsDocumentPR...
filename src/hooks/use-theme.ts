import { useContext } from "react";
import { ThemeContext, type ThemeContextValue } from "@/components/theme/theme-context";

/**
 * Reads the global theme state. Every consumer shares one provider, so a change
 * anywhere updates the whole application at once.
 */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("Theme context is missing. Wrap the app in ThemeProvider.");
  return context;
}

export type { ThemePreference, ResolvedTheme } from "@/components/theme/theme-context";
