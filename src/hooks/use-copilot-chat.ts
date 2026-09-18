import { useCallback, useRef, useState } from "react";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import { supabase, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/integrations/supabase/client";
import { splitCopilotPayload } from "@/lib/ai-parse";

export interface CopilotCitation {
  chunk_id: string;
  document_title: string;
  section: string | null;
}

export interface CopilotMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: CopilotCitation[];
  escalated: boolean;
  isStreaming: boolean;
}

const FALLBACK_MESSAGES: Record<string, string> = {
  authentication_error: "Authentication failed. Please refresh the page.",
  rate_limit_error: "Too many requests. Please wait a moment.",
  invalid_request_error: "Invalid request. Please rephrase the question.",
  overloaded_error: "The service is busy. Please try again shortly.",
  insufficient_quota: "This website's AI credits have been exhausted. Please contact the administrator.",
  permission_error: "AI capability is disabled for this workspace.",
  api_error: "The service is temporarily unavailable.",
};

function userMessage(code: string | undefined, backendMessage: string | undefined): string {
  if (backendMessage) return backendMessage;
  return FALLBACK_MESSAGES[code ?? "api_error"] ?? FALLBACK_MESSAGES.api_error;
}

/**
 * Streams answers from the Policy Copilot backend function.
 * Handles the four error levels the AI gateway requires: connection, stream,
 * network and exception.
 */
export function useCopilotChat() {
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionIdRef = useRef<string>(crypto.randomUUID());
  const abortRef = useRef<AbortController | null>(null);

  const ask = useCallback(async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed) return;

    setError(null);
    setIsStreaming(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      setError("Your session has expired. Sign in again to use the copilot.");
      setIsStreaming(false);
      return;
    }

    const userEntry: CopilotMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      citations: [],
      escalated: false,
      isStreaming: false,
    };
    const assistantId = crypto.randomUUID();
    const assistantEntry: CopilotMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      citations: [],
      escalated: false,
      isStreaming: true,
    };

    const history = [...messages, userEntry]
      .filter((message) => !message.isStreaming && message.content)
      .slice(-5)
      .map((message) => ({ role: message.role, content: message.content }));

    setMessages((previous) => [...previous, userEntry, assistantEntry]);
    abortRef.current = new AbortController();
    let buffer = "";

    const patch = (updates: Partial<CopilotMessage>) => {
      setMessages((previous) =>
        previous.map((message) => (message.id === assistantId ? { ...message, ...updates } : message)),
      );
    };

    try {
      await fetchEventSource(`${SUPABASE_URL}/functions/v1/talent-ai-copilot`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          apikey: SUPABASE_PUBLISHABLE_KEY,
          "X-Session-ID": sessionIdRef.current,
        },
        body: JSON.stringify({ question: trimmed, history }),
        signal: abortRef.current.signal,

        async onopen(response) {
          const contentType = response.headers.get("content-type");

          if (!response.ok) {
            // Level 0: with streaming, even 4xx/5xx bodies arrive as SSE.
            if (contentType?.includes("text/event-stream")) {
              const text = await response.text();
              const match = text.match(/data: (.+)/);
              if (match) {
                try {
                  const parsed = JSON.parse(match[1]) as { error?: { message?: string; type?: string } };
                  throw new Error(userMessage(parsed.error?.type, parsed.error?.message));
                } catch (parseError) {
                  if (parseError instanceof Error && parseError.message.startsWith("Unexpected")) {
                    // fall through to the generic status message
                  } else {
                    throw parseError;
                  }
                }
              }
            }

            if (contentType?.includes("application/json")) {
              const parsed = (await response.json()) as { error?: { message?: string } };
              throw new Error(userMessage(undefined, parsed.error?.message));
            }

            throw new Error(`Request failed with status ${response.status}`);
          }

          if (!contentType?.includes("text/event-stream")) {
            throw new Error(`Expected a stream but received ${contentType ?? "an unknown type"}`);
          }
        },

        onmessage(event) {
          if (!event.data) return;
          if (event.data === "[DONE]") return;

          let parsed: {
            choices?: Array<{ delta?: { content?: string }; finish_reason?: string | null }>;
            error?: { message?: string; type?: string };
          };

          try {
            parsed = JSON.parse(event.data);
          } catch {
            return;
          }

          // Level 1: an error frame inside an otherwise successful stream.
          if (parsed.error) {
            setError(userMessage(parsed.error.type, parsed.error.message));
            setMessages((previous) => previous.filter((message) => message.id !== assistantId));
            setIsStreaming(false);
            return;
          }

          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            buffer += delta;
            const partial = splitCopilotPayload(buffer);
            patch({ content: partial.answer, citations: partial.citations, escalated: partial.escalated });
          }
        },

        // Level 2: network failure.
        onerror(err) {
          throw err;
        },
      });

      const final = splitCopilotPayload(buffer);
      patch({ content: final.answer, citations: final.citations, escalated: final.escalated, isStreaming: false });
    } catch (caught) {
      // Level 3: exceptions. Abort is a user action, not an error.
      if (!(caught instanceof Error) || caught.name !== "AbortError") {
        setError(caught instanceof Error ? caught.message : "The copilot could not answer.");
        setMessages((previous) => previous.filter((message) => message.id !== assistantId));
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [messages]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    sessionIdRef.current = crypto.randomUUID();
    setMessages([]);
    setError(null);
    setIsStreaming(false);
  }, []);

  return { messages, isStreaming, error, ask, cancel, reset };
}
