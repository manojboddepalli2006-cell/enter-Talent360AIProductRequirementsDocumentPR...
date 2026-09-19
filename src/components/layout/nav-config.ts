import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck,
  MicVocal,
  Bell,
  BarChart3,
  Building2,
  Compass,
  BrainCircuit,
  Briefcase,
  ClipboardList,
  FileText,
  Gauge,
  GraduationCap,
  LayoutDashboard,
  MessagesSquare,
  Network,
  Settings,
  ShieldAlert,
  UserCircle,
  Users,
  UsersRound,
} from "lucide-react";
import type { Capability } from "@/hooks/use-permissions";

export interface NavItem {
  key: string;
  label: string;
  to: string;
  icon: LucideIcon;
  /** Any one of these unlocks the item. Omit for items every signed-in role sees. */
  capabilities?: Capability[];
}

export interface NavGroup {
  key: string;
  label: string;
  items: NavItem[];
  defaultOpen?: boolean;
}

/**
 * Navigation mirrors the reference shell's grouped sidebar. Visibility is a UX
 * affordance only; the same capability boundaries are enforced by RLS.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    key: "overview",
    label: "Overview",
    defaultOpen: true,
    items: [
      {
        key: "command-center",
        label: "Command Center",
        to: "/app/command-center",
        icon: LayoutDashboard,
        capabilities: ["view_org_overview"],
      },
      {
        key: "action-center",
        label: "AI Action Center",
        to: "/app/action-center",
        icon: BrainCircuit,
        capabilities: ["review_actions_org", "review_actions_team"],
      },
      {
        key: "org-console",
        label: "Organization",
        to: "/app/org",
        icon: Building2,
        capabilities: ["manage_admin"],
      },
      {
        key: "analytics",
        label: "Analytics",
        to: "/app/analytics",
        icon: BarChart3,
        capabilities: ["view_org_overview", "view_team"],
      },
    ],
  },
  {
    key: "workspace",
    label: "My Workspace",
    defaultOpen: true,
    items: [
      {
        key: "team-intel",
        label: "My Team Intelligence",
        to: "/app/my-team",
        icon: UsersRound,
        capabilities: ["view_team"],
      },
      { key: "team", label: "Team Directory", to: "/app/team", icon: Users, capabilities: ["view_team"] },
      { key: "my-home", label: "My Growth", to: "/app/my-home", icon: Compass, capabilities: ["view_self"] },
      { key: "my-profile", label: "My Profile", to: "/app/my-profile", icon: UserCircle, capabilities: ["view_self"] },
      { key: "onboarding", label: "Onboarding", to: "/app/onboarding", icon: ClipboardList },
      { key: "practice", label: "Interview Prep", to: "/app/practice", icon: MicVocal },
      { key: "notifications", label: "Notifications", to: "/app/notifications", icon: Bell },
      { key: "my-tasks", label: "My Tasks", to: "/app/tasks", icon: BadgeCheck, capabilities: ["view_self"] },
    ],
  },
  {
    key: "recruitment",
    label: "Recruitment",
    defaultOpen: true,
    items: [
      {
        key: "pipeline",
        label: "Pipeline",
        to: "/app/recruitment",
        icon: Briefcase,
        capabilities: ["view_recruitment"],
      },
      {
        key: "interviews",
        label: "Interview Console",
        to: "/app/interviews",
        icon: MessagesSquare,
        capabilities: ["view_interviews"],
      },
    ],
  },
  {
    key: "people",
    label: "People & Growth",
    defaultOpen: false,
    items: [
      { key: "employees", label: "Employees", to: "/app/employees", icon: Users, capabilities: ["browse_employees"] },
      {
        key: "skills",
        label: "Skill Intelligence",
        to: "/app/skills",
        icon: GraduationCap,
        capabilities: ["view_org_overview", "view_team"],
      },
      {
        key: "risk",
        label: "Workforce Risk",
        to: "/app/risk",
        icon: ShieldAlert,
        capabilities: ["view_risk_org", "view_risk_team"],
      },
      {
        key: "development",
        label: "Development Plans",
        to: "/app/development",
        icon: Compass,
        capabilities: ["view_org_overview", "view_team", "view_self"],
      },
    ],
  },
  {
    key: "support",
    label: "Support",
    defaultOpen: false,
    items: [
      { key: "copilot", label: "Policy Copilot", to: "/app/copilot", icon: MessagesSquare },
      {
        key: "policies",
        label: "Policy Library",
        to: "/app/policies",
        icon: FileText,
        capabilities: ["manage_policies", "use_copilot"],
      },
    ],
  },
  {
    key: "governance",
    label: "Governance",
    defaultOpen: false,
    items: [
      {
        key: "decision-log",
        label: "AI Decision Log",
        to: "/app/decision-log",
        icon: FileText,
        capabilities: ["view_decision_log"],
      },
      {
        key: "usage",
        label: "AI Usage & Cost",
        to: "/app/admin/usage",
        icon: Gauge,
        capabilities: ["view_admin_usage"],
      },
      { key: "admin", label: "Admin Console", to: "/app/admin", icon: Building2, capabilities: ["manage_admin"] },
      { key: "users", label: "Users & Roles", to: "/app/admin/users", icon: Network, capabilities: ["manage_users"] },
      { key: "integrations", label: "Integrations", to: "/app/admin/integrations", icon: Compass, capabilities: ["manage_admin"] },
    ],
  },
  {
    key: "settings",
    label: "Settings",
    defaultOpen: false,
    items: [{ key: "settings", label: "Settings", to: "/app/settings", icon: Settings }],
  },
];

/** Flat list used by the command palette and route titles. */
export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);

export function canSeeItem(item: NavItem, can: (capability: Capability) => boolean): boolean {
  if (!item.capabilities?.length) return true;
  return item.capabilities.some((capability) => can(capability));
}
