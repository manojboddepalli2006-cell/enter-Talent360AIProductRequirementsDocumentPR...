import { FullScreenLoader } from "@/components/auth/require-auth";
import { useProfile } from "@/hooks/use-profile";
import { roleHome } from "@/lib/domain";
import { Navigate } from "react-router-dom";

/** Sends each role to a surface it can actually use after sign-in. */
export default function RoleRedirect() {
  const { profile, loading, needsOnboarding } = useProfile();

  if (loading) return <FullScreenLoader label="Opening your workspace" />;

  if (needsOnboarding) {
    return (
      <div className="talent-tile p-6 shadow-card">
        <h2 className="text-[15px] font-extrabold text-foreground">Workspace setup is incomplete</h2>
        <p className="mt-1.5 max-w-xl text-[12.5px] font-medium leading-relaxed text-muted-foreground">
          Your account exists but no workspace profile was created for it. Sign out and create the workspace
          again, or ask an HR admin to add you.
        </p>
      </div>
    );
  }

  return <Navigate to={roleHome(profile?.role)} replace />;
}
