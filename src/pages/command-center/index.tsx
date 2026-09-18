import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BrainCircuit,
  Briefcase,
  ClipboardList,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  UserRound,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";
import { fetchCommandCenter } from "@/lib/api/command-center";
import { PageHeader } from "@/components/common/page-header";
import { KpiTile } from "@/components/common/kpi-tile";
import { ChartCard } from "@/components/common/chart-card";
import { ErrorState, LoadingState, EmptyState, SkeletonBlock } from "@/components/common/states";
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
        <SkeletonBlock className="h-40" />
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

      {/* Workforce pulse banner */}
      <section className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-brand p-5 shadow-glow md:p-6">
        <span
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/10 blur-3xl"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-black/10 blur-3xl"
        />

        <div className="relative flex flex-wrap items-center justify-between gap-5">
          <div className="min-w-0 max-w-xl">
            <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-white/80">
              <Sparkles className="h-3.5 w-3.5" />
              Workforce pulse
            </div>
            <h2 className="mt-2 text-[20px] font-extrabold leading-tight text-white">
              {data.kpis.pendingRecommendations > 0
                ? `${data.kpis.pendingRecommendations} recommendation${
                    data.kpis.pendingRecommendations === 1 ? "" : "s"
                  } are waiting for a human decision.`
                : "The queue is clear — every recommendation has been decided."}
            </h2>
            <p className="mt-1.5 text-[13px] font-medium leading-relaxed text-white/85">
              {data.kpis.highRisk > 0
                ? `${data.kpis.highRisk} people are flagged high risk and ${data.kpis.openTasks} workflow task${
                    data.kpis.openTasks === 1 ? " is" : "s are"
                  } open. Nothing becomes an action without approval.`
                : `No high-risk flags right now, with ${data.kpis.openTasks} open workflow task${
                    data.kpis.openTasks === 1 ? "" : "s"
                  } tracking outcomes.`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              to="/app/action-center"
              className="inline-flex h-9 items-center gap-2 rounded-xl bg-white px-4 text-[13px] font-bold text-primary shadow-sm transition-transform active:scale-[0.98] hover:-translate-y-0.5"
            >
              Review queue
              <ArrowRight className="h-4 w-4" />
            </Link>
            <button
              type="button"
              onClick={() => void handleRefresh()}
              className="inline-flex h-9 items-center gap-2 rounded-xl bg-white/15 px-4 text-[13px] font-bold text-white ring-1 ring-inset ring-white/30 backdrop-blur transition-colors hover:bg-white/25"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
          </div>
        </div>
      </section>

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-extrabold tracking-tight text-foreground">
          Workforce intelligence analytics
        </h2>
        <span className="hidden text-[11.5px] font-semibold text-muted-foreground sm:block">
          {data.aiSpend.runs} AI runs · {formatCompact(data.aiSpend.tokens)} tokens · $
          {data.aiSpend.cost.toFixed(2)} estimated
        </span>
      </div>

      <motion.div
        initial="hidden"
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
        className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4"
      >
        {[
          {
            title: "Team composition",
            subtitle: "Workspace accounts by role",
            body: (
              <DonutChart
                data={data.roleDistribution}
                centerValue={String(data.roleDistribution.reduce((sum, slice) => sum + slice.value, 0))}
                centerLabel="Accounts"
              />
            ),
          },
          {
            title: "Onboarding steps",
            subtitle: "Progress across assigned steps",
            body: <BarSeries data={onboardingBars} highlightIndex={0} />,
          },
          {
            title: "Workforce status",
            subtitle: "Active versus inactive records",
            body: <GaugeChart percent={activePercent} caption="Active" remainderLabel="Inactive" />,
          },
          {
            title: "Pipeline by source",
            subtitle: "Where applications originate",
            body: <CategoryPie data={data.pipelineBySource} />,
          },
          {
            title: "Applications",
            subtitle: `Raised per week, trailing ${data.applicationTrend.length} weeks`,
            body: <SparklineChart id="applications" data={data.applicationTrend} height={150} showAxis />,
          },
          {
            title: "Evaluation coverage",
            subtitle: "Completed interviews that carry a score",
            body: (
              <RadialDial
                percent={data.evaluationProgress.percent}
                caption="Scored"
                subcaption={`${data.evaluationProgress.evaluated} of ${data.evaluationProgress.total}`}
              />
            ),
          },
          {
            title: "Workforce risk",
            subtitle: "Employees flagged above low risk, by month",
            body: (
              <AreaTrend
                id="risk"
                data={data.riskTrend}
                color="hsl(var(--chart-3))"
                axisLabel="Elevated risk"
              />
            ),
          },
          {
            title: "Headcount by department",
            subtitle: "Distribution across the organisation",
            body: <ProgressList data={data.departmentLoad} suffix="people" />,
          },
        ].map((card) => (
          <motion.div
            key={card.title}
            variants={{
              hidden: { opacity: 0, y: 14 },
              show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
            }}
          >
            <ChartCard title={card.title} subtitle={card.subtitle}>
              {card.body}
            </ChartCard>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
