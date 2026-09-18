import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Compass, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/common/page-header";
import { KpiTile } from "@/components/common/kpi-tile";
import { FilterTabs } from "@/components/common/filter-tabs";
import { StatusPill } from "@/components/common/status-pill";
import { UserCell } from "@/components/common/user-cell";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/states";

interface LearningRow {
  id: string;
  course_title: string;
  provider: string | null;
  rationale: string | null;
  priority: string;
  status: string;
  employee_id: string;
  employee: { full_name: string; role_title: string } | null;
  skill: { name: string } | null;
}

async function listLearning(): Promise<LearningRow[]> {
  const { data, error } = await supabase
    .from("talent_learning_recommendations")
    .select("id, course_title, provider, rationale, priority, status, employee_id, employee:talent_employees(full_name, role_title), skill:talent_skills(name)")
    .order("priority")
    .order("course_title");

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as LearningRow[];
}

export default function DevelopmentPage() {
  const [priorityFilter, setPriorityFilter] = useState("all");

  const query = useQuery({ queryKey: ["talent360-learning"], queryFn: listLearning });
  const rows = useMemo(() => query.data ?? [], [query.data]);

  const counts = useMemo(
    () => ({
      all: rows.length,
      high: rows.filter((row) => row.priority === "high").length,
      medium: rows.filter((row) => row.priority === "medium").length,
      low: rows.filter((row) => row.priority === "low").length,
      people: new Set(rows.map((row) => row.employee_id)).size,
    }),
    [rows],
  );

  const visible = rows.filter((row) => (priorityFilter === "all" ? true : row.priority === priorityFilter));

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Development plans"
        description="Learning proposed against a measured skill gap. Each item names the gap it closes, so a plan can be reviewed rather than accepted on faith."
        statusLabel={`${counts.people} people with a plan`}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile label="Plan items" value={String(counts.all)} icon={BookOpen} tone="primary" />
        <KpiTile label="High priority" value={String(counts.high)} icon={Target} tone="danger" />
        <KpiTile label="Medium priority" value={String(counts.medium)} icon={Compass} tone="warning" />
        <KpiTile label="People covered" value={String(counts.people)} icon={BookOpen} tone="success" />
      </div>

      <div className="talent-tile px-4 pb-1 pt-3 shadow-card">
        <FilterTabs
          items={[
            { key: "all", label: "All", count: counts.all },
            { key: "high", label: "High priority", count: counts.high },
            { key: "medium", label: "Medium priority", count: counts.medium },
            { key: "low", label: "Low priority", count: counts.low },
          ]}
          value={priorityFilter}
          onChange={setPriorityFilter}
        />
      </div>

      {query.isLoading ? <LoadingState label="Reading development plans" /> : null}

      {query.error ? (
        <ErrorState
          message={query.error instanceof Error ? query.error.message : "Development plans could not be loaded."}
          onRetry={() => void query.refetch()}
        />
      ) : null}

      {!query.isLoading && !query.error && !visible.length ? (
        <EmptyState
          icon={<BookOpen className="h-5 w-5" />}
          title="No development items in this view"
          description="Open a person's record and generate a development plan to close their measured skill gaps."
        />
      ) : null}

      {!query.isLoading && !query.error && visible.length ? (
        <div className="flex flex-col gap-2">
          {visible.map((row) => (
            <article
              key={row.id}
              className="talent-tile flex flex-wrap items-center justify-between gap-4 p-4 shadow-card"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill
                    tone={row.priority === "high" ? "danger" : row.priority === "medium" ? "warning" : "neutral"}
                  >
                    {row.priority} priority
                  </StatusPill>
                  <StatusPill tone={row.status === "enrolled" ? "info" : row.status === "completed" ? "success" : "neutral"}>
                    {row.status}
                  </StatusPill>
                  {row.skill?.name ? <StatusPill tone="primary">{row.skill.name}</StatusPill> : null}
                </div>
                <h3 className="mt-2 text-[13.5px] font-extrabold text-foreground">{row.course_title}</h3>
                {row.rationale ? (
                  <p className="mt-1 max-w-3xl text-[12px] font-medium leading-relaxed text-muted-foreground">
                    {row.rationale}
                  </p>
                ) : null}
                <div className="mt-1 text-[11px] font-semibold text-muted-foreground">
                  {row.provider ?? "Talent360 Academy"}
                </div>
              </div>

              <div className="flex flex-col items-end gap-2">
                <UserCell name={row.employee?.full_name} subtext={row.employee?.role_title} tone="primary" />
                <Button variant="soft" size="sm" asChild>
                  <Link to={`/app/employees/${row.employee_id}`}>Open record</Link>
                </Button>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}
