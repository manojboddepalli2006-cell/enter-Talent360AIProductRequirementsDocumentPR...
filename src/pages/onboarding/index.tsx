import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, ClipboardList, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/common/page-header";
import { KpiTile } from "@/components/common/kpi-tile";
import { ChartCard } from "@/components/common/chart-card";
import { StatusPill } from "@/components/common/status-pill";
import { ProgressList } from "@/components/dashboard/charts/progress-list";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/states";
import { formatDate } from "@/lib/format";
import { usePermissions } from "@/hooks/use-permissions";
import { useProfile } from "@/hooks/use-profile";
import { cn } from "@/lib/utils";

interface StepRow {
  id: string;
  employee_id: string;
  step_key: string;
  step_label: string;
  step_kind: string;
  status: string;
  due_date: string | null;
  employee: { full_name: string; role_title: string } | null;
}

async function listSteps(): Promise<StepRow[]> {
  const { data, error } = await supabase
    .from("talent_onboarding_progress")
    .select("id, employee_id, step_key, step_label, step_kind, status, due_date, employee:talent_employees(full_name, role_title)")
    .order("due_date", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as StepRow[];
}

export default function OnboardingPage() {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const { employee: myEmployee, org } = useProfile();
  const [busyStep, setBusyStep] = useState<string | null>(null);

  const isOrgScope = can("view_org_overview") || can("manage_onboarding");

  const stepsQuery = useQuery({ queryKey: ["talent360-onboarding-steps"], queryFn: listSteps });
  const templatesQuery = useQuery({
    queryKey: ["talent360-onboarding-templates", org?.id ?? "none"],
    enabled: Boolean(org?.id) && isOrgScope,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("talent_onboarding_templates")
        .select("id, name, role_title, is_active, steps")
        .order("name");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const steps = stepsQuery.data ?? [];
  const mySteps = myEmployee ? steps.filter((step) => step.employee_id === myEmployee.id) : [];
  const scopedSteps = isOrgScope ? steps : mySteps;

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      setBusyStep(id);
      const { error } = await supabase
        .from("talent_onboarding_progress")
        .update({
          status,
          completed_at: status === "completed" ? new Date().toISOString() : null,
        })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["talent360-onboarding-steps"] });
    },
    onError: (error) => {
      toast.error("Step not updated", {
        description: error instanceof Error ? error.message : "The change could not be saved.",
      });
    },
    onSettled: () => setBusyStep(null),
  });

  const stats = useMemo(() => {
    const completed = scopedSteps.filter((step) => step.status === "completed").length;
    const inProgress = scopedSteps.filter((step) => step.status === "in_progress").length;
    const overdue = scopedSteps.filter(
      (step) => step.status !== "completed" && step.due_date && new Date(step.due_date) < new Date(),
    ).length;
    return {
      total: scopedSteps.length,
      completed,
      inProgress,
      overdue,
      percent: scopedSteps.length ? Math.round((completed / scopedSteps.length) * 100) : 0,
    };
  }, [scopedSteps]);

  const byDepartment = useMemo(() => {
    const grouped: Record<string, { total: number; done: number }> = {};
    scopedSteps.forEach((step) => {
      const key = step.employee?.role_title ?? "Unassigned";
      grouped[key] = grouped[key] ?? { total: 0, done: 0 };
      grouped[key].total += 1;
      if (step.status === "completed") grouped[key].done += 1;
    });
    return Object.entries(grouped)
      .map(([name, value]) => ({ name, value: Math.round((value.done / value.total) * 100) }))
      .sort((a, b) => a.value - b.value)
      .slice(0, 6);
  }, [scopedSteps]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={isOrgScope ? "Onboarding" : "My onboarding"}
        description={
          isOrgScope
            ? "Personalised journeys generated from role and department, with templates HR can edit."
            : "The steps generated for your role, with the due dates your manager can see too."
        }
        statusLabel={stepsQuery.isFetching ? "Refreshing" : `${stats.total} steps in scope`}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile label="Completion" value={`${stats.percent}%`} icon={CheckCircle2} tone="success" />
        <KpiTile label="Steps tracked" value={String(stats.total)} icon={ClipboardList} tone="primary" />
        <KpiTile label="In progress" value={String(stats.inProgress)} icon={ClipboardList} tone="info" />
        <KpiTile
          label="Past due"
          value={String(stats.overdue)}
          icon={ClipboardList}
          tone={stats.overdue ? "danger" : "success"}
          footnote={stats.overdue ? "Ramp time at risk" : "Nothing overdue"}
        />
      </div>

      {stepsQuery.isLoading ? <LoadingState label="Reading onboarding progress" /> : null}

      {stepsQuery.error ? (
        <ErrorState
          message={stepsQuery.error instanceof Error ? stepsQuery.error.message : "Onboarding could not be loaded."}
          onRetry={() => void stepsQuery.refetch()}
        />
      ) : null}

      {!stepsQuery.isLoading && !stepsQuery.error && !scopedSteps.length ? (
        <EmptyState
          icon={<ClipboardList className="h-5 w-5" />}
          title="No onboarding plan assigned"
          description={
            isOrgScope
              ? "Create a template per department, then assign it to the people joining that team."
              : "Your manager has not assigned an onboarding journey yet."
          }
        />
      ) : null}

      {!stepsQuery.isLoading && !stepsQuery.error && scopedSteps.length ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <ChartCard
            title={isOrgScope ? "Steps by owner" : "My steps"}
            subtitle={`${stats.completed} complete · ${stats.overdue} past due`}
            className="xl:col-span-2"
          >
            <ul className="flex flex-col gap-2">
              {scopedSteps.slice(0, 40).map((step) => {
                const done = step.status === "completed";
                const overdue = !done && step.due_date && new Date(step.due_date) < new Date();
                return (
                  <li
                    key={step.id}
                    className={cn(
                      "flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2.5",
                      overdue ? "border-destructive/40 bg-destructive-soft/40" : "border-border bg-muted/30",
                    )}
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-2.5">
                      <button
                        type="button"
                        aria-label={done ? "Mark as in progress" : "Mark as complete"}
                        disabled={busyStep === step.id}
                        onClick={() => setStatus.mutate({ id: step.id, status: done ? "in_progress" : "completed" })}
                        className="mt-0.5 shrink-0"
                      >
                        {busyStep === step.id ? (
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        ) : (
                          <span
                            className={cn(
                              "flex h-4 w-4 items-center justify-center rounded border",
                              done ? "border-success bg-success text-success-foreground" : "border-input bg-card",
                            )}
                          >
                            {done ? <CheckCircle2 className="h-3 w-3" /> : null}
                          </span>
                        )}
                      </button>
                      <div className="min-w-0">
                        <div
                          className={cn(
                            "truncate text-[12.5px] font-semibold",
                            done ? "text-muted-foreground line-through" : "text-foreground",
                          )}
                        >
                          {step.step_label}
                        </div>
                        <div className="truncate text-[10.5px] font-medium capitalize text-muted-foreground">
                          {isOrgScope && step.employee?.full_name ? `${step.employee.full_name} · ` : ""}
                          {step.step_kind} · due {step.due_date ? formatDate(step.due_date) : "not set"}
                        </div>
                      </div>
                    </div>
                    <StatusPill
                      tone={done ? "success" : overdue ? "danger" : step.status === "in_progress" ? "info" : "neutral"}
                    >
                      {done ? "Done" : overdue ? "Overdue" : step.status === "in_progress" ? "In progress" : "Pending"}
                    </StatusPill>
                  </li>
                );
              })}
            </ul>
            {scopedSteps.length > 40 ? (
              <p className="mt-2 text-[11px] font-medium text-muted-foreground">
                Showing the 40 earliest due steps of {scopedSteps.length}.
              </p>
            ) : null}
          </ChartCard>

          <div className="flex flex-col gap-4">
            <ChartCard title="Completion by role" subtitle="Share of steps completed">
              <ProgressList data={byDepartment} suffix="%" />
            </ChartCard>

            {templatesQuery.data?.length ? (
              <ChartCard
                title="Templates"
                subtitle={`${templatesQuery.data.length} active template${
                  templatesQuery.data.length === 1 ? "" : "s"
                }`}
              >
                <ul className="flex flex-col gap-2">
                  {templatesQuery.data.map((template) => {
                    const stepCount = Array.isArray(template.steps) ? template.steps.length : 0;
                    return (
                      <li
                        key={template.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-[12.5px] font-bold text-foreground">{template.name}</div>
                          <div className="text-[10.5px] font-medium text-muted-foreground">
                            {stepCount} steps
                          </div>
                        </div>
                        <StatusPill tone={template.is_active ? "success" : "neutral"}>
                          {template.is_active ? "Active" : "Draft"}
                        </StatusPill>
                      </li>
                    );
                  })}
                </ul>
              </ChartCard>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
