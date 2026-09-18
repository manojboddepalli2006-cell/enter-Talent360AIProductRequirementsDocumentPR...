import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { GraduationCap, TrendingDown, Users } from "lucide-react";
import { listSkillGaps } from "@/lib/api/people";
import { PageHeader } from "@/components/common/page-header";
import { KpiTile } from "@/components/common/kpi-tile";
import { ChartCard } from "@/components/common/chart-card";
import { StatusPill } from "@/components/common/status-pill";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/states";
import { cn } from "@/lib/utils";

function gapTone(gap: number): "danger" | "warning" | "success" {
  if (gap >= 20) return "danger";
  if (gap > 0) return "warning";
  return "success";
}

function gapCell(gap: number): string {
  if (gap >= 25) return "bg-destructive-soft text-destructive-soft-foreground";
  if (gap >= 15) return "bg-warning-soft text-warning-soft-foreground";
  if (gap > 0) return "bg-info-soft text-info-soft-foreground";
  return "bg-success-soft text-success-soft-foreground";
}

export default function SkillsPage() {
  const query = useQuery({ queryKey: ["talent360-skill-gaps"], queryFn: listSkillGaps });
  const rows = useMemo(() => query.data ?? [], [query.data]);

  const byRole = useMemo(() => {
    const grouped: Record<string, typeof rows> = {};
    rows.forEach((row) => {
      grouped[row.roleTitle] = grouped[row.roleTitle] ?? [];
      grouped[row.roleTitle].push(row);
    });
    return Object.entries(grouped).map(([roleTitle, entries]) => {
      const sorted = [...entries].sort((a, b) => b.gap - a.gap);
      return {
        roleTitle,
        entries: sorted,
        // Roles have different required skills, so cells are looked up by skill id.
        cells: sorted.reduce<Record<string, (typeof sorted)[number]>>((acc, entry) => {
          acc[entry.skillId] = entry;
          return acc;
        }, {}),
        worstGap: Math.max(...sorted.map((entry) => entry.gap)),
        people: Math.max(...sorted.map((entry) => entry.people)),
      };
    });
  }, [rows]);

  // Union of every benchmarked skill, so the heatmap columns line up across roles.
  const heatmapSkills = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((row) => map.set(row.skillId, row.skillName));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name })).slice(0, 12);
  }, [rows]);

  const worst = rows.filter((row) => row.gap > 0).slice(0, 6);
  const skillsTracked = new Set(rows.map((row) => row.skillId)).size;
  const rolesTracked = byRole.length;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Skill intelligence"
        description="Assessed proficiency against the target profile for each role. A gap is only shown where an assessment exists, so the heatmap never implies a judgement it cannot support."
        statusLabel={query.isFetching ? "Refreshing" : `${rows.length} role-skill pairs`}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile label="Roles with targets" value={String(rolesTracked)} icon={GraduationCap} tone="primary" />
        <KpiTile label="Skills benchmarked" value={String(skillsTracked)} icon={Users} tone="info" />
        <KpiTile
          label="Skills below target"
          value={String(rows.filter((row) => row.gap > 0).length)}
          icon={TrendingDown}
          tone={rows.some((row) => row.gap >= 20) ? "danger" : "warning"}
        />
        <KpiTile
          label="Worst shortfall"
          value={rows.length ? String(Math.max(...rows.map((row) => row.gap))) : "—"}
          icon={TrendingDown}
          tone="accent"
          footnote="Points below target"
        />
      </div>

      {query.isLoading ? <LoadingState label="Aggregating skill data" /> : null}

      {query.error ? (
        <ErrorState
          message={query.error instanceof Error ? query.error.message : "Skill data could not be loaded."}
          onRetry={() => void query.refetch()}
        />
      ) : null}

      {!query.isLoading && !query.error && !rows.length ? (
        <EmptyState
          icon={<GraduationCap className="h-5 w-5" />}
          title="No benchmarks to compare"
          description="A heatmap needs assessed skills and a target profile. Add role skill requirements and employee assessments to populate it."
        />
      ) : null}

      {worst.length ? (
        <ChartCard title="Largest shortfalls across the organisation" subtitle="Ranked by average shortfall">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {worst.map((row) => (
              <div key={`${row.roleTitle}-${row.skillId}`} className="rounded-xl border border-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[12.5px] font-bold text-foreground">{row.skillName}</div>
                    <div className="truncate text-[11px] font-medium text-muted-foreground">{row.roleTitle}</div>
                  </div>
                  <StatusPill tone={gapTone(row.gap)}>−{row.gap}</StatusPill>
                </div>
                <div className="mt-2.5 flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
                  <span>
                    Average {row.averageProficiency} / target {row.requiredLevel}
                  </span>
                  <span>
                    {row.people} {row.people === 1 ? "person" : "people"}
                  </span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      row.gap >= 20 ? "bg-chart-3" : row.gap >= 10 ? "bg-chart-4" : "bg-chart-5",
                    )}
                    style={{ width: `${Math.max(3, Math.min(100, row.averageProficiency))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </ChartCard>
      ) : null}

      {byRole.length ? (
        <ChartCard
          title="Role skill heatmap"
          subtitle="Average assessed proficiency against the required level. Red means far below target."
        >
          <div className="talent-scroll overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-3 pr-4 text-left talent-label">Role</th>
                  {heatmapSkills.map((skill) => (
                    <th key={skill.id} className="px-2 py-3 text-center talent-label">
                      {skill.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {byRole.map((role) => (
                  <tr key={role.roleTitle} className="border-b border-border last:border-0">
                    <td className="py-3 pr-4">
                      <div className="text-[12.5px] font-bold text-foreground">{role.roleTitle}</div>
                      <div className="text-[11px] font-medium text-muted-foreground">
                        {role.people} {role.people === 1 ? "person" : "people"}
                      </div>
                    </td>
                    {heatmapSkills.map((skill) => {
                      const entry = role.cells[skill.id];
                      return (
                        <td key={skill.id} className="px-2 py-3 text-center">
                          {entry ? (
                            <span
                              className={cn(
                                "inline-flex min-w-[54px] justify-center rounded-lg px-2 py-1.5 text-[11.5px] font-bold",
                                gapCell(entry.gap),
                              )}
                              title={`Average ${entry.averageProficiency} against a target of ${entry.requiredLevel}`}
                            >
                              {entry.averageProficiency}
                              <span className="ml-1 opacity-70">/ {entry.requiredLevel}</span>
                            </span>
                          ) : (
                            <span className="text-[11.5px] font-medium text-muted-foreground">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      ) : null}
    </div>
  );
}
