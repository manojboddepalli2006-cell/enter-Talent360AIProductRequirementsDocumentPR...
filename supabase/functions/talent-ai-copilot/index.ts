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
const META_MARKER = "[[TALENT360_META]]";
const ESCALATE_TOKEN = "[[ESCALATE]]";

const SYSTEM_PROMPT = [
  "You are the HR Policy Copilot inside Talent360 AI. You answer questions from an organisation's own policy documents.",
  "Rules you must not break:",
  "- Answer only from the numbered policy extracts provided in the user message. Do not use outside knowledge or general HR practice.",
  "- Cite the extracts you rely on inline using their numbers, for example [1] or [2][3].",
  "- If the extracts do not answer the question, say that the policy library does not cover it and end your reply with the exact token [[ESCALATE]] on its own line.",
  "- If the question concerns harassment, discrimination, a legal dispute, a medical matter or anything about a specific person's case, do not attempt an answer. Direct the person to a human HR contact and end with [[ESCALATE]].",
  "- Never invent a policy clause, a number of days, or a monetary figure that is not in the extracts.",
  "- Be concise and practical. Two short paragraphs at most unless the question genuinely needs a list.",
].join(NL);

function sseFrame(payload: string): string {
  return `data: ${payload}${NL}${NL}`;
}

function textFrame(text: string): string {
  return sseFrame(
    JSON.stringify({ choices: [{ index: 0, delta: { content: text }, finish_reason: null }] }),
  );
}

interface Chunk {
  chunk_id: string;
  document_id: string;
  document_title: string;
  section: string | null;
  chunk_text: string;
  rank: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startedAt = Date.now();

  try {
    const sessionId = req.headers.get("X-Session-ID")?.trim() || crypto.randomUUID();
    const body = (await req.json()) as { question?: string; history?: Array<{ role: string; content: string }> };
    const question = body.question?.trim();

    if (!question) throw new Error("A question is required.");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
    );

    const { data: profile } = await supabase
      .from("talent_profiles")
      .select("id, org_id")
      .eq("id", (await supabase.auth.getUser()).data.user?.id ?? "")
      .maybeSingle();

    const orgId = profile?.org_id ?? null;
    if (!orgId) throw new Error("Your workspace could not be resolved.");

    // Ranked retrieval over the organisation's own policy chunks.
    const { data: chunks, error: searchError } = await supabase.rpc("talent_search_policy_chunks", {
      query_text: question,
      match_count: 6,
    });

    if (searchError) throw new Error(searchError.message);

    const retrieved = (chunks ?? []) as Chunk[];

    // No retrieval hit means no grounded answer. The user is told to escalate
    // rather than receiving a plausible-sounding invention.
    if (!retrieved.length) {
      const message =
        "The policy library has no passage that matches this question, so I am not going to guess. Please raise it with your HR contact directly, or check whether the relevant policy has been uploaded.";

      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          controller.enqueue(encoder.encode(sseFrame(JSON.stringify({
            choices: [{ index: 0, delta: { content: message }, finish_reason: null }],
          }))));
          controller.enqueue(encoder.encode(sseFrame(JSON.stringify({
            choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
          }))));
          controller.enqueue(
            encoder.encode(
              textFrame(
                `${NL}${META_MARKER}${JSON.stringify({ citations: [], escalated: true, confidence: 0 })}`,
              ),
            ),
          );
          controller.enqueue(encoder.encode(sseFrame("[DONE]")));
          controller.close();

          await supabase.from("talent_copilot_queries").insert({
            org_id: orgId,
            user_id: profile.id,
            question,
            answer: message,
            cited_chunks: [],
            escalated: true,
            confidence: 0,
          });
        },
      });

      return new Response(stream, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
        },
      });
    }

    const extracts = retrieved
      .map((chunk, index) => {
        const section = chunk.section ? `${chunk.document_title} — ${chunk.section}` : chunk.document_title;
        return `[${index + 1}] ${section}${NL}${chunk.chunk_text}`;
      })
      .join(`${NL}${NL}`);

    const history = Array.isArray(body.history)
      ? body.history.filter((entry) => entry.role === "user" || entry.role === "assistant").slice(-4)
      : [];

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history.map((entry) => ({ role: entry.role, content: entry.content })),
      {
        role: "user",
        content: `POLICY EXTRACTS:${NL}${extracts}${NL}${NL}QUESTION: ${question}`,
      },
    ];

    const upstream = await fetch(`${API_BASE}/code/api/v1/ai/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AI_API_TOKEN}`,
        "Content-Type": "application/json",
        "X-Session-ID": sessionId,
        "X-Enter-Project-ID": PROJECT_ID,
      },
      body: JSON.stringify({ model: MODEL, messages, stream: true, temperature: 0.2, max_tokens: 1200 }),
    });

    if (!upstream.ok) {
      const raw = await upstream.text();
      let message = `The copilot request failed with status ${upstream.status}`;
      try {
        const parsed = JSON.parse(raw) as { error?: { message?: string } };
        if (parsed.error?.message) message = parsed.error.message;
      } catch { /* keep status message */ }

      const encoder = new TextEncoder();
      return new Response(
        encoder.encode(`event: error${NL}data: ${JSON.stringify({ error: { message, type: "api_error" } })}${NL}${NL}`),
        { status: upstream.status, headers: { ...corsHeaders, "Content-Type": "text/event-stream" } },
      );
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const usage = { prompt: 0, completion: 0, total: 0 };
    let answer = "";

    const stream = new ReadableStream({
      async start(controller) {
        const reader = upstream.body!.getReader();
        let buffer = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const text = decoder.decode(value, { stream: true });
            controller.enqueue(encoder.encode(text));

            buffer += text;
            const lines = buffer.split(NL);
            buffer = lines.pop() ?? "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith("data:")) continue;
              const payload = trimmed.slice(5).trim();
              if (payload === "[DONE]") continue;

              try {
                const parsed = JSON.parse(payload) as {
                  choices?: Array<{ delta?: { content?: string } }>;
                  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
                };
                const delta = parsed.choices?.[0]?.delta?.content;
                if (delta) answer += delta;
                if (parsed.usage) {
                  usage.prompt = parsed.usage.prompt_tokens ?? usage.prompt;
                  usage.completion = parsed.usage.completion_tokens ?? usage.completion;
                  usage.total = parsed.usage.total_tokens ?? usage.total;
                }
              } catch {
                // Ignore frames that are not JSON chunks.
              }
            }
          }

          const escalated = answer.includes(ESCALATE_TOKEN);
          const cleanAnswer = answer.split(ESCALATE_TOKEN).join("").trim();

          const citations = retrieved.map((chunk) => ({
            chunk_id: chunk.chunk_id,
            document_title: chunk.document_title,
            section: chunk.section,
          }));

          // The client reads this trailing block to render sources without
          // re-parsing prose.
          controller.enqueue(
            encoder.encode(
              textFrame(
                `${NL}${META_MARKER}${JSON.stringify({
                  citations,
                  escalated,
                  confidence: escalated ? 0.3 : 0.8,
                })}`,
              ),
            ),
          );
          controller.enqueue(encoder.encode(sseFrame("[DONE]")));
        } finally {
          controller.close();
        }

        await supabase.from("talent_copilot_queries").insert({
          org_id: orgId,
          user_id: profile.id,
          question,
          answer: cleanAnswer,
          cited_chunks: retrieved.map((chunk) => ({
            chunk_id: chunk.chunk_id,
            document_title: chunk.document_title,
            section: chunk.section,
          })),
          escalated,
          confidence: escalated ? 0.3 : 0.8,
        });

        await supabase.from("talent_ai_usage").insert({
          org_id: orgId,
          function_name: "talent-ai-copilot",
          provider: "qwen",
          model: MODEL,
          prompt_tokens: usage.prompt,
          completion_tokens: usage.completion,
          total_tokens: usage.total,
          cost_estimate: Number((usage.total * 0.0000004).toFixed(6)),
          status: "success",
          latency_ms: Date.now() - startedAt,
        });
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The copilot request failed.";
    console.error("talent-ai-copilot failed", message);
    return new Response(
      `event: error${NL}data: ${JSON.stringify({ error: { message, type: "api_error" } })}${NL}${NL}`,
      { status: 400, headers: { ...corsHeaders, "Content-Type": "text/event-stream" } },
    );
  }
});
