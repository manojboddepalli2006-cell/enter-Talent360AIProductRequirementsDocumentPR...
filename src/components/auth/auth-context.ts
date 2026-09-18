import { createContext } from "react";
import type { Session, User } from "@supabase/supabase-js";

export interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  /** Bumped whenever the workspace profile changes, so consumers can refetch. */
  profileVersion: number;
  refreshProfile: () => void;
  signOut: () => Promise<void>;
}

/**
 * Kept in its own module so the provider file exports components only, which is
 * what fast refresh needs to stay reliable during development.
 */
export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
