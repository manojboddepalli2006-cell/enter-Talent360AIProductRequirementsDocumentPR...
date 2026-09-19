import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, ArrowRight, Briefcase, CheckCircle2, Loader2, Lock, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusPill } from "@/components/common/status-pill";
import { PIPELINE_STAGES, STAGE_TONE } from "@/lib/domain";
import { formatDate } from "@/lib/format";

interface PortalQuestion {
  id: string;
  position: number;
  question_text: string;
  category: string;
}

interface PortalInterview {
  id: string;
  interview_type: string;
  status: string;
  questions: PortalQuestion[];
  responses: Array<{ id: string; question_id: string; response_text: string }>;
}

interface PortalApplication {
  id: string;
  stage: string;
  status: string;
  created_at: string;
  ai_match_score: number | null;
  job: { title: string | null; location: string | null; seniority: string | null } | null;
  interviews: PortalInterview[];
}

interface PortalPayload {
  ok: boolean;
  error?: string;
  candidate?: { full_name: string; email: string; location: string | null };
  applications?: PortalApplication[];
}

export default function PortalPage() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<PortalPayload | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const lookup = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const { data, error: invokeError } = await supabase.functions.invoke("talent-portal", {
      body: { action: "lookup", email: email.trim(), code: code.trim() },
      headers: { "Content-Type": "application/json" },
    });

    setLoading(false);
    if (invokeError) {
      setError(invokeError.message);
      return;
    }

    const result = data as PortalPayload;
    if (!result.ok) {
      setError(result.error ?? "Sign-in failed.");
      return;
    }
    setPayload(result);
  };

  const saveAnswer = async (questionId: string, responseText: string) => {
    setSaving(questionId);
    setError(null);
    const { data, error: invokeError } = await supabase.functions.invoke("talent-portal", {
      body: { action: "save-answer", email: email.trim(), code: code.trim(), questionId, responseText },
      headers: { "Content-Type": "application/json" },
    });
    setSaving(null);

    if (invokeError || !(data as { ok?: boolean })?.ok) {
      setError(((data as { error?: string })?.error) ?? invokeError?.message ?? "Your answer could not be saved.");
      return;
    }
    setDrafts((current) => ({ ...current, [questionId]: "" }));
  };

  const existingResponse = (questionId: string, interviews: PortalInterview[]): string => {
    for (const interview of interviews) {
      const match = interview.responses.find((response) => response.question_id === questionId);
      if (match) return match.response_text;
    }
    return "";
  };

  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-2xl">
        {/* Brand */}
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-primary text-[14px] font-bold text-primary-foreground">
            T3
          </span>
          <h1 className="text-[22px] font-bold tracking-tight text-foreground">Candidate portal</h1>
          <p className="max-w-md text-[13px] font-medium leading-relaxed text-muted-foreground">
            Track your application and answer your interview questions. Use the email you applied with and the
            portal code your recruiter shared with you.
          </p>
        </div>

        {error ? (
          <div className="mb-4 flex items-start gap-2 rounded-xl bg-destructive-soft px-3 py-2.5 text-destructive-soft-foreground">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="text-[12.5px] font-semibold leading-snug">{error}</span>
          </div>
        ) : null}

        {!payload ? (
          <form onSubmit={lookup} className="talent-tile flex flex-col gap-4 p-6 sm:p-8">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="portalEmail">Email you applied with</Label>
              <Input
                id="portalEmail"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="portalCode">Portal code</Label>
              <Input
                id="portalCode"
                required
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="e.g. a1b2c3d4e5"
                className="font-mono"
              />
              <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                <Lock className="h-3 w-3" />
                Your recruiter shares this code with you. It is your scoped access to this portal.
              </span>
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              View my application
            </Button>
          </form>
        ) : (
          <div className="flex flex-col gap-5">
            <div className="talent-tile p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="talent-label">Welcome</div>
                  <div className="text-[17px] font-bold text-foreground">{payload.candidate?.full_name}</div>
                  <div className="text-[12px] font-medium text-muted-foreground">{payload.candidate?.email}</div>
                </div>
                <Button variant="soft" size="sm" onClick={() => { setPayload(null); setDrafts({}); }}>
                  Sign out
                </Button>
              </div>
            </div>

            {(payload.applications ?? []).map((application) => (
              <section key={application.id} className="talent-tile flex flex-col gap-4 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-primary" />
                      <h2 className="truncate text-[16px] font-bold text-foreground">
                        {application.job?.title ?? "Application"}
                      </h2>
                    </div>
                    <p className="mt-0.5 text-[12px] font-medium text-muted-foreground">
                      {[application.job?.location, application.job?.seniority, formatDate(application.created_at)]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <StatusPill tone={STAGE_TONE[application.stage] ?? "neutral"}>
                    {PIPELINE_STAGES.find((stage) => stage.key === application.stage)?.label ??
                      application.stage}
                  </StatusPill>
                </div>

                {/* Stage timeline */}
                <div className="flex items-center gap-1.5">
                  {PIPELINE_STAGES.filter((stage) => stage.key !== "hold" && stage.key !== "rejected").map(
                    (stage, index, list) => {
                      const currentIndex = list.findIndex(
                        (item) => item.key === application.stage || (application.stage === "rejected" && item.key === "sourced"),
                      );
                      const reached =
                        application.stage === "rejected" || application.stage === "hired"
                          ? index < list.length
                          : index <= currentIndex && currentIndex !== -1;
                      return (
                        <div key={stage.key} className="flex flex-1 flex-col items-center gap-1">
                          <span
                            className={
                              reached
                                ? "flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground"
                                : "flex h-6 w-6 items-center justify-center rounded-full bg-muted text-muted-foreground"
                            }
                          >
                            {reached ? <CheckCircle2 className="h-3.5 w-3.5" /> : <span className="text-[10px] font-bold">{index + 1}</span>}
                          </span>
                          <span
                            className={
                              reached ? "text-[10px] font-bold text-primary" : "text-[10px] font-medium text-muted-foreground"
                            }
                          >
                            {stage.label}
                          </span>
                        </div>
                      );
                    },
                  )}
                </div>

                {/* Interview questions */}
                {application.interviews.length ? (
                  <div className="border-t border-border pt-4">
                    <div className="talent-label">Your interview</div>
                    {application.interviews.map((interview) => (
                      <div key={interview.id} className="mt-3 flex flex-col gap-3">
                        <StatusPill tone="neutral">
                          {interview.interview_type} interview · {interview.status.replace(/_/g, " ")}
                        </StatusPill>
                        {interview.questions.map((question) => {
                          const saved = existingResponse(question.id, application.interviews);
                          const draft = drafts[question.id] ?? "";
                          return (
                            <div key={question.id} className="flex flex-col gap-2 rounded-xl border border-border p-3">
                              <div className="flex items-start gap-2">
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-bold text-muted-foreground">
                                  {question.position}
                                </span>
                                <div>
                                  <div className="text-[12.5px] font-semibold text-foreground">
                                    {question.question_text}
                                  </div>
                                  <div className="text-[10.5px] font-medium text-muted-foreground">
                                    {question.category}
                                  </div>
                                </div>
                              </div>
                              {saved ? (
                                <div className="rounded-lg bg-muted/40 px-3 py-2">
                                  <span className="talent-label">Your saved answer</span>
                                  <p className="mt-1 whitespace-pre-wrap text-[12px] font-medium leading-relaxed text-foreground">
                                    {saved}
                                  </p>
                                </div>
                              ) : null}
                              <div className="flex flex-col gap-2">
                                <Textarea
                                  value={draft}
                                  onChange={(event) =>
                                    setDrafts((current) => ({ ...current, [question.id]: event.target.value }))
                                  }
                                  placeholder={saved ? "Edit your answer…" : "Type your answer…"}
                                  className="min-h-[90px]"
                                />
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="self-end"
                                  disabled={!draft.trim() || saving === question.id}
                                  onClick={() => void saveAnswer(question.id, draft.trim())}
                                >
                                  {saving === question.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Save className="h-3.5 w-3.5" />
                                  )}
                                  {saved ? "Update answer" : "Save answer"}
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                ) : null}
              </section>
            ))}

            <p className="text-center text-[11.5px] font-medium text-muted-foreground">
              Answers you save are reviewed by the hiring team. <Link to="/" className="font-bold text-primary hover:underline">Back to Talent360 AI</Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
