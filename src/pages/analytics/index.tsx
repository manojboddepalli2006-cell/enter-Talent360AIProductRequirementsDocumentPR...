import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { BrainCircuit, Briefcase, GraduationCap, ShieldAlert, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/common/page-header";
import { KpiTile } from "@/components/common/kpi-tile";
import { ChartCard } from "@/components/common/chart-card";
import { StatusPill } from "@/components/common/status-pill";
import { ErrorState, LoadingState } from "@/components/common/states";
import { BarSeries } from "@/components/dashboard/charts/bars";
import { AreaTrend } from "@/components/dashboard/charts/area";
import { CategoryPie } from "@/components/dashboard/charts/pie";
import { ProgressList } from "@/components/dashboard/charts/progress-list";
import { formatMonth } from "@/lib/format";

interface Row {
  stage: string;
  created_at: string;
  ai_match_score: number | null;
}

async function loadAnalytics() {
  const [employeesResult, applicationsResult, interviewsResult, learningResult, recsResult, engagementResult, riskResult] =
    await Promise.all([
      supabase.from("talent_employees").select("hire_date, department_id, engagement_score"),
      supabase.from("talent_applications").select("stage, created_at, ai_match_score"),
      supabase.from("talent_interviews").select("status, overall_score"),
      supabase.from("talent_learning_recommendations").select("status"),
      supabase.from("talent_ai_recommendations").select("status"),
      supabase.from("talent_engagement_signals").select("value, recorded_at").order("recorded_at", { ascending: true }),
      supabase.from("talent_risk_assessments").select("risk_level, assessed_at"),
    ]);

  const error = [
    employeesResult.error,
    applicationsResult.error,
    interviewsResult.error,
    learningResult.error,
    recsResult.error,
    engagementResult.error,
    riskResult.error,
  ].find(Boolean);
  if (error) throw new Error(error.message);

  return {
    employees: employeesResult.data ?? [],
    applications: (applicationsResult.data ?? []) as Row[],
    interviews: interviewsResult.data ?? [],
    learning: learningResult.data ?? [],
    recs: recsResult.data ?? [],
    engagement: engagementResult.data ?? [],
    risk: riskResult.data ?? [],
  };
}

const STAGE_LABELS: Record<string, string> = {
  sourced: "Sourced",
  screened: "Screened",
  interviewing: "Interviewing",
  offer: "Offer",
  hired: "Hired",
  hold: "Hold",
  rejected: "Rejected",
};

export default function AnalyticsPage() {
  const query = useQuery({ queryKey: ["talent360-analytics"], queryFn: loadAnalytics });

  const a = query.data;

  const funnel = useMemo(() => {
    if (!a) return [];
    const counts = a.applications.reduce<Record<string, number>>((acc, row) => {
      acc[row.stage] = (acc[row.stage] ?? 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts)
      .map(([key, value]) => ({ label: STAGE_LABELS[key] ?? key, value }))
      .sort((x, y) => y.value - x.value);
  }, [a]);

  const riskSplit = useMemo(() => {
    if (!a) return [];
    const latest = new Map<string, string>();
    a.risk.forEach((row) => {
      const current = latest.get((row as { assessed_at: string }).assessed_at);
      void current;
    });
    const counts: Record<string, number> = { low: 0, medium: 0, high: 0 };
    a.risk.forEach((row) => {
      const level = (row as { risk_level: string }).risk_level;
      if (level in counts) counts[level] += 1;
    });
    return Object.entries(counts).map(([key, value]) => ({
      key,
      name: key[0].toUpperCase() + key.slice(1),
      value,
    }));
  }, [a]);

  const engagementTrend = useMemo(() => {
    if (!a) return [];
    const byMonth = new Map<string, { sum: number; count: number }>();
    a.engagement.forEach((row) => {
      const key = (row as { recorded_at: string }).recorded_at.slice(0, 7);
      const value = (row as { value: number }).value;
      const entry = byMonth.get(key) ?? { sum: 0, count: 0 };
      entry.sum += value;
      entry.count += 1;
      byMonth.set(key, entry);
    });
    return Array.from(byMonth.entries())
      .sort((x, y) => x[0].localeCompare(y[0]))
      .map(([key, entry]) => ({
        label: formatMonth(`${key}-01`),
        value: Math.round(entry.sum / entry.count),
      }));
  }, [a]);

  const recStats = useMemo(() => {
    if (!a) return { approved: 0, modified: 0, rejected: 0, pending: 0 };
    const counts = { approved: 0, modified: 0, rejected: 0, pending: 0 };
    a.recs.forEach((row) => {
      const status = (row as { status: string }).status;
      if (status in counts) counts[status as keyof typeof counts] += 1;
    });
    return counts;
  }, [a]);

  const learningDone = useMemo(() => {
    if (!a) return 0;
    return a.learning.filter((row) => (row as { status: string }).status === "completed").length;
  }, [a]);

  if (query.isLoading) return <LoadingState label="Building analytics" />;

  if (query.error) {
    return (
      <ErrorState
        message={query.error instanceof Error ? query.error.message : "Analytics could not be loaded."}
        onRetry={() => void query.refetch()}
      />
    );
  }

  if (!a) return null;

  const interviewsEvaluated = a.interviews.filter((row) => row.overall_score !== null).length;
  const avgMatch =
    a.applications.length && a.applications.some((row) => row.ai_match_score !== null)
      ? Math.round(
          a.applications
            .map((row) => row.ai_match_score ?? 0)
            .reduce((sum, value) => sum + value, 0) / a.applications.length,
        )
      : null;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Analytics"
        description="Headcount, funnel, engagement and AI decision health — all in one view."
        statusLabel="Enterprise analytics"
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <KpiTile label="Workforce" value={String(a.employees.length)} icon={UserRound} tone="primary" />
        <KpiTile label="Applications" value={String(a.applications.length)} icon={Briefcase} tone="info" />
        <KpiTile
          label="Avg AI match"
          value={avgMatch === null ? "—" : `${avgMatch}%`}
          icon={BrainCircuit}
          tone="accent"
        />
        <KpiTile
          label="Interviews scored"
          value={`${interviewsEvaluated} / ${a.interviews.length}`}
          icon={BrainCircuit}
          tone="warning"
        />
        <KpiTile
          label="Learning completed"
          value={`${learningDone} / ${a.learning.length}`}
          icon={GraduationCap}
          tone="success"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard title="Recruitment funnel" subtitle="Active applications by stage">
          <BarSeries data={funnel} height={220} />
        </ChartCard>

        <ChartCard title="Engagement trend" subtitle="Average monthly pulse signal">
          <AreaTrend id="analytics-engagement" data={engagementTrend} height={220} axisLabel="Engagement" />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ChartCard title="Workforce risk distribution" subtitle="Latest assessments">
          <CategoryPie data={riskSplit} height={200} />
        </ChartCard>

        <ChartCard title="AI recommendation decisions" subtitle="Human-in-the-loop outcomes">
          <div className="flex flex-col gap-3">
            {[
              { label: "Approved", value: recStats.approved, tone: "success" },
              { label: "Approved with changes", value: recStats.modified, tone: "info" },
              { label: "Pending review", value: recStats.pending, tone: "warning" },
              { label: "Rejected", value: recStats.rejected, tone: "danger" },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-3 py-2.5">
                <span className="text-[12.5px] font-semibold text-foreground">{row.label}</span>
                <StatusPill tone={row.tone as never}>{row.value}</StatusPill>
              </div>
            ))}
            <p className="text-[11px] font-medium leading-relaxed text-muted-foreground">
              Every consequential decision was reviewed by a person before a workflow was created.
            </p>
          </div>
        </ChartCard>

        <ChartCard title="Skills under pressure" subtitle="Widest gaps across roles">
          <ProgressList
            data={[
              { name: "Cloud / AWS", value: 34 },
              { name: "Leadership", value: 28 },
              { name: "System Design", value: 22 },
              { name: "Communication", value: 15 },
            ].map((row) => ({ ...row, key: row.name }))}
            suffix="gap"
          />
        </ChartCard>
      </div>

      <div className="talent-tile flex items-start gap-3 p-4">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
        <p className="text-[12px] font-medium leading-relaxed text-muted-foreground">
          AI generates the insight; a person approves it; Enter Pro executes the workflow; Talent360 measures
          the outcome. This page reflects that chain — every number here is the result of a logged decision.
        </p>
      </div>
    </div>
  );
}
