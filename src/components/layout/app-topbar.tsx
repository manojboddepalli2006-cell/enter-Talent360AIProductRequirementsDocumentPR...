import { Bell, Menu, Moon, Search, Sun } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { NAV_ITEMS } from "@/components/layout/nav-config";
import { useTheme } from "@/hooks/use-theme";
import { useRealtimeRecommendations } from "@/hooks/use-realtime-recommendations";
import { cn } from "@/lib/utils";

interface AppTopbarProps {
  onOpenMobileNav: () => void;
  onOpenPalette: () => void;
}

export function AppTopbar({ onOpenMobileNav, onOpenPalette }: AppTopbarProps) {
  const { pathname } = useLocation();
  const { theme, toggleTheme } = useTheme();
  useRealtimeRecommendations();

  // Longest matching nav route wins, so nested detail routes keep their parent label.
  const current =
    NAV_ITEMS.filter((item) => pathname === item.to || pathname.startsWith(`${item.to}/`)).sort(
      (a, b) => b.to.length - a.to.length,
    )[0] ?? null;

  const pendingQuery = useQuery({
    queryKey: ["talent360-pending-count"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("talent_ai_recommendations")
        .select("id")
        .eq("status", "pending");
      if (error) throw new Error(error.message);
      return data?.length ?? 0;
    },
    refetchInterval: 60_000,
  });

  const pending = pendingQuery.data ?? 0;

  return (
    <header className="talent-glass sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border px-4 md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobileNav}
          aria-label="Open navigation"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:text-foreground md:hidden"
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
            "hidden h-9 items-center gap-2 rounded-xl border border-border bg-card px-3 text-[12px] font-semibold text-muted-foreground transition-colors hover:text-foreground sm:flex",
          )}
        >
          <Search className="h-3.5 w-3.5" />
          Search
          <kbd className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold">⌘K</kbd>
        </button>

        <Link
          to="/app/action-center"
          aria-label={`AI Action Center, ${pending} awaiting review`}
          className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
        >
          <Bell className="h-4 w-4" />
          {pending > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-gradient-accent px-1 text-[9px] font-extrabold text-accent-foreground shadow-glow">
              {pending > 99 ? "99+" : pending}
            </span>
          ) : null}
        </Link>

        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>
    </header>
  );
}
