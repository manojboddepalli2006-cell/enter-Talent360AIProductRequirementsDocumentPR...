import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { AlertCircle, Building2, Loader2, UserPlus, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AuthLayout } from "@/components/auth/auth-layout";
import { FullScreenLoader } from "@/components/auth/require-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "@/hooks/use-session";
import { completeWorkspaceSetup } from "@/lib/onboarding";
import { DEMO_ORG_NAME, ROLES, type RoleKey } from "@/lib/domain";
import { cn } from "@/lib/utils";

type WorkspaceMode = "demo" | "new";

export default function SignupPage() {
  const navigate = useNavigate();
  const { isAuthenticated, loading } = useSession();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<RoleKey>("hr_admin");
  const [mode, setMode] = useState<WorkspaceMode>("demo");
  const [orgName, setOrgName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading) return <FullScreenLoader label="Checking your session" />;
  if (isAuthenticated) return <Navigate to="/app" replace />;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (mode === "new" && !orgName.trim()) {
      setError("Enter an organization name, or switch to joining the demo workspace.");
      return;
    }

    setSubmitting(true);
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: { full_name: fullName.trim(), role, mode, org_name: orgName.trim() },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      if (!data.session || !data.user) {
        setError(
          "Your account was created but no session was returned, which usually means email confirmation is required.",
        );
        return;
      }

      await completeWorkspaceSetup({
        fullName: fullName.trim() || email.trim(),
        role,
        mode,
        orgName: orgName.trim(),
      });

      navigate("/app", { replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Your workspace could not be created.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Create your Talent360 workspace"
      subtitle="Your role decides which surfaces open, and the data boundaries behind them are enforced in the database rather than hidden in the interface."
      footer={
        <span className="text-muted-foreground">
          Already have access?{" "}
          <Link to="/login" className="font-bold text-primary hover:underline">
            Sign in
          </Link>
        </span>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fullName">Full name</Label>
          <Input
            id="fullName"
            required
            placeholder="Priya Raman"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
          />
        </div>

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
            autoComplete="new-password"
            required
            minLength={8}
            placeholder="At least 8 characters"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <span className="talent-label">Your role</span>
          <div className="grid grid-cols-2 gap-2">
            {ROLES.map((option) => {
              const active = option.key === role;
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setRole(option.key)}
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors",
                    active
                      ? "border-primary bg-primary-soft"
                      : "border-border bg-card hover:border-primary/40",
                  )}
                >
                  <span
                    className={cn(
                      "text-[12.5px] font-bold",
                      active ? "text-primary-soft-foreground" : "text-foreground",
                    )}
                  >
                    {option.label}
                  </span>
                  <span
                    className={cn(
                      "text-[11px] font-medium leading-snug",
                      active ? "text-primary-soft-foreground/80" : "text-muted-foreground",
                    )}
                  >
                    {option.blurb}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="talent-label">Workspace</span>
          <div className="grid grid-cols-1 gap-2">
            <button
              type="button"
              onClick={() => setMode("demo")}
              className={cn(
                "flex items-start gap-3 rounded-xl border p-3 text-left transition-colors",
                mode === "demo" ? "border-primary bg-primary-soft" : "border-border bg-card hover:border-primary/40",
              )}
            >
              <Users className={cn("mt-0.5 h-4 w-4", mode === "demo" ? "text-primary-soft-foreground" : "text-muted-foreground")} />
              <span>
                <span className="block text-[12.5px] font-bold text-foreground">
                  Join {DEMO_ORG_NAME}
                </span>
                <span className="block text-[11px] font-medium leading-snug text-muted-foreground">
                  Drops you into a fully populated workspace: pipeline, interviews, risk signals,
                  policy library, action queue and decision log.
                </span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => setMode("new")}
              className={cn(
                "flex items-start gap-3 rounded-xl border p-3 text-left transition-colors",
                mode === "new" ? "border-primary bg-primary-soft" : "border-border bg-card hover:border-primary/40",
              )}
            >
              <Building2 className={cn("mt-0.5 h-4 w-4", mode === "new" ? "text-primary-soft-foreground" : "text-muted-foreground")} />
              <span className="flex-1">
                <span className="block text-[12.5px] font-bold text-foreground">Create a new organization</span>
                <span className="block text-[11px] font-medium leading-snug text-muted-foreground">
                  Starts empty so you can seed or add your own people. Empty states are used instead of
                  zero-filled charts.
                </span>
              </span>
            </button>
          </div>
        </div>

        {mode === "new" ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="orgName">Organization name</Label>
            <Input
              id="orgName"
              placeholder="Northwind Group"
              value={orgName}
              onChange={(event) => setOrgName(event.target.value)}
            />
          </div>
        ) : null}

        {error ? (
          <div className="flex items-start gap-2 rounded-lg bg-destructive-soft px-3 py-2.5 text-destructive-soft-foreground">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="text-[12.5px] font-semibold leading-snug">{error}</span>
          </div>
        ) : null}

        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
          Create workspace
        </Button>
      </form>
    </AuthLayout>
  );
}
