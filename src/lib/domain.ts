/** Domain vocabulary shared by every Talent360 surface. */

export type RoleKey = "org_admin" | "hr_admin" | "manager" | "employee";

export interface RoleMeta {
  key: RoleKey;
  label: string;
  blurb: string;
  defaultEmail: string;
}

/** Order matters: it drives the demo entry chips and the role manager table. */
export const ROLES: RoleMeta[] = [
  {
    key: "org_admin",
    label: "Org Admin",
    blurb: "Owns the workspace: integrations, AI policy, roles and retention.",
    defaultEmail: "admin@talent360.demo",
  },
  {
    key: "hr_admin",
    label: "HR Admin",
    blurb: "Runs recruitment, reviews AI recommendations and owns the risk queue.",
    defaultEmail: "hr@talent360.demo",
  },
  {
    key: "manager",
    label: "People Manager",
    blurb: "Sees their own team only: skills, engagement and risk signals.",
    defaultEmail: "manager@talent360.demo",
  },
  {
    key: "employee",
    label: "Employee",
    blurb: "Self-service: profile, development plan, onboarding and the policy copilot.",
    defaultEmail: "employee@talent360.demo",
  },
];

export const DEMO_PASSWORD = "Talent360!demo";
export const DEMO_ORG_NAME = "Talent360 Demo Corp";

export const ROLE_LABELS: Record<string, string> = ROLES.reduce<Record<string, string>>((acc, role) => {
  acc[role.key] = role.label;
  return acc;
}, {});

export function roleMeta(role: string | null | undefined): RoleMeta | undefined {
  return ROLES.find((item) => item.key === role);
}

/**
 * Role-specific portal home. Each role gets its own dashboard identity:
 * Org Admin → Organization Intelligence, HR → Workforce Intelligence,
 * Manager → My Team Intelligence, Employee → My Growth Intelligence.
 */
export const PORTALS: Record<string, { path: string; label: string; dashboard: string }> = {
  org_admin: { path: "/org", label: "Organization", dashboard: "Organization Intelligence" },
  hr_admin: { path: "/hr", label: "Workforce", dashboard: "Workforce Intelligence" },
  manager: { path: "/manager", label: "Team", dashboard: "My Team Intelligence" },
  employee: { path: "/employee", label: "Growth", dashboard: "My Growth Intelligence" },
};

export function roleHome(role: string | null | undefined): string {
  switch (role) {
    case "employee":
      return "/app/my-home";
    case "manager":
      return "/app/my-team";
    case "org_admin":
      return "/app/org";
    default:
      return "/app/command-center";
  }
}

/** Portal root path for a role (used by the portal gate and the org selector). */
export function rolePortalPath(role: string | null | undefined): string {
  return PORTALS[role ?? ""]?.path ?? "/app";
}

export function dashboardTitle(role: string | null | undefined): string {
  return PORTALS[role ?? ""]?.dashboard ?? "Workforce Intelligence";
}

export const PIPELINE_STAGES = [
  { key: "sourced", label: "Sourced" },
  { key: "screened", label: "Screened" },
  { key: "interviewing", label: "Interviewing" },
  { key: "offer", label: "Offer" },
  { key: "hired", label: "Hired" },
  { key: "hold", label: "Hold" },
  { key: "rejected", label: "Rejected" },
] as const;

export const STAGE_LABELS: Record<string, string> = PIPELINE_STAGES.reduce<Record<string, string>>(
  (acc, stage) => {
    acc[stage.key] = stage.label;
    return acc;
  },
  {},
);

export const RECOMMENDATION_MODULES = ["recruit", "interview", "develop", "monitor", "onboard"] as const;

export const MODULE_LABELS: Record<string, string> = {
  recruit: "Recruitment",
  interview: "Interview",
  develop: "Development",
  monitor: "Risk monitor",
  onboard: "Onboarding",
};

export const RISK_LABELS: Record<string, string> = {
  low: "Low risk",
  medium: "Medium risk",
  high: "High risk",
};

export const RECOMMENDATION_STATUS_LABELS: Record<string, string> = {
  pending: "Pending review",
  approved: "Approved",
  modified: "Approved with changes",
  rejected: "Rejected",
};

export type Tone =
  | "neutral"
  | "primary"
  | "accent"
  | "success"
  | "warning"
  | "info"
  | "danger";

export const TONE_CHIP: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground",
  primary: "bg-primary-soft text-primary-soft-foreground",
  accent: "bg-accent-soft text-accent-soft-foreground",
  success: "bg-success-soft text-success-soft-foreground",
  warning: "bg-warning-soft text-warning-soft-foreground",
  info: "bg-info-soft text-info-soft-foreground",
  danger: "bg-destructive-soft text-destructive-soft-foreground",
};

export const TONE_ICON: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground",
  primary: "bg-primary-soft text-primary-soft-foreground",
  accent: "bg-accent-soft text-accent-soft-foreground",
  success: "bg-success-soft text-success-soft-foreground",
  warning: "bg-warning-soft text-warning-soft-foreground",
  info: "bg-info-soft text-info-soft-foreground",
  danger: "bg-destructive-soft text-destructive-soft-foreground",
};

export const RISK_TONE: Record<string, Tone> = {
  low: "success",
  medium: "warning",
  high: "danger",
};

export const STAGE_TONE: Record<string, Tone> = {
  sourced: "neutral",
  screened: "info",
  interviewing: "primary",
  offer: "warning",
  hired: "success",
  hold: "neutral",
  rejected: "danger",
};

export const STATUS_TONE: Record<string, Tone> = {
  pending: "warning",
  approved: "success",
  modified: "info",
  rejected: "danger",
};

export const DIRECTION_TONE: Record<string, Tone> = {
  up: "success",
  down: "danger",
  flat: "neutral",
};

/** Confidence is shown as a band, never as a bare number without context. */
export function confidenceBand(value: number | null | undefined): { tone: Tone; label: string } {
  if (value === null || value === undefined) return { tone: "neutral", label: "No confidence estimate" };
  if (value >= 0.8) return { tone: "success", label: "High confidence" };
  if (value >= 0.6) return { tone: "info", label: "Moderate confidence" };
  return { tone: "warning", label: "Low confidence" };
}
