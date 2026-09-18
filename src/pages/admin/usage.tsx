import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, AlertCircle, Coins, Gauge, Timer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/common/page-header";
import { ChartCard } from "@/components/common/chart-card";
import { KpiTile } from "@/components/common/kpi-tile";
import { StatusPill } from "@/components/common/status-pill";
import { BarSeries } from "@/components/dashboard/charts/bars";
import { AreaTrend } from "@/components/dashboard/charts/area";
import { ErrorState, LoadingState } from "@/components/common/states";
import { formatCompact, formatNumber } from "@/lib/format";
import { useProfile } from "@/hooks/use-profile";

interface UsageRow {
  function_name: string;
  model: string;
  total_tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
  cost_estimate: number;
  latency_ms: number | null;
  status: string;
  created_at: string;
}

async function listUsage(): Promise<UsageRow[]> {
  const { data, error } = await supabase
    .from("talent_ai_usage")
    .select("function_name, model, total_tokens, prompt_tokens, completion_tokens, cost_estimate, latency_ms, status, created_at")
    .order("created_at", { ascending: false })
    .limit(1000);

  if (error) throw new Error(error.message);
  return (data ?? []) as UsageRow[];
}

const FUNCTION_LABEL: Record<string, string> = {
  "talent-ai-resume-match": "Resume match",
  "talent-ai-interview": "Interview agent",
  "talent-ai-risk": "Workforce risk",
  "talent-ai-development": "Development plan",
  "talent-ai-copilot": "Policy Copilot",
};

export default function AdminUsagePage() {
  const { org } = useProfile();
  const query = useQuery({ queryKey: ["talent360-ai-usage"], queryFn: listUsage });
  const rows = useMemo(() => query.data ?? [], [query.data]);

  const totals = useMemo(() => {
    const tokens = rows.reduce((sum, row) => sum + (row.total_tokens ?? 0), 0);
    const cost = rows.reduce((sum, row) => sum + Number(row.cost_estimate ?? 0), 0);
    const latencies = rows
      .map((row) => row.latency_ms)
      .filter((value): value is number => typeof value === "number");
    return {
      calls: rows.length,
      tokens,
      cost,
      avgLatency: latencies.length
        ? Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length)
        : null,
      failures: rows.filter((row) => row.status !== "success").length,
    };
  }, [rows]);

  const byDay = useMemo(() => {
    const grouped: Record<string, { calls: number; tokens: number }> = {};
    rows.forEach((row) => {
      const day = row.created_at.slice(0, 10);
      grouped[day] = grouped[day] ?? { calls: 0, tokens: 0 };
      grouped[day].calls += 1;
      grouped[day].tokens += row.total_tokens ?? 0;
    });

    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14)
      .map(([day, value]) => ({
        label: new Date(day).toLocaleDateString("en-US", { day: "numeric", month: "short" }),
        calls: value.calls,
        tokens: value.tokens,
      }));
  }, [rows]);

  const byFunction = useMemo(() => {
    const grouped: Record<string, { calls: number; tokens: number; cost: number; latency: number; latencyCount: number }> = {};
    rows.forEach((row) => {
      const key = row.function_name;
      grouped[key] = grouped[key] ?? { calls: 0, tokens: 0, cost: 0, latency: 0, latencyCount: 0 };
      grouped[key].calls += 1;
      grouped[key].tokens += row.total_tokens ?? 0;
      grouped[key].cost += Number(row.cost_estimate ?? 0);
      if (typeof row.latency_ms === "number") {
        grouped[key].latency += row.latency_ms;
        grouped[key].latencyCount += 1;
      }
    });

    return Object.entries(grouped)
      .map(([name, value]) => ({
        name,
        ...value,
        avgLatency: value.latencyCount ? Math.round(value.latency / value.latencyCount) : null,
      }))
      .sort((a, b) => b.calls - a.calls);
  }, [rows]);

  const overBudgetDays = useMemo(() => {
    if (!org) return [];
    return byDay.filter((day) => day.calls > org.ai_daily_quota);
  }, [byDay, org]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="AI usage and cost"
        description="Every AI call writes a usage row with the function, model, token counts and a cost estimate, so spend is attributable per capability rather than a single opaque figure."
        statusLabel={query.isFetching ? "Refreshing" : `${totals.calls} calls recorded`}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        <KpiTile label="AI calls" value={String(totals.calls)} icon={Activity} tone="primary" />
        <KpiTile label="Tokens" value={formatCompact(totals.tokens)} icon={Gauge} tone="info" />
        <KpiTile
          label="Estimated cost"
          value={`$${totals.cost.toFixed(2)}`}
          icon={Coins}
          tone="warning"
          footnote="Estimate, not an invoice"
        />
        <KpiTile
          label="Average latency"
          value={totals.avgLatency === null ? "—" : `${totals.avgLatency} ms`}
          icon={Timer}
          tone="success"
        />
        <KpiTile
          label="Failed calls"
          value={String(totals.failures)}
          icon={AlertCircle}
          tone={totals.failures ? "danger" : "success"}
        />
      </div>

      {org ? (
        <div className="talent-tile flex flex-wrap items-center gap-3 p-4 shadow-card">
          <StatusPill tone={overBudgetDays.length ? "warning" : "success"}>
            Daily budget {formatNumber(org.ai_daily_quota)} calls
          </StatusPill>
          <span className="text-[12px] font-medium text-muted-foreground">
            {overBudgetDays.length
              ? `${overBudgetDays.length} day(s) in the last fortnight exceeded the configured budget.`
              : "No day in the recorded window exceeded the configured budget."}
          </span>
          {overBudgetDays.length ? (
            <span className="text-[11.5px] font-semibold text-warning-soft-foreground">
              Highest: {Math.max(...overBudgetDays.map((day) => day.calls))} calls
            </span>
          ) : null}
        </div>
      ) : null}

      {query.isLoading ? <LoadingState label="Reading AI usage" /> : null}

      {query.error ? (
        <ErrorState
          message={query.error instanceof Error ? query.error.message : "Usage data could not be loaded."}
          onRetry={() => void query.refetch()}
        />
      ) : null}

      {!query.isLoading && !query.error && rows.length ? (
        <>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <ChartCard title="Calls per day" subtitle="Trailing fourteen recorded days">
              <BarSeries data={byDay.map((day) => ({ label: day.label, value: day.calls }))} height={200} />
            </ChartCard>

            <ChartCard title="Tokens per day" subtitle="Prompt plus completion tokens">
              <AreaTrend
                id="usage-tokens"
                data={byDay.map((day) => ({ label: day.label, value: day.tokens }))}
                height={200}
                axisLabel="Tokens"
              />
            </ChartCard>
          </div>

          <ChartCard title="Usage by capability" subtitle="Where the spend and latency actually sit">
            <div className="talent-scroll overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-3 pr-4 text-left talent-label">Capability</th>
                    <th className="py-3 pr-4 text-right talent-label">Calls</th>
                    <th className="py-3 pr-4 text-right talent-label">Tokens</th>
                    <th className="py-3 pr-4 text-right talent-label">Avg latency</th>
                    <th className="py-3 text-right talent-label">Est. cost</th>
                  </tr>
                </thead>
                <tbody>
                  {byFunction.map((entry) => (
                    <tr key={entry.name} className="border-b border-border last:border-0">
                      <td className="py-3 pr-4 text-[12.5px] font-bold text-foreground">
                        {FUNCTION_LABEL[entry.name] ?? entry.name}
                      </td>
                      <td className="py-3 pr-4 text-right text-[12.5px] font-semibold text-foreground">
                        {entry.calls}
                      </td>
                      <td className="py-3 pr-4 text-right text-[12.5px] font-semibold text-foreground">
                        {formatCompact(entry.tokens)}
                      </td>
                      <td className="py-3 pr-4 text-right text-[12.5px] font-semibold text-muted-foreground">
                        {entry.avgLatency === null ? "—" : `${entry.avgLatency} ms`}
                      </td>
                      <td className="py-3 text-right text-[12.5px] font-bold text-foreground">
                        ${entry.cost.toFixed(4)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ChartCard>
        </>
      ) : null}

      {!query.isLoading && !query.error && !rows.length ? (
        <ChartCard title="No AI usage recorded" subtitle="Calls appear here as soon as a capability runs">
          <p className="text-[12.5px] font-medium leading-relaxed text-muted-foreground">
            Run a resume match, an interview evaluation, a risk assessment or a copilot question and the usage
            row will be written automatically by the backend function that performed the call.
          </p>
        </ChartCard>
      ) : null}
    </div>
  );
}
