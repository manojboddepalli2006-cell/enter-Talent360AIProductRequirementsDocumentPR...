import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, ClipboardList, Loader2 } from "lucide-react";
import { listMyTasks, completeTask } from "@/lib/api/actions";
import { PageHeader } from "@/components/common/page-header";
import { KpiTile } from "@/components/common/kpi-tile";
import { StatusPill } from "@/components/common/status-pill";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/states";
import { formatDate } from "@/lib/format";
import { useProfile } from "@/hooks/use-profile";
import { cn } from "@/lib/utils";

export default function TasksPage() {
  const queryClient = useQueryClient();
  const { employee } = useProfile();

  const query = useQuery({ queryKey: ["talent360-tasks"], queryFn: listMyTasks });

  const completeMutation = useMutation({
    mutationFn: completeTask,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["talent360-tasks"] });
      await queryClient.invalidateQueries({ queryKey: ["talent360-command-center"] });
      toast.success("Task completed");
    },
    onError: (error) => {
      toast.error("Task not updated", {
        description: error instanceof Error ? error.message : "The task could not be updated.",
      });
    },
  });

  const allTasks = useMemo(() => query.data ?? [], [query.data]);

  // The tasks table is org-readable so reviewers can see workflow history; this
  // view shows only the tasks actually assigned to the signed-in person.
  const tasks = useMemo(
    () => (employee ? allTasks.filter((task) => task.assignee_employee_id === employee.id) : []),
    [allTasks, employee],
  );

  const stats = useMemo(() => {
    const overdue = tasks.filter(
      (task) => task.status !== "done" && task.due_date && new Date(task.due_date) < new Date(),
    ).length;
    return {
      total: tasks.length,
      open: tasks.filter((task) => task.status !== "done").length,
      done: tasks.filter((task) => task.status === "done").length,
      overdue,
    };
  }, [tasks]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="My tasks"
        description="Tasks created when an AI recommendation was approved and turned into a workflow. Completing one here updates the workflow the reviewer created."
        statusLabel={`${stats.open} open`}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile label="Assigned to me" value={String(stats.total)} icon={ClipboardList} tone="primary" />
        <KpiTile label="Open" value={String(stats.open)} icon={ClipboardList} tone="info" />
        <KpiTile
          label="Past due"
          value={String(stats.overdue)}
          icon={ClipboardList}
          tone={stats.overdue ? "danger" : "success"}
        />
        <KpiTile label="Completed" value={String(stats.done)} icon={CheckCircle2} tone="success" />
      </div>

      {query.isLoading ? <LoadingState label="Reading your tasks" /> : null}

      {query.error ? (
        <ErrorState
          message={query.error instanceof Error ? query.error.message : "Tasks could not be loaded."}
          onRetry={() => void query.refetch()}
        />
      ) : null}

      {!query.isLoading && !query.error && !tasks.length ? (
        <EmptyState
          icon={<ClipboardList className="h-5 w-5" />}
          title="No tasks assigned to you"
          description={
            employee
              ? "When a reviewer approves a recommendation that concerns you, the resulting tasks appear here."
              : "Your profile is not linked to an employee record, so no tasks can be resolved for you."
          }
        />
      ) : null}

      {!query.isLoading && !query.error && tasks.length ? (
        <div className="flex flex-col gap-2">
          {tasks.map((task) => {
            const done = task.status === "done";
            const overdue = !done && task.due_date && new Date(task.due_date) < new Date();

            return (
              <article
                key={task.id}
                className={cn(
                  "talent-tile flex flex-wrap items-start justify-between gap-4 p-4 shadow-card",
                  overdue && "border-destructive/40",
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill tone={done ? "success" : overdue ? "danger" : "info"}>
                      {done ? "Done" : overdue ? "Overdue" : "Open"}
                    </StatusPill>
                    {task.workflowType ? <StatusPill tone="neutral">{task.workflowType}</StatusPill> : null}
                    <span className="text-[11px] font-semibold text-muted-foreground">
                      Due {task.due_date ? formatDate(task.due_date) : "not set"}
                    </span>
                  </div>
                  <h3
                    className={cn(
                      "mt-2 text-[13.5px] font-extrabold",
                      done ? "text-muted-foreground line-through" : "text-foreground",
                    )}
                  >
                    {task.title}
                  </h3>
                  {task.description ? (
                    <p className="mt-1 max-w-3xl text-[12px] font-medium leading-relaxed text-muted-foreground">
                      {task.description}
                    </p>
                  ) : null}
                  {task.recommendationTitle ? (
                    <p className="mt-1.5 text-[11px] font-semibold text-muted-foreground">
                      From: {task.recommendationTitle}
                    </p>
                  ) : null}
                </div>

                {!done ? (
                  <Button
                    size="sm"
                    onClick={() => completeMutation.mutate(task.id)}
                    disabled={completeMutation.isPending}
                  >
                    {completeMutation.isPending && completeMutation.variables === task.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    )}
                    Mark complete
                  </Button>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
