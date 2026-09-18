import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, BrainCircuit, ListChecks, Loader2, Save, ShieldCheck, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/common/page-header";
import { ChartCard } from "@/components/common/chart-card";
import { StatusPill } from "@/components/common/status-pill";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ErrorState, LoadingState } from "@/components/common/states";
import { formatDate, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

interface ResponseRow {
  id: string;
  response_text: string;
  score: number | null;
  ai_score: { criterion?: string; score?: number; max?: number; rationale?: string } | null;
}

interface QuestionRow {
  id: string;
  position: number;
  question_text: string;
  category: string;
  rubric: string | null;
  responses: ResponseRow[];
}

interface InterviewDetail {
  interview: {
    id: string;
    org_id: string;
    interview_type: string;
    status: string;
    scheduled_at: string | null;
    overall_score: number | null;
    summary: string | null;
    requires_human_review: boolean;
    application: {
      id: string;
      candidate: { full_name: string; email: string | null } | null;
      job: { title: string } | null;
    } | null;
  };
  questions: QuestionRow[];
}

async function fetchInterview(id: string): Promise<InterviewDetail | null> {
  const { data, error } = await supabase
    .from("talent_interviews")
    .select(
      "id, org_id, interview_type, status, scheduled_at, overall_score, summary, requires_human_review, application:talent_applications(id, candidate:talent_candidates(full_name, email), job:talent_job_postings(title))",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const { data: questions, error: questionError } = await supabase
    .from("talent_interview_questions")
    .select("id, position, question_text, category, rubric, responses:talent_interview_responses(id, response_text, score, ai_score)")
    .eq("interview_id", id)
    .order("position");

  if (questionError) throw new Error(questionError.message);

  return {
    interview: data as unknown as InterviewDetail["interview"],
    questions: (questions ?? []) as unknown as QuestionRow[],
  };
}

export default function InterviewDetailPage() {
  const { interviewId = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const query = useQuery({
    queryKey: ["talent360-interview", interviewId],
    queryFn: () => fetchInterview(interviewId),
    enabled: Boolean(interviewId),
  });

  const aiMutation = useMutation({
    mutationFn: async (action: "generate" | "evaluate") => {
      const { data, error } = await supabase.functions.invoke("talent-ai-interview", {
        body: { interviewId, action },
        headers: { "Content-Type": "application/json" },
      });
      if (error) throw new Error(error.message);
      const result = data as { ok?: boolean; error?: string } | null;
      if (result?.error || result?.ok === false) throw new Error(result.error ?? "The request failed.");
      return { action, result };
    },
    onSuccess: async ({ action }) => {
      await queryClient.invalidateQueries({ queryKey: ["talent360-interview", interviewId] });
      await queryClient.invalidateQueries({ queryKey: ["talent360-interviews"] });
      toast.success(action === "generate" ? "Questions generated" : "Responses evaluated", {
        description:
          action === "generate"
            ? "Each question carries the rubric a reviewer will judge it against."
            : "Rubric scores and rationales are stored for audit.",
      });
    },
    onError: (error) => {
      toast.error("AI step failed", {
        description: error instanceof Error ? error.message : "The request could not be completed.",
      });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async ({ questionId, text }: { questionId: string; text: string }) => {
      const detail = query.data;
      const question = detail?.questions.find((row) => row.id === questionId);
      const existing = question?.responses?.[0];

      if (existing) {
        const { error } = await supabase
          .from("talent_interview_responses")
          .update({ response_text: text })
          .eq("id", existing.id);
        if (error) throw new Error(error.message);
        return;
      }

      const { error } = await supabase.from("talent_interview_responses").insert({
        org_id: detail?.interview.org_id ?? "",
        question_id: questionId,
        response_text: text,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["talent360-interview", interviewId] });
      toast.success("Response saved");
    },
    onError: (error) => {
      toast.error("Response not saved", {
        description: error instanceof Error ? error.message : "The answer could not be saved.",
      });
    },
  });

  if (query.isLoading) return <LoadingState label="Loading the interview" />;

  if (query.error) {
    return (
      <ErrorState
        message={query.error instanceof Error ? query.error.message : "This interview could not be loaded."}
        onRetry={() => void query.refetch()}
      />
    );
  }

  const detail = query.data;
  if (!detail) {
    return (
      <ErrorState
        title="Interview not available"
        message="This interview is outside your scope, or it no longer exists. Interviewer-only access applies here."
      />
    );
  }

  const { interview, questions } = detail;
  const answeredCount = questions.filter((question) => question.responses?.[0]?.response_text?.trim()).length;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate("/app/interviews")}>
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to interviews
        </Button>
      </div>

      <PageHeader
        title={interview.application?.candidate?.full_name ?? "Interview"}
        description={`${interview.application?.job?.title ?? "Role removed"} · ${interview.interview_type} interview · ${
          interview.scheduled_at ? formatDate(interview.scheduled_at) : "not scheduled"
        }`}
        statusLabel={
          interview.overall_score === null
            ? "Not yet scored"
            : `Overall ${formatNumber(Number(interview.overall_score), 1)} / 5`
        }
        actions={
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => aiMutation.mutate("generate")}
              disabled={aiMutation.isPending}
            >
              {aiMutation.isPending && aiMutation.variables === "generate" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ListChecks className="h-3.5 w-3.5" />
              )}
              Generate questions
            </Button>
            <Button
              size="sm"
              onClick={() => aiMutation.mutate("evaluate")}
              disabled={aiMutation.isPending || answeredCount === 0}
              title={answeredCount === 0 ? "Record at least one answer first" : undefined}
            >
              {aiMutation.isPending && aiMutation.variables === "evaluate" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <BrainCircuit className="h-3.5 w-3.5" />
              )}
              Evaluate responses
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="flex flex-col gap-4 xl:col-span-2">
          {!questions.length ? (
            <ChartCard title="No questions yet" subtitle="Generate a structured question set from the posting">
              <p className="text-[12.5px] font-medium leading-relaxed text-muted-foreground">
                The generator reads the job description and the candidate's resume, then produces grouped
                questions with the rubric a reviewer will judge them against.
              </p>
              <Button
                size="sm"
                className="mt-3"
                onClick={() => aiMutation.mutate("generate")}
                disabled={aiMutation.isPending}
              >
                {aiMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                Generate questions
              </Button>
            </ChartCard>
          ) : null}

          {questions.map((question) => {
            const response = question.responses?.[0];
            const draft = drafts[question.id] ?? response?.response_text ?? "";
            const scored = response?.ai_score;

            return (
              <ChartCard
                key={question.id}
                title={`Q${question.position}. ${question.question_text}`}
                subtitle={question.category}
                className="gap-0"
              >
                <div className="flex flex-col gap-3">
                  {question.rubric ? (
                    <div className="rounded-lg bg-muted/50 px-3 py-2.5">
                      <span className="talent-label">Rubric</span>
                      <p className="mt-1 text-[11.5px] font-medium leading-relaxed text-muted-foreground">
                        {question.rubric}
                      </p>
                    </div>
                  ) : null}

                  <div className="flex flex-col gap-2">
                    <span className="talent-label">Recorded answer</span>
                    <Textarea
                      value={draft}
                      onChange={(event) => setDrafts((current) => ({ ...current, [question.id]: event.target.value }))}
                      placeholder="Type the candidate's answer as given, so the rubric scores can be audited against it."
                      className="min-h-[110px]"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => saveMutation.mutate({ questionId: question.id, text: draft })}
                        disabled={saveMutation.isPending || draft.trim().length === 0}
                      >
                        {saveMutation.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Save className="h-3.5 w-3.5" />
                        )}
                        Save answer
                      </Button>
                      {response?.score !== null && response?.score !== undefined ? (
                        <StatusPill tone={response.score >= 4 ? "success" : response.score >= 3 ? "info" : "danger"}>
                          Score {formatNumber(Number(response.score), 1)} / 5
                        </StatusPill>
                      ) : (
                        <StatusPill tone="neutral">Not scored</StatusPill>
                      )}
                    </div>
                  </div>

                  {scored?.rationale ? (
                    <div className="rounded-lg border border-border px-3 py-2.5">
                      <span className="talent-label">
                        Reviewer rationale{scored.criterion ? ` · ${scored.criterion}` : ""}
                      </span>
                      <p className="mt-1 text-[11.5px] font-medium leading-relaxed text-muted-foreground">
                        {scored.rationale}
                      </p>
                    </div>
                  ) : null}
                </div>
              </ChartCard>
            );
          })}
        </div>

        <div className="flex flex-col gap-4">
          <ChartCard title="Evaluation summary" subtitle="Human review is required before any decision">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-[18px] font-extrabold",
                    interview.overall_score === null
                      ? "bg-muted text-muted-foreground"
                      : interview.overall_score >= 4
                        ? "bg-success-soft text-success-soft-foreground"
                        : interview.overall_score >= 3
                          ? "bg-info-soft text-info-soft-foreground"
                          : "bg-destructive-soft text-destructive-soft-foreground",
                  )}
                >
                  {interview.overall_score === null
                    ? "—"
                    : formatNumber(Number(interview.overall_score), 1)}
                </span>
                <div>
                  <div className="text-[13px] font-bold text-foreground">Overall rubric score</div>
                  <div className="text-[11.5px] font-medium text-muted-foreground">Out of 5 across criteria</div>
                </div>
              </div>

              {interview.summary ? (
                <p className="text-[12.5px] font-medium leading-relaxed text-muted-foreground">
                  {interview.summary}
                </p>
              ) : (
                <p className="text-[12.5px] font-medium leading-relaxed text-muted-foreground">
                  No evaluation has been run yet. Record the answers, then evaluate to produce rubric scores and
                  a rationale for each.
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                <StatusPill tone={interview.requires_human_review ? "warning" : "success"} icon={<ShieldCheck className="h-3 w-3" />}>
                  {interview.requires_human_review ? "Human review required" : "No review flag"}
                </StatusPill>
                <StatusPill tone="neutral">
                  {answeredCount} of {questions.length} answers recorded
                </StatusPill>
              </div>

              <p className="text-[11.5px] font-medium leading-relaxed text-muted-foreground">
                Scores are advisory. The hiring decision belongs to a person, and the flag exists so a
                borderline outcome cannot be finalised by the model alone.
              </p>
            </div>
          </ChartCard>

          {interview.application ? (
            <Button variant="outline" size="sm" asChild>
              <Link to={`/app/recruitment/${interview.application.id}`}>
                Open the candidate record
              </Link>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
