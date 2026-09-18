import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-session-id",
};

const AI_API_TOKEN = Deno.env.get("AI_API_TOKEN_1a0a9a967ce7");
const API_BASE = "https://api.enter.pro";
const PROJECT_ID = "1a0a9a967ce742bbb298dcff38eb421b";
const MODEL = "alibaba/qwen-3.7-plus";

const NL = String.fromCharCode(10);
const QUOTE = 34;
const BACKSLASH = 92;
const LBRACE = 123;
const RBRACE = 125;

function num(value: unknown): number | null {
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return null;
}

function extractJson(raw: string): Record<string, unknown> | null {
  const start = raw.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < raw.length; index += 1) {
    const code = raw.charCodeAt(index);
    if (escaped) { escaped = false; continue; }
    if (code === BACKSLASH) { escaped = true; continue; }
    if (code === QUOTE) { inString = !inString; continue; }
    if (inString) continue;
    if (code === LBRACE) depth += 1;
    if (code === RBRACE) {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(raw.slice(start, index + 1)) as Record<string, unknown>;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

async function callModel(system: string, user: string, sessionId: string) {
  if (!AI_API_TOKEN) throw new Error("The AI API token is not configured for this project.");

  const response = await fetch(`${API_BASE}/code/api/v1/ai/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${AI_API_TOKEN}`,
      "Content-Type": "application/json",
      "X-Session-ID": sessionId,
      "X-Enter-Project-ID": PROJECT_ID,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      stream: false,
      temperature: 0.35,
      max_tokens: 1500,
    }),
  });

  const raw = await response.text();
  if (!response.ok) {
    let message = `AI request failed with status ${response.status}`;
    try {
      const parsed = JSON.parse(raw) as { error?: { message?: string } };
      if (parsed.error?.message) message = parsed.error.message;
    } catch {
      // Non-JSON body: keep the status-based message.
    }
    throw new Error(message);
  }

  const payload = JSON.parse(raw) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  };

  return {
    text: payload.choices?.[0]?.message?.content ?? "",
    promptTokens: payload.usage?.prompt_tokens ?? 0,
    completionTokens: payload.usage?.completion_tokens ?? 0,
    totalTokens: payload.usage?.total_tokens ?? 0,
  };
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item)).filter((item) => item.length > 1);
}

const GENERATE_SYSTEM = [
  "You are the interview coach inside Talent360 AI. You write realistic interview questions for a person practising for a specific role.",
  "Rules:",
  "- Questions must probe evidence of past work: ask for a concrete example and the outcome, not a hypothetical self-rating.",
  "- Mix the requested focus areas evenly, and phrase each question so it can be answered in a text conversation.",
  "- Never ask about protected attributes, family plans, health, or anything unrelated to the role.",
  "- Each question carries the rubric a reviewer would use to judge the answer.",
  "Return ONLY JSON in exactly this shape:",
  '{"questions": [{"question_text": string, "category": "Technical Knowledge" | "Problem Solving" | "Behavioral" | "Communication" | "Role Fit", "rubric": string}]}',
].join(NL);

const FEEDBACK_SYSTEM = [
  "You are an interview coach giving feedback on a practice answer.",
  "Rules:",
  "- Score only what the answer actually contains. A short or vague answer scores low even if the topic is easy.",
  "- Reserve score 1 for answers that are off-topic, empty or a refusal. A genuine attempt with real examples belongs at 3 or above.",
  "- Write strengths and improvements so the candidate can act on them, and keep each point to one sentence.",
  "- sample_structure is a brief outline of what a strong answer would have covered.",
  "Return ONLY JSON in exactly this shape:",
  '{"score": 1-5 number, "strengths": [string], "improvements": [string], "sample_structure": string}',
].join(NL);

const COMPLETE_SYSTEM = [
  "You summarise a completed practice interview for the candidate.",
  "You receive every question, its rubric score and the feedback given.",
  "Rules:",
  "- Write an encouraging but honest summary, 2-3 sentences.",
  "- strengths and improvements must each be 3-5 concrete points drawn from the feedback.",
  "- recommendation is one sentence about what to work on next.",
  "Return ONLY JSON in exactly this shape:",
  '{"summary": string, "strengths": [string], "improvements": [string], "recommendation": string}',
].join(NL);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startedAt = Date.now();

  try {
    const sessionId = req.headers.get("X-Session-ID")?.trim() || crypto.randomUUID();
    const body = (await req.json()) as {
      action?: string;
      sessionId?: string;
      roleTitle?: string;
      jobDescription?: string;
      focusAreas?: string[];
      questionCount?: number;
      answers?: Array<{ position: number; answerText?: string }>;
    };

    const action = body.action === "feedback" || body.action === "complete" ? body.action : "generate";
    if (!body.sessionId) throw new Error("sessionId is required.");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
    );

    const { data: session, error: sessionError } = await supabase
      .from("talent_practice_sessions")
      .select("id, org_id, role_title, job_description, focus_areas, question_count, status")
      .eq("id", body.sessionId)
      .maybeSingle();

    if (sessionError) throw new Error(sessionError.message);
    if (!session) throw new Error("That practice session is not visible to you, or it no longer exists.");

    const orgId = session.org_id;
    let promptTokens = 0;
    let completionTokens = 0;
    let totalTokens = 0;

    const recordUsage = async () => {
      await supabase.from("talent_ai_usage").insert({
        org_id: orgId,
        function_name: "talent-ai-practice",
        provider: "qwen",
        model: MODEL,
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: totalTokens,
        cost_estimate: Number((totalTokens * 0.0000004).toFixed(6)),
        status: "success",
        latency_ms: Date.now() - startedAt,
      });
    };

    if (action === "generate") {
      // Respect the count chosen when the session was created.
      const count = Math.max(3, Math.min(8, body.questionCount ?? session.question_count ?? 5));
      const focusAreas = Array.isArray(body.focusAreas) && body.focusAreas.length
        ? body.focusAreas
        : ["Behavioral", "Problem Solving"];

      const userPrompt = [
        `ROLE: ${session.role_title || body.roleTitle || "General professional"}`,
        session.job_description
          ? `JOB DESCRIPTION: ${session.job_description.slice(0, 4000)}`
          : "JOB DESCRIPTION: Not provided — tailor to the role title above.",
        `FOCUS AREAS: ${focusAreas.join(", ")}`,
        `Produce exactly ${count} questions, spread evenly across the focus areas.`,
      ].join(NL);

      const aiResult = await callModel(GENERATE_SYSTEM, userPrompt, sessionId);
      promptTokens += aiResult.promptTokens;
      completionTokens += aiResult.completionTokens;
      totalTokens += aiResult.totalTokens;

      const parsed = extractJson(aiResult.text);
      const questions = Array.isArray(parsed?.questions) ? parsed.questions : [];

      if (!questions.length) throw new Error("The model did not return any usable questions.");

      const rows = questions.slice(0, 8).map((question, index) => {
        const item = question as { question_text?: string; category?: string; rubric?: string };
        return {
          org_id: orgId,
          session_id: session.id,
          position: index + 1,
          question_text: String(item.question_text ?? "Question"),
          category: String(item.category ?? "Behavioral"),
          rubric: item.rubric ? String(item.rubric) : null,
        };
      });

      const { error: questionError } = await supabase.from("talent_practice_questions").insert(rows);
      if (questionError) throw new Error(questionError.message);

      const { error: sessionUpdateError } = await supabase
        .from("talent_practice_sessions")
        .update({ question_count: rows.length })
        .eq("id", session.id);
      if (sessionUpdateError) throw new Error(sessionUpdateError.message);

      await recordUsage();
      return new Response(JSON.stringify({ ok: true, action, questions: rows.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: questions, error: questionsError } = await supabase
      .from("talent_practice_questions")
      .select("id, position, question_text, category, rubric, answer_text, feedback")
      .eq("session_id", session.id)
      .order("position");

    if (questionsError) throw new Error(questionsError.message);

    if (action === "feedback") {
      const answers = new Map<number, string>();
      (body.answers ?? []).forEach((entry) => {
        if (entry.answerText?.trim()) answers.set(entry.position, entry.answerText.trim());
      });

      const pending = (questions ?? []).filter((question) => answers.has(question.position));
      if (!pending.length) throw new Error("No answers were provided to score.");

      const results: Array<{ position: number; feedback: Record<string, unknown> | null }> = [];

      for (const question of pending) {
        const userPrompt = [
          `QUESTION (${question.category}): ${question.question_text}`,
          `RUBRIC: ${question.rubric ?? "Judge on substance, clarity and evidence."}`,
          `CANDIDATE ANSWER: ${answers.get(question.position)}`,
        ].join(NL);

        const aiResult = await callModel(FEEDBACK_SYSTEM, userPrompt, sessionId);
        promptTokens += aiResult.promptTokens;
        completionTokens += aiResult.completionTokens;
        totalTokens += aiResult.totalTokens;

        const parsed = extractJson(aiResult.text);
        const score = num(parsed?.score);

        const feedback = {
          score,
          strengths: asStringArray(parsed?.strengths),
          improvements: asStringArray(parsed?.improvements),
          sample_structure: typeof parsed?.sample_structure === "string" ? parsed.sample_structure : "",
        };

        const { error: updateError } = await supabase
          .from("talent_practice_questions")
          .update({
            answer_text: answers.get(question.position),
            feedback,
            scored_at: new Date().toISOString(),
          })
          .eq("id", question.id);
        if (updateError) throw new Error(updateError.message);

        results.push({ position: question.position, feedback });
      }

      await recordUsage();
      return new Response(JSON.stringify({ ok: true, action, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---------------------------------------------------------------- complete
    const scored = (questions ?? []).filter((question) => question.feedback !== null);

    if (!scored.length) throw new Error("Score at least one answer before finishing the session.");

    const userPrompt = [
      "Practice session summary.",
      JSON.stringify(
        scored.map((question) => ({
          position: question.position,
          category: question.category,
          question: question.question_text,
          score: (question.feedback as { score?: number })?.score ?? null,
          feedback: (question.feedback as { strengths?: string[]; improvements?: string[] }) ?? {},
        })),
        null,
        0,
      ),
    ].join(NL);

    const aiResult = await callModel(COMPLETE_SYSTEM, userPrompt, sessionId);
    promptTokens += aiResult.promptTokens;
    completionTokens += aiResult.completionTokens;
    totalTokens += aiResult.totalTokens;

    const parsed = extractJson(aiResult.text);
    const scores = scored
      .map((question) => (question.feedback as { score?: number | null })?.score ?? null)
      .filter((value): value is number => typeof value === "number");

    const overall = scores.length
      ? Number((scores.reduce((sum, value) => sum + value, 0) / scores.length).toFixed(1))
      : null;

    const summary = {
      summary: typeof parsed?.summary === "string" ? parsed.summary : "",
      strengths: asStringArray(parsed?.strengths),
      improvements: asStringArray(parsed?.improvements),
      recommendation: typeof parsed?.recommendation === "string" ? parsed.recommendation : "",
    };

    const { error: completeError } = await supabase
      .from("talent_practice_sessions")
      .update({
        status: "completed",
        overall_score: overall,
        summary,
        completed_at: new Date().toISOString(),
      })
      .eq("id", session.id);
    if (completeError) throw new Error(completeError.message);

    await recordUsage();

    await supabase.from("talent_audit_log").insert({
      org_id: orgId,
      action: "practice.session_completed",
      entity_type: "practice_session",
      entity_id: session.id,
      metadata: { role_title: session.role_title, overall_score: overall, model: MODEL },
    });

    return new Response(JSON.stringify({ ok: true, action, overall_score: overall, summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The practice session request failed.";
    console.error("talent-ai-practice failed", message);
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
