import { useCallback, useMemo } from "react";
import { useProfile } from "@/hooks/use-profile";

/**
 * Capabilities are a UI convenience only. Every one of them is enforced again by
 * row level security on the server, and the client never decides access on its own.
 */
export type Capability =
  | "view_org_overview"
  | "view_recruitment"
  | "manage_recruitment"
  | "view_interviews"
  | "manage_interviews"
  | "browse_employees"
  | "view_team"
  | "view_self"
  | "view_risk_org"
  | "view_risk_team"
  | "review_actions_org"
  | "review_actions_team"
  | "manage_policies"
  | "manage_onboarding"
  | "view_decision_log"
  | "manage_admin"
  | "view_admin_usage"
  | "manage_users"
  | "use_copilot";

const MANAGER_CAPABILITIES: Capability[] = [
  "view_team",
  "view_self",
  "view_risk_team",
  "review_actions_team",
  "view_interviews",
  "use_copilot",
];

const EMPLOYEE_CAPABILITIES: Capability[] = ["view_self", "use_copilot"];

const HR_CAPABILITIES: Capability[] = [
  "view_org_overview",
  "view_self",
  "view_recruitment",
  "manage_recruitment",
  "view_interviews",
  "manage_interviews",
  "browse_employees",
  "view_risk_org",
  "review_actions_org",
  "manage_policies",
  "manage_onboarding",
  "view_decision_log",
  "view_admin_usage",
  "manage_users",
  "use_copilot",
];

const ORG_ADMIN_CAPABILITIES: Capability[] = [...HR_CAPABILITIES, "manage_admin"];

const CAPABILITIES_BY_ROLE: Record<string, Capability[]> = {
  org_admin: ORG_ADMIN_CAPABILITIES,
  hr_admin: HR_CAPABILITIES,
  manager: MANAGER_CAPABILITIES,
  employee: EMPLOYEE_CAPABILITIES,
};

export function roleCan(role: string | null | undefined, capability: Capability): boolean {
  if (!role) return false;
  return (CAPABILITIES_BY_ROLE[role] ?? EMPLOYEE_CAPABILITIES).includes(capability);
}

export function usePermissions() {
  const { profile } = useProfile();
  const role = profile?.role ?? null;

  const can = useCallback((capability: Capability) => roleCan(role, capability), [role]);

  return useMemo(
    () => ({
      role,
      can,
      isHr: role === "hr_admin" || role === "org_admin",
      isOrgAdmin: role === "org_admin",
      isManager: role === "manager",
      isEmployee: role === "employee",
    }),
    [role, can],
  );
}
