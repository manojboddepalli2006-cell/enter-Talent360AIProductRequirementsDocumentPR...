import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LogOut, Moon, Save, Sun, UserCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/common/page-header";
import { ChartCard } from "@/components/common/chart-card";
import { StatusPill } from "@/components/common/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProfile } from "@/hooks/use-profile";
import { useSession } from "@/hooks/use-session";
import { useAuthContext } from "@/hooks/use-auth-context";
import { ThemeSegmented } from "@/components/theme/theme-switcher";
import { ROLE_LABELS } from "@/lib/domain";
import { formatDate } from "@/lib/format";

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { profile, org, employee } = useProfile();
  const { user } = useSession();
  const { signOut } = useAuthContext();


  const [fullName, setFullName] = useState("");
  const [title, setTitle] = useState("");

  useEffect(() => {
    setFullName(profile?.full_name ?? "");
    setTitle(profile?.title ?? employee?.role_title ?? "");
  }, [profile?.full_name, profile?.title, employee?.role_title]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.id) throw new Error("Your profile could not be resolved.");

      const { error } = await supabase
        .from("talent_profiles")
        .update({ full_name: fullName.trim(), title: title.trim() || null })
        .eq("id", profile.id);
      if (error) throw new Error(error.message);

      if (employee?.id) {
        const { error: employeeError } = await supabase
          .from("talent_employees")
          .update({ full_name: fullName.trim(), role_title: title.trim() || employee.role_title })
          .eq("id", employee.id);
        if (employeeError) throw new Error(employeeError.message);
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      toast.success("Profile updated");
    },
    onError: (error) => {
      toast.error("Profile not updated", {
        description: error instanceof Error ? error.message : "The change could not be saved.",
      });
    },
  });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Settings"
        description="Your account details, workspace membership and appearance."
        statusLabel={org?.name ?? "Workspace"}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard title="Your profile" subtitle="Shown next to every decision you review">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-[14px] font-extrabold text-primary-soft-foreground">
                {(fullName || user?.email || "?").slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0">
                <div className="truncate text-[13.5px] font-bold text-foreground">
                  {profile?.full_name ?? "Signed in"}
                </div>
                <div className="truncate text-[11.5px] font-medium text-muted-foreground">
                  {profile?.email ?? user?.email ?? ""}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="settingsName">Full name</Label>
              <Input
                id="settingsName"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Priya Raman"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="settingsTitle">Job title</Label>
              <Input
                id="settingsTitle"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="HR Manager"
              />
            </div>

            <Button
              size="sm"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !fullName.trim()}
              className="self-start"
            >
              <Save className="h-3.5 w-3.5" />
              {saveMutation.isPending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </ChartCard>

        <div className="flex flex-col gap-4">
          <ChartCard title="Workspace" subtitle="Your membership and the organisation settings">
            <dl className="flex flex-col gap-3">
              <div>
                <dt className="talent-label">Organisation</dt>
                <dd className="mt-0.5 text-[12.5px] font-semibold text-foreground">{org?.name ?? "—"}</dd>
              </div>
              <div>
                <dt className="talent-label">Your role</dt>
                <dd className="mt-1">
                  <StatusPill tone="primary">{ROLE_LABELS[profile?.role ?? ""] ?? "Not set"}</StatusPill>
                </dd>
              </div>
              <div>
                <dt className="talent-label">Plan</dt>
                <dd className="mt-0.5 text-[12.5px] font-semibold capitalize text-foreground">
                  {org?.plan ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="talent-label">Data retention</dt>
                <dd className="mt-0.5 text-[12.5px] font-semibold text-foreground">
                  {org?.data_retention_months ?? "—"} months
                </dd>
              </div>
              <div>
                <dt className="talent-label">Member since</dt>
                <dd className="mt-0.5 text-[12.5px] font-semibold text-foreground">
                  {profile?.created_at ? formatDate(profile.created_at) : "—"}
                </dd>
              </div>
            </dl>
          </ChartCard>

          <ChartCard title="Appearance and session" subtitle="Dark mode applies to the whole application">
            <div className="flex flex-wrap items-center gap-2">
              <ThemeSegmented className="w-full sm:w-auto" />
              <Button variant="soft-destructive" size="sm" onClick={() => void signOut()}>
                <LogOut className="h-3.5 w-3.5" />
                Sign out
              </Button>
            </div>
            <p className="mt-3 flex items-start gap-2 text-[11.5px] font-medium leading-relaxed text-muted-foreground">
              <UserCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Signing out ends this session on this device. Your workspace data stays exactly as it is.
            </p>
          </ChartCard>
        </div>
      </div>
    </div>
  );
}
