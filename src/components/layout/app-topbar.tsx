import { CircleHelp, LogOut, Menu, Search, Settings } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { NAV_ITEMS } from "@/components/layout/nav-config";
import { NotificationBell } from "@/components/layout/notification-bell";
import { ThemeMenuItems, ThemeToggleButton } from "@/components/theme/theme-switcher";
import { useProfile } from "@/hooks/use-profile";
import { useAiEngineState } from "@/hooks/use-ai-engine-state";
import { useAuthContext } from "@/hooks/use-auth-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AiStatusPill } from "@/components/brand/live-ai-orb";
import { initialsOf } from "@/lib/format";
import { cn } from "@/lib/utils";

interface AppTopbarProps {
  onOpenMobileNav: () => void;
  onOpenPalette: () => void;
}

export function AppTopbar({ onOpenMobileNav, onOpenPalette }: AppTopbarProps) {
  const { pathname } = useLocation();
  const { profile, org } = useProfile();
  const { state: aiState } = useAiEngineState();
  const { signOut } = useAuthContext();

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

        <ThemeToggleButton />

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

        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Account and appearance"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-ai text-[11px] font-extrabold text-primary-foreground"
          >
            {initialsOf(profile?.full_name)}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="flex flex-col gap-0.5">
              <span className="text-[13px] font-bold">{profile?.full_name ?? "Signed in"}</span>
              <span className="truncate text-[11px] font-medium text-muted-foreground">
                {profile?.email ?? ""}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
              Theme
            </DropdownMenuLabel>
            <ThemeMenuItems />
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/app/settings" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void signOut()} className="flex items-center gap-2 text-destructive">
              <LogOut className="h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
