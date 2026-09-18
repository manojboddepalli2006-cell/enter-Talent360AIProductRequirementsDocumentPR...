import { useEffect, useState } from "react";
import { ChevronDown, LogOut, Moon, PanelLeftClose, PanelLeftOpen, Search, Sun, UserCircle } from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { NAV_GROUPS, canSeeItem } from "@/components/layout/nav-config";
import { usePermissions } from "@/hooks/use-permissions";
import { useProfile } from "@/hooks/use-profile";
import { useSession } from "@/hooks/use-session";
import { useAuthContext } from "@/hooks/use-auth-context";
import { useTheme } from "@/hooks/use-theme";
import { ROLE_LABELS } from "@/lib/domain";
import { initialsOf } from "@/lib/format";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface AppSidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  onOpenPalette: () => void;
  onNavigate?: () => void;
}

export function AppSidebar({ collapsed, onToggleCollapse, onOpenPalette, onNavigate }: AppSidebarProps) {
  const { can } = usePermissions();
  const { profile, org } = useProfile();
  const { user } = useSession();
  const { signOut } = useAuthContext();
  const { theme, toggleTheme } = useTheme();

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    NAV_GROUPS.reduce<Record<string, boolean>>((acc, group) => {
      acc[group.key] = group.defaultOpen ?? false;
      return acc;
    }, {}),
  );

  // A group that contains the active route should never stay collapsed.
  useEffect(() => {
    setOpenGroups((current) => {
      const next = { ...current };
      NAV_GROUPS.forEach((group) => {
        const visible = group.items.filter((item) => canSeeItem(item, can));
        if (!visible.length) return;
        if (window.location.pathname.startsWith("/app") && group.defaultOpen) next[group.key] = true;
      });
      return next;
    });
  }, [can]);

  const displayName = profile?.full_name ?? user?.email ?? "Signed in";
  const displayEmail = profile?.email ?? user?.email ?? "";

  return (
    /* macOS-style translucent source list: material over the canvas,
       with a hairline right edge instead of a hard shadow. */
    <div className="flex h-full w-full flex-col bg-sidebar text-sidebar-foreground backdrop-blur-2xl">
      {/* Brand */}
      <div className={cn("flex items-center gap-2.5 px-4 py-5", collapsed && "justify-center px-2")}>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-primary text-[13px] font-bold text-primary-foreground">
          T3
        </span>
        {!collapsed ? (
          <div className="min-w-0">
            <div className="truncate text-[15px] font-extrabold text-sidebar-accent-foreground">Talent360 AI</div>
            <div className="truncate text-[10.5px] font-semibold uppercase tracking-[0.1em] text-sidebar-foreground">
              Workforce Intelligence
            </div>
          </div>
        ) : null}
      </div>

      {/* Search / command palette trigger */}
      <div className={cn("px-3 pb-3", collapsed && "px-2")}>
        <button
          type="button"
          onClick={onOpenPalette}
          title="Search and jump to a module"
          className={cn(
            "flex w-full items-center gap-2 rounded-[10px] bg-sidebar-elevated px-3 py-2.5 text-[13px] font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent",
            collapsed && "justify-center px-2",
          )}
        >
          <Search className="h-4 w-4 shrink-0" />
          {!collapsed ? (
            <>
              <span className="flex-1 text-left">Search</span>
              <kbd className="rounded-md bg-sidebar-muted px-1.5 py-0.5 text-[10px] font-bold text-sidebar-foreground">
                ⌘K
              </kbd>
            </>
          ) : null}
        </button>
      </div>

      {/* Navigation */}
      <nav className="talent-sidebar-scroll flex-1 overflow-y-auto px-3 pb-4">
        {NAV_GROUPS.map((group) => {
          const items = group.items.filter((item) => canSeeItem(item, can));
          if (!items.length) return null;

          const isOpen = collapsed ? true : (openGroups[group.key] ?? false);

          return (
            <Collapsible
              key={group.key}
              open={isOpen}
              onOpenChange={(open) =>
                setOpenGroups((current) => ({ ...current, [group.key]: open }))
              }
              className="mb-1"
            >
              {!collapsed ? (
                <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-[10.5px] font-bold uppercase tracking-[0.1em] text-sidebar-foreground/80 transition-colors hover:text-sidebar-accent-foreground">
                  {group.label}
                  <ChevronDown
                    className={cn("h-3.5 w-3.5 transition-transform", !isOpen && "-rotate-90")}
                  />
                </CollapsibleTrigger>
              ) : null}

              <CollapsibleContent className="talent-sidebar-group">
                <div className={cn("flex flex-col gap-0.5", !collapsed && "mt-1")}>
                  {items.map((item) => (
                    <NavLink
                      key={item.key}
                      to={item.to}
                      onClick={onNavigate}
                      title={collapsed ? item.label : undefined}
                      className={({ isActive }) =>
                        cn(
                          "group relative flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[13px] font-medium transition-colors duration-150",
                          collapsed && "justify-center px-2",
                          isActive
                            ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                            : "text-sidebar-foreground hover:bg-sidebar-elevated",
                        )
                      }
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed ? <span className="truncate">{item.label}</span> : null}
                    </NavLink>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </nav>

      {/* Footer controls */}
      <div className={cn("flex items-center gap-2 px-3 pb-3", collapsed && "flex-col px-2")}>
        <button
          type="button"
          onClick={toggleTheme}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          className="flex h-9 flex-1 items-center justify-center gap-2 rounded-xl bg-sidebar-elevated text-[12px] font-semibold text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {!collapsed ? <span>{theme === "dark" ? "Light" : "Dark"}</span> : null}
        </button>
        <button
          type="button"
          onClick={onToggleCollapse}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-sidebar-elevated text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      {/* Identity */}
      <div className="border-t border-sidebar-border p-3">
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              "flex w-full items-center gap-2.5 rounded-xl p-2 text-left transition-colors hover:bg-sidebar-elevated",
              collapsed && "justify-center",
            )}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warning text-[12px] font-extrabold text-warning-foreground">
              {initialsOf(displayName)}
            </span>
            {!collapsed ? (
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12.5px] font-bold text-sidebar-accent-foreground">
                  {displayName}
                </div>
                <div className="truncate text-[11px] font-medium text-sidebar-foreground">{displayEmail}</div>
              </div>
            ) : null}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="flex flex-col gap-0.5">
              <span className="text-[13px] font-bold">{displayName}</span>
              <span className="text-[11px] font-medium text-muted-foreground">
                {ROLE_LABELS[profile?.role ?? ""] ?? "No workspace"}
                {org?.name ? ` · ${org.name}` : ""}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <NavLink to="/app/settings" className="flex items-center gap-2">
                <UserCircle className="h-4 w-4" />
                Account settings
              </NavLink>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void signOut()} className="flex items-center gap-2 text-destructive">
              <LogOut className="h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
