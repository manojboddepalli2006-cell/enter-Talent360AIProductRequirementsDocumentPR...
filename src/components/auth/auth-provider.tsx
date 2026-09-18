import { useCallback, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthContext } from "@/components/auth/auth-context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<import("@supabase/supabase-js").User | null>(null);
  const [session, setSession] = useState<import("@supabase/supabase-js").Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileVersion, setProfileVersion] = useState(0);

  const refreshProfile = useCallback(() => setProfileVersion((value) => value + 1), []);

  useEffect(() => {
    // Register the listener BEFORE restoring the session, otherwise the initial
    // restore can complete first and we would miss the event entirely.
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      // Never async, and no client call inline: that deadlocks the auth client.
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);

      setTimeout(() => {
        setProfileVersion((value) => value + 1);
      }, 0);
    });

    supabase.auth
      .getSession()
      .then(({ data }) => {
        setSession(data.session ?? null);
        setUser(data.session?.user ?? null);
      })
      .finally(() => setLoading(false));

    return () => {
      subscription.subscription.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, loading, profileVersion, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
