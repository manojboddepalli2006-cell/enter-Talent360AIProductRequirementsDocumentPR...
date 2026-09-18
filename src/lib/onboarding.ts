import { supabase } from "@/integrations/supabase/client";
import { DEMO_PASSWORD, roleMeta, type RoleKey } from "@/lib/domain";

export interface WorkspaceInput {
  fullName: string;
  role: RoleKey;
  /** `demo` joins the shared seeded workspace; `new` provisions a fresh one. */
  mode: "demo" | "new";
  orgName?: string;
}

/**
 * Creates the organisation profile, the workspace profile and the linked employee
 * record in one server-side step. This cannot be done from separate client inserts:
 * a `RETURNING` clause is checked against the SELECT policy, and that policy reads a
 * helper that cannot see a row inserted by the same statement.
 */
export async function completeWorkspaceSetup(input: WorkspaceInput): Promise<string> {
  let joinOrgId: string | null = null;

  if (input.mode === "demo") {
    const { data, error } = await supabase.rpc("talent_demo_workspace_id");
    if (error) throw new Error(error.message);
    joinOrgId = (data as string | null) ?? null;
  }

  const { data, error } = await supabase.rpc("talent_complete_signup", {
    p_full_name: input.fullName,
    p_role: input.role,
    p_org_name: input.mode === "new" ? (input.orgName?.trim() ?? null) : null,
    p_join_org_id: joinOrgId,
  });

  if (error) throw new Error(error.message);
  return data as string;
}

/**
 * Idempotent repair for an account whose workspace profile is missing — for
 * example an account created before setup completed. Safe to call after any sign-in.
 */
export async function ensureWorkspaceProfile(role: RoleKey = "employee"): Promise<boolean> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw new Error(userError.message);
  if (!userData.user) return false;

  const { data: existing, error } = await supabase
    .from("talent_profiles")
    .select("id, org_id")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (existing?.org_id) return false;

  const meta = roleMeta(role);
  await completeWorkspaceSetup({
    fullName: (userData.user.user_metadata?.full_name as string | undefined) ?? meta?.label ?? "New Member",
    role,
    mode: "demo",
  });
  return true;
}

export interface AuthOutcome {
  ok: boolean;
  message?: string;
  needsEmailConfirmation?: boolean;
}

const DEMO_NAMES: Record<RoleKey, string> = {
  org_admin: "Aarav Menon",
  hr_admin: "Priya Raman",
  manager: "Daniel Okafor",
  employee: "Sam Rivera",
};

/**
 * One-click demo entry: signs in when the demo account already exists, and
 * creates it on first use so a reviewer can reach every role immediately.
 */
export async function enterAsDemoRole(role: RoleKey): Promise<AuthOutcome> {
  const meta = roleMeta(role);
  if (!meta) return { ok: false, message: "Unknown role." };

  const signIn = await supabase.auth.signInWithPassword({
    email: meta.defaultEmail,
    password: DEMO_PASSWORD,
  });

  if (!signIn.error && signIn.data.user) {
    await ensureWorkspaceProfile(role);
    return { ok: true };
  }

  const signUp = await supabase.auth.signUp({
    email: meta.defaultEmail,
    password: DEMO_PASSWORD,
    options: {
      emailRedirectTo: `${window.location.origin}/`,
      data: { full_name: DEMO_NAMES[role], role, mode: "demo" },
    },
  });

  if (signUp.error) return { ok: false, message: signUp.error.message };

  if (!signUp.data.session || !signUp.data.user) {
    return {
      ok: false,
      needsEmailConfirmation: true,
      message: "The demo account was created but no session was returned.",
    };
  }

  await completeWorkspaceSetup({
    fullName: DEMO_NAMES[role],
    role,
    mode: "demo",
  });

  return { ok: true };
}
