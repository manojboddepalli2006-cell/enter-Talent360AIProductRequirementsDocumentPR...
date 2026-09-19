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
    // A session can also arrive in the URL (magic link / handoff). Hold the app in
    // its loading state briefly so the guard does not bounce the visitor to the
    // sign-in screen before the client has consumed that token.
    const hashHasSession =
      typeof window !== "undefined" &&
      (window.location.hash.includes("access_token") || window.location.hash.includes("refresh_token"));

    let releaseTimer: number | undefined;
    if (hashHasSession) {
      releaseTimer = window.setTimeout(() => setLoading(false), 2500);
    }

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
      .finally(() => {
        // Keep waiting when a URL session is still being consumed.
        if (!hashHasSession) setLoading(false);
      });

    return () => {
      subscription.subscription.unsubscribe();
      if (releaseTimer) window.clearTimeout(releaseTimer);
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
