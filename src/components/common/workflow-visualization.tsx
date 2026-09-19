import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface WorkflowStep {
  key: string;
  label: string;
  state: "pending" | "active" | "done";
}

/**
 * The Enter Pro flow rendered as glowing orbital nodes:
 * AI Insight → Human Review → Approved → Enter Pro Workflow → Task → Follow-up → Outcome.
 * Nodes change state (pending / active / done) and the connectors carry the AI gradient.
 */
export function WorkflowVisualization({
  steps,
  className,
}: {
  steps: WorkflowStep[];
  className?: string;
}) {
  const doneCount = steps.filter((step) => step.state === "done").length;

  return (
    <div className={cn("flex w-full flex-col gap-0", className)}>
      <div className="flex flex-wrap items-center">
        {steps.map((step, index) => {
          const active = step.state === "active";
          const done = step.state === "done";
          const connectorActive = index < doneCount || (index === doneCount && active);

          return (
            <div key={step.key} className="flex items-center">
              <div className="flex flex-col items-center gap-1.5 px-1.5">
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full border transition-all duration-300",
                    done && "border-success/60 bg-success/15 text-success",
                    active &&
                      "border-primary/60 bg-primary/10 text-primary shadow-glow animate-pulse-soft",
                    !done && !active && "border-border bg-card text-muted-foreground",
                  )}
                >
                  {done ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : active ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Circle className="h-3 w-3" />
                  )}
                </span>
                <span
                  className={cn(
                    "w-20 text-center text-[10px] font-bold leading-tight",
                    done ? "text-success" : active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  {step.label}
                </span>
              </div>

              {index < steps.length - 1 ? (
                <div className="mb-6 h-px flex-1 min-w-4">
                  <div
                    className={cn(
                      "h-px w-full transition-all duration-500",
                      connectorActive ? "bg-gradient-ai opacity-80" : "bg-border",
                    )}
                    style={connectorActive ? { boxShadow: "0 0 6px hsl(var(--primary) / 0.6)" } : undefined}
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
