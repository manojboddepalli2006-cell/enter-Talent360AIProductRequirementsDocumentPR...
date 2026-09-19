import { useEffect, useState } from "react";
import { ChevronDown, LogOut, PanelLeftClose, PanelLeftOpen, Search, UserCircle } from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { NAV_GROUPS, canSeeItem } from "@/components/layout/nav-config";
import { TalentLogo } from "@/components/brand/talent-logo";
import { usePermissions } from "@/hooks/use-permissions";
import { useProfile } from "@/hooks/use-profile";
import { useSession } from "@/hooks/use-session";
import { useAuthContext } from "@/hooks/use-auth-context";
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

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    NAV_GROUPS.reduce<Record<string, boolean>>((acc, group) => {
      acc[group.key] = group.defaultOpen ?? false;
      return acc;
    }, {}),
  );

  useEffect(() => {
    setOpenGroups((current) => {
      const next = { ...current };
      NAV_GROUPS.forEach((group) => {
        if (group.defaultOpen) next[group.key] = true;
      });
      return next;
    });
  }, []);

  const displayName = profile?.full_name ?? user?.email ?? "Signed in";
  const displayEmail = profile?.email ?? user?.email ?? "";

  return (
    <div className="flex h-full w-full flex-col bg-sidebar text-sidebar-foreground">
      {/* Brand */}
      <div className={cn("flex items-center px-4 pb-4 pt-5", collapsed && "justify-center px-2")}>
        <TalentLogo size={34} withWordmark={!collapsed} />
      </div>

      {/* Search / palette */}
      <div className={cn("px-3 pb-3", collapsed && "px-2")}>
        <button
          type="button"
          onClick={onOpenPalette}
          title="Search (⌘K)"
          className={cn(
            "flex w-full items-center gap-2 rounded-xl border border-sidebar-border bg-sidebar-elevated px-3 py-2.5 text-[12.5px] font-medium transition-colors hover:border-primary/40",
            collapsed && "justify-center px-2",
          )}
        >
          <Search className="h-4 w-4 shrink-0" />
          {!collapsed ? (
            <>
              <span className="flex-1 text-left">Search…</span>
              <kbd className="rounded-md bg-sidebar-muted px-1.5 py-0.5 text-[10px] font-bold">⌘K</kbd>
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
              onOpenChange={(open) => setOpenGroups((current) => ({ ...current, [group.key]: open }))}
              className="mb-1"
            >
              {!collapsed ? (
                <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-[10.5px] font-bold uppercase tracking-[0.14em] text-sidebar-foreground/80 transition-colors hover:text-sidebar-accent-foreground">
                  {group.label}
                  <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", !isOpen && "-rotate-90")} />
                </CollapsibleTrigger>
              ) : null}

              <CollapsibleContent>
                <div className={cn("flex flex-col gap-0.5", !collapsed && "mt-1")}>
                  {items.map((item) => (
                    <NavLink
                      key={item.key}
                      to={item.to}
                      onClick={onNavigate}
                      title={collapsed ? item.label : undefined}
                      className={({ isActive }) =>
                        cn(
                          "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-all duration-150",
                          collapsed && "justify-center px-2",
                          isActive
                            ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-glow"
                            : "hover:bg-sidebar-elevated hover:text-sidebar-accent-foreground",
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <span
                            className={cn(
                              "absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-gradient-ai transition-opacity",
                              isActive ? "opacity-100" : "opacity-0",
                            )}
                          />
                          <item.icon className="h-4 w-4 shrink-0" />
                          {!collapsed ? <span className="truncate">{item.label}</span> : null}
                        </>
                      )}
                    </NavLink>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </nav>

      {/* Footer: org selector, AI status, collapse */}
      <div className="flex flex-col gap-2 border-t border-sidebar-border p-3">
        <button
          type="button"
          className={cn(
            "flex w-full items-center gap-2.5 rounded-xl bg-sidebar-elevated px-3 py-2 text-left transition-colors hover:bg-sidebar-muted",
            collapsed && "justify-center",
          )}
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-ai text-[10px] font-extrabold text-primary-foreground">
            {(org?.name ?? "T3").slice(0, 2).toUpperCase()}
          </span>
          {!collapsed ? (
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] font-bold text-sidebar-accent-foreground">
                {org?.name ?? "Select workspace"}
              </span>
              <span className="block truncate text-[10px] font-medium text-sidebar-foreground">
                {ROLE_LABELS[profile?.role ?? ""] ?? "Member"}
              </span>
            </span>
          ) : null}
        </button>

        <div className={cn("flex items-center gap-2 rounded-xl border border-border bg-card/40 px-3 py-2", collapsed && "justify-center")}>
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
          </span>
          {!collapsed ? (
            <span className="min-w-0 flex-1">
              <span className="block text-[11.5px] font-bold text-sidebar-accent-foreground">AI Engine</span>
              <span className="block text-[10px] font-medium text-sidebar-foreground">Operational</span>
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleCollapse}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-sidebar-elevated text-sidebar-foreground transition-colors hover:bg-sidebar-muted"
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* User profile */}
      <div className="border-t border-sidebar-border p-3">
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              "flex w-full items-center gap-2.5 rounded-xl p-2 text-left transition-colors hover:bg-sidebar-elevated",
              collapsed && "justify-center",
            )}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-ai text-[12px] font-extrabold text-primary-foreground">
              {initialsOf(displayName)}
            </span>
            {!collapsed ? (
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-bold text-sidebar-accent-foreground">
                  {displayName}
                </span>
                <span className="block truncate text-[10.5px] font-medium text-sidebar-foreground">{displayEmail}</span>
              </span>
            ) : null}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="flex flex-col gap-0.5">
              <span className="text-[13px] font-bold">{displayName}</span>
              <span className="text-[11px] font-medium text-muted-foreground">{displayEmail}</span>
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
