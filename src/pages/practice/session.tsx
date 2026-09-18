import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  Lightbulb,
  Loader2,
  MicVocal,
  Plus,
  Sparkles,
  Target,
  Wand2,
} from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { StatusPill } from "@/components/common/status-pill";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/states";
import {
  completePracticeSession,
  fetchPracticeSession,
  generatePracticeQuestions,
  scorePracticeAnswer,
} from "@/lib/api/practice";
import { formatNumber, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

function scoreTone(score: number | null): "success" | "info" | "warning" | "danger" | "neutral" {
  if (score === null) return "neutral";
  if (score >= 4) return "success";
  if (score >= 3) return "info";
  if (score >= 2) return "warning";
  return "danger";
}

export default function PracticeSessionPage() {
  const { sessionId = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const query = useQuery({
    queryKey: ["talent360-practice-session", sessionId],
    queryFn: () => fetchPracticeSession(sessionId),
    enabled: Boolean(sessionId),
  });

  const data = query.data;

  // Generate the question set the first time the session is opened.
  useEffect(() => {
    if (
      data &&
      data.session.status === "in_progress" &&
      data.questions.length === 0 &&
      !generateMutation.isPending
    ) {
      generateMutation.mutate(sessionId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.session.id, data?.questions.length, sessionId]);

  const generateMutation = useMutation({
    mutationFn: generatePracticeQuestions,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["talent360-practice-session", sessionId] });
    },
    onError: (error) => {
      toast.error("Questions could not be generated", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    },
  });

  const scoreMutation = useMutation({
    mutationFn: async () => {
      const detail = query.data;
      if (!detail) throw new Error("The session is not loaded.");

      const answers = detail.questions
        .map((question) => ({
          position: question.position,
          answerText: (drafts[question.id] ?? question.answer_text ?? "").trim(),
        }))
        .filter((entry) => entry.answerText.length > 0);

      if (!answers.length) throw new Error("Answer at least one question first.");
      return scorePracticeAnswer(sessionId, answers);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["talent360-practice-session", sessionId] });
      toast.success("Answers scored", { description: "Check the feedback under each question." });
    },
    onError: (error) => {
      toast.error("Answers not scored", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    },
  });

  const finishMutation = useMutation({
    mutationFn: () => completePracticeSession(sessionId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["talent360-practice-session", sessionId] });
      await queryClient.invalidateQueries({ queryKey: ["talent360-practice-sessions"] });
      toast.success("Session complete", { description: "Here is your summary." });
    },
    onError: (error) => {
      toast.error("Session could not be finished", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    },
  });

  const canFinish = useMemo(
    () =>
      (query.data?.questions ?? []).some(
        (question) => question.feedbackParsed?.score !== null && question.feedbackParsed?.score !== undefined,
      ),
    [query.data],
  );

  if (query.isLoading) return <LoadingState label="Opening your practice session" />;

  if (query.error) {
    return (
      <ErrorState
        message={query.error instanceof Error ? query.error.message : "This session could not be loaded."}
        onRetry={() => void query.refetch()}
      />
    );
  }

  if (!data) {
    return (
      <ErrorState
        title="Session not available"
        message="This practice session is either not yours or no longer exists."
      />
    );
  }

  const { session, questions } = data;
  const answered = questions.filter((question) => (drafts[question.id] ?? question.answer_text ?? "").trim()).length;
  const scored = questions.filter((question) => question.feedbackParsed?.score !== null).length;
  const completed = session.status === "completed";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate("/app/practice")}>
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to interview prep
        </Button>
      </div>

      <PageHeader
        title={completed ? `${session.role_title} — completed` : `Practising for ${session.role_title}`}
        description={session.job_description ? "Tailored to the job description you provided." : undefined}
        statusLabel={`${answered} of ${session.question_count} answered · ${scored} scored`}
        actions={
          <>
            {!completed ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => scoreMutation.mutate()}
                  disabled={scoreMutation.isPending}
                >
                  {scoreMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Wand2 className="h-3.5 w-3.5" />
                  )}
                  Score my answers
                </Button>
                <Button size="sm" onClick={() => finishMutation.mutate()} disabled={finishMutation.isPending || !canFinish}>
                  {finishMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Award className="h-3.5 w-3.5" />}
                  Finish session
                </Button>
              </>
            ) : null}
          </>
        }
      />

      {/* Progress hairline */}
      <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${questions.length ? (answered / questions.length) * 100 : 0}%` }}
        />
      </div>

      {generateMutation.isPending || (questions.length === 0 && !completed) ? (
        <div className="talent-tile flex items-center justify-center gap-3 p-10">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-[13px] font-semibold text-muted-foreground">
            Writing your {session.question_count} questions…
          </span>
        </div>
      ) : null}

      {completed && session.overall_score !== null ? (
        <section className="talent-tile overflow-hidden p-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-[auto_1fr]">
            <div className="flex flex-col items-center justify-center gap-1 md:pr-6 md:border-r md:border-border">
              <span
                className={cn(
                  "flex h-24 w-24 items-center justify-center rounded-full text-[28px] font-bold",
                  session.overall_score >= 4
                    ? "bg-success-soft text-success-soft-foreground"
                    : session.overall_score >= 3
                      ? "bg-info-soft text-info-soft-foreground"
                      : "bg-warning-soft text-warning-soft-foreground",
                )}
              >
                {formatNumber(Number(session.overall_score), 1)}
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                out of 5
              </span>
            </div>

            <div className="flex flex-col gap-4">
              {session.summary && typeof session.summary === "object" ? (
                <SummaryBlock summary={session.summary as Record<string, unknown>} completedAt={session.completed_at} />
              ) : null}

              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={() => navigate("/app/practice")}>
                  <Plus className="h-3.5 w-3.5" />
                  New practice session
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/app/practice">View history</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {questions.length ? (
        <div className="flex flex-col gap-4">
          {questions.map((question, index) => {
            const draft = drafts[question.id] ?? question.answer_text ?? "";
            const feedback = question.feedbackParsed;

            return (
              <article key={question.id} className="talent-tile flex flex-col gap-3 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[12px] font-bold text-muted-foreground">
                    {question.position}
                  </span>
                  <StatusPill tone="primary">{question.category}</StatusPill>
                  {feedback?.score !== null && feedback?.score !== undefined ? (
                    <StatusPill tone={scoreTone(feedback.score)}>
                      {formatNumber(feedback.score, 1)} / 5
                    </StatusPill>
                  ) : null}
                </div>

                <h3 className="text-[15px] font-bold leading-snug text-foreground">{question.question_text}</h3>

                {question.rubric ? (
                  <p className="rounded-xl bg-muted/40 px-3 py-2 text-[11.5px] font-medium leading-relaxed text-muted-foreground">
                    <span className="font-bold text-foreground">What a strong answer covers:</span>{" "}
                    {question.rubric}
                  </p>
                ) : null}

                <Textarea
                  value={draft}
                  onChange={(event) => setDrafts((current) => ({ ...current, [question.id]: event.target.value }))}
                  placeholder="Type your answer as if you were in the interview…"
                  className="min-h-[110px]"
                />

                {feedback ? (
                  <div className="grid grid-cols-1 gap-3 border-t border-border pt-3 md:grid-cols-2">
                    {feedback.strengths.length ? (
                      <div>
                        <span className="talent-label">Strengths</span>
                        <ul className="mt-1.5 flex flex-col gap-1">
                          {feedback.strengths.map((point) => (
                            <li key={point} className="flex items-start gap-2 text-[12px] font-medium text-foreground">
                              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                              {point}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {feedback.improvements.length ? (
                      <div>
                        <span className="talent-label">Improve</span>
                        <ul className="mt-1.5 flex flex-col gap-1">
                          {feedback.improvements.map((point) => (
                            <li key={point} className="flex items-start gap-2 text-[12px] font-medium text-foreground">
                              <Target className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                              {point}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {feedback.sample_structure ? (
                      <div className="md:col-span-2">
                        <span className="talent-label">How a strong answer is structured</span>
                        <p className="mt-1.5 rounded-xl bg-muted/40 px-3 py-2 text-[12px] font-medium leading-relaxed text-muted-foreground">
                          {feedback.sample_structure}
                        </p>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                    <Lightbulb className="h-3.5 w-3.5" />
                    {index < questions.length - 1
                      ? "Answer, then score — feedback appears here."
                      : "Last one. Score your answers, then finish for the summary."}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      ) : null}

      {completed && session.summary === null ? (
        <EmptyState
          icon={<MicVocal className="h-5 w-5" />}
          title="Session marked complete"
          description="A summary could not be produced this time. You can review your scored answers above."
        />
      ) : null}
    </div>
  );
}

function SummaryBlock({ summary, completedAt }: { summary: Record<string, unknown>; completedAt: string | null }) {
  const strengths = Array.isArray(summary.strengths) ? summary.strengths.map(String) : [];
  const improvements = Array.isArray(summary.improvements) ? summary.improvements.map(String) : [];

  return (
    <>
      {typeof summary.summary === "string" && summary.summary ? (
        <p className="text-[13px] font-medium leading-relaxed text-muted-foreground">{summary.summary}</p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {strengths.length ? (
          <div>
            <div className="talent-label">What went well</div>
            <ul className="mt-1.5 flex flex-col gap-1.5">
              {strengths.map((point) => (
                <li key={point} className="flex items-start gap-2 text-[12px] font-medium text-foreground">
                  <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                  {point}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {improvements.length ? (
          <div>
            <div className="talent-label">Work on next</div>
            <ul className="mt-1.5 flex flex-col gap-1.5">
              {improvements.map((point) => (
                <li key={point} className="flex items-start gap-2 text-[12px] font-medium text-foreground">
                  <Target className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                  {point}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {typeof summary.recommendation === "string" && summary.recommendation ? (
        <div className="rounded-xl bg-primary-soft px-3 py-2.5">
          <span className="talent-label text-primary-soft-foreground">Coach's next step</span>
          <p className="mt-1 text-[12.5px] font-semibold leading-relaxed text-primary-soft-foreground">
            {summary.recommendation}
          </p>
        </div>
      ) : null}

      <p className="text-[10.5px] font-medium text-muted-foreground">
        Finished {completedAt ? formatRelative(completedAt) : "just now"}
      </p>
    </>
  );
}
