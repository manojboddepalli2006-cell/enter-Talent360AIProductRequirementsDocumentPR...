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
const NL2 = NL + NL;
const QUOTE = 34;
const BACKSLASH = 92;
const LBRACE = 123;
const RBRACE = 125;

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
      temperature: 0.3,
      max_tokens: 2000,
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

// Models sometimes return numbers as strings ("0.8"). Coerce rather than discarding
// the value and rendering "no confidence estimate" on every card.
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
    if (escaped) {
      escaped = false;
      continue;
    }
    if (code === BACKSLASH) {
      escaped = true;
      continue;
    }
    if (code === QUOTE) {
      inString = !inString;
      continue;
    }
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

const QUESTION_SYSTEM = [
  "You design structured interview questions for Talent360 AI, a workforce platform used by HR and hiring managers.",
  "Rules:",
  "- Questions must be answerable in a text conversation and must probe evidence of past work, not hypothetical self-description alone.",
  "- Mix technical, problem-solving and communication probes as instructed.",
  "- Never ask about protected attributes, family plans, health, or any personal circumstance unrelated to the role.",
  "- Each question carries the rubric a human would use to judge the answer.",
  "Return ONLY JSON in exactly this shape:",
  '{"questions": [{"question_text": string, "category": "Technical Knowledge" | "Problem Solving" | "Communication" | "Role Fit", "rubric": string describing what a strong, adequate and weak answer looks like}]}',
].join(NL);

const EVALUATION_SYSTEM = [
  "You evaluate interview responses for Talent360 AI. A human makes the hiring decision; you produce auditable rubric scores.",
  "Rules:",
  "- Score only what the response actually contains. Do not assume the candidate knows something they did not demonstrate.",
  "- A short or evasive answer scores low even if the topic is easy.",
  "- Write each rationale so a reviewer can see exactly which part of the answer drove the score.",
  "- Set requires_human_review true whenever the outcome is borderline, inconsistent across criteria, or would move a candidate toward rejection.",
  "Return ONLY JSON in exactly this shape:",
  '{"responses": [{"position": number, "score": 1-5 number, "criterion": string, "rationale": string}], "overall_score": 1-5 number, "summary": string, "recommendation": string, "requires_human_review": boolean, "confidence": 0-1 number}',
].join(NL);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startedAt = Date.now();

  try {
    const sessionId = req.headers.get("X-Session-ID")?.trim() || crypto.randomUUID();
    const body = (await req.json()) as { interviewId?: string; action?: string };
    const interviewId = body.interviewId;
    const action = body.action === "evaluate" ? "evaluate" : "generate";

    if (!interviewId) throw new Error("interviewId is required.");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
    );

    const { data: interview, error: interviewError } = await supabase
      .from("talent_interviews")
      .select("id, org_id, interview_type, application:talent_applications(candidate:talent_candidates(full_name, resume_text), job:talent_job_postings(title, description, required_skills))")
      .eq("id", interviewId)
      .maybeSingle();

    if (interviewError) throw new Error(interviewError.message);
    if (!interview) throw new Error("That interview is not visible to you, or it no longer exists.");

    const application = interview.application as {
      candidate: { full_name: string | null; resume_text: string | null } | null;
      job: { title: string | null; description: string | null; required_skills: string[] | null } | null;
    } | null;

    const job = application?.job ?? null;
    const resumeText = application?.candidate?.resume_text ?? "";

    if (action === "generate") {
      const userPrompt = [
        `INTERVIEW TYPE: ${interview.interview_type}`,
        `JOB TITLE: ${job?.title ?? "Unknown"}`,
        `REQUIRED SKILLS: ${(job?.required_skills ?? []).join(", ") || "Not specified"}`,
        `JOB DESCRIPTION: ${job?.description ?? "Not provided"}`,
        "CANDIDATE RESUME TEXT (for tailoring; refer to the candidate only as 'the candidate'):",
        resumeText.slice(0, 8000) || "Not available",
        "",
        "Produce exactly 5 questions: 3 technical or problem-solving and 2 communication or role-fit.",
      ].join(NL);

      const aiResult = await callModel(QUESTION_SYSTEM, userPrompt, sessionId);
      const parsed = extractJson(aiResult.text);
      const questions = Array.isArray(parsed?.questions) ? parsed.questions : [];

      if (!questions.length) {
        throw new Error("The model did not return any usable questions. Nothing was written.");
      }

      // Regenerating replaces the previous set so an interview never carries duplicates.
      const { error: deleteError } = await supabase
        .from("talent_interview_questions")
        .delete()
        .eq("interview_id", interviewId);
      if (deleteError) throw new Error(deleteError.message);

      const rows = questions.slice(0, 8).map((question, index) => {
        const item = question as { question_text?: string; category?: string; rubric?: string };
        return {
          org_id: interview.org_id,
          interview_id: interviewId,
          position: index + 1,
          question_text: String(item.question_text ?? "Question"),
          category: String(item.category ?? "Technical Knowledge"),
          rubric: item.rubric ? String(item.rubric) : null,
        };
      });

      const { data: inserted, error: insertError } = await supabase
        .from("talent_interview_questions")
        .insert(rows)
        .select("*");
      if (insertError) throw new Error(insertError.message);

      await supabase.from("talent_ai_usage").insert({
        org_id: interview.org_id,
        function_name: "talent-ai-interview",
        provider: "qwen",
        model: MODEL,
        prompt_tokens: aiResult.promptTokens,
        completion_tokens: aiResult.completionTokens,
        total_tokens: aiResult.totalTokens,
        cost_estimate: Number((aiResult.totalTokens * 0.0000004).toFixed(6)),
        status: "success",
        latency_ms: Date.now() - startedAt,
      });

      await supabase.from("talent_audit_log").insert({
        org_id: interview.org_id,
        action: "interview.questions_generated",
        entity_type: "interview",
        entity_id: interviewId,
        metadata: { count: rows.length, model: MODEL },
      });

      return new Response(JSON.stringify({ ok: true, action, questions: inserted }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ------------------------------------------------------------------ evaluate
    const { data: questions, error: questionsError } = await supabase
      .from("talent_interview_questions")
      .select("id, position, question_text, category, rubric, responses:talent_interview_responses(id, response_text)")
      .eq("interview_id", interviewId)
      .order("position");

    if (questionsError) throw new Error(questionsError.message);

    const answerable = (questions ?? []).filter(
      (question) => (question.responses as Array<{ response_text: string }> | null)?.length,
    );

    if (!answerable.length) {
      throw new Error("There are no recorded responses to evaluate yet.");
    }

    const transcript = answerable
      .map((question) => {
        const response = (question.responses as Array<{ response_text: string }>)[0];
        return [
          `QUESTION ${question.position} (${question.category}): ${question.question_text}`,
          `RUBRIC: ${question.rubric ?? "No rubric supplied."}`,
          `CANDIDATE ANSWER: ${response.response_text}`,
        ].join(NL);
      })
      .join(NL2);

    const aiResult = await callModel(EVALUATION_SYSTEM, transcript, sessionId);
    const parsed = extractJson(aiResult.text);

    if (!parsed) {
      throw new Error("The model did not return a parsable evaluation. No scores were written.");
    }

    const scored = Array.isArray(parsed.responses) ? parsed.responses : [];

    for (const entry of scored) {
      const item = entry as { position?: number; score?: unknown; criterion?: string; rationale?: string };
      const position = Number(item.position);
      const question = answerable.find((candidate) => candidate.position === position);
      if (!question) continue;

      const numericScore = Number(item.score);
      if (Number.isNaN(numericScore)) continue;

      const response = (question.responses as Array<{ id: string }>)[0];
      const { error: scoreError } = await supabase
        .from("talent_interview_responses")
        .update({
          score: numericScore,
          ai_score: {
            criterion: item.criterion ?? question.category,
            score: numericScore,
            max: 5,
            rationale: item.rationale ?? "",
          },
        })
        .eq("id", response.id);
      if (scoreError) throw new Error(scoreError.message);
    }

    const overall = Number(parsed.overall_score);
    const { error: interviewUpdateError } = await supabase
      .from("talent_interviews")
      .update({
        overall_score: Number.isNaN(overall) ? null : overall,
        summary: typeof parsed.summary === "string" ? parsed.summary : null,
        requires_human_review: parsed.requires_human_review !== false,
        status: "evaluated",
        updated_at: new Date().toISOString(),
      })
      .eq("id", interviewId);

    if (interviewUpdateError) throw new Error(interviewUpdateError.message);

    await supabase.from("talent_ai_usage").insert({
      org_id: interview.org_id,
      function_name: "talent-ai-interview",
      provider: "qwen",
      model: MODEL,
      prompt_tokens: aiResult.promptTokens,
      completion_tokens: aiResult.completionTokens,
      total_tokens: aiResult.totalTokens,
      cost_estimate: Number((aiResult.totalTokens * 0.0000004).toFixed(6)),
      status: "success",
      latency_ms: Date.now() - startedAt,
    });

    await supabase.from("talent_audit_log").insert({
      org_id: interview.org_id,
      action: "interview.evaluated",
      entity_type: "interview",
      entity_id: interviewId,
      metadata: {
        overall_score: Number.isNaN(overall) ? null : overall,
        requires_human_review: parsed.requires_human_review !== false,
        model: MODEL,
      },
    });

    return new Response(
      JSON.stringify({
        ok: true,
        action,
        evaluation: {
          responses: scored,
          overall_score: Number.isNaN(overall) ? null : overall,
          summary: parsed.summary ?? "",
          recommendation: parsed.recommendation ?? "",
          requires_human_review: parsed.requires_human_review !== false,
          confidence: num(parsed.confidence),
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The interview request failed.";
    console.error("talent-ai-interview failed", message);
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
