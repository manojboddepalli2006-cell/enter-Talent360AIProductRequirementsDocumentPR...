import { NavLink } from "react-router-dom";
import { BrainCircuit, Briefcase, LayoutDashboard, MessagesSquare, UserCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePermissions, type Capability } from "@/hooks/use-permissions";
import type { LucideIcon } from "lucide-react";

/**
 * iOS-style tab bar for compact (phone) layouts — the Apple HIG pattern where
 * navigation moves to the bottom of the screen. Hidden on md+ where the macOS
 * source list sidebar takes over.
 *
 * Auto-layout notes: the bar is anchored to the bottom edge (fixed inset-x-0),
 * heights are intrinsic (h-14 + safe-area padding), and each tab is a flex item
 * that grows evenly (flex-1), so content never needs hardcoded widths.
 */
const TABS: Array<{ to: string; label: string; icon: LucideIcon; capabilities: Capability[] }> = [
  { to: "/app/command-center", label: "Overview", icon: LayoutDashboard, capabilities: ["view_org_overview"] },
  { to: "/app/action-center", label: "Decisions", icon: BrainCircuit, capabilities: ["review_actions_org", "review_actions_team"] },
  { to: "/app/recruitment", label: "Pipeline", icon: Briefcase, capabilities: ["view_recruitment"] },
  { to: "/app/copilot", label: "Copilot", icon: MessagesSquare, capabilities: [] },
  { to: "/app/my-profile", label: "Profile", icon: UserCircle, capabilities: ["view_self"] },
];

export function MobileTabBar() {
  const { can } = usePermissions();

  const visible = TABS.filter(
    (tab) => !tab.capabilities.length || tab.capabilities.some((capability) => can(capability)),
  );

  if (!visible.length) return null;

  return (
    <nav
      aria-label="Primary navigation"
      className="talent-glass fixed inset-x-0 bottom-0 z-30 border-t border-border md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex h-14 items-stretch">
        {visible.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              cn(
                "flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors",
                isActive ? "text-primary" : "text-muted-foreground",
              )
            }
          >
            {({ isActive }) => (
              <>
                <tab.icon className={cn("h-[21px] w-[21px]", isActive && "font-bold")} />
                <span className={cn(isActive && "font-semibold")}>{tab.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
