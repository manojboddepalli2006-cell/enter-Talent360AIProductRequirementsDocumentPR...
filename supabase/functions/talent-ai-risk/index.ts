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
  "You are the workforce risk engine inside Talent360 AI. A human HR reviewer reads and decides on every flag you raise.",
  "The signal directions and weights you receive are computed from measured data. Do NOT recompute or contradict them.",
  "Your job is to improve the wording of the explanation, calibrate a confidence, and name one proportionate action.",
  "Rules:",
  "- Two sentences at most. Write plainly, for a busy manager.",
  "- Attribute the pattern to plausible causes without asserting facts you were not given.",
  "- Say so plainly when the evidence is thin, and lower the confidence instead of dramatising it.",
  "- Never reference a person's name, gender, age, nationality or any protected attribute.",
  "- Recommend a conversation before a formal process whenever the cause is not yet understood.",
  "- recommended_actions must be usable as task titles: at most 8 words each, no trailing full stop, no explanation inside them.",
  "Return ONLY JSON in exactly this shape:",
  '{"assessments": [{"employee_ref": string, "explanation": string (max 2 sentences), "confidence": 0-1 number, "recommended_actions": [string]}]}',
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

interface Signal {
  factor: string;
  direction: "up" | "down" | "flat";
  weight: "high" | "medium" | "low";
  detail: string;
}

function directionOf(delta: number, threshold: number): "up" | "down" | "flat" {
  if (delta <= -threshold) return "down";
  if (delta >= threshold) return "up";
  return "flat";
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
      max_tokens: 1200,
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
    const body = (await req.json().catch(() => ({}))) as { employeeIds?: string[] };
    const requested = Array.isArray(body.employeeIds) ? body.employeeIds : null;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
    );

    let employeeQuery = supabase
      .from("talent_employees")
      .select("id, org_id, role_title, engagement_score, status")
      .eq("status", "active")
      .limit(60);

    if (requested?.length) employeeQuery = employeeQuery.in("id", requested);

    const { data: employees, error: employeeError } = await employeeQuery;
    if (employeeError) throw new Error(employeeError.message);
    if (!employees?.length) throw new Error("No active employees are visible to you for assessment.");

    const orgId = employees[0].org_id;
    const employeeIds = employees.map((employee) => employee.id);

    const [reviewResult, engagementResult, skillResult, requirementResult, pendingResult] = await Promise.all([
      supabase
        .from("talent_performance_reviews")
        .select("employee_id, period, score")
        .in("employee_id", employeeIds)
        .order("period", { ascending: true }),
      supabase
        .from("talent_engagement_signals")
        .select("employee_id, value, recorded_at")
        .in("employee_id", employeeIds)
        .order("recorded_at", { ascending: true }),
      supabase
        .from("talent_employee_skills")
        .select("employee_id, skill_id, proficiency")
        .in("employee_id", employeeIds),
      supabase.from("talent_role_skill_requirements").select("role_title, skill_id, required_level"),
      supabase
        .from("talent_ai_recommendations")
        .select("employee_id")
        .eq("module", "monitor")
        .eq("status", "pending")
        .in("employee_id", employeeIds),
    ]);

    const firstError = [
      reviewResult.error,
      engagementResult.error,
      skillResult.error,
      requirementResult.error,
      pendingResult.error,
    ].find(Boolean);
    if (firstError) throw new Error(firstError.message);

    const alreadyPending = new Set((pendingResult.data ?? []).map((row) => row.employee_id));

    const requirementsByRole = (requirementResult.data ?? []).reduce<Record<string, Record<string, number>>>(
      (acc, row) => {
        acc[row.role_title] = acc[row.role_title] ?? {};
        acc[row.role_title][row.skill_id] = row.required_level;
        return acc;
      },
      {},
    );

    const skillTotals = (skillResult.data ?? []).reduce<
      Record<string, { sum: number; count: number; bySkill: Record<string, number> }>
    >((acc, row) => {
      const current = acc[row.employee_id] ?? { sum: 0, count: 0, bySkill: {} };
      current.sum += row.proficiency ?? 0;
      current.count += 1;
      current.bySkill[row.skill_id] = row.proficiency ?? 0;
      acc[row.employee_id] = current;
      return acc;
    }, {});

    const reviewsByEmployee = (reviewResult.data ?? []).reduce<
      Record<string, Array<{ period: string; score: number | null }>>
    >((acc, row) => {
      acc[row.employee_id] = acc[row.employee_id] ?? [];
      acc[row.employee_id].push({ period: row.period, score: row.score });
      return acc;
    }, {});

    const engagementByEmployee = (engagementResult.data ?? []).reduce<
      Record<string, Array<{ value: number; recorded_at: string }>>
    >((acc, row) => {
      acc[row.employee_id] = acc[row.employee_id] ?? [];
      acc[row.employee_id].push({ value: row.value, recorded_at: row.recorded_at });
      return acc;
    }, {});

    // Signal directions are computed from the data, never delegated to the model.
    const computed = employees.map((employee) => {
      const reviews = (reviewsByEmployee[employee.id] ?? []).filter((review) => review.score !== null);
      const latestReview = reviews.at(-1)?.score ?? null;
      const previousReview = reviews.at(-2)?.score ?? null;
      const perfDelta =
        latestReview !== null && previousReview !== null ? latestReview - previousReview : 0;
      const perfDir = directionOf(perfDelta, 0.3);

      const engagement = engagementByEmployee[employee.id] ?? [];
      const latestEngagement = engagement.at(-1)?.value ?? employee.engagement_score ?? 0;
      const previousEngagement = engagement.at(-2)?.value ?? latestEngagement;
      const engDelta = latestEngagement - previousEngagement;
      const engDir = directionOf(engDelta, 5);

      const stats = skillTotals[employee.id];
      const requirement = requirementsByRole[employee.role_title] ?? {};
      const gaps: Array<{ skillId: string; gap: number }> = [];
      if (stats) {
        Object.entries(requirement).forEach(([skillId, required]) => {
          const actual = stats.bySkill[skillId];
          if (actual === undefined) {
            gaps.push({ skillId, gap: required });
          } else if (actual < required - 5) {
            gaps.push({ skillId, gap: required - actual });
          }
        });
      }
      const averageGap = gaps.length
        ? Math.round(gaps.reduce((sum, entry) => sum + entry.gap, 0) / gaps.length)
        : 0;
      const skillDir = gaps.length === 0 ? "flat" : directionOf(-averageGap / 12, 0.5);

      const signals: Signal[] = [
        {
          factor: "Performance trend",
          direction: perfDir,
          weight: perfDir === "down" ? "high" : "low",
          detail:
            latestReview !== null && previousReview !== null
              ? `Latest review ${latestReview} against a previous ${previousReview}`
              : "Not enough review history to establish a trend",
        },
        {
          factor: "Engagement trend",
          direction: engDir,
          weight: engDir === "down" ? "high" : "low",
          detail: `Pulse signal ${Math.round(latestEngagement)} against a previous ${Math.round(previousEngagement)}`,
        },
        {
          factor: "Skill alignment",
          direction: skillDir,
          weight: skillDir === "down" ? "medium" : "low",
          detail: gaps.length
            ? `${gaps.length} required skill${gaps.length === 1 ? "" : "s"} below the target for ${employee.role_title}`
            : `Assessed profile meets the target for ${employee.role_title}`,
        },
      ];

      const downCount = signals.filter((signal) => signal.direction === "down").length;
      const level = downCount >= 2 ? "high" : downCount === 1 ? "medium" : "low";

      return { employee, signals, level, downCount, gaps: gaps.length };
    });

    // Deterministic levels, then one model call for the explanations, using
    // position-only references so no names leave the platform.
    const refs = computed.map((entry, index) => ({
      ref: `e${index + 1}`,
      employee: entry.employee,
      signals: entry.signals,
      level: entry.level,
    }));

    // Every assessment gets an explanation and a confidence immediately, computed
    // from the signals that were measured. Nothing is blank, and nothing depends on
    // a model returning a well-formed array.
    const byRef = new Map<string, { explanation: string; confidence: number | null; actions: string[] }>();

    const templateExplanation = (signals: Signal[], roleTitle: string, level: string): string => {
      const softening = signals.filter((signal) => signal.direction === "down");
      const improving = signals.filter((signal) => signal.direction === "up");

      if (!softening.length) {
        return improving.length
          ? `No signal is moving against its baseline for ${roleTitle}, and ${improving.length} ${
              improving.length === 1 ? "signal is" : "signals are"
            } improving. No intervention is indicated.`
          : `Every signal is flat against its own baseline for ${roleTitle}. No intervention is indicated.`;
      }

      const named = softening
        .map((signal) => `${signal.factor.toLowerCase()} (${signal.detail.toLowerCase()})`)
        .join(", ");

      if (level === "high") {
        return `Multiple independent signals are softening together: ${named}. When several signals move in the same direction at once, a single bad month is the less likely explanation, and a workload or role-fit conversation is the proportionate first step.`;
      }

      return `One signal has softened while the others hold: ${named}. A single softened signal is a prompt to check in, not a conclusion about intent.`;
    };

    const signalConfidence = (signals: Signal[]): number => {
      const down = signals.filter((signal) => signal.direction === "down");
      const highWeight = down.filter((signal) => signal.weight === "high").length;
      // Confidence reflects how many independent signals agree, not a model guess.
      return Number(Math.min(0.92, 0.45 + down.length * 0.12 + highWeight * 0.08).toFixed(2));
    };

    refs.forEach((ref) => {
      byRef.set(ref.ref, {
        explanation: templateExplanation(ref.signals, ref.employee.role_title, ref.level),
        confidence: signalConfidence(ref.signals),
        actions: [],
      });
    });

    let usagePrompt = 0;
    let usageCompletion = 0;
    let usageTotal = 0;

    // The model is used only where it adds the most: the high-risk assessments a
    // reviewer reads closely. One call, capped, so the scan stays inside the
    // request budget instead of timing out on a long batch.
    const enrichment = refs.filter((ref) => ref.level === "high").slice(0, 8);

    if (enrichment.length) {
      const userPrompt = [
        "Computed assessments. For each reference, write a short plain-language explanation (2 sentences at most),",
        "a calibrated confidence between 0 and 1, and one or two recommended actions, each a short task title of at most 8 words.",
        `Return one object for each of the ${enrichment.length} references, in the same order.`,
        JSON.stringify(
          enrichment.map((ref) => ({
            employee_ref: ref.ref,
            risk_level: ref.level,
            role_title: ref.employee.role_title,
            signals: ref.signals,
          })),
          null,
          0,
        ),
      ].join(NL);

      try {
        const enriched = await callModel(SYSTEM_PROMPT, userPrompt, sessionId);
        usagePrompt += enriched.promptTokens;
        usageCompletion += enriched.completionTokens;
        usageTotal += enriched.totalTokens;

        const parsed = extractJson(enriched.text);
        const assessments = Array.isArray(parsed?.assessments) ? parsed.assessments : [];

        assessments.forEach((entry) => {
          const item = entry as {
            employee_ref?: string;
            explanation?: string;
            confidence?: unknown;
            recommendation?: string;
            recommended_actions?: unknown;
          };
          if (!item.employee_ref) return;

          const current = byRef.get(String(item.employee_ref));
          if (!current) return;

          const actions = Array.isArray(item.recommended_actions)
            ? item.recommended_actions.map((action) => String(action))
            : item.recommendation
              ? [String(item.recommendation)]
              : [];

          byRef.set(String(item.employee_ref), {
            explanation:
              typeof item.explanation === "string" && item.explanation.trim().length > 40
                ? item.explanation.trim()
                : current.explanation,
            confidence: num(item.confidence) ?? current.confidence,
            actions: actions.length ? actions : current.actions,
          });
        });

        await supabase.from("talent_ai_usage").insert({
          org_id: orgId,
          function_name: "talent-ai-risk",
          provider: "qwen",
          model: MODEL,
          prompt_tokens: enriched.promptTokens,
          completion_tokens: enriched.completionTokens,
          total_tokens: enriched.totalTokens,
          cost_estimate: Number((enriched.totalTokens * 0.0000004).toFixed(6)),
          status: "success",
          latency_ms: Date.now() - startedAt,
        });
      } catch (enrichError) {
        // The computed explanation already stands, so a failed enrichment degrades
        // the wording rather than the assessment itself.
        console.error("risk enrichment failed, keeping computed explanations", enrichError);
        await supabase.from("talent_ai_usage").insert({
          org_id: orgId,
          function_name: "talent-ai-risk",
          provider: "qwen",
          model: MODEL,
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0,
          cost_estimate: 0,
          status: "failed",
          latency_ms: Date.now() - startedAt,
        });
      }
    }

    const riskRows = refs.map((ref, index) => {
      const narrative = byRef.get(ref.ref);
      return {
        org_id: orgId,
        employee_id: ref.employee.id,
        risk_level: ref.level,
        signals: ref.signals,
        explanation:
          narrative?.explanation ??
          `Computed from ${ref.signals.filter((signal) => signal.direction === "down").length} softening signal(s). No narrative was returned by the model for this assessment.`,
        confidence: narrative?.confidence ?? null,
        assessed_at: new Date(Date.now() - index * 1000).toISOString(),
      };
    });

    const { error: riskError } = await supabase.from("talent_risk_assessments").insert(riskRows);
    if (riskError) throw new Error(riskError.message);

    // Only non-low assessments become reviewable recommendations.
    const recommendationRows = refs
      .filter((ref) => ref.level !== "low")
      .map((ref) => {
        const narrative = byRef.get(ref.ref);
        const downSignals = ref.signals.filter((signal) => signal.direction === "down");
        return {
          org_id: orgId,
          module: "monitor",
          entity_type: "employee",
          entity_id: ref.employee.id,
          employee_id: ref.employee.id,
          title:
            ref.level === "high"
              ? `Retention risk: ${ref.employee.role_title}`
              : `Early signal: ${ref.employee.role_title}`,
          summary:
            ref.level === "high"
              ? "Multiple signals are moving against their own baselines."
              : "One signal has softened while the others are stable.",
          recommendation: {
            recommendation:
              narrative?.actions[0] ??
              "Run a structured check-in and review workload before creating any formal plan.",
            confidence: narrative?.confidence ?? null,
            reasoning_signals: ref.signals,
            explanation: narrative?.explanation ?? "",
            recommended_actions: narrative?.actions.length
              ? narrative.actions
              : ["Manager check-in", "Re-measure next cycle"],
            requires_human_review: true,
          },
          status: "pending",
        };
      });

    // A pending card is refreshed rather than duplicated, so the queue always shows
    // the most recent assessment for that person.
    const toInsert = recommendationRows.filter((row) => !alreadyPending.has(row.employee_id as string));
    const toRefresh = recommendationRows.filter((row) => alreadyPending.has(row.employee_id as string));

    if (toInsert.length) {
      const { error: recommendationError } = await supabase
        .from("talent_ai_recommendations")
        .insert(toInsert);
      if (recommendationError) throw new Error(recommendationError.message);
    }

    for (const row of toRefresh) {
      const { error: refreshError } = await supabase
        .from("talent_ai_recommendations")
        .update({
          title: row.title,
          summary: row.summary,
          recommendation: row.recommendation,
          updated_at: new Date().toISOString(),
        })
        .eq("employee_id", row.employee_id as string)
        .eq("module", "monitor")
        .eq("status", "pending");
      if (refreshError) throw new Error(refreshError.message);
    }

    await supabase.from("talent_audit_log").insert({
      org_id: orgId,
      action: "risk.assessment_run",
      entity_type: "risk_assessment",
      entity_id: null,
      metadata: {
        assessed: riskRows.length,
        missing_narrative: refs.filter((ref) => !byRef.get(ref.ref)?.explanation).length,
        high: riskRows.filter((row) => row.risk_level === "high").length,
        medium: riskRows.filter((row) => row.risk_level === "medium").length,
        recommendations_queued: recommendationRows.length,
        recommendations_refreshed: toRefresh.length,
        recommendations_new: toInsert.length,
        prompt_tokens: usagePrompt,
        completion_tokens: usageCompletion,
        total_tokens: usageTotal,
        model: MODEL,
      },
    });

    return new Response(
      JSON.stringify({
        ok: true,
        assessed: riskRows.length,
        high: riskRows.filter((row) => row.risk_level === "high").length,
        medium: riskRows.filter((row) => row.risk_level === "medium").length,
        recommendations_queued: recommendationRows.length,
        recommendations_new: toInsert.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The risk assessment failed.";
    console.error("talent-ai-risk failed", message);
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
