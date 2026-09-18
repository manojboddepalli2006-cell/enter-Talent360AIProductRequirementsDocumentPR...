import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-session-id",
};

const AI_API_TOKEN = Deno.env.get("AI_API_TOKEN_1a0a9a967ce7");
const API_BASE = "https://api.enter.pro";
const PROJECT_ID = "1a0a9a967ce742bbb298dcff38eb421b";
const MODEL = "alibaba/qwen-3.7-plus";

interface AiCallResult {
  text: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

async function callModel(system: string, user: string, sessionId: string): Promise<AiCallResult> {
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
      temperature: 0.2,
      max_tokens: 1600,
    }),
  });

  const raw = await response.text();

  if (!response.ok) {
    let message = `AI request failed with status ${response.status}`;
    try {
      const parsed = JSON.parse(raw) as { error?: { message?: string; type?: string } };
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
    const char = raw[index];
    if (escaped) { escaped = false; continue; }
    if (char === "\\") { escaped = true; continue; }
    if (char === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (char === "{") depth += 1;
    if (char === "}") {
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

const SYSTEM_PROMPT = [
  "You are the recruitment intelligence engine inside Talent360 AI, a workforce platform for HR teams.",
  "You score how well a candidate matches a job description and you explain your reasoning so a human can audit it.",
  "Rules you must follow:",
  "- Never consider or mention a candidate's name, gender, age, nationality, photograph, marital status, disability or any other protected attribute.",
  "- Do not treat an institution's prestige as evidence of capability. Score what the person has demonstrably done.",
  "- Scores must be justified by the resume text. Do not invent experience that is not present.",
  "- If the resume is thin or the evidence is weak, say so and lower the confidence rather than padding the score.",
  "Return ONLY a JSON object, with no prose before or after it, in exactly this shape:",
  '{"match_score": 0-100 number, "criteria": [{"factor": string, "score": 0-100 number, "weight": number summing to 1 across criteria, "note": string}], "explanation": string (2-4 sentences), "strengths": [string], "gaps": [string], "bias_flags": [{"type": string, "note": string}], "confidence": 0-1 number}',
  "bias_flags is where you record anything in the screening inputs that could correlate with a protected attribute, such as a pedigree or graduation-year proxy. Use an empty array when there is nothing to flag.",
].join("\n");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startedAt = Date.now();

  try {
    const sessionId = req.headers.get("X-Session-ID")?.trim() || crypto.randomUUID();
    const { applicationId } = (await req.json()) as { applicationId?: string };
    if (!applicationId) throw new Error("applicationId is required.");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
    );

    const { data: application, error: applicationError } = await supabase
      .from("talent_applications")
      .select("id, org_id, stage, candidate:talent_candidates(full_name, resume_text, parsed_profile, location), job:talent_job_postings(title, description, required_skills, seniority, location)")
      .eq("id", applicationId)
      .maybeSingle();

    if (applicationError) throw new Error(applicationError.message);
    if (!application) throw new Error("That application is not visible to you, or it no longer exists.");

    const candidate = application.candidate as {
      full_name: string | null;
      resume_text: string | null;
      parsed_profile: Record<string, unknown> | null;
      location: string | null;
    } | null;
    const job = application.job as {
      title: string | null;
      description: string | null;
      required_skills: string[] | null;
      seniority: string | null;
      location: string | null;
    } | null;

    const resumeText = candidate?.resume_text?.trim() ?? "";
    if (resumeText.length < 40) {
      throw new Error("This candidate has no usable resume text. Add or paste the resume before running a match.");
    }

    const userPrompt = [
      `JOB TITLE: ${job?.title ?? "Unknown"}`,
      `JOB LOCATION: ${job?.location ?? "Not specified"}`,
      `SENIORITY: ${job?.seniority ?? "Not specified"}`,
      `REQUIRED SKILLS: ${(job?.required_skills ?? []).join(", ") || "Not specified"}`,
      `JOB DESCRIPTION: ${job?.description ?? "Not provided"}`,
      "",
      "CANDIDATE RESUME TEXT:",
      resumeText.slice(0, 12000),
      "",
      "Score this candidate against the job. Refer to the candidate only as 'the candidate'.",
    ].join("\n");

    const aiResult = await callModel(SYSTEM_PROMPT, userPrompt, sessionId);
    const parsed = extractJson(aiResult.text);

    if (!parsed) {
      throw new Error("The model did not return a parsable JSON match report. No score was written.");
    }

    const matchScore =
      typeof parsed.match_score === "number"
        ? parsed.match_score
        : Number(parsed.match_score ?? Number.NaN);

    if (Number.isNaN(matchScore)) {
      throw new Error("The model response did not include a numeric match score. No score was written.");
    }

    const breakdown = {
      overall: Math.round(matchScore),
      criteria: Array.isArray(parsed.criteria) ? parsed.criteria : [],
      explanation: typeof parsed.explanation === "string" ? parsed.explanation : "",
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
      gaps: Array.isArray(parsed.gaps) ? parsed.gaps : [],
      confidence: num(parsed.confidence),
    };
    const biasFlags = Array.isArray(parsed.bias_flags) ? parsed.bias_flags : [];

    const { error: updateError } = await supabase
      .from("talent_applications")
      .update({
        ai_match_score: breakdown.overall,
        ai_match_breakdown: breakdown,
        bias_flags: biasFlags,
        updated_at: new Date().toISOString(),
      })
      .eq("id", applicationId);

    if (updateError) throw new Error(updateError.message);

    await supabase.from("talent_ai_usage").insert({
      org_id: application.org_id,
      function_name: "talent-ai-resume-match",
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
      org_id: application.org_id,
      action: "candidate.match_run",
      entity_type: "application",
      entity_id: applicationId,
      metadata: { score: breakdown.overall, bias_flags: biasFlags.length, model: MODEL },
    });

    return new Response(
      JSON.stringify({ ok: true, match_score: breakdown.overall, breakdown, bias_flags: biasFlags }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The match could not be produced.";
    console.error("talent-ai-resume-match failed", message);
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
