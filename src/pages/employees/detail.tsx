import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  ClipboardList,
  Gauge,
  Loader2,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchEmployee360 } from "@/lib/api/people";
import { PageHeader } from "@/components/common/page-header";
import { KpiTile } from "@/components/common/kpi-tile";
import { ChartCard } from "@/components/common/chart-card";
import { StatusPill } from "@/components/common/status-pill";
import { ReasoningPanel } from "@/components/common/reasoning-panel";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/states";
import { SkillRadar } from "@/pages/employees/skill-radar";
import { BarSeries } from "@/components/dashboard/charts/bars";
import { AreaTrend } from "@/components/dashboard/charts/area";
import { RISK_LABELS, RISK_TONE, MODULE_LABELS, STATUS_TONE, RECOMMENDATION_STATUS_LABELS } from "@/lib/domain";
import { formatDate, formatNumber, formatRelative } from "@/lib/format";
import { parseStructuredAiResult } from "@/lib/ai-parse";
import { usePermissions } from "@/hooks/use-permissions";
import { cn } from "@/lib/utils";

export default function EmployeeDetailPage() {
  const { employeeId = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { can, isHr } = usePermissions();
  const [busyStep, setBusyStep] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["talent360-employee", employeeId],
    queryFn: () => fetchEmployee360(employeeId),
    enabled: Boolean(employeeId),
  });

  const devPlanMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("talent-ai-development", {
        body: { employeeId },
        headers: { "Content-Type": "application/json" },
      });
      if (error) throw new Error(error.message);
      const result = data as { ok?: boolean; error?: string; message?: string; courses?: number } | null;
      if (result?.error || result?.ok === false) throw new Error(result.error ?? "The plan failed.");
      return result;
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["talent360-employee", employeeId] });
      await queryClient.invalidateQueries({ queryKey: ["talent360-recommendations"] });
      toast.success("Development plan generated", {
        description: result?.message ?? `${result?.courses ?? 0} learning item(s) proposed for review.`,
      });
    },
    onError: (error) => {
      toast.error("Plan not generated", {
        description: error instanceof Error ? error.message : "The plan could not be generated.",
      });
    },
  });

  const toggleStep = async (stepId: string, complete: boolean) => {
    setBusyStep(stepId);
    const { error } = await supabase
      .from("talent_onboarding_progress")
      .update({
        status: complete ? "completed" : "in_progress",
        completed_at: complete ? new Date().toISOString() : null,
      })
      .eq("id", stepId);

    if (error) {
      toast.error("Step not updated", { description: error.message });
      setBusyStep(null);
      return;
    }

    await queryClient.invalidateQueries({ queryKey: ["talent360-employee", employeeId] });
    setBusyStep(null);
  };

  const data = query.data;

  const radarData = useMemo(() => {
    if (!data) return [];
    return data.skills
      .filter((skill) => skill.requiredLevel !== null)
      .slice(0, 7)
      .map((skill) => ({
        label: skill.skillName,
        proficiency: skill.proficiency,
        target: skill.requiredLevel ?? 0,
      }));
  }, [data]);

  if (query.isLoading) return <LoadingState label="Building the employee record" />;

  if (query.error) {
    return (
      <ErrorState
        message={query.error instanceof Error ? query.error.message : "This record could not be loaded."}
        onRetry={() => void query.refetch()}
      />
    );
  }

  if (!data) {
    return (
      <ErrorState
        title="Record not available"
        message="This person is outside your scope, or the record no longer exists."
      />
    );
  }

  const { employee, skills, performance, engagement, risk, onboarding, learning, recommendations } = data;

  const performanceBars = performance.map((review) => ({
    label: review.period.replace(" ", "\u00a0"),
    value: Number(review.score ?? 0),
  }));

  const engagementTrend = engagement.map((signal) => ({
    label: formatDate(signal.recorded_at).slice(3),
    value: Math.round(signal.value),
  }));

  const gaps = skills.filter((skill) => (skill.gap ?? 0) > 0).slice(0, 6);
  const onboardingComplete = onboarding.filter((step) => step.status === "completed").length;
  const onboardingPercent = onboarding.length
    ? Math.round((onboardingComplete / onboarding.length) * 100)
    : 0;

  const averageGap = gaps.length
    ? Math.round(gaps.reduce((sum, skill) => sum + (skill.gap ?? 0), 0) / gaps.length)
    : 0;

  const canSeeRisk = isHr || can("view_risk_team");

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </Button>
      </div>

      <PageHeader
        title={employee.full_name}
        description={`${employee.role_title}${data.departmentName ? ` · ${data.departmentName}` : ""}${
          data.managerName ? ` · reports to ${data.managerName}` : ""
        }${employee.hire_date ? ` · joined ${formatDate(employee.hire_date)}` : ""}`}
        statusLabel={
          employee.engagement_score === null ? "No pulse data" : `Engagement ${employee.engagement_score}`
        }
        actions={
          <>
            <StatusPill tone="neutral">{employee.seniority ?? "Level not set"}</StatusPill>
            {can("review_actions_org") || can("review_actions_team") ? (
              <Button
                size="sm"
                onClick={() => devPlanMutation.mutate()}
                disabled={devPlanMutation.isPending}
              >
                {devPlanMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                Generate development plan
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile
          label="Engagement"
          value={employee.engagement_score === null ? "—" : String(employee.engagement_score)}
          icon={Gauge}
          tone="primary"
          footnote={`${engagement.length} monthly signals`}
        />
        <KpiTile
          label="Skill gaps"
          value={String(gaps.length)}
          icon={BookOpen}
          tone={gaps.length > 2 ? "warning" : "success"}
          footnote={gaps.length ? `Average shortfall ${averageGap} points` : "Meets the target profile"}
        />
        <KpiTile
          label="Onboarding"
          value={onboarding.length ? `${onboardingPercent}%` : "—"}
          icon={ClipboardList}
          tone={onboardingPercent >= 80 ? "success" : "info"}
          footnote={`${onboardingComplete} of ${onboarding.length} steps done`}
        />
        <KpiTile
          label="Performance"
          value={
            performance.length ? formatNumber(Number(performance[performance.length - 1].score ?? 0), 1) : "—"
          }
          icon={BrainCircuit}
          tone="accent"
          footnote={performance.length ? `Latest: ${performance[performance.length - 1].period}` : "No reviews"}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ChartCard
          title="Skill profile against the target role"
          subtitle={`Assessed versus required for ${employee.role_title}`}
          className="xl:col-span-2"
        >
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <SkillRadar data={radarData} />

            <div className="flex flex-col gap-2.5">
              <span className="talent-label">Largest gaps</span>
              {gaps.length ? (
                gaps.map((skill) => (
                  <div key={skill.skillId} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[12px] font-semibold text-foreground">
                        {skill.skillName}
                      </span>
                      <span className="shrink-0 text-[11.5px] font-bold text-muted-foreground">
                        {skill.proficiency} / {skill.requiredLevel}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          (skill.gap ?? 0) >= 20 ? "bg-chart-3" : (skill.gap ?? 0) >= 10 ? "bg-chart-4" : "bg-chart-5",
                        )}
                        style={{ width: `${Math.max(3, Math.min(100, skill.proficiency))}%` }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-[12px] font-medium leading-relaxed text-muted-foreground">
                  {skills.length
                    ? "No assessed skill sits below the target for this role."
                    : "No skill assessments have been recorded for this person yet."}
                </p>
              )}

              <div className="mt-1 flex flex-wrap gap-1.5">
                {skills.slice(0, 8).map((skill) => (
                  <StatusPill
                    key={skill.skillId}
                    tone={(skill.gap ?? 0) > 10 ? "danger" : (skill.gap ?? 0) > 0 ? "warning" : "success"}
                  >
                    {skill.skillName} {skill.proficiency}
                  </StatusPill>
                ))}
              </div>
            </div>
          </div>
        </ChartCard>

        <ChartCard
          title="Risk signal"
          subtitle={risk ? `Assessed ${formatRelative(risk.assessed_at)}` : "No assessment on record"}
        >
          {!canSeeRisk ? (
            <div className="flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-2.5">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <p className="text-[12px] font-medium leading-relaxed text-muted-foreground">
                Risk assessments are not shared with the employee they describe. They are visible to HR and
                to the person's manager only.
              </p>
            </div>
          ) : risk ? (
            <div className="flex flex-col gap-3">
              <StatusPill tone={RISK_TONE[risk.risk_level] ?? "neutral"}>
                {RISK_LABELS[risk.risk_level] ?? risk.risk_level}
              </StatusPill>
              <ReasoningPanel
                signals={((risk.signals ?? []) as Array<Record<string, unknown>>).map((signal) => ({
                  factor: String(signal.factor ?? "Signal"),
                  direction: String(signal.direction ?? "flat"),
                  weight: signal.weight === undefined ? undefined : String(signal.weight),
                  detail: signal.detail === undefined ? undefined : String(signal.detail),
                }))}
                explanation={risk.explanation}
                confidence={risk.confidence === null ? null : Number(risk.confidence)}
                recommendedActions={[]}
                requiresHumanReview
              />
            </div>
          ) : (
            <p className="text-[12px] font-medium leading-relaxed text-muted-foreground">
              No risk assessment has been run for this person. Run a signal scan from the AI Action Center.
            </p>
          )}
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard title="Performance history" subtitle="Review score by period, out of 5">
          {performanceBars.length ? (
            <BarSeries data={performanceBars} height={190} />
          ) : (
            <EmptyState title="No reviews recorded" description="Performance reviews feed the risk trend." />
          )}
        </ChartCard>

        <ChartCard title="Engagement trend" subtitle="Monthly pulse signal, compared with its own baseline">
          {engagementTrend.length ? (
            <AreaTrend id={`engagement-${employee.id}`} data={engagementTrend} height={190} />
          ) : (
            <EmptyState title="No pulse signals" description="Engagement signals arrive from check-ins and surveys." />
          )}
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard
          title="Development plan"
          subtitle={`${learning.length} proposed learning item${learning.length === 1 ? "" : "s"}`}
        >
          {learning.length ? (
            <ul className="flex flex-col gap-2">
              {learning.map((item) => (
                <li
                  key={item.id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="truncate text-[12.5px] font-bold text-foreground">{item.course_title}</div>
                    <div className="truncate text-[11px] font-medium text-muted-foreground">
                      {item.skillName ?? "General"} · {item.provider ?? "Talent360 Academy"}
                    </div>
                    {item.rationale ? (
                      <p className="mt-1 text-[11px] font-medium leading-snug text-muted-foreground">
                        {item.rationale}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <StatusPill tone={item.priority === "high" ? "danger" : item.priority === "low" ? "neutral" : "warning"}>
                      {item.priority}
                    </StatusPill>
                    <span className="text-[10.5px] font-semibold capitalize text-muted-foreground">
                      {item.status}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-start gap-3">
              <p className="text-[12.5px] font-medium leading-relaxed text-muted-foreground">
                No development plan has been generated. The generator reads the measured gaps and proposes
                specific learning rather than a generic catalogue.
              </p>
              {can("review_actions_org") || can("review_actions_team") ? (
                <Button size="sm" variant="outline" onClick={() => devPlanMutation.mutate()} disabled={devPlanMutation.isPending}>
                  {devPlanMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  Generate plan
                </Button>
              ) : null}
            </div>
          )}
        </ChartCard>

        <ChartCard
          title="Onboarding"
          subtitle={onboarding.length ? `${onboardingPercent}% complete` : "No onboarding plan assigned"}
        >
          {onboarding.length ? (
            <ul className="flex flex-col gap-2">
              {onboarding.map((step) => {
                const done = step.status === "completed";
                return (
                  <li key={step.id} className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => void toggleStep(step.id, !done)}
                      disabled={busyStep === step.id}
                      className="flex min-w-0 flex-1 items-start gap-2.5 text-left"
                    >
                      {busyStep === step.id ? (
                        <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-primary" />
                      ) : (
                        <span
                          className={cn(
                            "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                            done ? "border-success bg-success text-success-foreground" : "border-input bg-card",
                          )}
                        >
                          {done ? <CheckCircle2 className="h-3 w-3" /> : null}
                        </span>
                      )}
                      <span className="min-w-0">
                        <span
                          className={cn(
                            "block text-[12.5px] font-semibold",
                            done ? "text-muted-foreground line-through" : "text-foreground",
                          )}
                        >
                          {step.step_label}
                        </span>
                        <span className="block text-[10.5px] font-medium capitalize text-muted-foreground">
                          {step.step_kind} · due {step.due_date ? formatDate(step.due_date) : "not set"}
                        </span>
                      </span>
                    </button>
                    <StatusPill tone={done ? "success" : step.status === "in_progress" ? "info" : "neutral"}>
                      {done ? "Done" : step.status === "in_progress" ? "In progress" : "Pending"}
                    </StatusPill>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-[12.5px] font-medium leading-relaxed text-muted-foreground">
              No onboarding steps are assigned. Templates live in the Onboarding module.
            </p>
          )}
        </ChartCard>
      </div>

      <ChartCard
        title="AI recommendations for this person"
        subtitle={`${recommendations.length} on record, all human-reviewed`}
      >
        {recommendations.length ? (
          <ul className="flex flex-col gap-2">
            {recommendations.map((recommendation) => {
              const structured = parseStructuredAiResult(JSON.stringify(recommendation.recommendation));
              return (
                <li
                  key={recommendation.id}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill tone="neutral">{MODULE_LABELS[recommendation.module] ?? recommendation.module}</StatusPill>
                      <StatusPill tone={STATUS_TONE[recommendation.status] ?? "neutral"}>
                        {RECOMMENDATION_STATUS_LABELS[recommendation.status] ?? recommendation.status}
                      </StatusPill>
                      <span className="text-[11px] font-semibold text-muted-foreground">
                        {formatRelative(recommendation.created_at)}
                      </span>
                    </div>
                    <div className="mt-1.5 text-[12.5px] font-bold text-foreground">{recommendation.title}</div>
                    {structured?.explanation ? (
                      <p className="mt-0.5 text-[11.5px] font-medium leading-snug text-muted-foreground">
                        {structured.explanation}
                      </p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-[12.5px] font-medium leading-relaxed text-muted-foreground">
            Nothing has been raised for this person yet. Recommendations are created by the risk scan or the
            development generator, and always land in the Action Center for review.
          </p>
        )}

        <Button variant="outline" size="sm" className="mt-3" asChild>
          <Link to="/app/action-center">Open the AI Action Center</Link>
        </Button>
      </ChartCard>
    </div>
  );
}
