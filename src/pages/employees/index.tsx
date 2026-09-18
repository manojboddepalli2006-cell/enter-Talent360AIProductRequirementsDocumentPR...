import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Users, UsersRound } from "lucide-react";
import { listEmployees } from "@/lib/api/people";
import { PageHeader } from "@/components/common/page-header";
import { KpiTile } from "@/components/common/kpi-tile";
import { ErrorState, LoadingState } from "@/components/common/states";
import { EmployeeTable } from "@/pages/employees/employee-table";
import { StatusPill } from "@/components/common/status-pill";
import { average, formatNumber } from "@/lib/format";

export default function EmployeesPage() {
  const query = useQuery({ queryKey: ["talent360-employees"], queryFn: listEmployees });

  const employees = useMemo(() => query.data ?? [], [query.data]);

  const stats = useMemo(() => {
    const engagement = average(
      employees.map((employee) => (employee.engagement_score === null ? null : employee.engagement_score)),
    );
    const proficiency = average(
      employees.map((employee) => (employee.averageProficiency === null ? null : employee.averageProficiency)),
    );
    return {
      headcount: employees.length,
      managers: employees.filter((employee) => employees.some((other) => other.manager_id === employee.id)).length,
      atRisk: employees.filter((employee) => employee.latestRisk === "high").length,
      avgEngagement: engagement === null ? null : Math.round(engagement),
      avgProficiency: proficiency === null ? null : Math.round(proficiency),
    };
  }, [employees]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Employees"
        description="The unified people record. Engagement, skill profile and the latest risk assessment are read from the same source the other modules use."
        statusLabel={query.isFetching ? "Refreshing" : `${stats.headcount} people`}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile label="Headcount" value={String(stats.headcount)} icon={Users} tone="primary" />
        <KpiTile label="People managers" value={String(stats.managers)} icon={UsersRound} tone="info" />
        <KpiTile
          label="High risk"
          value={String(stats.atRisk)}
          icon={Users}
          tone="danger"
          footnote="Latest assessment"
        />
        <KpiTile
          label="Average engagement"
          value={stats.avgEngagement === null ? "—" : String(stats.avgEngagement)}
          icon={Users}
          tone="success"
          footnote={
            stats.avgProficiency === null
              ? undefined
              : `Avg skill ${formatNumber(stats.avgProficiency)} / 100`
          }
        />
      </div>

      <div className="flex items-center gap-2">
        <StatusPill tone="info">Scope: organisation</StatusPill>
        <span className="text-[11.5px] font-medium text-muted-foreground">
          Managers see only their direct reports on this route; the same query is narrowed by row level security.
        </span>
      </div>

      {query.isLoading ? <LoadingState label="Reading the employee list" /> : null}

      {query.error ? (
        <ErrorState
          message={query.error instanceof Error ? query.error.message : "Employees could not be loaded."}
          onRetry={() => void query.refetch()}
        />
      ) : null}

      {!query.isLoading && !query.error ? <EmployeeTable employees={employees} /> : null}

      {query.isFetching && !query.isLoading ? (
        <span className="flex items-center gap-2 text-[11.5px] font-semibold text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Refreshing
        </span>
      ) : null}
    </div>
  );
}
