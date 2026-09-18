import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, Loader2, Plug, Plus, Save, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/common/page-header";
import { ChartCard } from "@/components/common/chart-card";
import { KpiTile } from "@/components/common/kpi-tile";
import { StatusPill } from "@/components/common/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ErrorState, LoadingState } from "@/components/common/states";
import { useProfile } from "@/hooks/use-profile";
import { cn } from "@/lib/utils";

interface IntegrationRow {
  id: string;
  category: string;
  provider: string;
  status: string;
  config: Record<string, unknown> | null;
  notes: string | null;
  last_sync_at: string | null;
}

const REQUIRED_CONFIG: Record<string, string[]> = {
  ATS: ["sync_scope"],
  HRMS: ["sync_scope"],
  LMS: ["catalog_source"],
  SSO: ["protocol"],
  Comms: ["channels"],
};

const STATUS_TONE: Record<string, "success" | "warning" | "neutral"> = {
  config_only: "warning",
  not_configured: "neutral",
  connected: "success",
};

const SELECT_CLASS = cn(
  "h-9 w-full rounded-lg border border-input bg-card px-3 text-[13px] font-medium text-foreground",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
);

export default function AdminIntegrationsPage() {
  const queryClient = useQueryClient();
  const { org } = useProfile();

  const [editing, setEditing] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState("not_configured");
  const [draftConfig, setDraftConfig] = useState("");
  const [creating, setCreating] = useState(false);
  const [newCategory, setNewCategory] = useState("ATS");
  const [newProvider, setNewProvider] = useState("");

  const query = useQuery({
    queryKey: ["talent360-integrations", org?.id ?? "none"],
    enabled: Boolean(org?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("talent_integrations")
        .select("id, category, provider, status, config, notes, last_sync_at")
        .order("category")
        .order("provider");
      if (error) throw new Error(error.message);
      return (data ?? []) as IntegrationRow[];
    },
  });

  const rows = useMemo(() => query.data ?? [], [query.data]);

  const validate = (category: string, configText: string): { ok: boolean; message: string } => {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(configText || "{}") as Record<string, unknown>;
    } catch {
      return { ok: false, message: "The configuration is not valid JSON." };
    }

    const required = REQUIRED_CONFIG[category] ?? [];
    const missing = required.filter((key) => parsed[key] === undefined || parsed[key] === "");

    if (missing.length) {
      return {
        ok: false,
        message: `Missing required key${missing.length === 1 ? "" : "s"} for ${category}: ${missing.join(", ")}.`,
      };
    }

    return {
      ok: true,
      message: `Configuration shape is valid for ${category}. This checks the record only — no connection to ${category} was attempted.`,
    };
  };

  const saveMutation = useMutation({
    mutationFn: async (id: string) => {
      const row = rows.find((entry) => entry.id === id);
      if (!row) throw new Error("That integration record no longer exists.");

      const check = validate(row.category, draftConfig);
      if (!check.ok) throw new Error(check.message);

      const { error } = await supabase
        .from("talent_integrations")
        .update({
          status: draftStatus,
          config: JSON.parse(draftConfig || "{}"),
        })
        .eq("id", id);

      if (error) throw new Error(error.message);
      return check.message;
    },
    onSuccess: async (message) => {
      await queryClient.invalidateQueries({ queryKey: ["talent360-integrations"] });
      setEditing(null);
      toast.success("Configuration saved", { description: message });
    },
    onError: (error) => {
      toast.error("Configuration not saved", {
        description: error instanceof Error ? error.message : "The record could not be saved.",
      });
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!org?.id) throw new Error("Your workspace could not be resolved.");
      if (!newProvider.trim()) throw new Error("A provider name is required.");

      const { error } = await supabase.from("talent_integrations").insert({
        org_id: org.id,
        category: newCategory,
        provider: newProvider.trim(),
        status: "not_configured",
        config: {},
        notes: "Configuration record only. No live sync is performed, and no credential is stored here.",
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["talent360-integrations"] });
      setCreating(false);
      setNewProvider("");
      toast.success("Integration record added");
    },
    onError: (error) => {
      toast.error("Record not added", {
        description: error instanceof Error ? error.message : "The record could not be created.",
      });
    },
  });

  const stats = useMemo(
    () => ({
      total: rows.length,
      configured: rows.filter((row) => row.status !== "not_configured").length,
      categories: new Set(rows.map((row) => row.category)).size,
    }),
    [rows],
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Integrations"
        description="Connectors for the systems your HR stack already uses. Records here describe intended configuration; this build performs no outbound sync and stores no credential."
        statusLabel={`${stats.total} records`}
        actions={
          <Button size="sm" onClick={() => setCreating((value) => !value)}>
            <Plus className="h-3.5 w-3.5" />
            Add record
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiTile label="Records" value={String(stats.total)} icon={Plug} tone="primary" />
        <KpiTile label="Configured" value={String(stats.configured)} icon={CheckCircle2} tone="info" />
        <KpiTile label="Categories" value={String(stats.categories)} icon={Plug} tone="accent" />
      </div>

      <div className="talent-tile flex items-start gap-3 p-4 shadow-card">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
        <p className="text-[12px] font-medium leading-relaxed text-muted-foreground">
          <span className="font-bold text-foreground">These are configuration records, not live connectors.</span>{" "}
          No candidate, employee or course data is imported, no webhook is received, and no third-party service
          is called. Where a real connector would be needed, that work sits outside this environment.
        </p>
      </div>

      {creating ? (
        <ChartCard title="New integration record" subtitle="Describe the connector you intend to configure">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="newCategory">Category</Label>
              <select
                id="newCategory"
                className={SELECT_CLASS}
                value={newCategory}
                onChange={(event) => setNewCategory(event.target.value)}
              >
                {["ATS", "HRMS", "LMS", "SSO", "Comms", "Calendar"].map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="newProvider">Provider</Label>
              <Input
                id="newProvider"
                value={newProvider}
                onChange={(event) => setNewProvider(event.target.value)}
                placeholder="Workday"
              />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Button size="sm" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
              {createMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Add record
            </Button>
            <Button size="sm" variant="outline" onClick={() => setCreating(false)}>
              Cancel
            </Button>
          </div>
        </ChartCard>
      ) : null}

      {query.isLoading ? <LoadingState label="Reading integration records" /> : null}

      {query.error ? (
        <ErrorState
          message={query.error instanceof Error ? query.error.message : "Integrations could not be loaded."}
          onRetry={() => void query.refetch()}
        />
      ) : null}

      {!query.isLoading && !query.error ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {rows.map((row) => {
            const isEditing = editing === row.id;
            return (
              <ChartCard
                key={row.id}
                title={row.provider}
                subtitle={`${row.category} · last sync ${
                  row.last_sync_at ? new Date(row.last_sync_at).toLocaleDateString("en-US") : "never"
                }`}
              >
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill tone={STATUS_TONE[row.status] ?? "neutral"}>
                      {row.status.replace(/_/g, " ")}
                    </StatusPill>
                    <StatusPill tone="neutral">{row.category}</StatusPill>
                  </div>

                  {row.notes ? (
                    <p className="text-[11.5px] font-medium leading-relaxed text-muted-foreground">
                      {row.notes}
                    </p>
                  ) : null}

                  {isEditing ? (
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor={`status-${row.id}`}>Status</Label>
                        <select
                          id={`status-${row.id}`}
                          className={SELECT_CLASS}
                          value={draftStatus}
                          onChange={(event) => setDraftStatus(event.target.value)}
                        >
                          {["not_configured", "config_only", "connected"].map((option) => (
                            <option key={option} value={option}>
                              {option.replace(/_/g, " ")}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor={`config-${row.id}`}>Configuration (JSON)</Label>
                        <Textarea
                          id={`config-${row.id}`}
                          className="min-h-[110px] font-mono text-[11.5px]"
                          value={draftConfig}
                          onChange={(event) => setDraftConfig(event.target.value)}
                        />
                        <span className="text-[11px] font-medium text-muted-foreground">
                          Required for {row.category}:{" "}
                          {(REQUIRED_CONFIG[row.category] ?? []).join(", ") || "no required keys"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => saveMutation.mutate(row.id)}
                          disabled={saveMutation.isPending}
                        >
                          {saveMutation.isPending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Save className="h-3.5 w-3.5" />
                          )}
                          Validate and save
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditing(null)}>
                          <X className="h-3.5 w-3.5" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <pre className="talent-scroll max-h-32 overflow-auto whitespace-pre-wrap rounded-lg bg-muted/50 p-3 text-[11px] font-medium text-muted-foreground">
                        {JSON.stringify(row.config ?? {}, null, 2)}
                      </pre>
                      <Button
                        size="sm"
                        variant="outline"
                        className="self-start"
                        onClick={() => {
                          setEditing(row.id);
                          setDraftStatus(row.status);
                          setDraftConfig(JSON.stringify(row.config ?? {}, null, 2));
                        }}
                      >
                        Edit configuration
                      </Button>
                    </>
                  )}
                </div>
              </ChartCard>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
