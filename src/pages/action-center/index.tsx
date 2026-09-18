import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  BrainCircuit,
  CheckCircle2,
  ClipboardList,
  GitBranch,
  Inbox,
  Loader2,
  Radar,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { listRecommendations, type RecommendationWithContext, type ReviewResult } from "@/lib/api/actions";
import { PageHeader } from "@/components/common/page-header";
import { KpiTile } from "@/components/common/kpi-tile";
import { FilterTabs } from "@/components/common/filter-tabs";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/states";
import { RecommendationCard } from "@/pages/action-center/recommendation-card";
import { DecisionDialog, type DecisionMode } from "@/pages/action-center/decision-dialog";
import { useRealtimeRecommendations } from "@/hooks/use-realtime-recommendations";
import { useProfile } from "@/hooks/use-profile";
import { MODULE_LABELS, RECOMMENDATION_MODULES } from "@/lib/domain";
import { cn } from "@/lib/utils";

type StatusFilter = "pending" | "approved" | "modified" | "rejected" | "all";

const STATUS_TABS: Array<{ key: StatusFilter; label: string }> = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "modified", label: "Changed" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

export default function ActionCenterPage() {
  const queryClient = useQueryClient();
  const { org, profile } = useProfile();
  useRealtimeRecommendations();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [moduleFilter, setModuleFilter] = useState<string>("all");
  const [dialogMode, setDialogMode] = useState<DecisionMode | null>(null);
  const [active, setActive] = useState<RecommendationWithContext | null>(null);

  const recommendationsQuery = useQuery({
    queryKey: ["talent360-recommendations"],
    queryFn: () => listRecommendations(),
  });

  const reviewersQuery = useQuery({
    queryKey: ["talent360-reviewers", org?.id ?? "none"],
    enabled: Boolean(org?.id),
    queryFn: async () => {
      const { data, error } = await supabase.from("talent_profiles").select("id, full_name");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const scanMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("talent-ai-risk", {
        body: {},
        headers: { "Content-Type": "application/json" },
      });
      if (error) throw new Error(error.message);
      const result = data as { ok?: boolean; error?: string; assessed?: number; recommendations_created?: number } | null;
      if (result?.error || result?.ok === false) throw new Error(result.error ?? "The scan failed.");
      return result;
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["talent360-recommendations"] });
      await queryClient.invalidateQueries({ queryKey: ["talent360-risk"] });
      toast.success("Signal scan complete", {
        description: `${result?.assessed ?? 0} people reassessed · ${result?.recommendations_created ?? 0} new recommendation(s) queued.`,
      });
    },
    onError: (error) => {
      toast.error("Signal scan failed", {
        description: error instanceof Error ? error.message : "The scan could not be completed.",
      });
    },
  });

  const reviewerNames = useMemo(() => {
    return (reviewersQuery.data ?? []).reduce<Record<string, string>>((acc, reviewer) => {
      acc[reviewer.id] = reviewer.full_name;
      return acc;
    }, {});
  }, [reviewersQuery.data]);

  const all = useMemo(() => recommendationsQuery.data ?? [], [recommendationsQuery.data]);

  const counts = useMemo(
    () => ({
      pending: all.filter((row) => row.status === "pending").length,
      approved: all.filter((row) => row.status === "approved").length,
      modified: all.filter((row) => row.status === "modified").length,
      rejected: all.filter((row) => row.status === "rejected").length,
      withWorkflow: all.filter((row) => row.workflowId).length,
    }),
    [all],
  );

  const visible = useMemo(() => {
    return all.filter((row) => {
      const statusOk = statusFilter === "all" ? true : row.status === statusFilter;
      const moduleOk = moduleFilter === "all" ? true : row.module === moduleFilter;
      return statusOk && moduleOk;
    });
  }, [all, statusFilter, moduleFilter]);

  const handleDecide = (recommendation: RecommendationWithContext, mode: DecisionMode) => {
    setActive(recommendation);
    setDialogMode(mode);
  };

  const handleDone = async (result: ReviewResult) => {
    setDialogMode(null);
    setActive(null);
    await queryClient.invalidateQueries({ queryKey: ["talent360-recommendations"] });
    await queryClient.invalidateQueries({ queryKey: ["talent360-command-center"] });

    if (result.warning) {
      toast.warning("Partially applied", { description: result.warning });
      return;
    }

    if (result.status === "rejected") {
      toast.success("Recommendation rejected", { description: "No workflow was created." });
      return;
    }

    toast.success("Approved and orchestrated", {
      description: `${result.taskCount} task(s) created for the assignee.`,
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="AI Action Center"
        description="Every AI recommendation lands here as a card. Nothing becomes a workflow until a person approves it, and the decision is written to the log either way."
        statusLabel={counts.pending ? `${counts.pending} awaiting review` : "Queue clear"}
        actions={
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void recommendationsQuery.refetch()}
              disabled={recommendationsQuery.isFetching}
            >
              {recommendationsQuery.isFetching ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Refresh
            </Button>
            <Button size="sm" onClick={() => scanMutation.mutate()} disabled={scanMutation.isPending}>
              {scanMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Radar className="h-3.5 w-3.5" />
              )}
              Scan for new signals
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        <KpiTile label="Pending review" value={String(counts.pending)} icon={BrainCircuit} tone="warning" />
        <KpiTile label="Approved" value={String(counts.approved)} icon={CheckCircle2} tone="success" />
        <KpiTile label="Approved with changes" value={String(counts.modified)} icon={ClipboardList} tone="info" />
        <KpiTile label="Rejected" value={String(counts.rejected)} icon={XCircle} tone="danger" />
        <KpiTile label="Workflows created" value={String(counts.withWorkflow)} icon={GitBranch} tone="primary" />
      </div>

      <div className="flex flex-col gap-3">
        <div className="talent-tile flex flex-wrap items-center justify-between gap-3 px-4 pb-1 pt-3 shadow-card">
          <FilterTabs
            items={STATUS_TABS.map((tab) => ({
              ...tab,
              count: tab.key === "all" ? all.length : counts[tab.key as keyof typeof counts],
            }))}
            value={statusFilter}
            onChange={(key) => setStatusFilter(key as StatusFilter)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setModuleFilter("all")}
            className={cn(
              "talent-chip border transition-colors",
              moduleFilter === "all"
                ? "border-primary bg-primary-soft text-primary-soft-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            All modules
          </button>
          {RECOMMENDATION_MODULES.map((module) => (
            <button
              key={module}
              type="button"
              onClick={() => setModuleFilter(module)}
              className={cn(
                "talent-chip border transition-colors",
                moduleFilter === module
                  ? "border-primary bg-primary-soft text-primary-soft-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {MODULE_LABELS[module]}
            </button>
          ))}
        </div>
      </div>

      {recommendationsQuery.isLoading ? <LoadingState label="Reading the review queue" /> : null}

      {recommendationsQuery.error ? (
        <ErrorState
          message={
            recommendationsQuery.error instanceof Error
              ? recommendationsQuery.error.message
              : "The review queue could not be loaded."
          }
          onRetry={() => void recommendationsQuery.refetch()}
        />
      ) : null}

      {!recommendationsQuery.isLoading && !recommendationsQuery.error && !visible.length ? (
        <EmptyState
          icon={<Inbox className="h-5 w-5" />}
          title={statusFilter === "pending" ? "Nothing awaiting review" : "No recommendations in this view"}
          description={
            statusFilter === "pending"
              ? "Run a signal scan to reassess performance, engagement and skill alignment, then queue anything that needs a human decision."
              : "Try another status filter."
          }
          action={
            statusFilter === "pending" ? (
              <Button size="sm" onClick={() => scanMutation.mutate()} disabled={scanMutation.isPending}>
                {scanMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Radar className="h-3.5 w-3.5" />}
                Scan for new signals
              </Button>
            ) : null
          }
        />
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {visible.map((recommendation) => (
          <RecommendationCard
            key={recommendation.id}
            recommendation={recommendation}
            reviewerName={recommendation.reviewed_by ? reviewerNames[recommendation.reviewed_by] ?? null : null}
            onDecide={(mode) => handleDecide(recommendation, mode)}
          />
        ))}
      </div>

      <DecisionDialog
        key={`${dialogMode ?? "closed"}-${active?.id ?? "none"}`}
        mode={dialogMode}
        recommendation={active}
        onClose={() => {
          setDialogMode(null);
          setActive(null);
        }}
        onDone={(result) => void handleDone(result)}
      />

      <p className="text-[11.5px] font-medium leading-relaxed text-muted-foreground">
        Signed in as {profile?.full_name ?? "a reviewer"}. Rejections require a reason and create no workflow;
        approvals record your name, the timestamp and the resulting task list on the AI Decision Log.
      </p>
    </div>
  );
}
