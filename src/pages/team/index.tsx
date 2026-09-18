import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShieldAlert, UsersRound } from "lucide-react";
import { listEmployees } from "@/lib/api/people";
import { PageHeader } from "@/components/common/page-header";
import { KpiTile } from "@/components/common/kpi-tile";
import { ErrorState, LoadingState } from "@/components/common/states";
import { EmployeeTable } from "@/pages/employees/employee-table";
import { StatusPill } from "@/components/common/status-pill";
import { useProfile } from "@/hooks/use-profile";
import { average } from "@/lib/format";

export default function TeamPage() {
  const { profile, employee } = useProfile();
  const query = useQuery({ queryKey: ["talent360-team"], queryFn: listEmployees });

  const reports = useMemo(() => query.data ?? [], [query.data]);

  const stats = useMemo(() => {
    const engagement = average(
      reports.map((report) => (report.engagement_score === null ? null : report.engagement_score)),
    );
    return {
      headcount: reports.length,
      highRisk: reports.filter((report) => report.latestRisk === "high").length,
      mediumRisk: reports.filter((report) => report.latestRisk === "medium").length,
      notAssessed: reports.filter((report) => report.latestRisk === null).length,
      avgEngagement: engagement === null ? null : Math.round(engagement),
    };
  }, [reports]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="My team"
        description="Performance, engagement, skill profile and risk signals for your direct reports. Nothing outside your reporting line is readable from here."
        statusLabel={profile?.title ? `${profile.title}` : "Direct reports"}
        actions={<StatusPill tone="primary">Scope: direct reports</StatusPill>}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile label="Direct reports" value={String(stats.headcount)} icon={UsersRound} tone="primary" />
        <KpiTile
          label="High risk"
          value={String(stats.highRisk)}
          icon={ShieldAlert}
          tone="danger"
          footnote="Needs a conversation"
        />
        <KpiTile label="Medium risk" value={String(stats.mediumRisk)} icon={ShieldAlert} tone="warning" />
        <KpiTile
          label="Average engagement"
          value={stats.avgEngagement === null ? "—" : String(stats.avgEngagement)}
          icon={UsersRound}
          tone="success"
          footnote={`${stats.notAssessed} not yet assessed`}
        />
      </div>

      {employee ? null : (
        <p className="text-[11.5px] font-medium text-muted-foreground">
          Your profile is not linked to an employee record, so no team can be resolved for you yet.
        </p>
      )}

      {query.isLoading ? <LoadingState label="Reading your team" /> : null}

      {query.error ? (
        <ErrorState
          message={query.error instanceof Error ? query.error.message : "Your team could not be loaded."}
          onRetry={() => void query.refetch()}
        />
      ) : null}

      {!query.isLoading && !query.error ? (
        <EmployeeTable
          employees={reports}
          emptyTitle="No direct reports"
          emptyDescription="No employee record lists you as their manager in this workspace yet."
        />
      ) : null}
    </div>
  );
}
