import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  BrainCircuit,
  Briefcase,
  ClipboardList,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  UserRound,
  Users,
} from "lucide-react";
import { fetchCommandCenter } from "@/lib/api/command-center";
import { PageHeader } from "@/components/common/page-header";
import { KpiTile } from "@/components/common/kpi-tile";
import { ChartCard } from "@/components/common/chart-card";
import { Button } from "@/components/ui/button";
import { ErrorState, LoadingState, EmptyState, SkeletonCard } from "@/components/common/states";
import { DonutChart } from "@/components/dashboard/charts/donut";
import { BarSeries } from "@/components/dashboard/charts/bars";
import { GaugeChart } from "@/components/dashboard/charts/gauge";
import { CategoryPie } from "@/components/dashboard/charts/pie";
import { SparklineChart } from "@/components/dashboard/charts/sparkline";
import { RadialDial } from "@/components/dashboard/charts/radial";
import { AreaTrend } from "@/components/dashboard/charts/area";
import { ProgressList } from "@/components/dashboard/charts/progress-list";
import { SeedWorkspaceButton } from "@/pages/command-center/seed-workspace-button";
import { formatCompact } from "@/lib/format";

export default function CommandCenterPage() {
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["talent360-command-center"],
    queryFn: fetchCommandCenter,
  });

  const handleRefresh = async () => {
    await query.refetch();
    setRefreshedAt(new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }));
  };

  if (query.isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Workforce Command Center" statusLabel="Live Overview" />
        <LoadingState label="Reading workforce signals" />
      </div>
    );
  }

  if (query.error) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Workforce Command Center" statusLabel="Live Overview" />
        <ErrorState
          message={query.error instanceof Error ? query.error.message : "The dashboard could not be loaded."}
          onRetry={() => void query.refetch()}
        />
      </div>
    );
  }

  const data = query.data;
  if (!data) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Workforce Command Center" statusLabel="Live Overview" />
        <SkeletonCard className="h-40" />
      </div>
    );
  }

  const activeCount = data.statusSplit.find((slice) => slice.key === "active")?.value ?? 0;
  const activePercent = data.kpis.headcount ? (activeCount / data.kpis.headcount) * 100 : 0;

  const onboardingBars = data.onboardingByStatus.map((slice) => ({
    label: slice.name,
    value: slice.value,
  }));

  const isWorkspaceEmpty = data.kpis.headcount === 0 && data.kpis.openRoles === 0;

  if (isWorkspaceEmpty) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Workforce Command Center"
          description="This workspace has no people or requisitions yet, so nothing is charted. Empty states are shown instead of zero-filled charts."
        />
        <EmptyState
          icon={<Sparkles className="h-5 w-5" />}
          title="No workforce data yet"
          description="Seed a demo organisation to explore every module with realistic data, or add your own people from the Employees module."
          action={<SeedWorkspaceButton />}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Workforce Command Center"
        statusLabel={refreshedAt ? `Updated ${refreshedAt}` : "Live Overview"}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => void handleRefresh()}>
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
          </>
        }
      />

      {/* KPI strip */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        <KpiTile
          label="Headcount"
          value={String(data.kpis.headcount)}
          icon={Users}
          tone="primary"
          footnote={`${activeCount} active`}
        />
        <KpiTile
          label="Open roles"
          value={String(data.kpis.openRoles)}
          icon={Briefcase}
          tone="info"
          footnote="Requisitions live"
        />
        <KpiTile
          label="In pipeline"
          value={String(data.kpis.candidatesInPipeline)}
          icon={UserRound}
          tone="accent"
          footnote="Active applications"
        />
        <KpiTile
          label="Awaiting review"
          value={String(data.kpis.pendingRecommendations)}
          icon={BrainCircuit}
          tone="warning"
          footnote="AI recommendations"
        />
        <KpiTile
          label="High risk flags"
          value={String(data.kpis.highRisk)}
          icon={ShieldAlert}
          tone="danger"
          footnote="Latest assessment"
        />
        <KpiTile
          label="Open tasks"
          value={String(data.kpis.openTasks)}
          icon={ClipboardList}
          tone="success"
          footnote={`Avg engagement ${data.kpis.avgEngagement}`}
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-extrabold tracking-tight text-foreground">
          Workforce intelligence analytics
        </h2>
        <span className="hidden text-[11.5px] font-semibold text-muted-foreground sm:block">
          {data.aiSpend.runs} AI runs · {formatCompact(data.aiSpend.tokens)} tokens · $
          {data.aiSpend.cost.toFixed(2)} estimated
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ChartCard title="Team composition" subtitle="Workspace accounts by role">
          <DonutChart
            data={data.roleDistribution}
            centerValue={String(data.roleDistribution.reduce((sum, slice) => sum + slice.value, 0))}
            centerLabel="Accounts"
          />
        </ChartCard>

        <ChartCard title="Onboarding steps" subtitle="Progress across assigned steps">
          <BarSeries data={onboardingBars} highlightIndex={0} />
        </ChartCard>

        <ChartCard title="Workforce status" subtitle="Active versus inactive records">
          <GaugeChart percent={activePercent} caption="Active" remainderLabel="Inactive" />
        </ChartCard>

        <ChartCard title="Pipeline by source" subtitle="Where applications originate">
          <CategoryPie data={data.pipelineBySource} />
        </ChartCard>

        <ChartCard
          title="Applications"
          subtitle={`Raised per week, trailing ${data.applicationTrend.length} weeks`}
        >
          <SparklineChart id="applications" data={data.applicationTrend} height={150} />
        </ChartCard>

        <ChartCard title="Evaluation coverage" subtitle="Completed interviews that carry a score">
          <RadialDial
            percent={data.evaluationProgress.percent}
            caption="Scored"
            subcaption={`${data.evaluationProgress.evaluated} of ${data.evaluationProgress.total}`}
          />
        </ChartCard>

        <ChartCard title="Workforce risk" subtitle="Employees flagged above low risk, by month">
          <AreaTrend
            id="risk"
            data={data.riskTrend}
            color="hsl(var(--chart-3))"
            axisLabel="Elevated risk"
          />
        </ChartCard>

        <ChartCard title="Headcount by department" subtitle="Distribution across the organisation">
          <ProgressList data={data.departmentLoad} suffix="people" />
        </ChartCard>
      </div>
    </div>
  );
}
