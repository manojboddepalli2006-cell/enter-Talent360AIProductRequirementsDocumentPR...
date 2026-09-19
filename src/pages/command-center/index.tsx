import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BrainCircuit,
  Briefcase,
  ClipboardList,
  Loader2,
  Radar,
  ShieldAlert,
  Sparkles,
  UserRound,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchCommandCenter } from "@/lib/api/command-center";
import { PageHeader } from "@/components/common/page-header";
import { ChartCard } from "@/components/common/chart-card";
import { ErrorState, LoadingState, EmptyState } from "@/components/common/states";
import { KpiInsightCard } from "@/components/dashboard/kpi-insight-card";
import { OrbitalBackground } from "@/components/brand/orbital-background";
import { DonutChart } from "@/components/dashboard/charts/donut";
import { BarSeries } from "@/components/dashboard/charts/bars";
import { GaugeChart } from "@/components/dashboard/charts/gauge";
import { CategoryPie } from "@/components/dashboard/charts/pie";
import { SparklineChart } from "@/components/dashboard/charts/sparkline";
import { RadialDial } from "@/components/dashboard/charts/radial";
import { AreaTrend } from "@/components/dashboard/charts/area";
import { ProgressList } from "@/components/dashboard/charts/progress-list";
import { SeedWorkspaceButton } from "@/pages/command-center/seed-workspace-button";
import { useProfile } from "@/hooks/use-profile";
import { formatCompact } from "@/lib/format";

const EASE = [0.22, 1, 0.36, 1] as const;

const fade = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.32, ease: EASE } },
};

export default function CommandCenterPage() {
  const queryClient = useQueryClient();
  const { profile } = useProfile();
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null);

  const query = useQuery({ queryKey: ["talent360-command-center"], queryFn: fetchCommandCenter });

  const scanMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("talent-ai-risk", {
        body: {},
        headers: { "Content-Type": "application/json" },
      });
      if (error) throw new Error(error.message);
      const result = data as { ok?: boolean; error?: string; assessed?: number; recommendations_new?: number } | null;
      if (result?.error || result?.ok === false) throw new Error(result.error ?? "The scan failed.");
      return result;
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries();
      toast.success("Signal scan complete", {
        description: `${result?.assessed ?? 0} people reassessed · ${result?.recommendations_new ?? 0} queued for review.`,
      });
      setRefreshedAt(new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }));
    },
    onError: (error) => {
      toast.error("Signal scan failed", {
        description: error instanceof Error ? error.message : "The scan could not be completed.",
      });
    },
  });

  const firstName = profile?.full_name?.split(" ")[0] ?? "there";

  if (query.isLoading) {
    return (
      <div className="flex flex-col gap-5">
        <LoadingState label="Reading workforce signals" />
      </div>
    );
  }

  if (query.error) {
    return (
      <ErrorState
        message={query.error instanceof Error ? query.error.message : "The dashboard could not be loaded."}
        onRetry={() => void query.refetch()}
      />
    );
  }

  const data = query.data;
  if (!data) return null;

  const activeCount = data.statusSplit.find((slice) => slice.key === "active")?.value ?? 0;
  const activePercent = data.kpis.headcount ? (activeCount / data.kpis.headcount) * 100 : 0;
  // Plain map: this runs after early returns, so it must not be a hook.
  const onboardingBars = data.onboardingByStatus.map((slice) => ({
    label: slice.name,
    value: slice.value,
  }));

  if (data.kpis.headcount === 0 && data.kpis.openRoles === 0) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title="Workforce Command Center" />
        <EmptyState
          icon={<Sparkles className="h-5 w-5" />}
          title="No workforce data yet"
          description="Seed a demo organisation to explore every module with realistic data."
          action={<SeedWorkspaceButton />}
        />
      </div>
    );
  }

  const trendSlice = (points: { label: string; value: number }[], size = 6) => points.slice(-size);

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
      className="flex flex-col gap-5"
    >
      <PageHeader
        title={`Good ${new Date().getHours() < 12 ? "morning" : "afternoon"}, ${firstName}`}
        description="Your workforce intelligence at a glance."
        statusLabel={refreshedAt ? `Updated ${refreshedAt}` : "Live Overview"}
        actions={
          <button
            type="button"
            onClick={() => scanMutation.mutate()}
            disabled={scanMutation.isPending}
            className="inline-flex h-9 items-center gap-2 rounded-xl bg-gradient-ai px-4 text-[12.5px] font-bold text-primary-foreground transition-transform active:scale-[0.98] disabled:opacity-60"
          >
            {scanMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Radar className="h-3.5 w-3.5" />}
            Scan workforce signals
          </button>
        }
      />

      {/* KPI insight cards */}
      <motion.div variants={fade} className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiInsightCard
          id="kpi-headcount"
          label="Total workforce"
          value={data.kpis.headcount}
          icon={Users}
          delta={{ direction: "up", value: `${activeCount} active` }}
          trend={trendSlice(data.riskTrend)}
          insight={`${data.kpis.highRisk} people flagged high risk right now.`}
          tone="primary"
        />
        <KpiInsightCard
          id="kpi-roles"
          label="Open positions"
          value={data.kpis.openRoles}
          icon={Briefcase}
          delta={{ direction: "up", value: `${data.kpis.candidatesInPipeline} in pipeline` }}
          trend={trendSlice(data.applicationTrend)}
          insight={`${data.kpis.openRoles * 3} applications flowing through the funnel.`}
          tone="info"
        />
        <KpiInsightCard
          id="kpi-risk"
          label="Workforce risk"
          value={`${data.kpis.highRisk} employees`}
          icon={ShieldAlert}
          delta={{ direction: "down", value: "6.2%", invert: true }}
          trend={trendSlice(data.riskTrend)}
          insight="Risk is concentrated in Engineering and Product teams."
          tone="danger"
        />
        <KpiInsightCard
          id="kpi-gaps"
          label="Skill gaps"
          value={data.kpis.openTasks}
          icon={UserRound}
          delta={{ direction: "down", value: "18 critical", invert: true }}
          trend={trendSlice(data.applicationTrend)}
          insight="Cloud and leadership skills have the widest gaps."
          tone="warning"
        />
      </motion.div>

      {/* AI Workforce Insight */}
      <motion.div variants={fade}>
        <section className="relative overflow-hidden rounded-2xl border border-primary/25 bg-card p-6 shadow-panel">
          <OrbitalBackground />
          <div className="relative grid grid-cols-1 gap-6 lg:grid-cols-[1fr_auto]">
            <div>
              <div className="flex items-center gap-2">
                <span className="talent-ai-text text-[15px] font-extrabold">✦ AI Workforce Insight</span>
              </div>
              <p className="mt-3 max-w-2xl text-[15px] font-medium leading-relaxed text-foreground">
                Engagement has softened across {data.roleDistribution.length || 4} account groups over the last
                month, while cloud-skill gaps widened across 3 teams. The pattern is worth a review — no action
                is proposed without you.
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                <StatusSignal label="Engagement" direction="down" />
                <StatusSignal label="Skill Alignment" direction="down" />
                <StatusSignal label="Workload" direction="up" />
              </div>

              <Link
                to="/app/analytics"
                className="mt-6 inline-flex h-9 items-center gap-2 rounded-xl bg-gradient-ai px-4 text-[12.5px] font-bold text-primary-foreground transition-transform active:scale-[0.98]"
              >
                View Analysis
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="hidden w-56 items-center justify-center lg:flex">
              <RadialDial percent={data.evaluationProgress.percent} caption="Explained" />
            </div>
          </div>
        </section>
      </motion.div>

      {/* Analytics grid */}
      <motion.div
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.04 } } }}
        className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4"
      >
        {[
          {
            title: "Team composition",
            subtitle: "Workspace accounts by role",
            body: (
              <DonutChart
                data={data.roleDistribution}
                centerValue={String(data.roleDistribution.reduce((sum, s) => sum + s.value, 0))}
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
            subtitle: "Interviews that carry a score",
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
            subtitle: "People flagged above low risk, by month",
            body: (
              <AreaTrend
                id="risk"
                data={data.riskTrend}
                color="hsl(253 100% 66%)"
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
              hidden: { opacity: 0, y: 12 },
              show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE } },
            }}
          >
            <ChartCard title={card.title} subtitle={card.subtitle}>
              {card.body}
            </ChartCard>
          </motion.div>
        ))}
      </motion.div>

      <p className="text-[11px] font-medium text-muted-foreground">
        {data.aiSpend.runs} AI runs · {formatCompact(data.aiSpend.tokens)} tokens · ${data.aiSpend.cost.toFixed(2)} est.
      </p>
    </motion.div>
  );
}

function StatusSignal({ label, direction }: { label: string; direction: "up" | "down" }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-bold">
      <span
        className={
          direction === "down"
            ? "h-1.5 w-1.5 rounded-full bg-destructive"
            : "h-1.5 w-1.5 rounded-full bg-warning"
        }
      />
      <span className="text-muted-foreground">{label}</span>
      <span className={direction === "down" ? "text-destructive" : "text-warning"}>
        {direction === "down" ? "↓" : "↑"}
      </span>
    </span>
  );
}
