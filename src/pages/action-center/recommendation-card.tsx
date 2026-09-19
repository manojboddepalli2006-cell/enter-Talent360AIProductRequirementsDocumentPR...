import { Check, Clock, GitBranch, PencilLine, X } from "lucide-react";
import { StatusPill } from "@/components/common/status-pill";
import { ReasoningPanel } from "@/components/common/reasoning-panel";
import { Button } from "@/components/ui/button";
import { WorkflowVisualization } from "@/components/common/workflow-visualization";
import { UserCell } from "@/components/common/user-cell";
import { MODULE_LABELS, RECOMMENDATION_STATUS_LABELS, STATUS_TONE } from "@/lib/domain";
import { formatRelative } from "@/lib/format";
import type { RecommendationWithContext } from "@/lib/api/actions";

interface RecommendationCardProps {
  recommendation: RecommendationWithContext;
  reviewerName: string | null;
  onDecide: (mode: "approve" | "modify" | "reject") => void;
}

const MODULE_TONE = {
  recruit: "info",
  interview: "accent",
  develop: "primary",
  monitor: "danger",
  onboard: "success",
} as const;

export function RecommendationCard({ recommendation, reviewerName, onDecide }: RecommendationCardProps) {
  const structured = recommendation.structured;
  const subjectName = recommendation.employeeName ?? recommendation.candidateName;
  const subjectSubtext =
    [recommendation.employeeTitle, recommendation.jobTitle].filter(Boolean).join(" · ") || null;
  const isPending = recommendation.status === "pending";

  const highRisk = recommendation.module === "monitor" && recommendation.structured?.confidence !== null
    ? (recommendation.structured?.confidence ?? 0) >= 0.75
    : false;

  return (
    <article
      className="talent-tile talent-tile-hover relative flex flex-col gap-4 overflow-hidden p-5"
    >
      {highRisk ? (
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-[3px] bg-accent"
        />
      ) : null}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone={MODULE_TONE[recommendation.module] ?? "neutral"}>
              {MODULE_LABELS[recommendation.module] ?? recommendation.module}
            </StatusPill>
            <StatusPill tone={STATUS_TONE[recommendation.status] ?? "neutral"}>
              {RECOMMENDATION_STATUS_LABELS[recommendation.status] ?? recommendation.status}
            </StatusPill>
            <span className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
              <Clock className="h-3 w-3" />
              {formatRelative(recommendation.created_at)}
            </span>
          </div>
          <h3 className="mt-2 text-[15px] font-extrabold leading-snug text-foreground">
            {recommendation.title}
          </h3>
          {recommendation.summary ? (
            <p className="mt-1 text-[12.5px] font-medium leading-relaxed text-muted-foreground">
              {recommendation.summary}
            </p>
          ) : null}
        </div>

        {subjectName ? (
          <UserCell name={subjectName} subtext={subjectSubtext} className="shrink-0" />
        ) : null}
      </header>

      <ReasoningPanel
        signals={structured?.reasoning_signals ?? []}
        explanation={structured?.explanation ?? null}
        confidence={structured?.confidence ?? null}
        recommendedActions={structured?.recommended_actions ?? []}
        requiresHumanReview={structured?.requires_human_review ?? true}
      />

      {isPending ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <Button size="sm" onClick={() => onDecide("approve")}>
            <Check className="h-3.5 w-3.5" />
            Approve
          </Button>
          <Button size="sm" variant="outline" onClick={() => onDecide("modify")}>
            <PencilLine className="h-3.5 w-3.5" />
            Approve with changes
          </Button>
          <Button size="sm" variant="soft-destructive" onClick={() => onDecide("reject")}>
            <X className="h-3.5 w-3.5" />
            Reject
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-4">
          <span className="text-[11.5px] font-semibold text-muted-foreground">
            Reviewed by {reviewerName ?? "a reviewer"} · {formatRelative(recommendation.reviewed_at)}
          </span>
          {recommendation.workflowId ? (
            <StatusPill tone="success" icon={<GitBranch className="h-3 w-3" />}>
              Workflow created
            </StatusPill>
          ) : (
            <StatusPill tone="neutral">No workflow</StatusPill>
          )}
          {recommendation.workflowId ? (
            <div className="w-full pt-1">
              <WorkflowVisualization
                steps={[
                  { key: "ai", label: "AI Insight", state: "done" },
                  { key: "review", label: "Human Review", state: "done" },
                  { key: "approve", label: "Approved", state: "done" },
                  { key: "flow", label: "Workflow", state: "done" },
                  { key: "task", label: "Task", state: "active" },
                  { key: "follow", label: "Follow-up", state: "pending" },
                  { key: "outcome", label: "Outcome", state: "pending" },
                ]}
              />
            </div>
          ) : null}
          {recommendation.rejection_reason ? (
            <span className="w-full text-[11.5px] font-medium italic leading-snug text-muted-foreground">
              Reason: {recommendation.rejection_reason}
            </span>
          ) : null}
        </div>
      )}
        </article>
  );
}
