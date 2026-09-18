import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Briefcase,
  Eye,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Users,
  Wand2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  listApplications,
  listJobPostings,
  moveApplicationStage,
  recordApplicationDecision,
  type ApplicationWithContext,
} from "@/lib/api/recruitment";
import { PageHeader } from "@/components/common/page-header";
import { FilterTabs } from "@/components/common/filter-tabs";
import { StatusPill } from "@/components/common/status-pill";
import { UserCell } from "@/components/common/user-cell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/states";
import { PipelineBoard } from "@/pages/recruitment/pipeline-board";
import { IntakeDialog } from "@/pages/recruitment/intake-dialog";
import { JobDialog } from "@/pages/recruitment/job-dialog";
import { PIPELINE_STAGES, STAGE_TONE } from "@/lib/domain";
import { formatNumber, formatRelative } from "@/lib/format";
import { useProfile } from "@/hooks/use-profile";
import { useSession } from "@/hooks/use-session";
import { cn } from "@/lib/utils";

type View = "pipeline" | "table";

function scoreTone(score: number | null): "success" | "info" | "warning" | "danger" | "neutral" {
  if (score === null) return "neutral";
  if (score >= 85) return "success";
  if (score >= 70) return "info";
  if (score >= 60) return "warning";
  return "danger";
}

export default function RecruitmentPage() {
  const queryClient = useQueryClient();
  const { profile, org } = useProfile();
  const { user } = useSession();

  const [view, setView] = useState<View>("pipeline");
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [movingId, setMovingId] = useState<string | null>(null);
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [jobDialogOpen, setJobDialogOpen] = useState(false);

  const applicationsQuery = useQuery({
    queryKey: ["talent360-applications"],
    queryFn: listApplications,
  });

  const jobsQuery = useQuery({
    queryKey: ["talent360-jobs"],
    queryFn: listJobPostings,
  });

  const applications = useMemo(() => applicationsQuery.data ?? [], [applicationsQuery.data]);
  const jobs = jobsQuery.data ?? [];

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["talent360-applications"] });
    await queryClient.invalidateQueries({ queryKey: ["talent360-command-center"] });
  };

  const moveMutation = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: string }) => {
      setMovingId(id);
      await moveApplicationStage(id, stage);
    },
    onSuccess: async () => {
      await invalidate();
    },
    onError: (error) => {
      toast.error("Stage not updated", {
        description: error instanceof Error ? error.message : "The move could not be saved.",
      });
    },
    onSettled: () => setMovingId(null),
  });

  const decideMutation = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: string }) => {
      await recordApplicationDecision(id, stage, user?.id ?? null);
    },
    onSuccess: async () => {
      await invalidate();
      toast.success("Decision recorded");
    },
    onError: (error) => {
      toast.error("Decision not saved", {
        description: error instanceof Error ? error.message : "The decision could not be recorded.",
      });
    },
  });

  const matchMutation = useMutation({
    mutationFn: async (applicationId: string) => {
      const { data, error } = await supabase.functions.invoke("talent-ai-resume-match", {
        body: { applicationId },
        headers: { "Content-Type": "application/json" },
      });
      if (error) throw new Error(error.message);
      const result = data as { ok?: boolean; error?: string; match_score?: number } | null;
      if (result?.error || result?.ok === false) throw new Error(result.error ?? "The match failed.");
      return result;
    },
    onSuccess: async (result) => {
      await invalidate();
      toast.success("Match scored", { description: `Overall match ${result?.match_score ?? "—"}%.` });
    },
    onError: (error) => {
      toast.error("Match failed", {
        description: error instanceof Error ? error.message : "The match could not be produced.",
      });
    },
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return applications.filter((application) => {
      const stageOk = stageFilter === "all" ? true : application.stage === stageFilter;
      if (!stageOk) return false;
      if (!term) return true;
      return (
        (application.candidate?.full_name ?? "").toLowerCase().includes(term) ||
        (application.candidate?.email ?? "").toLowerCase().includes(term) ||
        (application.job?.title ?? "").toLowerCase().includes(term)
      );
    });
  }, [applications, search, stageFilter]);

  const counts = useMemo(() => {
    const base: Record<string, number> = { all: applications.length };
    PIPELINE_STAGES.forEach((stage) => {
      base[stage.key] = applications.filter((application) => application.stage === stage.key).length;
    });
    return base;
  }, [applications]);

  const unscored = applications.filter((application) => application.ai_match_score === null);

  const renderRow = (application: ApplicationWithContext) => (
    <tr key={application.id} className="border-b border-border last:border-0">
      <td className="py-3 pr-4">
        <UserCell name={application.candidate?.full_name} subtext={application.candidate?.email} />
      </td>
      <td className="py-3 pr-4">
        <div className="truncate text-[12.5px] font-semibold text-foreground">
          {application.job?.title ?? "—"}
        </div>
        <div className="truncate text-[11px] font-medium text-muted-foreground">
          {application.candidate?.source ?? "Direct"} · applied {formatRelative(application.created_at)}
        </div>
      </td>
      <td className="py-3 pr-4">
        <StatusPill tone={STAGE_TONE[application.stage] ?? "neutral"}>
          {PIPELINE_STAGES.find((stage) => stage.key === application.stage)?.label ?? application.stage}
        </StatusPill>
      </td>
      <td className="py-3 pr-4">
        <StatusPill tone={scoreTone(application.ai_match_score)}>
          {application.ai_match_score === null
            ? "Not scored"
            : `${formatNumber(Number(application.ai_match_score))}%`}
        </StatusPill>
      </td>
      <td className="py-3 pr-4">
        {application.bias_flags &&
        Array.isArray(application.bias_flags) &&
        application.bias_flags.length > 0 ? (
          <StatusPill tone="warning">Review</StatusPill>
        ) : (
          <span className="text-[11.5px] font-medium text-muted-foreground">—</span>
        )}
      </td>
      <td className="py-3 pr-4 text-[12px] font-semibold text-foreground">
        {application.interviewCount}
      </td>
      <td className="py-3">
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <Button variant="soft" size="sm" asChild>
            <Link to={`/app/recruitment/${application.id}`}>
              <Eye className="h-3.5 w-3.5" />
              View
            </Link>
          </Button>
          <Button
            variant="soft-primary"
            size="sm"
            disabled={matchMutation.isPending}
            onClick={() => matchMutation.mutate(application.id)}
          >
            {matchMutation.isPending && matchMutation.variables === application.id ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Wand2 className="h-3.5 w-3.5" />
            )}
            Match
          </Button>
          {application.stage !== "rejected" ? (
            <Button
              variant="soft-destructive"
              size="sm"
              disabled={decideMutation.isPending}
              onClick={() => decideMutation.mutate({ id: application.id, stage: "rejected" })}
            >
              Reject
            </Button>
          ) : null}
        </div>
      </td>
    </tr>
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Recruitment pipeline"
        description="Explainable candidate scoring. A fairness flag is raised for human review and never filters anyone automatically."
        statusLabel={`${jobs.length} open requisition${jobs.length === 1 ? "" : "s"}`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setJobDialogOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              Job posting
            </Button>
            <Button variant="outline" size="sm" onClick={() => void invalidate()}>
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={() => setIntakeOpen(true)}
              disabled={!jobs.length}
              title={jobs.length ? undefined : "Create a job posting first"}
            >
              <Plus className="h-3.5 w-3.5" />
              Add candidate
            </Button>
          </>
        }
      />

      {!jobs.length && !jobsQuery.isLoading ? (
        <EmptyState
          icon={<Briefcase className="h-5 w-5" />}
          title="No job postings yet"
          description="Candidate matching needs a job description to score against. Create a requisition first."
          action={
            <Button size="sm" onClick={() => setJobDialogOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              Create job posting
            </Button>
          }
        />
      ) : null}

      {jobs.length ? (
        <>
          <div className="talent-tile flex flex-wrap items-center justify-between gap-3 px-4 pb-1 pt-3 shadow-card">
            <FilterTabs
              items={[
                { key: "all", label: "All", count: counts.all },
                ...PIPELINE_STAGES.map((stage) => ({
                  key: stage.key,
                  label: stage.label,
                  count: counts[stage.key] ?? 0,
                })),
              ]}
              value={stageFilter}
              onChange={setStageFilter}
            />

            <div className="flex items-center gap-2 pb-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search candidates"
                  className="h-8 w-[190px] pl-8"
                />
              </div>
              <div className="flex items-center gap-1 rounded-lg bg-muted p-0.5">
                {(["pipeline", "table"] as View[]).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setView(option)}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-[11.5px] font-bold capitalize transition-colors",
                      view === option ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
                    )}
                  >
                    {option === "pipeline" ? "Board" : "Table"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {scoredNotice(unscored.length, matchMutation.isPending, () => {
            const target = unscored[0];
            if (target) matchMutation.mutate(target.id);
          })}

          {applicationsQuery.isLoading ? <LoadingState label="Reading the pipeline" /> : null}

          {applicationsQuery.error ? (
            <ErrorState
              message={
                applicationsQuery.error instanceof Error
                  ? applicationsQuery.error.message
                  : "The pipeline could not be loaded."
              }
              onRetry={() => void applicationsQuery.refetch()}
            />
          ) : null}

          {!applicationsQuery.isLoading && !applicationsQuery.error && !filtered.length ? (
            <EmptyState
              icon={<Users className="h-5 w-5" />}
              title="No applications in this view"
              description="Adjust the filter, or add a candidate to the pipeline."
              action={
                <Button size="sm" onClick={() => setIntakeOpen(true)}>
                  <Plus className="h-3.5 w-3.5" />
                  Add candidate
                </Button>
              }
            />
          ) : null}

          {!applicationsQuery.isLoading && !applicationsQuery.error && filtered.length ? (
            view === "pipeline" ? (
              <PipelineBoard
                applications={filtered}
                movingId={movingId}
                onMove={(id, stage) => moveMutation.mutate({ id, stage })}
              />
            ) : (
              <div className="talent-tile overflow-hidden shadow-card">
                <div className="talent-scroll overflow-x-auto">
                  <table className="w-full min-w-[900px] border-collapse">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="py-3 pr-4 text-left talent-label">Candidate</th>
                        <th className="py-3 pr-4 text-left talent-label">Role</th>
                        <th className="py-3 pr-4 text-left talent-label">Stage</th>
                        <th className="py-3 pr-4 text-left talent-label">AI match</th>
                        <th className="py-3 pr-4 text-left talent-label">Fairness</th>
                        <th className="py-3 pr-4 text-left talent-label">Interviews</th>
                        <th className="py-3 text-right talent-label">Actions</th>
                      </tr>
                    </thead>
                    <tbody>{filtered.map(renderRow)}</tbody>
                  </table>
                </div>
              </div>
            )
          ) : null}
        </>
      ) : null}

      <IntakeDialog
        open={intakeOpen}
        onOpenChange={setIntakeOpen}
        jobs={jobs}
        onCreated={(applicationId) => {
          void invalidate();
          toast.info("Next step", {
            description: "Run the AI match from the candidate page to score them against the posting.",
            action: { label: "Open", onClick: () => window.location.assign(`/app/recruitment/${applicationId}`) },
          });
        }}
      />

      <JobDialog
        open={jobDialogOpen}
        onOpenChange={setJobDialogOpen}
        orgId={org?.id ?? null}
        createdBy={profile?.id ?? null}
        onCreated={() => void invalidate()}
      />

      <p className="text-[11.5px] font-medium leading-relaxed text-muted-foreground">
        Drag a card between columns, or use the move menu. Scoring prompts exclude protected attributes,
        and a flagged match is routed to a human rather than being filtered out.
      </p>
    </div>
  );
}

function scoredNotice(count: number, busy: boolean, onScore: () => void) {
  if (!count) return null;
  return (
    <div className="talent-tile flex flex-wrap items-center justify-between gap-3 px-4 py-3 shadow-card">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-[12.5px] font-semibold text-foreground">
          {count} application{count === 1 ? "" : "s"} without a match score
        </span>
        <span className="hidden text-[11.5px] font-medium text-muted-foreground sm:inline">
          Score each one against its posting to unlock the shortlist view.
        </span>
      </div>
      <Button size="sm" variant="outline" onClick={onScore} disabled={busy}>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
        Score next
      </Button>
    </div>
  );
}
