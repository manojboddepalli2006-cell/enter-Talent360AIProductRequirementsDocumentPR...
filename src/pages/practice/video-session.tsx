import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Award,
  Camera,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Mic,
  Plus,
  Sparkles,
  Square,
  Target,
  Volume2,
  XCircle,
} from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { StatusPill } from "@/components/common/status-pill";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ErrorState, LoadingState } from "@/components/common/states";
import {
  completePracticeSession,
  fetchPracticeSession,
  generatePracticeQuestions,
  scorePracticeAnswer,
  type PracticeSummary,
} from "@/lib/api/practice";
import { createTranscriber, RECOGNITION_SUPPORTED, speak, stopSpeaking, type Transcriber } from "@/lib/speech";
import { useMediaRecorder } from "@/hooks/use-media-recorder";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

type Verdict = "qualified" | "partially_qualified" | "not_qualified";

const VERDICT_META: Record<Verdict, { label: string; tone: "success" | "warning" | "danger" }> = {
  qualified: { label: "Qualified", tone: "success" },
  partially_qualified: { label: "Partially qualified", tone: "warning" },
  not_qualified: { label: "Not qualified", tone: "danger" },
};

function scoreTone(score: number | null): "success" | "info" | "warning" | "danger" | "neutral" {
  if (score === null) return "neutral";
  if (score >= 4) return "success";
  if (score >= 3) return "info";
  if (score >= 2) return "warning";
  return "danger";
}

function verdictOf(summary: unknown): Verdict {
  const record = (summary ?? {}) as PracticeSummary;
  if (record.verdict === "qualified" || record.verdict === "not_qualified") return record.verdict;
  return "partially_qualified";
}

/**
 * Guided video interview.
 *
 * Flow: the AI reads each question aloud → you record your answer on camera
 * (transcribed live) → Next question auto-scores the answer → the final question
 * finishes the interview and produces a Qualified / Not qualified verdict.
 */
export default function VideoPracticeSessionPage() {
  const { sessionId = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeIndex, setActiveIndex] = useState(0);
  const [answerDraft, setAnswerDraft] = useState("");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [liveInterim, setLiveInterim] = useState("");
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  // Stable, memoised recorder callbacks so effects never re-run from identity changes.
  const recorder = useMediaRecorder();
  const { status: cameraStatus, stream, blobUrl, elapsed, requestCamera, beginRecording, stopRecording } = recorder;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const transcriberRef = useRef<Transcriber | null>(null);
  const interimRef = useRef("");

  const query = useQuery({
    queryKey: ["talent360-practice-video", sessionId],
    queryFn: () => fetchPracticeSession(sessionId),
    enabled: Boolean(sessionId),
  });

  const data = query.data;

  // Mirror the live camera into the preview element.
  useEffect(() => {
    const video = videoRef.current;
    if (video && stream) {
      video.srcObject = stream;
      void video.play().catch(() => undefined);
    }
  }, [stream]);

  const ensureTranscriber = useCallback(() => {
    if (transcriberRef.current) return;
    transcriberRef.current = createTranscriber({
      onInterim: (text) => {
        interimRef.current = text;
        setLiveInterim(text);
      },
      onFinal: (text) => {
        setAnswerDraft((current) => `${current}${current ? " " : ""}${text}`.trim());
        interimRef.current = "";
        setLiveInterim("");
      },
      onEnd: () => undefined,
      onError: (message) => setTranscriptError(message),
    });
  }, []);

  const generateMutation = useMutation({
    mutationFn: generatePracticeQuestions,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["talent360-practice-video", sessionId] });
    },
    onError: (error) => {
      toast.error("Questions could not be generated", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    },
  });

  // Auto-generate the question set the first time the interview opens.
  useEffect(() => {
    if (data && data.session.status === "in_progress" && data.questions.length === 0 && !generateMutation.isPending) {
      generateMutation.mutate(sessionId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.session.id, data?.questions.length, sessionId]);

  // Load the active question's saved answer into the editor.
  const activeQuestion = data?.questions[activeIndex] ?? null;
  useEffect(() => {
    setAnswerDraft(activeQuestion?.answer_text ?? "");
    setLiveInterim("");
    interimRef.current = "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeQuestion?.id]);

  const commitInterim = useCallback(() => {
    if (interimRef.current.trim()) {
      setAnswerDraft((current) => `${current}${current ? " " : ""}${interimRef.current}`.trim());
      interimRef.current = "";
      setLiveInterim("");
    }
  }, []);

  const startRecording = () => {
    setTranscriptError(null);
    if (cameraStatus !== "ready") {
      void requestCamera();
      return;
    }
    ensureTranscriber();
    setCountdown(3);
  };

  // 3-2-1 countdown then record. Depends only on the stable `countdown` + stable
  // callback, so the timer never gets reset by a re-render.
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      beginRecording();
      transcriberRef.current?.start();
      setCountdown(null);
      return;
    }
    const timer = window.setTimeout(() => {
      setCountdown((value) => (value === null ? null : value - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [countdown, beginRecording]);

  const stopAnswer = () => {
    stopRecording();
    transcriberRef.current?.stop();
    commitInterim();
  };

  const currentAnswer = answerDraft.trim();

  const advance = async () => {
    if (!activeQuestion || !currentAnswer || analyzing) return;

    setAnalyzing(true);
    try {
      // Score this answer, then move on — the interview never stalls.
      await scorePracticeAnswer(sessionId, [
        { position: activeQuestion.position, answerText: currentAnswer },
      ]);
      await queryClient.invalidateQueries({ queryKey: ["talent360-practice-video", sessionId] });

      if (activeIndex >= (data?.questions.length ?? 1) - 1) {
        await finishMutation.mutateAsync();
      } else {
        setActiveIndex((index) => index + 1);
      }
    } catch (error) {
      toast.error("Your answer could not be analysed", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const finishMutation = useMutation({
    mutationFn: () => completePracticeSession(sessionId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["talent360-practice-video", sessionId] });
      await queryClient.invalidateQueries({ queryKey: ["talent360-practice-sessions"] });
      toast.success("Interview complete", { description: "Here is your verdict." });
    },
    onError: (error) => {
      toast.error("The interview could not be finished", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    },
  });

  // Stop the camera and speech engines when leaving the page.
  useEffect(() => {
    return () => {
      stopSpeaking();
      transcriberRef.current?.stop();
      recorder.reset();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (query.isLoading) return <LoadingState label="Setting up your video interview" />;

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
      <ErrorState title="Session not available" message="This practice session is not yours or no longer exists." />
    );
  }

  const { session, questions } = data;
  const completed = session.status === "completed";
  const question = activeQuestion;

  const startHearing = () => {
    if (question) speak(question.question_text);
  };

  const summary = (session.summary ?? {}) as unknown as PracticeSummary;
  const verdict = completed && summary.verdict ? verdictOf(session.summary) : null;
  const verdictMeta = verdict ? VERDICT_META[verdict] : null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate("/app/practice")}>
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to interview prep
        </Button>
        <StatusPill tone="accent">Video interview</StatusPill>
      </div>

      <PageHeader
        title={completed ? `${session.role_title} — verdict` : `Interviewing for ${session.role_title}`}
        description="The AI reads each question aloud, records your answers, and decides at the end whether you are qualified."
        statusLabel={completed ? `${questions.length} questions` : `Question ${activeIndex + 1} of ${questions.length}`}
        actions={
          !completed ? (
            <StatusPill tone={analyzing ? "warning" : "neutral"}>
              {analyzing ? "Analysing your answer…" : "Answer on camera"}
            </StatusPill>
          ) : null
        }
      />

      <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${questions.length ? ((activeIndex + (currentAnswer ? 1 : 0)) / questions.length) * 100 : 0}%` }}
        />
      </div>

      {/* ------------------------------------------------------------------ review */}
      {completed && verdict && verdictMeta ? (
        <section className="talent-tile overflow-hidden p-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-[auto_1fr]">
            <div className="flex flex-col items-center justify-center gap-2 md:border-r md:border-border md:pr-6">
              <StatusPill tone={verdictMeta.tone} className="px-3.5 py-1.5 text-[13px]">
                {verdictMeta.label}
              </StatusPill>
              <span className="text-[13px] font-extrabold text-foreground">
                {session.overall_score === null ? "—" : `${formatNumber(Number(session.overall_score), 1)} / 5`}
              </span>
              <span className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                overall score
              </span>
            </div>

            <div className="flex flex-col gap-4">
              {summary.summary ? (
                <p className="text-[13px] font-medium leading-relaxed text-muted-foreground">{summary.summary}</p>
              ) : null}
              {summary.verdict_reason ? (
                <p className="text-[12.5px] font-semibold leading-relaxed text-foreground">{summary.verdict_reason}</p>
              ) : null}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {(summary.right ?? []).length ? (
                  <div>
                    <div className="talent-label text-success-soft-foreground">What you got right</div>
                    <ul className="mt-1.5 flex flex-col gap-1.5">
                      {summary.right!.map((point) => (
                        <li key={point} className="flex items-start gap-2 text-[12px] font-medium text-foreground">
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {(summary.wrong ?? []).length ? (
                  <div>
                    <div className="talent-label text-destructive-soft-foreground">What held you back</div>
                    <ul className="mt-1.5 flex flex-col gap-1.5">
                      {summary.wrong!.map((point) => (
                        <li key={point} className="flex items-start gap-2 text-[12px] font-medium text-foreground">
                          <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>

              {(summary.strengths.length || summary.improvements.length) ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {summary.strengths.length ? (
                    <div>
                      <div className="talent-label">Strengths</div>
                      <ul className="mt-1.5 flex flex-col gap-1.5">
                        {summary.strengths.map((point) => (
                          <li key={point} className="flex items-start gap-2 text-[12px] font-medium text-foreground">
                            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                            {point}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {summary.improvements.length ? (
                    <div>
                      <div className="talent-label">Work on next</div>
                      <ul className="mt-1.5 flex flex-col gap-1.5">
                        {summary.improvements.map((point) => (
                          <li key={point} className="flex items-start gap-2 text-[12px] font-medium text-foreground">
                            <Target className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                            {point}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {summary.recommendation ? (
                <div className="rounded-xl bg-primary-soft px-3 py-2.5">
                  <span className="talent-label text-primary-soft-foreground">Coach's next step</span>
                  <p className="mt-1 text-[12.5px] font-semibold leading-relaxed text-primary-soft-foreground">
                    {summary.recommendation}
                  </p>
                </div>
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

      {/* ------------------------------------------------------------------ live */}
      {!completed && question ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_300px]">
          <div className="flex flex-col gap-4">
            {/* AI asks */}
            <section className="talent-tile flex flex-col gap-3 p-5">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-[12px] font-bold text-primary-foreground">
                  AI
                </span>
                <div>
                  <div className="text-[12px] font-bold text-foreground">The interviewer asks</div>
                  <div className="text-[10.5px] font-medium text-muted-foreground">
                    Question {activeIndex + 1} of {questions.length} · {question.category}
                  </div>
                </div>
                <Button variant="soft" size="icon-sm" className="ml-auto" onClick={startHearing} aria-label="Hear the question" title="Hear the question">
                  <Volume2 className="h-4 w-4" />
                </Button>
              </div>

              <p className="text-[16px] font-semibold leading-snug text-foreground">{question.question_text}</p>

              {question.rubric ? (
                <p className="rounded-xl bg-muted/40 px-3 py-2 text-[11.5px] font-medium leading-relaxed text-muted-foreground">
                  <span className="font-bold text-foreground">What a strong answer covers:</span> {question.rubric}
                </p>
              ) : null}
            </section>

            {/* Your turn */}
            <section className="talent-tile flex flex-col gap-3 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="talent-label">Your turn — record your answer</div>
                <span className="text-[11px] font-semibold text-muted-foreground">
                  {cameraStatus === "recording"
                    ? `${elapsed}s`
                    : cameraStatus === "recorded"
                      ? "Recording done"
                      : "Camera off"}
                </span>
              </div>

              <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
                {stream ? (
                  <video ref={videoRef} playsInline muted className="h-full w-full -scale-x-100 object-cover" />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-6 text-center text-white/70">
                    <Camera className="h-7 w-7" />
                    <span className="text-[12px] font-medium">
                      {cameraStatus === "requesting"
                        ? "Requesting camera…"
                        : cameraStatus === "denied" || cameraStatus === "unsupported"
                          ? recorder.error
                          : "Enable your camera to answer on video — or simply type below."}
                    </span>
                  </div>
                )}

                {cameraStatus === "recording" ? (
                  <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-destructive px-2.5 py-1 text-[10.5px] font-bold text-destructive-foreground">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                    REC
                  </span>
                ) : null}

                {countdown !== null ? (
                  <span className="absolute inset-0 flex items-center justify-center text-[64px] font-extrabold text-white drop-shadow">
                    {countdown}
                  </span>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {cameraStatus === "recording" ? (
                  <Button size="sm" variant="destructive" onClick={stopAnswer}>
                    <Square className="h-3.5 w-3.5" />
                    Stop recording
                  </Button>
                ) : cameraStatus === "recorded" ? (
                  <Button size="sm" onClick={startRecording}>
                    <Mic className="h-3.5 w-3.5" />
                    Record again
                  </Button>
                ) : (
                  <Button size="sm" onClick={startRecording} disabled={cameraStatus === "requesting"}>
                    <Mic className="h-3.5 w-3.5" />
                    {cameraStatus === "ready" ? "Start recording" : "Enable camera"}
                  </Button>
                )}
                <Button size="sm" variant="soft" onClick={startHearing}>
                  <Volume2 className="h-3.5 w-3.5" />
                  Hear question
                </Button>
              </div>

              {recorder.error ? (
                <p className="rounded-xl bg-destructive-soft px-3 py-2 text-[11.5px] font-semibold text-destructive-soft-foreground">
                  {recorder.error}
                </p>
              ) : null}

              {blobUrl && cameraStatus === "recorded" ? (
                <video src={blobUrl} controls playsInline className="w-full rounded-xl border border-border" />
              ) : null}
            </section>

            {/* Transcript */}
            <section className="talent-tile flex flex-col gap-2 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="talent-label">Your answer</div>
                {RECOGNITION_SUPPORTED ? (
                  <StatusPill tone={cameraStatus === "recording" ? "danger" : "neutral"}>
                    {cameraStatus === "recording" ? "Listening…" : "Voice capture"}
                  </StatusPill>
                ) : (
                  <StatusPill tone="warning">Type manually</StatusPill>
                )}
              </div>

              {liveInterim ? (
                <p className="rounded-xl bg-primary-soft/50 px-3 py-2 text-[12px] font-medium italic leading-relaxed text-muted-foreground">
                  {liveInterim}
                </p>
              ) : null}

              <Textarea
                value={answerDraft}
                onChange={(event) => setAnswerDraft(event.target.value)}
                placeholder={
                  RECOGNITION_SUPPORTED
                    ? "Your spoken words appear here as you talk. You can also edit."
                    : "Voice capture is not supported here — type your answer."
                }
                className="min-h-[100px]"
              />

              {transcriptError ? (
                <p className="text-[11px] font-semibold text-warning-soft-foreground">{transcriptError}</p>
              ) : null}

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Button
                  size="sm"
                  className="ml-auto"
                  onClick={() => void advance()}
                  disabled={!currentAnswer || analyzing}
                >
                  {analyzing ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Analysing answer…
                    </>
                  ) : activeIndex >= questions.length - 1 ? (
                    <>
                      <Award className="h-3.5 w-3.5" />
                      Finish interview
                    </>
                  ) : (
                    <>
                      Next question
                      <ChevronRight className="h-3.5 w-3.5" />
                    </>
                  )}
                </Button>
              </div>
              <p className="text-[10.5px] font-medium text-muted-foreground">
                Your answer is scored automatically when you continue. The verdict comes at the end.
              </p>
            </section>
          </div>

          {/* Progress rail */}
          <aside className="flex flex-col gap-4">
            <div className="talent-tile flex flex-col gap-2 p-4 xl:sticky xl:top-20">
              <div className="talent-label">Interview progress</div>
              <ul className="mt-1 flex flex-col gap-1.5">
                {questions.map((item, index) => {
                  const hasAnswer = (item.answer_text ?? "").trim().length > 0;
                  const isScored = item.feedbackParsed?.score !== null;
                  const active = index === activeIndex;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => setActiveIndex(index)}
                        className={cn(
                          "flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2 text-left transition-colors",
                          active ? "bg-muted" : "hover:bg-muted/50",
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                            isScored
                              ? "bg-success-soft text-success-soft-foreground"
                              : hasAnswer
                                ? "bg-info-soft text-info-soft-foreground"
                                : "bg-muted text-muted-foreground",
                          )}
                        >
                          {isScored ? <CheckCircle2 className="h-3 w-3" /> : item.position}
                        </span>
                        <span
                          className={cn(
                            "truncate text-[12px] font-semibold",
                            active ? "text-foreground" : "text-muted-foreground",
                          )}
                        >
                          {item.category}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>

              <div className="mt-2 border-t border-border pt-3">
                <p className="text-[11px] font-medium leading-relaxed text-muted-foreground">
                  Answer every question to get your verdict and a breakdown of what you got right and wrong.
                </p>
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      {!completed && !questions.length ? (
        <div className="talent-tile flex items-center justify-center gap-3 p-10">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-[13px] font-semibold text-muted-foreground">
            The interviewer is writing your questions…
          </span>
        </div>
      ) : null}

      {/* Per-answer review on completed sessions */}
      {completed && verdict ? (
        <section className="flex flex-col gap-3">
          <div className="talent-label">Review your answers</div>
          {questions.map((item) => {
            const feedback = item.feedbackParsed;
            return (
              <article key={item.id} className="talent-tile flex flex-col gap-3 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[12px] font-bold text-muted-foreground">
                    {item.position}
                  </span>
                  <StatusPill tone="primary">{item.category}</StatusPill>
                  {feedback?.score !== null && feedback?.score !== undefined ? (
                    <StatusPill tone={scoreTone(feedback.score)}>{formatNumber(feedback.score, 1)} / 5</StatusPill>
                  ) : null}
                </div>
                <h3 className="text-[15px] font-bold leading-snug text-foreground">{item.question_text}</h3>
                <div className="rounded-xl bg-muted/40 px-3 py-2">
                  <span className="talent-label">Your spoken answer</span>
                  <p className="mt-1 whitespace-pre-wrap text-[12.5px] font-medium leading-relaxed text-foreground">
                    {item.answer_text || "No answer was recorded for this question."}
                  </p>
                </div>
                {feedback ? (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
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
                ) : null}
              </article>
            );
          })}
        </section>
      ) : null}

      {completed && !verdict ? (
        <ErrorState
          title="No verdict produced"
          message="This session was completed without a verdict summary. Start a new practice session to get one."
        />
      ) : null}
    </div>
  );
}
