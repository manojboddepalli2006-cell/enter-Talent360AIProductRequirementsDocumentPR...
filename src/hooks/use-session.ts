import { useAuthContext } from "@/hooks/use-auth-context";
import type { Session, User } from "@supabase/supabase-js";

export interface UseSessionResult {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAuthenticated: boolean;
}

/** Thin read-only view of the auth context for components that only need identity. */
export function useSession(): UseSessionResult {
  const { user, session, loading } = useAuthContext();
  return { user, session, loading, isAuthenticated: Boolean(user && session) };
}
