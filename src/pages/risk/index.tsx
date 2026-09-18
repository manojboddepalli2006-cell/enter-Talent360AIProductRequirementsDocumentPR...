import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Radar, ShieldAlert, ShieldCheck, ShieldHalf } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { listRiskAssessments } from "@/lib/api/people";
import { PageHeader } from "@/components/common/page-header";
import { KpiTile } from "@/components/common/kpi-tile";
import { ChartCard } from "@/components/common/chart-card";
import { StatusPill } from "@/components/common/status-pill";
import { ReasoningPanel } from "@/components/common/reasoning-panel";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/states";
import { RISK_LABELS, RISK_TONE } from "@/lib/domain";
import { formatRelative } from "@/lib/format";
import { usePermissions } from "@/hooks/use-permissions";

export default function RiskPage() {
  const queryClient = useQueryClient();
  const { can } = usePermissions();

  const query = useQuery({
    queryKey: ["talent360-risk"],
    queryFn: listRiskAssessments,
  });

  const scanMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("talent-ai-risk", {
        body: {},
        headers: { "Content-Type": "application/json" },
      });
      if (error) throw new Error(error.message);
      const result = data as { ok?: boolean; error?: string; assessed?: number } | null;
      if (result?.error || result?.ok === false) throw new Error(result.error ?? "The scan failed.");
      return result;
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["talent360-risk"] });
      await queryClient.invalidateQueries({ queryKey: ["talent360-recommendations"] });
      toast.success("Risk reassessed", { description: `${result?.assessed ?? 0} people assessed.` });
    },
    onError: (error) => {
      toast.error("Scan failed", {
        description: error instanceof Error ? error.message : "The assessment could not be completed.",
      });
    },
  });

  const rows = useMemo(() => query.data ?? [], [query.data]);
  const isOrgScope = can("view_risk_org");

  const grouped = useMemo(
    () => ({
      high: rows.filter((row) => row.risk_level === "high"),
      medium: rows.filter((row) => row.risk_level === "medium"),
      low: rows.filter((row) => row.risk_level === "low"),
    }),
    [rows],
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Workforce risk"
        description="Performance, engagement and skill alignment are read together. A flag always shows which signal moved and by how much, and it never becomes an action without review."
        statusLabel={isOrgScope ? "Scope: organisation" : "Scope: your direct reports"}
        actions={
          can("review_actions_org") ? (
            <Button size="sm" onClick={() => scanMutation.mutate()} disabled={scanMutation.isPending}>
              {scanMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Radar className="h-3.5 w-3.5" />}
              Run risk assessment
            </Button>
          ) : null
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <KpiTile
          label="High risk"
          value={String(grouped.high.length)}
          icon={ShieldAlert}
          tone="danger"
          footnote="Multiple signals softening"
        />
        <KpiTile
          label="Medium risk"
          value={String(grouped.medium.length)}
          icon={ShieldHalf}
          tone="warning"
          footnote="One signal moved"
        />
        <KpiTile
          label="Low risk"
          value={String(grouped.low.length)}
          icon={ShieldCheck}
          tone="success"
          footnote="No intervention indicated"
        />
      </div>

      <div className="talent-tile flex items-start gap-3 p-4 shadow-card">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p className="text-[12px] font-medium leading-relaxed text-muted-foreground">
          Risk assessments are never shown to the employee they describe. They are readable by HR and by the
          person's own manager, and that boundary is enforced in the database rather than by hiding a column
          in the interface.
        </p>
      </div>

      {query.isLoading ? <LoadingState label="Reading risk signals" /> : null}

      {query.error ? (
        <ErrorState
          message={query.error instanceof Error ? query.error.message : "Risk data could not be loaded."}
          onRetry={() => void query.refetch()}
        />
      ) : null}

      {!query.isLoading && !query.error && !rows.length ? (
        <EmptyState
          icon={<Radar className="h-5 w-5" />}
          title="No assessments yet"
          description="Run a risk assessment to read performance, engagement and skill alignment together for the people in your scope."
          action={
            can("review_actions_org") ? (
              <Button size="sm" onClick={() => scanMutation.mutate()} disabled={scanMutation.isPending}>
                {scanMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Radar className="h-3.5 w-3.5" />}
                Run risk assessment
              </Button>
            ) : null
          }
        />
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {[...grouped.high, ...grouped.medium].map((row) => {
          const signals = ((row.signals ?? []) as Array<Record<string, unknown>>).map((signal) => ({
            factor: String(signal.factor ?? "Signal"),
            direction: String(signal.direction ?? "flat"),
            weight: signal.weight === undefined ? undefined : String(signal.weight),
            detail: signal.detail === undefined ? undefined : String(signal.detail),
          }));

          return (
            <ChartCard
              key={row.id}
              title={row.employeeName ?? "Employee"}
              subtitle={`${row.roleTitle ?? "Role not set"}${
                row.departmentName ? ` · ${row.departmentName}` : ""
              } · assessed ${formatRelative(row.assessed_at)}`}
            >
              <div className="flex flex-col gap-3">
                <StatusPill tone={RISK_TONE[row.risk_level] ?? "neutral"}>
                  {RISK_LABELS[row.risk_level] ?? row.risk_level}
                </StatusPill>
                <ReasoningPanel
                  signals={signals}
                  explanation={row.explanation}
                  confidence={row.confidence === null ? null : Number(row.confidence)}
                  recommendedActions={[]}
                  requiresHumanReview
                />
                <Button variant="outline" size="sm" asChild>
                  <Link to={`/app/employees/${row.employee_id}`}>Open the employee record</Link>
                </Button>
              </div>
            </ChartCard>
          );
        })}
      </div>

      {grouped.low.length ? (
        <ChartCard title="Low risk" subtitle="No signal is moving against its own baseline">
          <div className="flex flex-wrap gap-2">
            {grouped.low.map((row) => (
              <Link
                key={row.id}
                to={`/app/employees/${row.employee_id}`}
                className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 transition-colors hover:border-primary/40"
              >
                <StatusPill tone="success">Low</StatusPill>
                <span className="text-[12.5px] font-semibold text-foreground">{row.employeeName}</span>
                <span className="text-[11px] font-medium text-muted-foreground">{row.roleTitle}</span>
              </Link>
            ))}
          </div>
        </ChartCard>
      ) : null}
    </div>
  );
}
