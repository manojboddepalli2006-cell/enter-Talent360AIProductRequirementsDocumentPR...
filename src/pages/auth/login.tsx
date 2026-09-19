import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { AlertCircle, Loader2, LogIn } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AuthLayout } from "@/components/auth/auth-layout";
import { FullScreenLoader } from "@/components/auth/require-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "@/hooks/use-session";
import { ensureWorkspaceProfile, enterAsDemoRole } from "@/lib/onboarding";
import { DEMO_PASSWORD, ROLES, type RoleKey } from "@/lib/domain";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  const navigate = useNavigate();
  const { isAuthenticated, loading } = useSession();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [demoRole, setDemoRole] = useState<RoleKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (loading) return <FullScreenLoader label="Checking your session" />;
  if (isAuthenticated) return <Navigate to="/app" replace />;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        setError(signInError.message);
        return;
      }

      if (data.user) {
        // Repairs an account created before the workspace profile was written.
        await ensureWorkspaceProfile();
      }
      navigate("/app", { replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sign-in failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemo = async (role: RoleKey) => {
    setError(null);
    setDemoRole(role);
    try {
      const outcome = await enterAsDemoRole(role);
      if (!outcome.ok) {
        setError(outcome.message ?? "The demo workspace could not be opened.");
        return;
      }
      navigate("/app", { replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The demo workspace could not be opened.");
    } finally {
      setDemoRole(null);
    }
  };

  return (
    <AuthLayout
      title="Sign in to Talent360 AI"
      subtitle="Use your workspace credentials, or step into a pre-seeded role to see how each permission scope changes what is visible."
      footer={
        <span className="text-muted-foreground">
          No workspace yet?{" "}
          <Link to="/signup" className="font-bold text-primary hover:underline">
            Create one in a minute
          </Link>
        </span>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Work email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@company.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="••••••••"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>

        {error ? (
          <div className="flex items-start gap-2 rounded-lg bg-destructive-soft px-3 py-2.5 text-destructive-soft-foreground">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="text-[12.5px] font-semibold leading-snug">{error}</span>
          </div>
        ) : null}

        <Button type="submit" disabled={submitting || demoRole !== null} className="w-full">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
          Sign in
        </Button>

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setNotice("Password reset emails are not sent from this workspace yet. Ask an Org Admin to reset your password, or open a demo role below to explore.")}
            className="text-[11.5px] font-semibold text-primary hover:underline"
          >
            Forgot password?
          </button>
          <button
            type="button"
            onClick={() => setNotice("Single sign-on is recorded as a configuration entry but no identity provider is connected in this workspace yet.")}
            className="text-[11.5px] font-semibold text-muted-foreground hover:text-foreground"
          >
            SSO Login
          </button>
        </div>

        {notice ? (
          <p className="rounded-xl border border-border bg-card/60 px-3 py-2 text-[11.5px] font-medium leading-relaxed text-muted-foreground">
            {notice}
          </p>
        ) : null}
      </form>

      <div className="my-6 flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="talent-label">Or open a demo role</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <div className="grid grid-cols-2 gap-2">
        {ROLES.map((role) => (
          <button
            key={role.key}
            type="button"
            disabled={demoRole !== null || submitting}
            onClick={() => void handleDemo(role.key)}
            className={cn(
              "flex flex-col items-start gap-1 rounded-xl border border-border bg-card p-3 text-left transition-colors",
              "hover:border-primary/40 hover:bg-primary-soft/50 disabled:opacity-60",
            )}
          >
            <span className="flex w-full items-center justify-between gap-2">
              <span className="text-[12.5px] font-bold text-foreground">{role.label}</span>
              {demoRole === role.key ? <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /> : null}
            </span>
            <span className="text-[11px] font-medium leading-snug text-muted-foreground">{role.blurb}</span>
          </button>
        ))}
      </div>

      <p className="mt-3 text-[11px] font-medium leading-relaxed text-muted-foreground">
        Demo accounts are created on first use in the shared <span className="font-semibold">Talent360 Demo
        Corp</span> workspace. Password for every demo role: <span className="font-semibold">{DEMO_PASSWORD}</span>.
      </p>
    </AuthLayout>
  );
}
