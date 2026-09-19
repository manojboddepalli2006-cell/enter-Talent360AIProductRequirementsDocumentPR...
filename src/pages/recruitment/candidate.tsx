import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  ChevronDown,
  FileText,
  Loader2,
  MapPin,
  MessagesSquare,
  ShieldAlert,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchApplicationDetail,
  moveApplicationStage,
  recordApplicationDecision,
} from "@/lib/api/recruitment";
import { PageHeader } from "@/components/common/page-header";
import { ChartCard } from "@/components/common/chart-card";
import { StatusPill } from "@/components/common/status-pill";
import { Button } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/common/states";
import { PIPELINE_STAGES, STAGE_TONE, confidenceBand } from "@/lib/domain";
import { formatDate, formatNumber, formatRelative } from "@/lib/format";
import { useSession } from "@/hooks/use-session";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface Criterion {
  factor?: string;
  score?: number;
  weight?: number;
  note?: string;
}

export default function CandidatePage() {
  const { applicationId = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useSession();
  const [resumeOpen, setResumeOpen] = useState(false);

  const detailQuery = useQuery({
    queryKey: ["talent360-application", applicationId],
    queryFn: () => fetchApplicationDetail(applicationId),
    enabled: Boolean(applicationId),
  });

  const matchMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("talent-ai-resume-match", {
        body: { applicationId },
        headers: { "Content-Type": "application/json" },
      });
      if (error) throw new Error(error.message);
      const result = data as { ok?: boolean; error?: string; match_score?: number } | null;
      if (result?.error || result?.ok === false) throw new Error(result.error ?? "The match failed.");
      return result;
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["talent360-application", applicationId] });
      toast.success("Match scored", { description: `Overall match ${result?.match_score ?? "—"}%.` });
    },
    onError: (error) => {
      toast.error("Match failed", {
        description: error instanceof Error ? error.message : "The match could not be produced.",
      });
    },
  });

  const stageMutation = useMutation({
    mutationFn: async (stage: string) => {
      if (stage === "rejected") {
        await recordApplicationDecision(applicationId, stage, user?.id ?? null);
      } else {
        await moveApplicationStage(applicationId, stage);
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["talent360-application", applicationId] });
      await queryClient.invalidateQueries({ queryKey: ["talent360-applications"] });
      toast.success("Stage updated");
    },
    onError: (error) => {
      toast.error("Stage not updated", {
        description: error instanceof Error ? error.message : "The change could not be saved.",
      });
    },
  });

  if (detailQuery.isLoading) return <LoadingState label="Loading the candidate" />;

  if (detailQuery.error) {
    return (
      <ErrorState
        message={detailQuery.error instanceof Error ? detailQuery.error.message : "This candidate could not be loaded."}
        onRetry={() => void detailQuery.refetch()}
      />
    );
  }

  const detail = detailQuery.data;
  if (!detail) {
    return (
      <ErrorState
        title="Candidate not available"
        message="This application is either outside your role's scope or no longer exists."
      />
    );
  }

  const { application, interviews } = detail;
  const candidate = application.candidate;
  const job = application.job;
  const breakdown = (application.ai_match_breakdown ?? {}) as {
    overall?: number;
    criteria?: Criterion[];
    explanation?: string;
    strengths?: string[];
    gaps?: string[];
    confidence?: number;
  };
  const flags = Array.isArray(application.bias_flags)
    ? (application.bias_flags as Array<{ type?: string; note?: string }>)
    : [];
  const band = confidenceBand(breakdown.confidence ?? null);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate("/app/recruitment")}>
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to pipeline
        </Button>
      </div>

      <PageHeader
        title={candidate?.full_name ?? "Candidate"}
        description={`${job?.title ?? "Role removed"}${
          job?.location ? ` · ${job.location}` : ""
        } · applied ${formatRelative(application.created_at)}`}
        statusLabel={application.ai_match_score === null ? "Not scored" : `${formatNumber(Number(application.ai_match_score))}% match`}
        actions={
          <>
            <StatusPill tone={STAGE_TONE[application.stage] ?? "neutral"}>
              {PIPELINE_STAGES.find((stage) => stage.key === application.stage)?.label ?? application.stage}
            </StatusPill>

            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex h-8 items-center gap-2 rounded-lg border border-input bg-card px-3 text-[12px] font-bold text-foreground transition-colors hover:bg-muted">
                Move stage
                <ChevronDown className="h-3 w-3" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>Move to</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {PIPELINE_STAGES.filter((stage) => stage.key !== application.stage).map((stage) => (
                  <DropdownMenuItem key={stage.key} onSelect={() => stageMutation.mutate(stage.key)}>
                    <StatusPill tone={STAGE_TONE[stage.key] ?? "neutral"}>{stage.label}</StatusPill>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button size="sm" onClick={() => matchMutation.mutate()} disabled={matchMutation.isPending}>
              {matchMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Wand2 className="h-3.5 w-3.5" />
              )}
              Run AI match
            </Button>
          </>
        }
      />

      {flags.length ? (
        <div className="talent-tile flex items-start gap-3 border-warning/40 bg-warning-soft p-4">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning-soft-foreground" />
          <div>
            <div className="text-[13px] font-bold text-warning-soft-foreground">
              Fairness flag raised for human review
            </div>
            <ul className="mt-1 flex flex-col gap-1">
              {flags.map((flag, index) => (
                <li key={`${flag.type}-${index}`} className="text-[12px] font-medium leading-snug text-warning-soft-foreground">
                  {flag.note ?? flag.type ?? "Manual review required"}
                </li>
              ))}
            </ul>
            <p className="mt-1.5 text-[11.5px] font-medium leading-snug text-warning-soft-foreground/90">
              The score was not adjusted. This flag exists so a person checks the input, not so the system
              filters anyone out.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ChartCard
          title="Why this score"
          subtitle={
            breakdown.overall !== undefined
              ? `Overall ${breakdown.overall}% · ${band.label}`
              : "No match has been run yet"
          }
          className="xl:col-span-2"
        >
          {application.ai_match_score === null ? (
            <div className="flex flex-col items-start gap-3">
              <p className="text-[12.5px] font-medium leading-relaxed text-muted-foreground">
                This application has not been scored. The match reads the pasted resume text against the job
                description and returns weighted criteria with a rationale for each.
              </p>
              <Button size="sm" onClick={() => matchMutation.mutate()} disabled={matchMutation.isPending}>
                {matchMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                Run the AI match
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {breakdown.explanation ? (
                <p className="text-[12.5px] font-medium leading-relaxed text-muted-foreground">
                  {breakdown.explanation}
                </p>
              ) : null}

              <ul className="flex flex-col gap-3">
                {(breakdown.criteria ?? []).map((criterion, index) => {
                  const score = Number(criterion.score ?? 0);
                  const weight = Number(criterion.weight ?? 0);
                  return (
                    <li key={`${criterion.factor}-${index}`} className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[12.5px] font-bold text-foreground">
                          {criterion.factor ?? "Criterion"}
                        </span>
                        <span className="flex items-center gap-2">
                          {weight ? (
                            <span className="text-[11px] font-semibold text-muted-foreground">
                              weight {Math.round(weight * 100)}%
                            </span>
                          ) : null}
                          <span className="text-[12.5px] font-extrabold text-foreground">{score}%</span>
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            score >= 85 ? "bg-chart-5" : score >= 70 ? "bg-chart-1" : score >= 60 ? "bg-chart-4" : "bg-chart-3",
                          )}
                          style={{ width: `${Math.max(2, Math.min(100, score))}%` }}
                        />
                      </div>
                      {criterion.note ? (
                        <p className="text-[11.5px] font-medium leading-snug text-muted-foreground">
                          {criterion.note}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>

              <div className="grid grid-cols-1 gap-4 border-t border-border pt-4 sm:grid-cols-2">
                <div>
                  <span className="talent-label">Strengths</span>
                  <ul className="mt-1.5 flex flex-col gap-1">
                    {(breakdown.strengths ?? []).length ? (
                      (breakdown.strengths ?? []).map((strength) => (
                        <li key={strength} className="flex items-start gap-2 text-[12px] font-medium text-foreground">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
                          {strength}
                        </li>
                      ))
                    ) : (
                      <li className="text-[12px] font-medium text-muted-foreground">None recorded</li>
                    )}
                  </ul>
                </div>
                <div>
                  <span className="talent-label">Gaps</span>
                  <ul className="mt-1.5 flex flex-col gap-1">
                    {(breakdown.gaps ?? []).length ? (
                      (breakdown.gaps ?? []).map((gap) => (
                        <li key={gap} className="flex items-start gap-2 text-[12px] font-medium text-foreground">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-warning" />
                          {gap}
                        </li>
                      ))
                    ) : (
                      <li className="text-[12px] font-medium text-muted-foreground">None recorded</li>
                    )}
                  </ul>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                <StatusPill tone={band.tone}>{band.label}</StatusPill>
                <StatusPill tone="warning">Human decision required</StatusPill>
              </div>
            </div>
          )}
        </ChartCard>

        <div className="flex flex-col gap-4">
          <ChartCard title="Candidate details" subtitle="From the intake record">
            <dl className="flex flex-col gap-3">
              <div>
                <dt className="talent-label">Email</dt>
                <dd className="mt-0.5 truncate text-[12.5px] font-semibold text-foreground">
                  {candidate?.email ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="talent-label">Location</dt>
                <dd className="mt-0.5 flex items-center gap-1.5 text-[12.5px] font-semibold text-foreground">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                  {candidate?.location ?? "Not provided"}
                </dd>
              </div>
              <div>
                <dt className="talent-label">Source</dt>
                <dd className="mt-0.5 text-[12.5px] font-semibold text-foreground">
                  {candidate?.source ?? "Direct"}
                </dd>
              </div>
              <div>
                <dt className="talent-label">Portal code</dt>
                <dd className="mt-1 flex items-center gap-2">
                  <code className="rounded-md bg-muted px-2 py-0.5 text-[12px] font-bold text-foreground">
                    {(candidate as unknown as { portal_code?: string | null })?.portal_code ?? "—"}
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      const code = (candidate as unknown as { portal_code?: string | null })?.portal_code;
                      if (code) {
                        void navigator.clipboard?.writeText(`${window.location.origin}/portal`);
                        void navigator.clipboard?.writeText(code);
                      }
                    }}
                    className="text-[11px] font-semibold text-primary hover:underline"
                  >
                    Copy
                  </button>
                </dd>
                <p className="mt-1 text-[10.5px] font-medium leading-snug text-muted-foreground">
                  Share the portal link ({window.location.origin}/portal) and this code so the candidate can track
                  their application and answer interview questions.
                </p>
              </div>
              <div>
                <dt className="talent-label">Decision</dt>
                <dd className="mt-0.5 text-[12.5px] font-semibold text-foreground">
                  {application.decided_at
                    ? `Recorded ${formatDate(application.decided_at)}`
                    : "No final decision recorded"}
                </dd>
              </div>
            </dl>

            <Button
              variant="outline"
              size="sm"
              className="mt-4 w-full"
              onClick={() => setResumeOpen((open) => !open)}
              disabled={!candidate?.resume_text}
            >
              <FileText className="h-3.5 w-3.5" />
              {resumeOpen ? "Hide resume text" : "Show resume text"}
            </Button>
            {resumeOpen && candidate?.resume_text ? (
              <pre className="talent-scroll mt-3 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg bg-muted/50 p-3 text-[11.5px] font-medium leading-relaxed text-muted-foreground">
                {candidate.resume_text}
              </pre>
            ) : null}
          </ChartCard>

          <ChartCard title="Interviews" subtitle={`${interviews.length} scheduled or completed`}>
            {interviews.length ? (
              <ul className="flex flex-col gap-2">
                {interviews.map((interview) => (
                  <li
                    key={interview.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-[12.5px] font-bold capitalize text-foreground">
                        {interview.interview_type} interview
                      </div>
                      <div className="truncate text-[11px] font-medium text-muted-foreground">
                        {interview.scheduled_at ? formatDate(interview.scheduled_at) : "Not scheduled"} ·{" "}
                        {interview.scoreCount} scored response{interview.scoreCount === 1 ? "" : "s"}
                      </div>
                    </div>
                    <Link
                      to={`/app/interviews/${interview.id}`}
                      className="shrink-0 rounded-lg bg-muted px-2.5 py-1.5 text-[11.5px] font-bold text-foreground transition-colors hover:bg-muted/70"
                    >
                      Open
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[12.5px] font-medium leading-relaxed text-muted-foreground">
                No interviews have been scheduled for this application yet.
              </p>
            )}

            <Button variant="outline" size="sm" className="mt-3 w-full" asChild>
              <Link to="/app/interviews">
                <MessagesSquare className="h-3.5 w-3.5" />
                Go to interview console
              </Link>
            </Button>
          </ChartCard>

          {application.stage !== "rejected" ? (
            <Button
              variant="soft-destructive"
              size="sm"
              onClick={() => stageMutation.mutate("rejected")}
              disabled={stageMutation.isPending}
            >
              <X className="h-3.5 w-3.5" />
              Reject this application
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
