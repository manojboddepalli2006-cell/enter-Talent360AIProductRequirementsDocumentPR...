import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Eye, Loader2, MessagesSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/common/page-header";
import { FilterTabs } from "@/components/common/filter-tabs";
import { StatusPill } from "@/components/common/status-pill";
import { UserCell } from "@/components/common/user-cell";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/states";
import { KpiTile } from "@/components/common/kpi-tile";
import { formatDate, formatNumber } from "@/lib/format";
import { BrainCircuit, CheckCircle2, Clock, ShieldCheck } from "lucide-react";

interface InterviewRow {
  id: string;
  interview_type: string;
  status: string;
  scheduled_at: string | null;
  overall_score: number | null;
  requires_human_review: boolean;
  application: {
    id: string;
    candidate: { full_name: string; email: string | null } | null;
    job: { title: string } | null;
  } | null;
}

const STATUS_TONE: Record<string, "neutral" | "warning" | "success" | "info"> = {
  scheduled: "info",
  awaiting_evaluation: "warning",
  evaluated: "success",
};

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Scheduled",
  awaiting_evaluation: "Awaiting evaluation",
  evaluated: "Evaluated",
};

async function listInterviews(): Promise<InterviewRow[]> {
  const { data, error } = await supabase
    .from("talent_interviews")
    .select(
      "id, interview_type, status, scheduled_at, overall_score, requires_human_review, application:talent_applications(id, candidate:talent_candidates(full_name, email), job:talent_job_postings(title))",
    )
    .order("scheduled_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as InterviewRow[];
}

export default function InterviewsPage() {
  const [statusFilter, setStatusFilter] = useState("all");

  const query = useQuery({ queryKey: ["talent360-interviews"], queryFn: listInterviews });
  const interviews = useMemo(() => query.data ?? [], [query.data]);

  const counts = useMemo(
    () => ({
      all: interviews.length,
      scheduled: interviews.filter((row) => row.status === "scheduled").length,
      awaiting_evaluation: interviews.filter((row) => row.status === "awaiting_evaluation").length,
      evaluated: interviews.filter((row) => row.status === "evaluated").length,
    }),
    [interviews],
  );

  const visible = interviews.filter((row) => (statusFilter === "all" ? true : row.status === statusFilter));

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Interview console"
        description="Structured questions, recorded answers and rubric scores. A borderline outcome is always flagged for human review before it can move a candidate."
        statusLabel={`${counts.awaiting_evaluation} awaiting evaluation`}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile label="Total interviews" value={String(counts.all)} icon={MessagesSquare} tone="primary" />
        <KpiTile label="Scheduled" value={String(counts.scheduled)} icon={Clock} tone="info" />
        <KpiTile
          label="Awaiting evaluation"
          value={String(counts.awaiting_evaluation)}
          icon={BrainCircuit}
          tone="warning"
        />
        <KpiTile label="Evaluated" value={String(counts.evaluated)} icon={CheckCircle2} tone="success" />
      </div>

      <div className="talent-tile px-4 pb-1 pt-3 shadow-card">
        <FilterTabs
          items={[
            { key: "all", label: "All", count: counts.all },
            { key: "scheduled", label: "Scheduled", count: counts.scheduled },
            { key: "awaiting_evaluation", label: "Awaiting evaluation", count: counts.awaiting_evaluation },
            { key: "evaluated", label: "Evaluated", count: counts.evaluated },
          ]}
          value={statusFilter}
          onChange={setStatusFilter}
        />
      </div>

      {query.isLoading ? <LoadingState label="Loading interviews" /> : null}

      {query.error ? (
        <ErrorState
          message={query.error instanceof Error ? query.error.message : "Interviews could not be loaded."}
          onRetry={() => void query.refetch()}
        />
      ) : null}

      {!query.isLoading && !query.error && !visible.length ? (
        <EmptyState
          icon={<MessagesSquare className="h-5 w-5" />}
          title="No interviews in this view"
          description="Interviews appear here once an application reaches the interviewing stage."
        />
      ) : null}

      {!query.isLoading && !query.error && visible.length ? (
        <div className="talent-tile overflow-hidden shadow-card">
          <div className="talent-scroll overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-3 pl-4 text-left talent-label">Candidate</th>
                  <th className="py-3 pr-4 text-left talent-label">Role</th>
                  <th className="py-3 pr-4 text-left talent-label">Type</th>
                  <th className="py-3 pr-4 text-left talent-label">Status</th>
                  <th className="py-3 pr-4 text-left talent-label">Score</th>
                  <th className="py-3 pr-4 text-left talent-label">Review</th>
                  <th className="py-3 pr-4 text-right talent-label">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((interview) => (
                  <tr key={interview.id} className="border-b border-border last:border-0">
                    <td className="py-3 pl-4 pr-4">
                      <UserCell
                        name={interview.application?.candidate?.full_name}
                        subtext={
                          interview.scheduled_at ? `Scheduled ${formatDate(interview.scheduled_at)}` : "Not scheduled"
                        }
                      />
                    </td>
                    <td className="py-3 pr-4 text-[12.5px] font-semibold text-foreground">
                      {interview.application?.job?.title ?? "—"}
                    </td>
                    <td className="py-3 pr-4 text-[12.5px] font-semibold capitalize text-foreground">
                      {interview.interview_type}
                    </td>
                    <td className="py-3 pr-4">
                      <StatusPill tone={STATUS_TONE[interview.status] ?? "neutral"}>
                        {STATUS_LABEL[interview.status] ?? interview.status}
                      </StatusPill>
                    </td>
                    <td className="py-3 pr-4 text-[12.5px] font-bold text-foreground">
                      {interview.overall_score === null
                        ? "—"
                        : `${formatNumber(Number(interview.overall_score), 1)} / 5`}
                    </td>
                    <td className="py-3 pr-4">
                      {interview.requires_human_review ? (
                        <StatusPill tone="warning" icon={<ShieldCheck className="h-3 w-3" />}>
                          Required
                        </StatusPill>
                      ) : (
                        <StatusPill tone="neutral">Not required</StatusPill>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-right">
                      <Button variant="soft" size="sm" asChild>
                        <Link to={`/app/interviews/${interview.id}`}>
                          <Eye className="h-3.5 w-3.5" />
                          Open
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {query.isFetching && !query.isLoading ? (
        <span className="flex items-center gap-2 text-[11.5px] font-semibold text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Refreshing
        </span>
      ) : null}
    </div>
  );
}
