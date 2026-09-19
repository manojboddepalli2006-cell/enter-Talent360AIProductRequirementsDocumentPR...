import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Building2,
  CheckCircle2,
  Cpu,
  DollarSign,
  Plug,
  ShieldCheck,
  Users,
  Workflow,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/common/page-header";
import { KpiTile } from "@/components/common/kpi-tile";
import { ChartCard } from "@/components/common/chart-card";
import { StatusPill } from "@/components/common/status-pill";
import { ErrorState, LoadingState } from "@/components/common/states";
import { LiveAiOrb } from "@/components/brand/live-ai-orb";
import { ProgressList } from "@/components/dashboard/charts/progress-list";
import { formatCompact, formatDate } from "@/lib/format";
import { useProfile } from "@/hooks/use-profile";

async function loadOrgConsole() {
  const [orgResult, departmentsResult, employeesResult, integrationsResult, usageResult, recsResult, flowsResult, auditResult] =
    await Promise.all([
      supabase.from("talent_orgs").select("*").maybeSingle(),
      supabase.from("talent_departments").select("id, name"),
      supabase.from("talent_employees").select("id, department_id, status"),
      supabase.from("talent_integrations").select("id, category, provider, status, last_sync_at"),
      supabase.from("talent_ai_usage").select("total_tokens, cost_estimate, created_at"),
      supabase.from("talent_ai_recommendations").select("id, status"),
      supabase.from("talent_workflows").select("id, status"),
      supabase.from("talent_audit_log").select("id, action, created_at").order("created_at", { ascending: false }).limit(6),
    ]);

  const error = [
    orgResult.error,
    departmentsResult.error,
    employeesResult.error,
    integrationsResult.error,
    usageResult.error,
    recsResult.error,
    flowsResult.error,
    auditResult.error,
  ].find(Boolean);
  if (error) throw new Error(error.message);

  return {
    org: orgResult.data,
    departments: departmentsResult.data ?? [],
    employees: employeesResult.data ?? [],
    integrations: integrationsResult.data ?? [],
    usage: usageResult.data ?? [],
    recs: recsResult.data ?? [],
    flows: flowsResult.data ?? [],
    audit: auditResult.data ?? [],
  };
}

export default function OrgCommandCenterPage() {
  const { profile } = useProfile();
  const query = useQuery({ queryKey: ["talent360-org-console"], queryFn: loadOrgConsole });

  if (query.isLoading) return <LoadingState label="Reading organization state" />;
  if (query.error) {
    return (
      <ErrorState
        message={query.error instanceof Error ? query.error.message : "The organization console could not be loaded."}
        onRetry={() => void query.refetch()}
      />
    );
  }

  const data = query.data;
  if (!data) return null;

  const { org, departments, employees, integrations, usage, recs, flows } = data;

  const connected = integrations.filter((row) => row.status === "connected").length;
  const tokens = usage.reduce((sum, row) => sum + (row.total_tokens ?? 0), 0);
  const cost = usage.reduce((sum, row) => sum + Number(row.cost_estimate ?? 0), 0);
  const pendingReview = recs.filter((row) => row.status === "pending").length;
  const activeFlows = flows.filter((row) => row.status === "active").length;

  const departmentLoad = departments
    .map((department) => ({
      name: department.name,
      value: employees.filter((employee) => employee.department_id === department.id).length,
      key: department.id,
    }))
    .sort((a, b) => b.value - a.value);

  // Only the configured model is live; the alternates are declared fallbacks.
  const primaryModel = org?.ai_model?.split("/").pop() ?? "qwen";
  const providers = [
    { name: "Qwen (reasoning)", detail: primaryModel, state: "operational" as const },
    { name: "Groq (fast classification)", detail: "Declared fallback · not wired", state: "standby" as const },
    { name: "Gemini (failover)", detail: "Declared fallback · not wired", state: "standby" as const },
    { name: "Embedding service", detail: "Postgres full-text retrieval", state: "operational" as const },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Organization Command Center"
        description="Configuration, governance, integrations and AI administration for the whole organization."
        statusLabel={org?.plan ? `${org.plan} plan` : "Governance"}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <KpiTile label="Total employees" value={String(employees.length)} icon={Users} tone="primary" />
        <KpiTile label="Departments" value={String(departments.length)} icon={Building2} tone="info" />
        <KpiTile
          label="Active integrations"
          value={String(connected)}
          icon={Plug}
          tone="accent"
          footnote={`${integrations.length} configured`}
        />
        <KpiTile label="AI runs recorded" value={String(usage.length)} icon={Cpu} tone="warning" />
        <KpiTile
          label="AI spend"
          value={`$${cost.toFixed(2)}`}
          icon={DollarSign}
          tone="success"
          footnote={`${formatCompact(tokens)} tokens`}
        />
        <KpiTile
          label="Pending governance"
          value={String(pendingReview)}
          icon={ShieldCheck}
          tone={pendingReview ? "danger" : "success"}
          footnote="Awaiting human review"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* AI infrastructure */}
        <ChartCard
          title="AI Infrastructure Status"
          subtitle="Providers, models and retrieval services"
          className="xl:col-span-2"
        >
          <div className="relative">
            <LiveAiOrb
              state={pendingReview ? "recommendation" : "operational"}
              size={180}
              intensity={0.22}
              className="absolute -right-6 -top-10 hidden lg:block"
            />
            <ul className="relative flex flex-col gap-2">
              {providers.map((provider) => (
                <li
                  key={provider.name}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="text-[12.5px] font-bold text-foreground">{provider.name}</div>
                    <div className="truncate text-[10.5px] font-medium text-muted-foreground">{provider.detail}</div>
                  </div>
                  <StatusPill tone={provider.state === "operational" ? "success" : "neutral"}>
                    {provider.state === "operational" ? "Operational" : "Standby"}
                  </StatusPill>
                </li>
              ))}
            </ul>
            <p className="relative mt-3 text-[11px] font-medium leading-relaxed text-muted-foreground">
              Call routing, quota and failover are recorded here. Today the platform routes every AI call through
              the configured primary model; the alternates are declared policy entries.
            </p>
          </div>
        </ChartCard>

        {/* AI policy controls */}
        <ChartCard title="AI Policy Controls" subtitle="Guardrails applied server-side">
          <ul className="flex flex-col gap-2">
            {[
              { label: "Human approval required", on: true },
              { label: "Protected attribute exclusion", on: true },
              { label: "Audit logging", on: true },
              { label: "PII redaction in prompts", on: true },
              { label: "Risk scores visible to employees", on: false },
            ].map((control) => (
              <li key={control.label} className="flex items-center justify-between gap-2">
                <span className="text-[12px] font-medium text-foreground">{control.label}</span>
                <StatusPill tone={control.on ? "success" : "neutral"}>{control.on ? "ON" : "OFF"}</StatusPill>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-col gap-2">
            <Button to="/app/admin" label="Open admin console" />
            <Button to="/app/admin/integrations" label="Integration center" />
            <Button to="/app/admin/usage" label="AI usage & cost" />
          </div>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ChartCard title="Organization health" subtitle="Department distribution">
          <ProgressList data={departmentLoad} suffix="people" />
        </ChartCard>

        <ChartCard title="Integration health" subtitle="Connector configuration records">
          {integrations.length ? (
            <ul className="flex flex-col gap-2">
              {integrations.slice(0, 6).map((integration) => (
                <li key={integration.id} className="flex items-center justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block truncate text-[12px] font-semibold text-foreground">
                      {integration.provider}
                    </span>
                    <span className="block text-[10.5px] font-medium text-muted-foreground">
                      {integration.category} ·{" "}
                      {integration.last_sync_at ? formatDate(integration.last_sync_at) : "never synced"}
                    </span>
                  </span>
                  <StatusPill tone={integration.status === "connected" ? "success" : "neutral"}>
                    {integration.status.replace(/_/g, " ")}
                  </StatusPill>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[12px] font-medium text-muted-foreground">No integrations configured yet.</p>
          )}
        </ChartCard>

        <ChartCard title="Workflow activity" subtitle="Enter Pro orchestration">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-3 py-2.5">
              <span className="flex items-center gap-2 text-[12.5px] font-semibold text-foreground">
                <Workflow className="h-4 w-4 text-primary" />
                Active workflows
              </span>
              <StatusPill tone={activeFlows ? "info" : "neutral"}>{activeFlows}</StatusPill>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-3 py-2.5">
              <span className="flex items-center gap-2 text-[12.5px] font-semibold text-foreground">
                <CheckCircle2 className="h-4 w-4 text-success" />
                Total workflows
              </span>
              <StatusPill tone="success">{flows.length}</StatusPill>
            </div>
            <div className="rounded-xl border border-border bg-muted/30 px-3 py-2.5">
              <span className="talent-label">Data retention</span>
              <p className="mt-1 text-[12px] font-semibold text-foreground">
                {org?.data_retention_months ?? 12} months recorded policy
              </p>
            </div>
          </div>
        </ChartCard>
      </div>

      <div className="talent-tile flex items-start gap-3 p-4">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
        <p className="text-[12px] font-medium leading-relaxed text-muted-foreground">
          Signed in as {profile?.full_name ?? "an administrator"}. Organization-wide configuration, governance and
          audit surfaces are limited to this role, and the same boundaries are enforced on every API call by
          row-level security.
        </p>
      </div>
    </div>
  );
}

function Button({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="flex h-9 items-center justify-center rounded-xl border border-border bg-card px-4 text-[12px] font-semibold text-foreground transition-colors hover:border-primary/40"
    >
      {label}
    </Link>
  );
}
