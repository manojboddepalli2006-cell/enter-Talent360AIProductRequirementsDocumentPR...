import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BrainCircuit, ClipboardList, Gauge, ShieldAlert, Target, UsersRound } from "lucide-react";
import { listEmployees, listRiskAssessments } from "@/lib/api/people";
import { listRecommendations } from "@/lib/api/actions";
import { PageHeader } from "@/components/common/page-header";
import { KpiTile } from "@/components/common/kpi-tile";
import { ChartCard } from "@/components/common/chart-card";
import { StatusPill } from "@/components/common/status-pill";
import { UserCell } from "@/components/common/user-cell";
import { ErrorState, LoadingState, EmptyState } from "@/components/common/states";
import { LiveAiOrb } from "@/components/brand/live-ai-orb";
import { ProgressList } from "@/components/dashboard/charts/progress-list";
import { average } from "@/lib/format";
import { useProfile } from "@/hooks/use-profile";

export default function ManagerIntelligencePage() {
  const { profile } = useProfile();

  const reportsQuery = useQuery({ queryKey: ["talent360-my-team"], queryFn: listEmployees });
  const riskQuery = useQuery({ queryKey: ["talent360-team-risk"], queryFn: listRiskAssessments });
  const recsQuery = useQuery({
    queryKey: ["talent360-team-recs"],
    queryFn: () => listRecommendations({ status: ["pending"] }),
  });

  const reports = useMemo(() => reportsQuery.data ?? [], [reportsQuery.data]);
  const risks = useMemo(() => riskQuery.data ?? [], [riskQuery.data]);
  const recs = useMemo(() => recsQuery.data ?? [], [recsQuery.data]);

  const loading = reportsQuery.isLoading || riskQuery.isLoading || recsQuery.isLoading;
  const error = reportsQuery.error ?? riskQuery.error ?? recsQuery.error;

  const stats = useMemo(() => {
    const engagement = average(reports.map((report) => report.engagement_score ?? null));
    return {
      teamSize: reports.length,
      highRisk: risks.filter((risk) => risk.risk_level === "high").length,
      mediumRisk: risks.filter((risk) => risk.risk_level === "medium").length,
      avgEngagement: engagement === null ? null : Math.round(engagement),
      skillGaps: reports.filter((report) => (report.averageProficiency ?? 100) < 65).length,
      pendingCheckIns: recs.filter((rec) => rec.module === "monitor").length,
    };
  }, [reports, risks, recs]);

  if (loading) return <LoadingState label="Reading your team" />;

  if (error) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : "Team intelligence could not be loaded."}
        onRetry={() => {
          void reportsQuery.refetch();
          void riskQuery.refetch();
          void recsQuery.refetch();
        }}
      />
    );
  }

  const skillRows = reports
    .filter((report) => report.averageProficiency !== null)
    .slice(0, 6)
    .map((report) => ({
      name: report.full_name,
      value: report.averageProficiency ?? 0,
      key: report.id,
    }));

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="My Team Intelligence"
        description={`Direct reports of ${profile?.full_name ?? "you"} — performance, skills, engagement and recommended actions.`}
        statusLabel="Scope: direct reports"
        actions={<StatusPill tone="primary">Team-scoped by policy</StatusPill>}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <KpiTile label="Team size" value={String(stats.teamSize)} icon={UsersRound} tone="primary" />
        <KpiTile label="Open check-ins" value={String(stats.pendingCheckIns)} icon={ClipboardList} tone="info" />
        <KpiTile label="Skill gaps" value={String(stats.skillGaps)} icon={Target} tone="warning" />
        <KpiTile
          label="Engagement"
          value={stats.avgEngagement === null ? "—" : String(stats.avgEngagement)}
          icon={Gauge}
          tone="success"
        />
        <KpiTile label="High risk" value={String(stats.highRisk)} icon={ShieldAlert} tone="danger" />
        <KpiTile label="AI recommendations" value={String(recs.length)} icon={BrainCircuit} tone="accent" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ChartCard title="Team health" subtitle="Performance, engagement and skill alignment" className="xl:col-span-2">
          <div className="relative">
            <LiveAiOrb
              state={recs.length ? "recommendation" : "operational"}
              size={170}
              intensity={0.2}
              className="absolute -right-4 -top-8 hidden lg:block"
            />
            <ul className="relative flex flex-col gap-3">
              {[
                {
                  label: "Engagement",
                  score: stats.avgEngagement ?? 0,
                  note: `${reports.length} reports with a pulse signal`,
                },
                {
                  label: "Skill alignment",
                  score: Math.max(0, 100 - stats.skillGaps * 12),
                  note: `${stats.skillGaps} people below the target profile`,
                },
                {
                  label: "Risk pressure",
                  score: Math.max(0, 100 - (stats.highRisk * 20 + stats.mediumRisk * 8)),
                  note: `${stats.highRisk} high · ${stats.mediumRisk} medium flags`,
                },
              ].map((row) => (
                <li key={row.label} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12.5px] font-bold text-foreground">{row.label}</span>
                    <span className="text-[12px] font-extrabold text-foreground">{row.score}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-gradient-ai"
                      style={{ width: `${Math.max(4, Math.min(100, row.score))}%` }}
                    />
                  </div>
                  <span className="text-[10.5px] font-medium text-muted-foreground">{row.note}</span>
                </li>
              ))}
            </ul>
          </div>
        </ChartCard>

        <ChartCard title="AI recommendations for my team" subtitle="Awaiting your review">
          {recs.length ? (
            <ul className="flex flex-col gap-2">
              {recs.slice(0, 4).map((rec) => (
                <li key={rec.id} className="rounded-xl border border-border bg-muted/30 px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="talent-ai-text text-[9px] font-extrabold">✦ AI</span>
                    <StatusPill tone="warning">Review required</StatusPill>
                  </div>
                  <div className="mt-1 truncate text-[12.5px] font-bold text-foreground">{rec.title}</div>
                  <div className="truncate text-[10.5px] font-medium text-muted-foreground">
                    {rec.employeeName ?? "Team member"} · confidence{" "}
                    {rec.structured?.confidence == null
                      ? "—"
                      : `${Math.round(rec.structured.confidence * 100)}%`}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[12px] font-medium leading-relaxed text-muted-foreground">
              No recommendations are waiting. Run a signal scan from the Action Center when you want a fresh read.
            </p>
          )}
          <Link
            to="/app/action-center"
            className="mt-3 flex h-9 items-center justify-center rounded-xl bg-gradient-ai px-4 text-[12px] font-bold text-primary-foreground"
          >
            Open the review queue
          </Link>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard title="My reports" subtitle="Direct reports only">
          {reports.length ? (
            <ul className="flex flex-col divide-y divide-border">
              {reports.map((report) => (
                <li key={report.id} className="flex items-center justify-between gap-3 py-2.5">
                  <UserCell name={report.full_name} subtext={`${report.role_title} · ${report.departmentName ?? "—"}`} />
                  <div className="flex items-center gap-2">
                    {report.latestRisk ? (
                      <StatusPill
                        tone={report.latestRisk === "high" ? "danger" : report.latestRisk === "medium" ? "warning" : "success"}
                      >
                        {report.latestRisk} risk
                      </StatusPill>
                    ) : null}
                    <Link
                      to={`/app/employees/${report.id}`}
                      className="rounded-lg bg-muted px-2.5 py-1.5 text-[11px] font-bold text-foreground transition-colors hover:bg-muted/70"
                    >
                      Open 360
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="No direct reports"
              description="No employee record lists you as their manager in this workspace yet."
            />
          )}
        </ChartCard>

        <ChartCard title="Skill profile of my team" subtitle="Average assessed proficiency">
          {skillRows.length ? (
            <ProgressList data={skillRows} suffix="" />
          ) : (
            <p className="text-[12px] font-medium text-muted-foreground">No skill assessments recorded yet.</p>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
