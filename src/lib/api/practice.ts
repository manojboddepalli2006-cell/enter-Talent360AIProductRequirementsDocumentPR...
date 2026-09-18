import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type PracticeSession = Database["public"]["Tables"]["talent_practice_sessions"]["Row"];
export type PracticeQuestion = Database["public"]["Tables"]["talent_practice_questions"]["Row"];

export interface PracticeSessionWithMeta extends PracticeSession {
  answeredCount: number;
}

export interface PracticeQuestionWithMeta extends PracticeQuestion {
  feedbackParsed: {
    score: number | null;
    strengths: string[];
    improvements: string[];
    sample_structure: string;
  } | null;
}

const SESSION_SELECT =
  "*, questions:talent_practice_questions(id, position, answer_text, feedback)";

export async function listSessions(): Promise<PracticeSessionWithMeta[]> {
  const { data, error } = await supabase
    .from("talent_practice_sessions")
    .select(SESSION_SELECT)
    .order("started_at", { ascending: false })
    .limit(100);

  if (error) throw new Error(error.message);

  return ((data ?? []) as unknown as Array<PracticeSession & { questions: Array<{ answer_text: string | null }> }>).map(
    (row) => ({
      ...row,
      answeredCount: (row.questions ?? []).filter((question) => question.answer_text?.trim()).length,
    }),
  );
}

export interface PracticeSummary {
  summary: string;
  verdict?: "qualified" | "partially_qualified" | "not_qualified";
  verdict_reason?: string;
  right?: string[];
  wrong?: string[];
  strengths: string[];
  improvements: string[];
  recommendation: string;
}

export async function createPracticeSession(input: {
  roleTitle: string;
  jobDescription?: string;
  focusAreas: string[];
  questionCount: number;
  mode: "text" | "video";
  userId: string | null;
  orgId: string;
}): Promise<string> {
  const { data, error } = await supabase
    .from("talent_practice_sessions")
    .insert({
      org_id: input.orgId,
      user_id: input.userId,
      role_title: input.roleTitle.trim(),
      job_description: input.jobDescription?.trim() || null,
      focus_areas: input.focusAreas,
      question_count: input.questionCount,
      mode: input.mode,
      status: "in_progress",
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return data.id;
}

export async function fetchPracticeSession(sessionId: string): Promise<{
  session: PracticeSessionWithMeta;
  questions: PracticeQuestionWithMeta[];
} | null> {
  const { data: session, error: sessionError } = await supabase
    .from("talent_practice_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError) throw new Error(sessionError.message);
  if (!session) return null;

  const { data: questions, error: questionsError } = await supabase
    .from("talent_practice_questions")
    .select("*")
    .eq("session_id", sessionId)
    .order("position");

  if (questionsError) throw new Error(questionsError.message);

  return {
    session: {
      ...session,
      answeredCount: ((questions ?? []) as PracticeQuestion[]).filter(
        (question) => question.answer_text?.trim(),
      ).length,
    },
    questions: ((questions ?? []) as PracticeQuestion[]).map((question) => ({
      ...question,
      feedbackParsed: parseFeedback(question.feedback),
    })),
  };
}

export function parseFeedback(value: unknown): PracticeQuestionWithMeta["feedbackParsed"] {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  return {
    score: typeof record.score === "number" ? record.score : null,
    strengths: Array.isArray(record.strengths) ? record.strengths.map(String) : [],
    improvements: Array.isArray(record.improvements) ? record.improvements.map(String) : [],
    sample_structure: typeof record.sample_structure === "string" ? record.sample_structure : "",
  };
}

interface PracticeResult {
  ok?: boolean;
  error?: string;
  overall_score?: number | null;
  results?: Array<{ position: number; feedback: unknown }>;
  summary?: unknown;
}

async function invokePractice(body: Record<string, unknown>): Promise<PracticeResult> {
  const { data, error } = await supabase.functions.invoke("talent-ai-practice", {
    body,
    headers: { "Content-Type": "application/json" },
  });
  if (error) throw new Error(error.message);
  const result = data as PracticeResult | null;
  if (result?.error || result?.ok === false) throw new Error(result.error ?? "The practice request failed.");
  return result ?? { ok: true };
}

export async function generatePracticeQuestions(sessionId: string): Promise<void> {
  await invokePractice({ action: "generate", sessionId });
}

export async function scorePracticeAnswer(
  sessionId: string,
  answers: Array<{ position: number; answerText: string }>,
): Promise<PracticeResult> {
  return invokePractice({ action: "feedback", sessionId, answers });
}

export async function completePracticeSession(sessionId: string): Promise<PracticeResult> {
  return invokePractice({ action: "complete", sessionId });
}

export async function deletePracticeSession(sessionId: string): Promise<void> {
  const { error } = await supabase.from("talent_practice_sessions").delete().eq("id", sessionId);
  if (error) throw new Error(error.message);
}

export async function listOrgPracticeStats(): Promise<{ sessions: number; completed: number; avgScore: number | null }> {
  const { data, error } = await supabase
    .from("talent_practice_sessions")
    .select("status, overall_score");

  if (error) throw new Error(error.message);

  const sessions = data ?? [];
  const completed = sessions.filter((session) => session.status === "completed");
  const scores = completed
    .map((session) => (typeof session.overall_score === "number" ? session.overall_score : null))
    .filter((value): value is number => value !== null);

  return {
    sessions: sessions.length,
    completed: completed.length,
    avgScore: scores.length
      ? Math.round((scores.reduce((sum, value) => sum + value, 0) / scores.length) * 10) / 10
      : null,
  };
}
