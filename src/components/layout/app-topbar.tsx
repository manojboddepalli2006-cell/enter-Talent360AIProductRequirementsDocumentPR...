import { CircleHelp, Menu, Moon, Search, Sun } from "lucide-react";
import { useLocation } from "react-router-dom";
import { NAV_ITEMS } from "@/components/layout/nav-config";
import { NotificationBell } from "@/components/layout/notification-bell";
import { useTheme } from "@/hooks/use-theme";
import { useProfile } from "@/hooks/use-profile";
import { useAiEngineState } from "@/hooks/use-ai-engine-state";
import { AiStatusPill } from "@/components/brand/live-ai-orb";
import { initialsOf } from "@/lib/format";
import { cn } from "@/lib/utils";

interface AppTopbarProps {
  onOpenMobileNav: () => void;
  onOpenPalette: () => void;
}

export function AppTopbar({ onOpenMobileNav, onOpenPalette }: AppTopbarProps) {
  const { pathname } = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { profile, org } = useProfile();
  const { state: aiState } = useAiEngineState();

  const current =
    NAV_ITEMS.filter((item) => pathname === item.to || pathname.startsWith(`${item.to}/`)).sort(
      (a, b) => b.to.length - a.to.length,
    )[0] ?? null;

  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-xl md:px-6">
      <button
        type="button"
        onClick={onOpenMobileNav}
        aria-label="Open navigation"
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:text-foreground md:hidden"
      >
        <Menu className="h-4 w-4" />
      </button>

      {/* Breadcrumb */}
      <div className="hidden min-w-0 items-center gap-1.5 text-[12.5px] font-medium text-muted-foreground md:flex">
        <span>Talent360 AI</span>
        <span className="text-border">/</span>
        <span className="truncate font-bold text-foreground">{current?.label ?? "Workspace"}</span>
      </div>

      {/* Center search */}
      <div className="mx-auto hidden w-full max-w-md lg:block">
        <button
          type="button"
          onClick={onOpenPalette}
          className="flex h-9 w-full items-center gap-2.5 rounded-xl border border-border bg-card/60 px-3 text-[12.5px] font-medium text-muted-foreground transition-colors hover:border-primary/40"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="flex-1 text-left">Search employees, candidates, skills, actions…</span>
          <kbd className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-bold">⌘K</kbd>
        </button>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">
        <AiStatusPill state={aiState} className="hidden xl:inline-flex" />

        <button
          type="button"
          onClick={onOpenPalette}
          aria-label="Search"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:text-foreground lg:hidden"
        >
          <Search className="h-4 w-4" />
        </button>

        <NotificationBell />

        <button
          type="button"
          aria-label="Help"
          title="Help"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
        >
          <CircleHelp className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        <button
          type="button"
          title={org?.name ?? "Workspace"}
          className="flex h-9 items-center gap-2 rounded-xl border border-border bg-card px-2 transition-colors hover:border-primary/40"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-ai text-[9px] font-extrabold text-primary-foreground">
            {(org?.name ?? "T3").slice(0, 2).toUpperCase()}
          </span>
          <span className="hidden max-w-[130px] truncate text-[12px] font-bold text-foreground lg:block">
            {org?.name ?? "Workspace"}
          </span>
        </button>

        <span
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-full bg-gradient-ai text-[11px] font-extrabold text-primary-foreground",
          )}
        >
          {initialsOf(profile?.full_name)}
        </span>
      </div>
    </header>
  );
}
