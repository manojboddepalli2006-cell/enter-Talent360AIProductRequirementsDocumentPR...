import { Menu, Moon, Search, Sun } from "lucide-react";
import { useLocation } from "react-router-dom";
import { NAV_ITEMS } from "@/components/layout/nav-config";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

interface AppTopbarProps {
  onOpenMobileNav: () => void;
  onOpenPalette: () => void;
}

export function AppTopbar({ onOpenMobileNav, onOpenPalette }: AppTopbarProps) {
  const { pathname } = useLocation();
  const { theme, toggleTheme } = useTheme();

  // Longest matching nav route wins, so nested detail routes keep their parent label.
  const current =
    NAV_ITEMS.filter((item) => pathname === item.to || pathname.startsWith(`${item.to}/`)).sort(
      (a, b) => b.to.length - a.to.length,
    )[0] ?? null;

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-background/85 px-4 backdrop-blur md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobileNav}
          aria-label="Open navigation"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:text-foreground md:hidden"
        >
          <Menu className="h-4 w-4" />
        </button>

        <div className="min-w-0">
          <div className="truncate text-[13px] font-bold text-foreground">
            {current?.label ?? "Talent360 AI"}
          </div>
          <div className="hidden truncate text-[11px] font-medium text-muted-foreground sm:block">
            Human-in-the-loop workforce intelligence
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenPalette}
          className={cn(
            "hidden h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-[12px] font-semibold text-muted-foreground transition-colors hover:text-foreground sm:flex",
          )}
        >
          <Search className="h-3.5 w-3.5" />
          Search
          <kbd className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold">⌘K</kbd>
        </button>

        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>
    </header>
  );
}
