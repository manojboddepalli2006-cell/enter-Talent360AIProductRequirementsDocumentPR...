import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/hooks/use-auth-context";
import type { Database } from "@/integrations/supabase/types";

type ProfileRow = Database["public"]["Tables"]["talent_profiles"]["Row"];
type OrgRow = Database["public"]["Tables"]["talent_orgs"]["Row"];
type EmployeeRow = Database["public"]["Tables"]["talent_employees"]["Row"];

export interface ProfileBundle {
  profile: ProfileRow | null;
  org: OrgRow | null;
  employee: EmployeeRow | null;
}

const EMPTY: ProfileBundle = { profile: null, org: null, employee: null };

/**
 * Resolves the signed-in identity into the workspace it belongs to.
 * Also reports `needsOnboarding` when a session exists but no workspace profile
 * does, which is the window between sign-up and profile creation.
 */
export function useProfile() {
  const { user, loading: authLoading, profileVersion } = useAuthContext();

  const query = useQuery({
    queryKey: ["talent360-profile", user?.id ?? "anonymous", profileVersion],
    enabled: Boolean(user),
    staleTime: 30_000,
    queryFn: async (): Promise<ProfileBundle> => {
      if (!user) return EMPTY;

      const { data: profile, error } = await supabase
        .from("talent_profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (error) throw new Error(error.message);
      if (!profile) return EMPTY;

      const [orgResult, employeeResult] = await Promise.all([
        supabase.from("talent_orgs").select("*").eq("id", profile.org_id).maybeSingle(),
        supabase.from("talent_employees").select("*").eq("user_id", user.id).maybeSingle(),
      ]);

      if (orgResult.error) throw new Error(orgResult.error.message);

      return {
        profile,
        org: orgResult.data ?? null,
        employee: employeeResult.data ?? null,
      };
    },
  });

  const data = query.data ?? EMPTY;

  return {
    ...data,
    loading: authLoading || (Boolean(user) && query.isLoading),
    error: query.error instanceof Error ? query.error : null,
    refetch: query.refetch,
    needsOnboarding: Boolean(user) && !query.isLoading && !data.profile,
  };
}
