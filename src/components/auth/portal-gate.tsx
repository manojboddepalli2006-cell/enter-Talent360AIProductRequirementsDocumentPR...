import { Navigate } from "react-router-dom";
import { useProfile } from "@/hooks/use-profile";
import { roleHome, PORTALS } from "@/lib/domain";
import { TalentLogo } from "@/components/brand/talent-logo";
import { LiveAiOrb } from "@/components/brand/live-ai-orb";

/**
 * Portal entry gate.
 *
 * Domain architecture: /org, /hr, /manager and /employee are the portal roots
 * (ready to map to org./hr./manager./employee. subdomains later). The gate reads
 * the role from the database — never from the URL — and sends the visitor to the
 * portal that actually belongs to them, so changing the address cannot change
 * what a user can see.
 */
export function PortalGate({ portal }: { portal: "org" | "hr" | "manager" | "employee" }) {
  const { profile, loading, needsOnboarding } = useProfile();

  if (loading) {
    return (
      <div className="relative flex h-full w-full flex-col items-center justify-center gap-6 bg-background">
        <LiveAiOrb state="processing" size={220} intensity={0.7} />
        <TalentLogo size={30} withWordmark />
        <p className="text-[12px] font-medium text-muted-foreground">Resolving your portal…</p>
      </div>
    );
  }

  if (needsOnboarding) return <Navigate to="/login" replace />;

  const role = profile?.role ?? null;
  const expectedPortal = role ? PORTALS[role]?.path.replace("/", "") : null;

  // Always land on the portal that matches the signed-in role.
  if (expectedPortal !== portal) return <Navigate to={roleHome(role)} replace />;
  return <Navigate to={roleHome(role)} replace />;
}
