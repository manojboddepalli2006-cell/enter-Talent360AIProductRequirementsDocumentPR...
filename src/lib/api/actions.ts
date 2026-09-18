import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { parseStructuredAiResult, type StructuredAiResult } from "@/lib/ai-parse";

export type RecommendationRow = Database["public"]["Tables"]["talent_ai_recommendations"]["Row"];
export type WorkflowRow = Database["public"]["Tables"]["talent_workflows"]["Row"];
export type TaskRow = Database["public"]["Tables"]["talent_workflow_tasks"]["Row"];

export interface RecommendationWithContext extends RecommendationRow {
  structured: StructuredAiResult | null;
  employeeName: string | null;
  employeeTitle: string | null;
  candidateName: string | null;
  jobTitle: string | null;
  workflowId: string | null;
}

interface ListOptions {
  status?: string[];
  module?: string[];
  /** Restricts to one employee, used by the employee-level surfaces. */
  employeeId?: string | null;
}

function asStructured(value: unknown): StructuredAiResult | null {
  if (!value || typeof value !== "object") return null;
  return parseStructuredAiResult(JSON.stringify(value));
}

/**
 * Reads recommendations with the labels the review cards need.
 * Scope (org-wide versus direct reports) is decided by RLS, not by this query.
 */
export async function listRecommendations(options: ListOptions = {}): Promise<RecommendationWithContext[]> {
  let builder = supabase
    .from("talent_ai_recommendations")
    .select(
      "*, employee:talent_employees(full_name, role_title), application:talent_applications(id, job:talent_job_postings(title), candidate:talent_candidates(full_name))",
    )
    .order("created_at", { ascending: false });

  if (options.status?.length) builder = builder.in("status", options.status);
  if (options.module?.length) builder = builder.in("module", options.module);
  if (options.employeeId) builder = builder.eq("employee_id", options.employeeId);

  const { data, error } = await builder;
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Array<
    RecommendationRow & {
      employee: { full_name: string; role_title: string } | null;
      application:
        | {
            id: string;
            job: { title: string } | null;
            candidate: { full_name: string } | null;
          }
        | null;
    }
  >;

  const ids = rows.filter((row) => ["approved", "modified"].includes(row.status)).map((row) => row.id);
  let workflowByRecommendation: Record<string, string> = {};

  if (ids.length) {
    const { data: workflows, error: workflowError } = await supabase
      .from("talent_workflows")
      .select("id, recommendation_id")
      .in("recommendation_id", ids);

    if (workflowError) throw new Error(workflowError.message);
    workflowByRecommendation = (workflows ?? []).reduce<Record<string, string>>((acc, workflow) => {
      acc[workflow.recommendation_id] = workflow.id;
      return acc;
    }, {});
  }

  return rows.map((row) => ({
    ...row,
    structured: asStructured(row.recommendation),
    employeeName: row.employee?.full_name ?? null,
    employeeTitle: row.employee?.role_title ?? null,
    candidateName: row.application?.candidate?.full_name ?? null,
    jobTitle: row.application?.job?.title ?? null,
    workflowId: workflowByRecommendation[row.id] ?? null,
  }));
}

async function writeAudit(entry: {
  orgId: string;
  actorId: string | null;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: unknown;
}): Promise<void> {
  const { error } = await supabase.from("talent_audit_log").insert({
    org_id: entry.orgId,
    actor_id: entry.actorId,
    actor_name: entry.actorName,
    action: entry.action,
    entity_type: entry.entityType,
    entity_id: entry.entityId,
    metadata: entry.metadata as never,
  });
  if (error) throw new Error(error.message);
}

export interface ReviewActionInput {
  recommendation: RecommendationWithContext;
  orgId: string;
  actorId: string | null;
  actorName: string;
  /** Edited action list; only supplied on the modify path. */
  actions?: string[];
  rejectionReason?: string;
  dueInDays?: number;
}

export interface ReviewResult {
  status: "approved" | "modified" | "rejected";
  workflowId: string | null;
  taskCount: number;
  /** Set when the approval landed but the orchestration step was blocked by policy. */
  warning: string | null;
}

function workflowTypeFor(module: string): string {
  switch (module) {
    case "monitor":
      return "retention-check-in";
    case "develop":
      return "development-plan";
    case "onboard":
      return "onboarding-follow-up";
    case "interview":
      return "interview-follow-up";
    default:
      return "recruitment-follow-up";
  }
}

function recipientFor(input: ReviewActionInput): { employeeId: string | null; name: string | null } {
  return {
    employeeId: input.recommendation.employee_id,
    name: input.recommendation.employeeName,
  };
}

async function createWorkflowAndTasks(input: ReviewActionInput, actions: string[]): Promise<ReviewResult> {
  const { recommendation, orgId, actorId, actorName } = input;
  const recipient = recipientFor(input);

  const { data: workflow, error: workflowError } = await supabase
    .from("talent_workflows")
    .insert({
      org_id: orgId,
      recommendation_id: recommendation.id,
      workflow_type: workflowTypeFor(recommendation.module),
      status: "active",
      created_by: actorId,
    })
    .select("id")
    .single();

  if (workflowError) {
    // The approval itself is already committed, so report the orchestration gap
    // instead of pretending the workflow was created.
    return {
      status: "approved",
      workflowId: null,
      taskCount: 0,
      warning: `Recommendation recorded, but the workflow could not be created: ${workflowError.message}`,
    };
  }

  const dueInDays = input.dueInDays ?? 7;
  const taskRows = (actions.length ? actions : ["Review the recommendation and agree next steps"]).map(
    (action) => ({
      org_id: orgId,
      workflow_id: workflow.id,
      assignee_employee_id: recipient.employeeId,
      assignee_name: recipient.name,
      title: action,
      description: recommendation.structured?.explanation ?? recommendation.summary,
      due_date: new Date(Date.now() + dueInDays * 86_400_000).toISOString().slice(0, 10),
      status: "open",
    }),
  );

  const { error: taskError } = await supabase.from("talent_workflow_tasks").insert(taskRows);
  if (taskError) {
    return {
      status: "approved",
      workflowId: workflow.id,
      taskCount: 0,
      warning: `Workflow created, but its tasks could not be: ${taskError.message}`,
    };
  }

  await writeAudit({
    orgId,
    actorId,
    actorName,
    action: "workflow.created",
    entityType: "workflow",
    entityId: workflow.id,
    metadata: { type: workflowTypeFor(recommendation.module), tasks: taskRows.length },
  });

  return { status: "approved", workflowId: workflow.id, taskCount: taskRows.length, warning: null };
}

export async function approveRecommendation(input: ReviewActionInput): Promise<ReviewResult> {
  const actions = input.actions ?? input.recommendation.structured?.recommended_actions ?? [];

  const { error } = await supabase
    .from("talent_ai_recommendations")
    .update({
      status: "approved",
      reviewed_by: input.actorId,
      reviewed_at: new Date().toISOString(),
      rejection_reason: null,
    })
    .eq("id", input.recommendation.id);

  if (error) throw new Error(error.message);

  await writeAudit({
    orgId: input.orgId,
    actorId: input.actorId,
    actorName: input.actorName,
    action: "recommendation.approved",
    entityType: "ai_recommendation",
    entityId: input.recommendation.id,
    metadata: { module: input.recommendation.module, actions },
  });

  return createWorkflowAndTasks(input, actions);
}

export async function modifyRecommendation(input: ReviewActionInput): Promise<ReviewResult> {
  const actions = input.actions ?? [];

  const { error } = await supabase
    .from("talent_ai_recommendations")
    .update({
      status: "modified",
      reviewed_by: input.actorId,
      reviewed_at: new Date().toISOString(),
      modified_payload: { recommended_actions: actions },
      rejection_reason: null,
    })
    .eq("id", input.recommendation.id);

  if (error) throw new Error(error.message);

  await writeAudit({
    orgId: input.orgId,
    actorId: input.actorId,
    actorName: input.actorName,
    action: "recommendation.modified",
    entityType: "ai_recommendation",
    entityId: input.recommendation.id,
    metadata: {
      module: input.recommendation.module,
      original: input.recommendation.structured?.recommended_actions ?? [],
      revised: actions,
    },
  });

  return createWorkflowAndTasks(input, actions);
}

export async function rejectRecommendation(input: ReviewActionInput): Promise<ReviewResult> {
  const reason = input.rejectionReason?.trim();
  if (!reason) throw new Error("A rejection reason is required so the decision is auditable.");

  const { error } = await supabase
    .from("talent_ai_recommendations")
    .update({
      status: "rejected",
      reviewed_by: input.actorId,
      reviewed_at: new Date().toISOString(),
      rejection_reason: reason,
    })
    .eq("id", input.recommendation.id);

  if (error) throw new Error(error.message);

  await writeAudit({
    orgId: input.orgId,
    actorId: input.actorId,
    actorName: input.actorName,
    action: "recommendation.rejected",
    entityType: "ai_recommendation",
    entityId: input.recommendation.id,
    metadata: { module: input.recommendation.module, reason },
  });

  return { status: "rejected", workflowId: null, taskCount: 0, warning: null };
}

/** Tasks assigned to the signed-in employee, plus their open workflow context. */
export async function listMyTasks(): Promise<
  Array<TaskRow & { workflowType: string | null; recommendationTitle: string | null }>
> {
  const { data, error } = await supabase
    .from("talent_workflow_tasks")
    .select("*, workflow:talent_workflows(workflow_type, recommendation:talent_ai_recommendations(title))")
    .order("status", { ascending: true })
    .order("due_date", { ascending: true });

  if (error) throw new Error(error.message);

  return (
    (data ?? []) as Array<
      TaskRow & {
        workflow: { workflow_type: string; recommendation: { title: string } | null } | null;
      }
    >
  ).map((row) => ({
    ...row,
    workflowType: row.workflow?.workflow_type ?? null,
    recommendationTitle: row.workflow?.recommendation?.title ?? null,
  }));
}

export async function completeTask(taskId: string): Promise<void> {
  const { error } = await supabase
    .from("talent_workflow_tasks")
    .update({ status: "done", completed_at: new Date().toISOString() })
    .eq("id", taskId);

  if (error) throw new Error(error.message);
}
