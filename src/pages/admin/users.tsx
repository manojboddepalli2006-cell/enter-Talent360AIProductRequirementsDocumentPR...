import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, ShieldCheck, UserCog, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/common/page-header";
import { ChartCard } from "@/components/common/chart-card";
import { KpiTile } from "@/components/common/kpi-tile";
import { StatusPill } from "@/components/common/status-pill";
import { UserCell } from "@/components/common/user-cell";
import { ErrorState, LoadingState } from "@/components/common/states";
import { ROLES, ROLE_LABELS } from "@/lib/domain";
import { formatDate } from "@/lib/format";
import { useSession } from "@/hooks/use-session";
import { useProfile } from "@/hooks/use-profile";
import { cn } from "@/lib/utils";

interface ProfileRow {
  id: string;
  full_name: string;
  email: string;
  role: string;
  title: string | null;
  status: string;
  created_at: string;
}

const SELECT_CLASS = cn(
  "h-8 rounded-lg border border-input bg-card px-2.5 text-[12px] font-semibold text-foreground",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-60",
);

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const { user } = useSession();
  const { profile: myProfile } = useProfile();

  const query = useQuery({
    queryKey: ["talent360-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("talent_profiles")
        .select("id, full_name, email, role, title, status, created_at")
        .order("created_at");
      if (error) throw new Error(error.message);
      return (data ?? []) as ProfileRow[];
    },
  });

  const roleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      const { error } = await supabase.from("talent_profiles").update({ role }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["talent360-profiles"] });
      toast.success("Role updated", {
        description: "The change takes effect on that account's next request.",
      });
    },
    onError: (error) => {
      toast.error("Role not updated", {
        description: error instanceof Error ? error.message : "The change could not be saved.",
      });
    },
  });

  const profiles = query.data ?? [];
  const counts = ROLES.map((role) => ({
    role: role.key,
    label: role.label,
    count: profiles.filter((profile) => profile.role === role.key).length,
  }));

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Users and roles"
        description="Role assignment for this workspace. Changing a role changes which surfaces open and which rows the person can read."
        statusLabel={`${profiles.length} accounts`}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {counts.map((entry, index) => (
          <KpiTile
            key={entry.role}
            label={entry.label}
            value={String(entry.count)}
            icon={Users}
            tone={(["primary", "info", "warning", "success"] as const)[index % 4]}
          />
        ))}
      </div>

      {query.isLoading ? <LoadingState label="Reading workspace accounts" /> : null}

      {query.error ? (
        <ErrorState
          message={query.error instanceof Error ? query.error.message : "Accounts could not be loaded."}
          onRetry={() => void query.refetch()}
        />
      ) : null}

      {!query.isLoading && !query.error ? (
        <ChartCard title="Accounts" subtitle="Your own role cannot be changed from this screen">
          <div className="talent-scroll overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-3 pr-4 text-left talent-label">Account</th>
                  <th className="py-3 pr-4 text-left talent-label">Role</th>
                  <th className="py-3 pr-4 text-left talent-label">Status</th>
                  <th className="py-3 pr-4 text-left talent-label">Joined</th>
                  <th className="py-3 pr-4 text-left talent-label">Change role</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((profile) => {
                  const isSelf = profile.id === user?.id || profile.id === myProfile?.id;
                  return (
                    <tr key={profile.id} className="border-b border-border last:border-0">
                      <td className="py-3 pr-4">
                        <UserCell
                          name={profile.full_name}
                          subtext={profile.title ? `${profile.title} · ${profile.email}` : profile.email}
                          trailing={isSelf ? <StatusPill tone="primary">You</StatusPill> : undefined}
                        />
                      </td>
                      <td className="py-3 pr-4">
                        <StatusPill tone="neutral">{ROLE_LABELS[profile.role] ?? profile.role}</StatusPill>
                      </td>
                      <td className="py-3 pr-4">
                        <StatusPill tone={profile.status === "active" ? "success" : "neutral"}>
                          {profile.status}
                        </StatusPill>
                      </td>
                      <td className="py-3 pr-4 text-[12px] font-medium text-muted-foreground">
                        {formatDate(profile.created_at)}
                      </td>
                      <td className="py-3 pr-4">
                        <select
                          className={SELECT_CLASS}
                          value={profile.role}
                          disabled={isSelf || roleMutation.isPending}
                          aria-label={`Role for ${profile.full_name}`}
                          onChange={(event) =>
                            roleMutation.mutate({ id: profile.id, role: event.target.value })
                          }
                        >
                          {ROLES.map((role) => (
                            <option key={role.key} value={role.key}>
                              {role.label}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {roleMutation.isPending ? (
            <p className="mt-2 flex items-center gap-2 text-[11.5px] font-semibold text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Saving role change
            </p>
          ) : null}
        </ChartCard>
      ) : null}

      <div className="talent-tile flex items-start gap-3 p-4 shadow-card">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p className="text-[12px] font-medium leading-relaxed text-muted-foreground">
          Only HR administrators and org admins can read the account list or change a role, and the update
          policy blocks a user from changing their own role. A person who loses a role immediately loses the
          data that role could read, because the restriction lives on the rows rather than the menus.
        </p>
      </div>

      <div className="flex items-center gap-2 text-[11.5px] font-medium text-muted-foreground">
        <UserCog className="h-3.5 w-3.5" />
        Accounts are created through the sign-up flow. This build has no invitation email round-trip.
      </div>
    </div>
  );
}
