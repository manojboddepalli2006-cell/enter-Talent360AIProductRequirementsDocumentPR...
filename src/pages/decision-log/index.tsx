import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, FileText, Filter, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/common/page-header";
import { KpiTile } from "@/components/common/kpi-tile";
import { FilterTabs } from "@/components/common/filter-tabs";
import { StatusPill } from "@/components/common/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/states";
import { downloadCsv } from "@/lib/csv";
import { formatDateTime } from "@/lib/format";

interface AuditRow {
  id: string;
  actor_id: string | null;
  actor_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: unknown;
  created_at: string;
}

const ACTION_LABEL: Record<string, string> = {
  "recommendation.approved": "Recommendation approved",
  "recommendation.modified": "Recommendation approved with changes",
  "recommendation.rejected": "Recommendation rejected",
  "workflow.created": "Workflow created",
  "outcome.recorded": "Outcome recorded",
  "candidate.match_run": "Candidate match run",
  "interview.questions_generated": "Interview questions generated",
  "interview.evaluated": "Interview evaluated",
  "risk.assessment_run": "Risk assessment run",
  "development.plan_generated": "Development plan generated",
  "policy_document.indexed": "Policy document indexed",
  "integration.config_updated": "Integration configuration updated",
  "workspace.demo_seeded": "Demo workspace generated",
};

const ACTION_TONE: Record<string, "success" | "danger" | "info" | "primary" | "neutral"> = {
  "recommendation.approved": "success",
  "recommendation.modified": "info",
  "recommendation.rejected": "danger",
  "workflow.created": "primary",
};

async function listAudit(): Promise<AuditRow[]> {
  const { data, error } = await supabase
    .from("talent_audit_log")
    .select("id, actor_id, actor_name, action, entity_type, entity_id, metadata, created_at")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) throw new Error(error.message);
  return (data ?? []) as AuditRow[];
}

export default function DecisionLogPage() {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("decisions");

  const query = useQuery({ queryKey: ["talent360-audit"], queryFn: listAudit });
  const rows = useMemo(() => query.data ?? [], [query.data]);

  const counts = useMemo(() => {
    const decisions = rows.filter((row) => row.action.startsWith("recommendation."));
    return {
      all: rows.length,
      decisions: decisions.length,
      approved: rows.filter((row) => row.action === "recommendation.approved").length,
      modified: rows.filter((row) => row.action === "recommendation.modified").length,
      rejected: rows.filter((row) => row.action === "recommendation.rejected").length,
      workflows: rows.filter((row) => row.action === "workflow.created").length,
    };
  }, [rows]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (actionFilter === "decisions" && !row.action.startsWith("recommendation.")) return false;
      if (actionFilter === "workflows" && !row.action.startsWith("workflow.") && !row.action.startsWith("outcome."))
        return false;
      if (actionFilter === "ai" && !row.action.includes("interview") && !row.action.includes("match") && !row.action.includes("risk") && !row.action.includes("development"))
        return false;
      if (!term) return true;
      return (
        row.action.toLowerCase().includes(term) ||
        (row.actor_name ?? "").toLowerCase().includes(term) ||
        JSON.stringify(row.metadata ?? {}).toLowerCase().includes(term)
      );
    });
  }, [rows, search, actionFilter]);

  const handleExport = () => {
    downloadCsv(
      `talent360-decision-log-${new Date().toISOString().slice(0, 10)}.csv`,
      visible.map((row) => ({
        timestamp: row.created_at,
        actor: row.actor_name ?? "system",
        action: ACTION_LABEL[row.action] ?? row.action,
        entity_type: row.entity_type,
        entity_id: row.entity_id ?? "",
        detail: JSON.stringify(row.metadata ?? {}),
      })),
      ["timestamp", "actor", "action", "entity_type", "entity_id", "detail"],
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="AI Decision Log"
        description="Append-only record of every AI recommendation and the human decision on it. Rows can be added and read, but never edited or deleted."
        statusLabel={`${counts.all} entries`}
        actions={
          <Button variant="outline" size="sm" onClick={handleExport} disabled={!visible.length}>
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile label="Total entries" value={String(counts.all)} icon={FileText} tone="primary" />
        <KpiTile label="Approved" value={String(counts.approved)} icon={Filter} tone="success" />
        <KpiTile label="Approved with changes" value={String(counts.modified)} icon={Filter} tone="info" />
        <KpiTile label="Rejected" value={String(counts.rejected)} icon={Filter} tone="danger" />
      </div>

      <div className="talent-tile flex flex-wrap items-center justify-between gap-3 px-4 pb-1 pt-3 shadow-card">
        <FilterTabs
          items={[
            { key: "decisions", label: "Decisions", count: counts.decisions },
            { key: "workflows", label: "Workflows & outcomes", count: counts.workflows },
            { key: "ai", label: "AI runs", count: undefined },
            { key: "all", label: "Everything", count: counts.all },
          ]}
          value={actionFilter}
          onChange={setActionFilter}
        />
        <div className="relative pb-2">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search the log"
            className="h-8 w-[220px] pl-8"
          />
        </div>
      </div>

      {query.isLoading ? <LoadingState label="Reading the decision log" /> : null}

      {query.error ? (
        <ErrorState
          message={query.error instanceof Error ? query.error.message : "The decision log could not be loaded."}
          onRetry={() => void query.refetch()}
        />
      ) : null}

      {!query.isLoading && !query.error && !visible.length ? (
        <EmptyState
          icon={<FileText className="h-5 w-5" />}
          title="Nothing in this view"
          description="Approve, modify or reject a recommendation in the AI Action Center and it will be recorded here."
        />
      ) : null}

      {!query.isLoading && !query.error && visible.length ? (
        <div className="talent-tile overflow-hidden shadow-card">
          <div className="talent-scroll overflow-x-auto">
            <table className="w-full min-w-[880px] border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-3 pl-4 text-left talent-label">When</th>
                  <th className="py-3 pr-4 text-left talent-label">Actor</th>
                  <th className="py-3 pr-4 text-left talent-label">Action</th>
                  <th className="py-3 pr-4 text-left talent-label">Entity</th>
                  <th className="py-3 pr-4 text-left talent-label">Detail</th>
                </tr>
              </thead>
              <tbody>
                {visible.slice(0, 200).map((row) => (
                  <tr key={row.id} className="border-b border-border last:border-0 align-top">
                    <td className="py-3 pl-4 pr-4 text-[12px] font-semibold text-muted-foreground">
                      {formatDateTime(row.created_at)}
                    </td>
                    <td className="py-3 pr-4 text-[12.5px] font-semibold text-foreground">
                      {row.actor_name ?? "System"}
                    </td>
                    <td className="py-3 pr-4">
                      <StatusPill tone={ACTION_TONE[row.action] ?? "neutral"}>
                        {ACTION_LABEL[row.action] ?? row.action}
                      </StatusPill>
                    </td>
                    <td className="py-3 pr-4 text-[11.5px] font-medium text-muted-foreground">
                      {row.entity_type}
                      {row.entity_id ? (
                        <span className="block truncate font-mono text-[10.5px]">{row.entity_id.slice(0, 8)}…</span>
                      ) : null}
                    </td>
                    <td className="max-w-[420px] py-3 pr-4">
                      <span className="line-clamp-2 text-[11.5px] font-medium leading-snug text-muted-foreground">
                        {JSON.stringify(row.metadata ?? {})}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {visible.length > 200 ? (
            <p className="border-t border-border px-4 py-2 text-[11px] font-medium text-muted-foreground">
              Showing the 200 most recent of {visible.length} matching entries. Export to CSV for the full set.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
