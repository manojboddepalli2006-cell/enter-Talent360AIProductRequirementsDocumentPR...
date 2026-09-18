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

const SYSTEM_PROMPT = [
  "You design development plans inside Talent360 AI. A manager or HR reviewer approves every plan you propose.",
  "You receive a person's assessed proficiency against the target profile for their role. The numbers are computed for you; do not change them.",
  "Rules:",
  "- Recommend learning that closes the specific measured gap, not generic career advice.",
  "- Prefer a small number of high-leverage items over a long catalogue.",
  "- Where a mentor or pairing would beat a course, say so explicitly.",
  "- Never reference a person's name, gender, age or nationality.",
  "Return ONLY JSON in exactly this shape:",
  '{"summary": string (2-3 sentences), "recommendation": string (the plan in one sentence), "recommended_actions": [string], "confidence": 0-1 number, "courses": [{"course_title": string, "provider": string, "rationale": string, "priority": "high" | "medium" | "low", "skill_name": string}]}',
].join(NL);

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
      temperature: 0.3,
      max_tokens: 1600,
    }),
  });

  const raw = await response.text();
  if (!response.ok) {
    let message = `AI request failed with status ${response.status}`;
    try {
      const parsed = JSON.parse(raw) as { error?: { message?: string } };
      if (parsed.error?.message) message = parsed.error.message;
    } catch { /* keep status message */ }
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startedAt = Date.now();

  try {
    const sessionId = req.headers.get("X-Session-ID")?.trim() || crypto.randomUUID();
    const { employeeId } = (await req.json()) as { employeeId?: string };
    if (!employeeId) throw new Error("employeeId is required.");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
    );

    const { data: employee, error: employeeError } = await supabase
      .from("talent_employees")
      .select("id, org_id, role_title, seniority")
      .eq("id", employeeId)
      .maybeSingle();

    if (employeeError) throw new Error(employeeError.message);
    if (!employee) throw new Error("That employee is not visible to you, or no longer exists.");

    const [skillResult, requirementResult, learningResult] = await Promise.all([
      supabase
        .from("talent_employee_skills")
        .select("proficiency, skill:talent_skills(id, name, category)")
        .eq("employee_id", employeeId),
      supabase
        .from("talent_role_skill_requirements")
        .select("skill_id, required_level")
        .eq("role_title", employee.role_title),
      supabase
        .from("talent_learning_recommendations")
        .select("id")
        .eq("employee_id", employeeId),
    ]);

    const firstError = [skillResult.error, requirementResult.error, learningResult.error].find(Boolean);
    if (firstError) throw new Error(firstError.message);

    const requirements = (requirementResult.data ?? []).reduce<Record<string, number>>((acc, row) => {
      acc[row.skill_id] = row.required_level;
      return acc;
    }, {});

    const assessed = (skillResult.data ?? []) as unknown as Array<{
      proficiency: number;
      skill: { id: string; name: string; category: string } | null;
    }>;

    const gaps = assessed
      .filter((row) => row.skill && requirements[row.skill.id] !== undefined)
      .map((row) => ({
        skill_id: row.skill!.id,
        skill_name: row.skill!.name,
        category: row.skill!.category,
        assessed: row.proficiency,
        target: requirements[row.skill!.id],
        gap: requirements[row.skill!.id] - row.proficiency,
      }))
      .filter((row) => row.gap > 0)
      .sort((a, b) => b.gap - a.gap);

    const missingSkills = Object.keys(requirements)
      .filter((skillId) => !assessed.some((row) => row.skill?.id === skillId))
      .map((skillId) => ({ skill_id: skillId, note: "No assessment on record for a required skill" }));

    if (!gaps.length && !missingSkills.length) {
      return new Response(
        JSON.stringify({
          ok: true,
          message: "No skill gap found against the target profile for this role. Nothing was generated.",
          courses: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const userPrompt = [
      `ROLE TITLE: ${employee.role_title}`,
      `SENIORITY: ${employee.seniority ?? "Not specified"}`,
      "MEASURED GAPS (assessed against target):",
      JSON.stringify(gaps.slice(0, 12)),
      "REQUIRED SKILLS WITH NO ASSESSMENT ON RECORD:",
      JSON.stringify(missingSkills.slice(0, 8)),
    ].join(NL);

    const aiResult = await callModel(SYSTEM_PROMPT, userPrompt, sessionId);
    const parsed = extractJson(aiResult.text);

    if (!parsed) throw new Error("The model did not return a parsable development plan. Nothing was written.");

    const courses = Array.isArray(parsed.courses)
      ? (parsed.courses as Array<Record<string, unknown>>)
      : [];
    const recommendedActions = Array.isArray(parsed.recommended_actions)
      ? parsed.recommended_actions.map((action) => String(action))
      : [];

    const skillIdByName = gaps.reduce<Record<string, string>>((acc, row) => {
      acc[row.skill_name.toLowerCase()] = row.skill_id;
      return acc;
    }, {});

    if (courses.length) {
      const rows = courses.slice(0, 6).map((course) => {
        const skillName = String(course.skill_name ?? "").toLowerCase();
        const priority = String(course.priority ?? "medium");
        return {
          org_id: employee.org_id,
          employee_id: employeeId,
          skill_id: skillIdByName[skillName] ?? gaps[0]?.skill_id ?? null,
          course_title: String(course.course_title ?? "Development activity"),
          provider: course.provider ? String(course.provider) : "Talent360 Academy",
          rationale: course.rationale ? String(course.rationale) : null,
          priority: ["high", "medium", "low"].includes(priority) ? priority : "medium",
          status: "suggested",
        };
      });

      const { error: insertError } = await supabase.from("talent_learning_recommendations").insert(rows);
      if (insertError) throw new Error(insertError.message);
    }

    const { error: recommendationError } = await supabase.from("talent_ai_recommendations").insert({
      org_id: employee.org_id,
      module: "develop",
      entity_type: "employee",
      entity_id: employeeId,
      employee_id: employeeId,
      title: `Development plan: ${employee.role_title}`,
      summary: typeof parsed.summary === "string" ? parsed.summary : null,
      recommendation: {
        recommendation:
          typeof parsed.recommendation === "string"
            ? parsed.recommendation
            : "Agree a development plan covering the highest-priority skill gaps.",
        confidence: num(parsed.confidence),
        reasoning_signals: [
          ...gaps.slice(0, 3).map((gap) => ({
            factor: gap.skill_name,
            direction: "down",
            weight: gap.gap >= 20 ? "high" : "medium",
            detail: `Assessed ${gap.assessed} against a target of ${gap.target} for ${employee.role_title}`,
          })),
          ...(missingSkills.length
            ? [
                {
                  factor: "Unassessed requirements",
                  direction: "flat",
                  weight: "low",
                  detail: `${missingSkills.length} required skill(s) have no assessment on record`,
                },
              ]
            : []),
        ],
        explanation: typeof parsed.summary === "string" ? parsed.summary : "",
        recommended_actions: recommendedActions.length
          ? recommendedActions
          : ["Agree the development plan", "Assign the recommended learning"],
        requires_human_review: true,
      },
      status: "pending",
    });

    if (recommendationError) throw new Error(recommendationError.message);

    await supabase.from("talent_ai_usage").insert({
      org_id: employee.org_id,
      function_name: "talent-ai-development",
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
      org_id: employee.org_id,
      action: "development.plan_generated",
      entity_type: "employee",
      entity_id: employeeId,
      metadata: { gaps: gaps.length, courses: courses.length, model: MODEL },
    });

    return new Response(
      JSON.stringify({
        ok: true,
        gaps: gaps.length,
        courses: courses.length,
        summary: parsed.summary ?? "",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The development plan could not be generated.";
    console.error("talent-ai-development failed", message);
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
