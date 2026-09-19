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
  if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) return Number(value);
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
      temperature: 0.2,
      max_tokens: 1600,
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

const SYSTEM_PROMPT = [
  "You are the recruitment intelligence engine inside Talent360 AI.",
  "You score how well a candidate matches a job description and you explain your reasoning so a human can audit it.",
  "Rules:",
  "- Never consider or mention a candidate's name, gender, age, nationality, photograph, marital status, disability or any other protected attribute.",
  "- Do not treat an institution's prestige as evidence of capability.",
  "- Score only what the resume text demonstrates; do not invent experience.",
  "Return ONLY JSON in exactly this shape:",
  '{"match_score": 0-100 number, "criteria": [{"factor": string, "score": 0-100 number, "weight": number, "note": string}], "explanation": string (2-4 sentences), "strengths": [string], "gaps": [string], "bias_flags": [{"type": string, "note": string}], "confidence": 0-1 number}',
].join(NL);

/** Per-invocation cap keeps the run inside the gateway's request budget. */
const MAX_PER_RUN = 4;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startedAt = Date.now();

  try {
    const sessionId = req.headers.get("X-Session-ID")?.trim() || crypto.randomUUID();
    const body = (await req.json()) as { jobPostingId?: string; applicationIds?: string[] };

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
    );

    const { data: me } = await supabase.auth.getUser();
    const { data: profile } = await supabase
      .from("talent_profiles")
      .select("id, org_id")
      .eq("id", me.user?.id ?? "")
      .maybeSingle();

    if (!profile) throw new Error("Your workspace profile could not be resolved.");

    let ids = Array.isArray(body.applicationIds) ? body.applicationIds : [];

    if (!ids.length && body.jobPostingId) {
      const { data: rows, error } = await supabase
        .from("talent_applications")
        .select("id")
        .eq("job_posting_id", body.jobPostingId)
        .is("ai_match_score", null);
      if (error) throw new Error(error.message);
      ids = (rows ?? []).map((row) => row.id);
    }

    if (!ids.length) throw new Error("Nothing to score. Add candidates or pick a posting with unscored applications.");

    const applications = ids.slice(0, MAX_PER_RUN);

    const { data: job, error: jobError } = await supabase
      .from("talent_ai_jobs")
      .insert({
        org_id: profile.org_id,
        kind: "resume-match",
        status: "running",
        total: applications.length,
        processed: 0,
        progress: 0,
        payload: { application_ids: applications },
        created_by: profile.id,
      })
      .select("id")
      .single();

    if (jobError) throw new Error(jobError.message);
    const jobId = job.id;

    let processed = 0;
    let scored = 0;
    let usageTokens = 0;

    const progress = async (status: string, error?: string | null) => {
      await supabase.from("talent_ai_jobs").update({
        status,
        processed,
        progress: applications.length ? Math.round((processed / applications.length) * 100) : 100,
        error: error ?? null,
        updated_at: new Date().toISOString(),
      }).eq("id", jobId);
    };

    for (const applicationId of applications) {
      const { data: application, error: applicationError } = await supabase
        .from("talent_applications")
        .select("id, org_id, candidate:talent_candidates(resume_text), job:talent_job_postings(title, description, required_skills, seniority, location)")
        .eq("id", applicationId)
        .maybeSingle();

      if (applicationError) throw new Error(applicationError.message);
      if (!application) {
        processed += 1;
        await progress("running");
        continue;
      }

      const candidate = application.candidate as { resume_text: string | null } | null;
      const jobPosting = application.job as {
        title: string | null;
        description: string | null;
        required_skills: string[] | null;
        seniority: string | null;
        location: string | null;
      } | null;

      const resumeText = candidate?.resume_text?.trim() ?? "";
      if (resumeText.length < 40) {
        processed += 1;
        await progress("running");
        continue;
      }

      const userPrompt = [
        `JOB TITLE: ${jobPosting?.title ?? "Unknown"}`,
        `JOB LOCATION: ${jobPosting?.location ?? "Not specified"}`,
        `SENIORITY: ${jobPosting?.seniority ?? "Not specified"}`,
        `REQUIRED SKILLS: ${(jobPosting?.required_skills ?? []).join(", ") || "Not specified"}`,
        `JOB DESCRIPTION: ${jobPosting?.description ?? "Not provided"}`,
        "",
        "CANDIDATE RESUME TEXT:",
        resumeText.slice(0, 12000),
        "",
        "Score this candidate against the job. Refer to the candidate only as 'the candidate'.",
      ].join(NL);

      const aiResult = await callModel(SYSTEM_PROMPT, userPrompt, sessionId);
      usageTokens += aiResult.totalTokens;

      const parsed = extractJson(aiResult.text);
      const matchScore = num(parsed?.match_score);

      if (matchScore !== null) {
        const breakdown = {
          overall: Math.round(matchScore),
          criteria: Array.isArray(parsed?.criteria) ? parsed.criteria : [],
          explanation: typeof parsed?.explanation === "string" ? parsed.explanation : "",
          strengths: Array.isArray(parsed?.strengths) ? parsed.strengths : [],
          gaps: Array.isArray(parsed?.gaps) ? parsed.gaps : [],
          confidence: typeof parsed?.confidence === "number" ? parsed.confidence : null,
        };
        const biasFlags = Array.isArray(parsed?.bias_flags) ? parsed.bias_flags : [];

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
        scored += 1;
      }

      processed += 1;
      await progress("running");
    }

    await supabase.from("talent_ai_usage").insert({
      org_id: profile.org_id,
      function_name: "talent-ai-bulk-match",
      provider: "qwen",
      model: MODEL,
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: usageTokens,
      cost_estimate: Number((usageTokens * 0.0000004).toFixed(6)),
      status: "success",
      latency_ms: Date.now() - startedAt,
    });

    await progress("completed");

    await supabase.from("talent_audit_log").insert({
      org_id: profile.org_id,
      action: "candidate.bulk_match_run",
      entity_type: "ai_job",
      entity_id: jobId,
      metadata: { requested: ids.length, processed, scored, model: MODEL },
    });

    return new Response(
      JSON.stringify({ ok: true, jobId, processed, scored, truncated: ids.length > MAX_PER_RUN }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The bulk match failed.";
    console.error("talent-ai-bulk-match failed", message);
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
