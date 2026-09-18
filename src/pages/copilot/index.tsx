import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, BookOpen, CornerDownLeft, Loader2, MessagesSquare, RotateCcw, Send, ShieldAlert, Square } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/common/page-header";
import { ChartCard } from "@/components/common/chart-card";
import { StatusPill } from "@/components/common/status-pill";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCopilotChat } from "@/hooks/use-copilot-chat";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "How many days of annual leave do I get, and how much can I carry over?",
  "What is the process for reporting harassment, and how long does an investigation take?",
  "Can I work from another country for a month?",
  "How much is the annual learning budget and who approves it?",
  "What happens to unused sick leave days?",
];

interface QueryLogRow {
  id: string;
  question: string;
  escalated: boolean;
  created_at: string;
  cited_chunks: unknown;
}

const CANNED_ANSWER =
  "I answer only from your organisation's uploaded policy documents, and I cite the passage each answer comes from. Ask about leave, conduct, remote working or compensation.";

export default function CopilotPage() {
  const [input, setInput] = useState("");
  const { messages, isStreaming, error, ask, cancel, reset } = useCopilotChat();

  const logQuery = useQuery({
    queryKey: ["talent360-copilot-log"],
    queryFn: async () => {
      const { data, error: logError } = await supabase
        .from("talent_copilot_queries")
        .select("id, question, escalated, created_at, cited_chunks")
        .order("created_at", { ascending: false })
        .limit(12);
      if (logError) throw new Error(logError.message);
      return (data ?? []) as QueryLogRow[];
    },
  });

  const submit = (question: string) => {
    setInput("");
    void ask(question);
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="HR Policy Copilot"
        description="Answers are grounded in the organisation's own policy documents and cite the passage they came from. Sensitive or uncovered questions are escalated to a person instead of guessed."
        statusLabel={isStreaming ? "Answering" : "Grounded in your policy library"}
        actions={
          <Button variant="outline" size="sm" onClick={reset} disabled={!messages.length}>
            <RotateCcw className="h-3.5 w-3.5" />
            New conversation
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="talent-tile flex h-[calc(100vh-320px)] min-h-[460px] flex-col overflow-hidden shadow-card xl:col-span-2">
          <div className="talent-scroll flex-1 overflow-y-auto p-4">
            {!messages.length ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
                  <MessagesSquare className="h-5 w-5" />
                </span>
                <h3 className="text-[14px] font-bold text-foreground">Ask about a policy</h3>
                <p className="max-w-md text-[12.5px] font-medium leading-relaxed text-muted-foreground">
                  {CANNED_ANSWER}
                </p>
              </div>
            ) : null}

            <div className="flex flex-col gap-5">
              {messages.map((message) => (
                <div key={message.id} className="flex gap-3">
                  <span
                    className={cn(
                      "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-accent-soft text-accent-soft-foreground",
                    )}
                  >
                    {message.role === "user" ? "You" : "AI"}
                  </span>

                  <div className="min-w-0 flex-1">
                    {message.role === "assistant" && !message.content && message.isStreaming ? (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span className="text-[12.5px] font-medium">Searching the policy library…</span>
                      </div>
                    ) : null}

                    {message.content ? (
                      <div className="whitespace-pre-wrap text-[13px] font-medium leading-relaxed text-foreground">
                        {message.content}
                        {message.isStreaming ? (
                          <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-primary align-text-bottom" />
                        ) : null}
                      </div>
                    ) : null}

                    {message.role === "assistant" && message.citations.length ? (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {message.citations.map((citation, index) => (
                          <span
                            key={`${citation.chunk_id}-${index}`}
                            className="talent-chip border border-border bg-muted/50 text-muted-foreground"
                            title={`Source: ${citation.document_title}`}
                          >
                            <BookOpen className="h-3 w-3" />
                            [{index + 1}] {citation.document_title}
                            {citation.section ? ` — ${citation.section}` : ""}
                          </span>
                        ))}
                      </div>
                    ) : null}

                    {message.role === "assistant" && message.escalated ? (
                      <div className="mt-3 flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2.5">
                        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning-soft-foreground" />
                        <p className="text-[11.5px] font-semibold leading-snug text-warning-soft-foreground">
                          This question is outside what the policy library can answer, so it has been flagged
                          for a human HR contact rather than answered from inference.
                        </p>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {error ? (
            <div className="mx-4 mb-2 flex items-start gap-2 rounded-lg bg-destructive-soft px-3 py-2.5 text-destructive-soft-foreground">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="text-[12px] font-semibold leading-snug">{error}</span>
            </div>
          ) : null}

          <div className="border-t border-border p-3">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                submit(input);
              }}
              className="flex items-end gap-2"
            >
              <Textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    submit(input);
                  }
                }}
                placeholder="Ask about leave, conduct, remote working, compensation…"
                className="min-h-[44px] flex-1 resize-none"
                rows={1}
              />
              {isStreaming ? (
                <Button type="button" variant="outline" size="icon" onClick={cancel} aria-label="Stop">
                  <Square className="h-3.5 w-3.5" />
                </Button>
              ) : (
                <Button type="submit" size="icon" disabled={!input.trim()} aria-label="Send">
                  <Send className="h-3.5 w-3.5" />
                </Button>
              )}
            </form>
            <p className="mt-2 flex items-center gap-1.5 text-[10.5px] font-medium text-muted-foreground">
              <CornerDownLeft className="h-3 w-3" />
              Enter sends · Shift + Enter adds a line · answers cite their source passage
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <ChartCard title="Suggested questions" subtitle="Grounded in the uploaded policies">
            <ul className="flex flex-col gap-1.5">
              {SUGGESTIONS.map((suggestion) => (
                <li key={suggestion}>
                  <button
                    type="button"
                    onClick={() => submit(suggestion)}
                    disabled={isStreaming}
                    className="w-full rounded-lg border border-border px-3 py-2 text-left text-[12px] font-medium leading-snug text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-60"
                  >
                    {suggestion}
                  </button>
                </li>
              ))}
            </ul>
          </ChartCard>

          <ChartCard title="Recent questions" subtitle="Logged for transparency and audit">
            {logQuery.data?.length ? (
              <ul className="flex flex-col gap-2">
                {logQuery.data.map((row) => (
                  <li key={row.id} className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-semibold text-foreground">{row.question}</p>
                      <p className="text-[10.5px] font-medium text-muted-foreground">
                        {formatRelative(row.created_at)}
                      </p>
                    </div>
                    {row.escalated ? <StatusPill tone="warning">Escalated</StatusPill> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[12px] font-medium leading-relaxed text-muted-foreground">
                No questions have been asked in this workspace yet.
              </p>
            )}
          </ChartCard>
        </div>
      </div>
    </div>
  );
}
