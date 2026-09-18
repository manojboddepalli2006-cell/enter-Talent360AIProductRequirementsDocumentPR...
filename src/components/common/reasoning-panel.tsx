import { ArrowDownRight, ArrowRight, ArrowUpRight, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusPill } from "@/components/common/status-pill";
import { confidenceBand, DIRECTION_TONE } from "@/lib/domain";
import type { ReasoningSignal } from "@/lib/ai-parse";

interface ReasoningPanelProps {
  signals: ReasoningSignal[];
  explanation?: string | null;
  confidence?: number | null;
  recommendedActions?: string[];
  requiresHumanReview?: boolean;
  className?: string;
}

const DIRECTION_ICON = {
  up: ArrowUpRight,
  down: ArrowDownRight,
  flat: ArrowRight,
} as const;

/**
 * The explainability surface required by the PRD: every AI output shows which
 * signals moved, how much they were weighted, and whether a human must decide.
 */
export function ReasoningPanel({
  signals,
  explanation,
  confidence,
  recommendedActions = [],
  requiresHumanReview = true,
  className,
}: ReasoningPanelProps) {
  const band = confidenceBand(confidence);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {explanation ? (
        <p className="text-[12.5px] font-medium leading-relaxed text-muted-foreground">{explanation}</p>
      ) : null}

      {signals.length ? (
        <div className="flex flex-col gap-1.5">
          <span className="talent-label">Reasoning signals</span>
          <div className="flex flex-col gap-1.5">
            {signals.map((signal) => {
              const direction = (signal.direction ?? "flat") as keyof typeof DIRECTION_ICON;
              const Icon = DIRECTION_ICON[direction] ?? ArrowRight;
              const tone = DIRECTION_TONE[direction] ?? "neutral";

              return (
                <div
                  key={`${signal.factor}-${signal.detail ?? ""}`}
                  className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-2.5 py-2"
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md",
                      tone === "success" && "bg-success-soft text-success-soft-foreground",
                      tone === "danger" && "bg-destructive-soft text-destructive-soft-foreground",
                      tone === "neutral" && "bg-muted text-muted-foreground",
                    )}
                  >
                    <Icon className="h-3 w-3" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[12px] font-bold text-foreground">{signal.factor}</span>
                      {signal.weight ? (
                        <StatusPill tone={signal.weight === "high" ? "danger" : signal.weight === "medium" ? "warning" : "neutral"}>
                          {signal.weight} weight
                        </StatusPill>
                      ) : null}
                    </div>
                    {signal.detail ? (
                      <p className="mt-0.5 text-[11.5px] font-medium leading-snug text-muted-foreground">
                        {signal.detail}
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {recommendedActions.length ? (
        <div className="flex flex-col gap-1.5">
          <span className="talent-label">Recommended actions</span>
          <ul className="flex flex-col gap-1">
            {recommendedActions.map((action) => (
              <li key={action} className="flex items-start gap-2 text-[12.5px] font-medium text-foreground">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                {action}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <StatusPill tone={band.tone}>{band.label}</StatusPill>
        {requiresHumanReview ? (
          <StatusPill tone="warning" icon={<ShieldCheck className="h-3 w-3" />}>
            Human review required
          </StatusPill>
        ) : (
          <StatusPill tone="neutral">No decision proposed</StatusPill>
        )}
      </div>
    </div>
  );
}
