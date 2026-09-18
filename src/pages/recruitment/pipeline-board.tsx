import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, GripVertical } from "lucide-react";
import { StatusPill } from "@/components/common/status-pill";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PIPELINE_STAGES, STAGE_TONE } from "@/lib/domain";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ApplicationWithContext } from "@/lib/api/recruitment";

interface PipelineBoardProps {
  applications: ApplicationWithContext[];
  onMove: (applicationId: string, stage: string) => void;
  movingId: string | null;
}

const BOARD_STAGES = PIPELINE_STAGES.filter((stage) => stage.key !== "rejected");

function scoreTone(score: number | null): "success" | "info" | "warning" | "danger" | "neutral" {
  if (score === null) return "neutral";
  if (score >= 85) return "success";
  if (score >= 70) return "info";
  if (score >= 60) return "warning";
  return "danger";
}

export function PipelineBoard({ applications, onMove, movingId }: PipelineBoardProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);

  return (
    <div className="talent-scroll -mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
      {BOARD_STAGES.map((stage) => {
        const items = applications.filter((application) => application.stage === stage.key);
        const isTarget = overStage === stage.key;

        return (
          <section
            key={stage.key}
            onDragOver={(event) => {
              event.preventDefault();
              setOverStage(stage.key);
            }}
            onDragLeave={() => setOverStage((current) => (current === stage.key ? null : current))}
            onDrop={(event) => {
              event.preventDefault();
              setOverStage(null);
              const id = event.dataTransfer.getData("text/plain") || draggingId;
              if (id) onMove(id, stage.key);
              setDraggingId(null);
            }}
            className={cn(
              "flex w-[268px] shrink-0 flex-col gap-2 rounded-xl border bg-muted/30 p-3 transition-colors",
              isTarget ? "border-primary bg-primary-soft/40" : "border-border",
            )}
          >
            <header className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <span className="text-[12px] font-extrabold uppercase tracking-[0.06em] text-foreground">
                  {stage.label}
                </span>
                <span className="rounded-full bg-card px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                  {items.length}
                </span>
              </span>
            </header>

            <div className="flex flex-col gap-2">
              {items.map((application) => {
                const busy = movingId === application.id;
                return (
                  <article
                    key={application.id}
                    draggable
                    onDragStart={(event) => {
                      setDraggingId(application.id);
                      event.dataTransfer.setData("text/plain", application.id);
                      event.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => setDraggingId(null)}
                    className={cn(
                      "group cursor-grab rounded-xl border border-border bg-card p-3 shadow-card transition-opacity active:cursor-grabbing",
                      busy ? "opacity-50" : "opacity-100",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link
                          to={`/app/recruitment/${application.id}`}
                          className="block truncate text-[13px] font-bold text-foreground hover:text-primary"
                        >
                          {application.candidate?.full_name ?? "Candidate"}
                        </Link>
                        <div className="truncate text-[11px] font-medium text-muted-foreground">
                          {application.job?.title ?? "Role removed"}
                        </div>
                      </div>
                      <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    </div>

                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                      <StatusPill tone={scoreTone(application.ai_match_score)}>
                        {application.ai_match_score === null
                          ? "Not scored"
                          : `${formatNumber(Number(application.ai_match_score))}% match`}
                      </StatusPill>
                      {application.bias_flags &&
                      Array.isArray(application.bias_flags) &&
                      application.bias_flags.length > 0 ? (
                        <StatusPill tone="warning">Fairness flag</StatusPill>
                      ) : null}
                      {application.interviewCount > 0 ? (
                        <StatusPill tone="neutral">
                          {application.interviewCount} interview{application.interviewCount === 1 ? "" : "s"}
                        </StatusPill>
                      ) : null}
                    </div>

                    <div className="mt-2.5">
                      <DropdownMenu>
                        <DropdownMenuTrigger className="flex h-7 w-full items-center justify-center gap-1.5 rounded-lg bg-muted text-[11px] font-bold text-foreground transition-colors hover:bg-muted/70">
                          Move stage
                          <ChevronDown className="h-3 w-3" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-52">
                          <DropdownMenuLabel>Move to</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {PIPELINE_STAGES.filter((option) => option.key !== application.stage).map(
                            (option) => (
                              <DropdownMenuItem
                                key={option.key}
                                onSelect={() => onMove(application.id, option.key)}
                              >
                                <StatusPill tone={STAGE_TONE[option.key] ?? "neutral"}>
                                  {option.label}
                                </StatusPill>
                              </DropdownMenuItem>
                            ),
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </article>
                );
              })}

              {!items.length ? (
                <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-[11.5px] font-medium text-muted-foreground">
                  {stage.key === "sourced" ? "Add a candidate to start the pipeline" : "Nothing here"}
                </p>
              ) : null}
            </div>
          </section>
        );
      })}
    </div>
  );
}
