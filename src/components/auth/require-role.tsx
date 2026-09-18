import type { ReactNode } from "react";
import { ShieldAlert } from "lucide-react";
import { usePermissions, type Capability } from "@/hooks/use-permissions";
import { useProfile } from "@/hooks/use-profile";
import { EmptyState } from "@/components/common/states";
import { FullScreenLoader } from "@/components/auth/require-auth";
import { ROLE_LABELS } from "@/lib/domain";

interface RequireRoleProps {
  /** Any one of these unlocks the route. */
  capabilities: Capability[];
  children: ReactNode;
}

/**
 * Hides a route from roles that cannot use it. This is presentation only: the
 * same boundary is enforced server-side, so a direct API call still returns nothing.
 */
export function RequireRole({ capabilities, children }: RequireRoleProps) {
  const { loading } = useProfile();
  const { can, role } = usePermissions();

  if (loading) return <FullScreenLoader label="Checking your access" />;

  if (!capabilities.some((capability) => can(capability))) {
    return (
      <EmptyState
        icon={<ShieldAlert className="h-5 w-5" />}
        title="Not available for your role"
        description={`This module is outside the ${
          ROLE_LABELS[role ?? ""] ?? "current"
        } scope. Restricted data such as workforce risk, recruitment and the decision log is limited to the roles that own it, and the same restriction applies to direct API access.`}
      />
    );
  }

  return <>{children}</>;
}
