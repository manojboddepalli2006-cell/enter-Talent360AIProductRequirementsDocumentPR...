/**
 * Tolerant parser for the structured AI contract described in the PRD:
 * { recommendation, confidence, reasoning_signals[], explanation,
 *   recommended_actions[], requires_human_review }
 *
 * Models occasionally wrap JSON in prose or code fences, so the first brace
 * block is extracted before parsing. Callers must handle a null result rather
 * than rendering a missing score as zero.
 */

export interface ReasoningSignal {
  factor: string;
  direction: "up" | "down" | "flat" | string;
  weight?: "high" | "medium" | "low" | string;
  detail?: string;
}

export interface StructuredAiResult {
  recommendation: string;
  confidence: number | null;
  reasoning_signals: ReasoningSignal[];
  explanation: string;
  recommended_actions: string[];
  requires_human_review: boolean;
  [key: string]: unknown;
}

function extractJsonBlock(raw: string): string | null {
  const withoutFences = raw.replace(/```json/gi, "```").split("```").join("\n");
  const start = withoutFences.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < withoutFences.length; index += 1) {
    const char = withoutFences[index];

    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return withoutFences.slice(start, index + 1);
    }
  }

  return null;
}

function coerceSignals(value: unknown): ReasoningSignal[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      factor: String(item.factor ?? "Signal"),
      direction: String(item.direction ?? "flat"),
      weight: item.weight === undefined ? undefined : String(item.weight),
      detail: item.detail === undefined ? undefined : String(item.detail),
    }));
}

function coerceActions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item)).filter(Boolean);
}

export function parseStructuredAiResult(raw: string): StructuredAiResult | null {
  if (!raw) return null;
  const block = extractJsonBlock(raw);
  if (!block) return null;

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(block) as Record<string, unknown>;
  } catch {
    return null;
  }

  const confidenceRaw = parsed.confidence;
  const confidence =
    typeof confidenceRaw === "number"
      ? confidenceRaw
      : typeof confidenceRaw === "string" && confidenceRaw.trim() !== "" && !Number.isNaN(Number(confidenceRaw))
        ? Number(confidenceRaw)
        : null;

  return {
    ...parsed,
    recommendation: String(parsed.recommendation ?? ""),
    confidence,
    reasoning_signals: coerceSignals(parsed.reasoning_signals),
    explanation: String(parsed.explanation ?? ""),
    recommended_actions: coerceActions(parsed.recommended_actions),
    requires_human_review: parsed.requires_human_review !== false,
  };
}

/**
 * Reads a section of a streamed Copilot answer. The backend appends a trailing
 * citation block as a fenced json payload so the UI can render sources without
 * re-parsing prose.
 */
export interface CopilotAnswer {
  answer: string;
  citations: Array<{ chunk_id: string; document_title: string; section: string | null }>;
  escalated: boolean;
  confidence: number | null;
}

export function splitCopilotPayload(raw: string): CopilotAnswer {
  const marker = "[[TALENT360_META]]";
  const markerIndex = raw.indexOf(marker);

  if (markerIndex === -1) {
    return { answer: raw.trim(), citations: [], escalated: false, confidence: null };
  }

  const answer = raw.slice(0, markerIndex).trim();
  const metaRaw = raw.slice(markerIndex + marker.length);
  const block = extractJsonBlock(metaRaw);

  if (!block) {
    return { answer, citations: [], escalated: false, confidence: null };
  }

  try {
    const meta = JSON.parse(block) as Record<string, unknown>;
    const citations = Array.isArray(meta.citations)
      ? meta.citations
          .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
          .map((item) => ({
            chunk_id: String(item.chunk_id ?? ""),
            document_title: String(item.document_title ?? "Policy"),
            section: item.section === undefined || item.section === null ? null : String(item.section),
          }))
      : [];

    return {
      answer,
      citations,
      escalated: meta.escalated === true,
      confidence: typeof meta.confidence === "number" ? meta.confidence : null,
    };
  } catch {
    return { answer, citations: [], escalated: false, confidence: null };
  }
}
