import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { BookOpen, Briefcase, CheckCircle2, ClipboardList, ShieldCheck, UserCircle } from "lucide-react";
import { fetchEmployee360 } from "@/lib/api/people";
import { PageHeader } from "@/components/common/page-header";
import { KpiTile } from "@/components/common/kpi-tile";
import { ChartCard } from "@/components/common/chart-card";
import { StatusPill } from "@/components/common/status-pill";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/states";
import { SkillRadar } from "@/pages/employees/skill-radar";
import { formatDate } from "@/lib/format";
import { useProfile } from "@/hooks/use-profile";
import { ROLE_LABELS } from "@/lib/domain";

export default function MyProfilePage() {
  const { profile, org, employee } = useProfile();

  const query = useQuery({
    queryKey: ["talent360-my-record", employee?.id ?? "none"],
    enabled: Boolean(employee?.id),
    queryFn: () => fetchEmployee360(employee!.id),
  });

  const data = query.data;

  const radarData = (data?.skills ?? [])
    .filter((skill) => skill.requiredLevel !== null)
    .slice(0, 7)
    .map((skill) => ({
      label: skill.skillName,
      proficiency: skill.proficiency,
      target: skill.requiredLevel ?? 0,
    }));

  const gaps = (data?.skills ?? []).filter((skill) => (skill.gap ?? 0) > 0).slice(0, 5);
  const onboardingSteps = data?.onboarding ?? [];
  const completedSteps = onboardingSteps.filter((step) => step.status === "completed").length;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="My profile"
        description="Your skills, development plan and onboarding journey. Your employer sees the same record; risk assessments about you are not shown to you or to your peers."
        statusLabel={org?.name ?? "Workspace"}
        actions={<StatusPill tone="primary">{ROLE_LABELS[profile?.role ?? ""] ?? "Member"}</StatusPill>}
      />

      {!employee ? (
        <EmptyState
          icon={<UserCircle className="h-5 w-5" />}
          title="No employee record linked"
          description="Your account is not linked to an employee record yet, so there is no skills or development data to show. An HR admin can link you."
        />
      ) : null}

      {employee && query.isLoading ? <LoadingState label="Reading your record" /> : null}

      {employee && query.error ? (
        <ErrorState
          message={query.error instanceof Error ? query.error.message : "Your record could not be loaded."}
          onRetry={() => void query.refetch()}
        />
      ) : null}

      {employee && data ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiTile
              label="Skills assessed"
              value={String(data.skills.length)}
              icon={BookOpen}
              tone="primary"
            />
            <KpiTile
              label="Skill gaps"
              value={String(gaps.length)}
              icon={BookOpen}
              tone={gaps.length ? "warning" : "success"}
            />
            <KpiTile
              label="Development items"
              value={String(data.learning.length)}
              icon={Briefcase}
              tone="info"
            />
            <KpiTile
              label="Onboarding"
              value={onboardingSteps.length ? `${Math.round((completedSteps / onboardingSteps.length) * 100)}%` : "—"}
              icon={ClipboardList}
              tone="accent"
              footnote={`${completedSteps} of ${onboardingSteps.length} steps`}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <ChartCard
              title="My skills against the target role"
              subtitle={data.employee.role_title}
              className="xl:col-span-2"
            >
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <SkillRadar data={radarData} />
                <div className="flex flex-col gap-2.5">
                  <span className="talent-label">Where to focus next</span>
                  {gaps.length ? (
                    gaps.map((skill) => (
                      <div key={skill.skillId} className="flex items-center justify-between gap-3">
                        <span className="truncate text-[12.5px] font-semibold text-foreground">
                          {skill.skillName}
                        </span>
                        <span className="shrink-0 text-[11.5px] font-bold text-muted-foreground">
                          {skill.proficiency} / {skill.requiredLevel}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-[12px] font-medium leading-relaxed text-muted-foreground">
                      {data.skills.length
                        ? "Nothing in your assessed profile sits below the target for your role."
                        : "No skills have been assessed for you yet."}
                    </p>
                  )}
                </div>
              </div>
            </ChartCard>

            <ChartCard title="Employee record" subtitle="What your employer sees">
              <dl className="flex flex-col gap-3">
                <div>
                  <dt className="talent-label">Name</dt>
                  <dd className="mt-0.5 text-[12.5px] font-semibold text-foreground">
                    {data.employee.full_name}
                  </dd>
                </div>
                <div>
                  <dt className="talent-label">Role</dt>
                  <dd className="mt-0.5 text-[12.5px] font-semibold text-foreground">
                    {data.employee.role_title}
                  </dd>
                </div>
                <div>
                  <dt className="talent-label">Department</dt>
                  <dd className="mt-0.5 text-[12.5px] font-semibold text-foreground">
                    {data.departmentName ?? "Unassigned"}
                  </dd>
                </div>
                <div>
                  <dt className="talent-label">Manager</dt>
                  <dd className="mt-0.5 text-[12.5px] font-semibold text-foreground">
                    {data.managerName ?? "Not set"}
                  </dd>
                </div>
                <div>
                  <dt className="talent-label">Joined</dt>
                  <dd className="mt-0.5 text-[12.5px] font-semibold text-foreground">
                    {data.employee.hire_date ? formatDate(data.employee.hire_date) : "Not set"}
                  </dd>
                </div>
              </dl>
            </ChartCard>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <ChartCard title="My development plan" subtitle={`${data.learning.length} item(s) proposed`}>
              {data.learning.length ? (
                <ul className="flex flex-col gap-2">
                  {data.learning.map((item) => (
                    <li key={item.id} className="rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusPill tone={item.priority === "high" ? "danger" : item.priority === "low" ? "neutral" : "warning"}>
                          {item.priority}
                        </StatusPill>
                        <span className="text-[10.5px] font-semibold capitalize text-muted-foreground">
                          {item.status}
                        </span>
                      </div>
                      <div className="mt-1.5 text-[12.5px] font-bold text-foreground">{item.course_title}</div>
                      {item.rationale ? (
                        <p className="mt-0.5 text-[11.5px] font-medium leading-snug text-muted-foreground">
                          {item.rationale}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[12.5px] font-medium leading-relaxed text-muted-foreground">
                  No development items have been proposed for you yet. Your manager or HR can generate one from
                  your skill gaps.
                </p>
              )}
            </ChartCard>

            <ChartCard
              title="My onboarding"
              subtitle={
                onboardingSteps.length
                  ? `${completedSteps} of ${onboardingSteps.length} steps complete`
                  : "No journey assigned"
              }
            >
              {onboardingSteps.length ? (
                <ul className="flex flex-col gap-2">
                  {onboardingSteps.map((step) => {
                    const done = step.status === "completed";
                    return (
                      <li key={step.id} className="flex items-center justify-between gap-3">
                        <span className="flex min-w-0 items-center gap-2.5">
                          <span
                            className={
                              done
                                ? "flex h-4 w-4 shrink-0 items-center justify-center rounded border border-success bg-success text-success-foreground"
                                : "flex h-4 w-4 shrink-0 rounded border border-input bg-card"
                            }
                          >
                            {done ? <CheckCircle2 className="h-3 w-3" /> : null}
                          </span>
                          <span className="min-w-0">
                            <span
                              className={
                                done
                                  ? "block truncate text-[12.5px] font-semibold text-muted-foreground line-through"
                                  : "block truncate text-[12.5px] font-semibold text-foreground"
                              }
                            >
                              {step.step_label}
                            </span>
                            <span className="block text-[10.5px] font-medium text-muted-foreground">
                              due {step.due_date ? formatDate(step.due_date) : "not set"}
                            </span>
                          </span>
                        </span>
                        <StatusPill tone={done ? "success" : step.status === "in_progress" ? "info" : "neutral"}>
                          {done ? "Done" : step.status === "in_progress" ? "In progress" : "Pending"}
                        </StatusPill>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-[12.5px] font-medium leading-relaxed text-muted-foreground">
                  No onboarding steps are assigned to you.
                </p>
              )}
              <Button variant="outline" size="sm" className="mt-3" asChild>
                <Link to="/app/tasks">See my tasks</Link>
              </Button>
            </ChartCard>
          </div>

          <div className="talent-tile flex items-start gap-3 p-4 shadow-card">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p className="text-[12px] font-medium leading-relaxed text-muted-foreground">
              Workforce risk signals about you are visible to HR and to your manager only, and are never used
              as the sole basis for a decision. Anything raised about you appears as a recommendation that a
              person has to review first.
            </p>
          </div>
        </>
      ) : null}
    </div>
  );
}
