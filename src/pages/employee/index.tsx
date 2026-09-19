import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { BookOpen, CheckCircle2, ClipboardList, Compass, GraduationCap, Sparkles, Target } from "lucide-react";
import { fetchEmployee360 } from "@/lib/api/people";
import { listMyTasks } from "@/lib/api/actions";
import { PageHeader } from "@/components/common/page-header";
import { KpiTile } from "@/components/common/kpi-tile";
import { ChartCard } from "@/components/common/chart-card";
import { StatusPill } from "@/components/common/status-pill";
import { ErrorState, LoadingState, EmptyState } from "@/components/common/states";
import { LiveAiOrb } from "@/components/brand/live-ai-orb";
import { formatDate, formatNumber } from "@/lib/format";
import { useProfile } from "@/hooks/use-profile";

export default function EmployeeHomePage() {
  const { profile, employee } = useProfile();

  const recordQuery = useQuery({
    queryKey: ["talent360-my-record", employee?.id ?? "none"],
    enabled: Boolean(employee?.id),
    queryFn: () => fetchEmployee360(employee!.id),
  });

  const tasksQuery = useQuery({ queryKey: ["talent360-tasks"], queryFn: listMyTasks });

  const data = recordQuery.data;
  const allTasks = tasksQuery.data ?? [];
  const myTasks = employee ? allTasks.filter((task) => task.assignee_employee_id === employee.id) : [];

  const firstName = profile?.full_name?.split(" ")[0] ?? "there";

  if (recordQuery.isLoading) return <LoadingState label="Opening your growth view" />;

  if (recordQuery.error) {
    return (
      <ErrorState
        message={recordQuery.error instanceof Error ? recordQuery.error.message : "Your record could not be loaded."}
        onRetry={() => void recordQuery.refetch()}
      />
    );
  }

  const skills = data?.skills ?? [];
  const topSkills = skills.slice(0, 5);
  const gaps = skills.filter((skill) => (skill.gap ?? 0) > 0);
  const onboarding = data?.onboarding ?? [];
  const onboardingDone = onboarding.filter((step) => step.status === "completed").length;
  const onboardingPercent = onboarding.length ? Math.round((onboardingDone / onboarding.length) * 100) : 0;
  const openTasks = myTasks.filter((task) => task.status !== "done").length;
  const learning = data?.learning ?? [];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={`Welcome, ${firstName}`}
        description="Your growth journey at Talent360 AI."
        statusLabel="My Growth Intelligence"
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <KpiTile label="My skills" value={String(skills.length)} icon={Sparkles} tone="primary" />
        <KpiTile
          label="Skill gaps"
          value={String(gaps.length)}
          icon={Target}
          tone={gaps.length ? "warning" : "success"}
        />
        <KpiTile label="Learning items" value={String(learning.length)} icon={GraduationCap} tone="info" />
        <KpiTile
          label="Onboarding"
          value={onboarding.length ? `${onboardingPercent}%` : "—"}
          icon={ClipboardList}
          tone="accent"
          footnote={`${onboardingDone} of ${onboarding.length} steps`}
        />
        <KpiTile label="Open tasks" value={String(openTasks)} icon={CheckCircle2} tone="success" />
      </div>

      {!employee ? (
        <EmptyState
          icon={<Compass className="h-5 w-5" />}
          title="No employee record linked"
          description="Your account is not linked to an employee record yet, so there is no skills or development data to show. An HR admin can link you."
        />
      ) : null}

      {data ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {/* Circular skill profile */}
          <ChartCard
            title="My skill profile"
            subtitle={`Assessed against the ${data.employee.role_title} target profile`}
          >
            <div className="relative flex flex-col items-center gap-4">
              <LiveAiOrb state="operational" size={190} intensity={0.22} className="absolute -top-4" />
              <div className="relative flex flex-wrap justify-center gap-3">
                {topSkills.map((skill) => {
                  const percent = Math.max(4, Math.min(100, skill.proficiency));
                  return (
                    <div key={skill.skillId} className="flex w-[86px] flex-col items-center gap-1.5">
                      <div className="relative h-[86px] w-[86px]">
                        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                          <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(222 40% 16%)" strokeWidth="8" />
                          <circle
                            cx="50"
                            cy="50"
                            r="42"
                            fill="none"
                            stroke="url(#skill-ring)"
                            strokeWidth="8"
                            strokeLinecap="round"
                            strokeDasharray={`${(percent / 100) * 264} 264`}
                          />
                          <defs>
                            <linearGradient id="skill-ring" x1="0" y1="100" x2="100" y2="0" gradientUnits="userSpaceOnUse">
                              <stop stopColor="#1677FF" />
                              <stop offset="0.5" stopColor="#00D9FF" />
                              <stop offset="1" stopColor="#9B6CFF" />
                            </linearGradient>
                          </defs>
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-[15px] font-extrabold text-foreground">
                          {percent}%
                        </span>
                      </div>
                      <span className="truncate text-[10.5px] font-semibold text-muted-foreground">{skill.skillName}</span>
                    </div>
                  );
                })}
              </div>
              <Link
                to="/app/skills"
                className="relative flex h-9 items-center justify-center rounded-xl border border-border bg-card px-4 text-[12px] font-semibold text-foreground transition-colors hover:border-primary/40"
              >
                View my full skill profile
              </Link>
            </div>
          </ChartCard>

          {/* Development plan */}
          <ChartCard title="My development plan" subtitle="Recommended learning for my gaps">
            {learning.length ? (
              <ul className="flex flex-col gap-2">
                {learning.slice(0, 4).map((item) => (
                  <li key={item.id} className="rounded-xl border border-border bg-muted/30 px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[12.5px] font-bold text-foreground">{item.course_title}</span>
                      <StatusPill tone={item.priority === "high" ? "danger" : item.priority === "low" ? "neutral" : "warning"}>
                        {item.priority}
                      </StatusPill>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-[11px] font-medium leading-snug text-muted-foreground">
                      {item.rationale ?? `${item.skillName ?? "General"} development`}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[12px] font-medium leading-relaxed text-muted-foreground">
                No development items yet. Your manager or HR can generate a plan from your skill gaps.
              </p>
            )}
            <Link
              to="/app/development"
              className="mt-3 flex h-9 items-center justify-center rounded-xl border border-border bg-card px-4 text-[12px] font-semibold text-foreground transition-colors hover:border-primary/40"
            >
              Open my development plan
            </Link>
          </ChartCard>

          {/* Onboarding + tasks */}
          <div className="flex flex-col gap-4">
            <ChartCard
              title="My onboarding"
              subtitle={onboarding.length ? `${onboardingDone} of ${onboarding.length} complete` : "No journey assigned"}
            >
              {onboarding.length ? (
                <ul className="flex flex-col gap-2">
                  {onboarding.slice(0, 5).map((step) => {
                    const done = step.status === "completed";
                    return (
                      <li key={step.id} className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate text-[12px] font-medium text-foreground">
                          {done ? "✓" : "○"} {step.step_label}
                        </span>
                        <span className="shrink-0 text-[10px] font-semibold text-muted-foreground">
                          {done ? "Done" : step.due_date ? formatDate(step.due_date) : "Pending"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-[12px] font-medium text-muted-foreground">No onboarding steps assigned.</p>
              )}
              <Link
                to="/app/onboarding"
                className="mt-3 flex h-9 items-center justify-center rounded-xl border border-border bg-card px-4 text-[12px] font-semibold text-foreground transition-colors hover:border-primary/40"
              >
                Open onboarding
              </Link>
            </ChartCard>

            <ChartCard title="Upcoming tasks" subtitle={`${openTasks} open`}>
              {myTasks.length ? (
                <ul className="flex flex-col gap-2">
                  {myTasks.slice(0, 4).map((task) => (
                    <li key={task.id} className="flex items-start justify-between gap-2">
                      <span className="min-w-0">
                        <span className="block truncate text-[12px] font-semibold text-foreground">{task.title}</span>
                        <span className="block text-[10.5px] font-medium text-muted-foreground">
                          due {task.due_date ? formatDate(task.due_date) : "not set"}
                        </span>
                      </span>
                      <StatusPill tone={task.status === "done" ? "success" : "info"}>
                        {task.status === "done" ? "Done" : "Open"}
                      </StatusPill>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[12px] font-medium text-muted-foreground">Nothing assigned to you right now.</p>
              )}
              <Link
                to="/app/tasks"
                className="mt-3 flex h-9 items-center justify-center rounded-xl bg-gradient-ai px-4 text-[12px] font-bold text-primary-foreground"
              >
                Open my tasks
              </Link>
            </ChartCard>
          </div>
        </div>
      ) : null}

      <div className="talent-tile flex items-start gap-3 p-4">
        <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p className="text-[12px] font-medium leading-relaxed text-muted-foreground">
          You can see your own skills, development and onboarding. Workforce-risk signals about you stay with HR and
          your manager, and any action proposed about you is reviewed by a person before anything is created.
        </p>
      </div>
    </div>
  );
}
