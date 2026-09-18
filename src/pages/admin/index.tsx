import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Building2, Gauge, Plug, Save, ShieldCheck, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/common/page-header";
import { ChartCard } from "@/components/common/chart-card";
import { KpiTile } from "@/components/common/kpi-tile";
import { StatusPill } from "@/components/common/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProfile } from "@/hooks/use-profile";
import { cn } from "@/lib/utils";

const SELECT_CLASS = cn(
  "h-9 w-full rounded-lg border border-input bg-card px-3 text-[13px] font-medium text-foreground",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
);

export default function AdminConsolePage() {
  const queryClient = useQueryClient();
  const { org } = useProfile();

  const [name, setName] = useState("");
  const [model, setModel] = useState("alibaba/qwen-3.7-plus");
  const [quota, setQuota] = useState("2000");
  const [retention, setRetention] = useState("12");
  const [accent, setAccent] = useState("#7C3AED");
  const [plan, setPlan] = useState("pilot");

  useEffect(() => {
    if (!org) return;
    setName(org.name);
    setModel(org.ai_model);
    setQuota(String(org.ai_daily_quota));
    setRetention(String(org.data_retention_months));
    setAccent(org.brand_accent);
    setPlan(org.plan);
  }, [org]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!org?.id) throw new Error("Your workspace could not be resolved.");

      const { error } = await supabase
        .from("talent_orgs")
        .update({
          name: name.trim() || org.name,
          ai_model: model,
          ai_daily_quota: Number(quota) || org.ai_daily_quota,
          data_retention_months: Number(retention) || org.data_retention_months,
          brand_accent: accent,
          plan,
        })
        .eq("id", org.id);

      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      toast.success("Workspace settings saved");
    },
    onError: (error) => {
      toast.error("Settings not saved", {
        description: error instanceof Error ? error.message : "The change could not be saved.",
      });
    },
  });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Admin console"
        description="Workspace configuration: which model reasons over your data, how much it may spend, and how long records are kept."
        statusLabel={org?.name ?? "Workspace"}
        actions={
          <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            <Save className="h-3.5 w-3.5" />
            {saveMutation.isPending ? "Saving…" : "Save changes"}
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile label="AI model" value={model.split("/").pop() ?? model} icon={Gauge} tone="primary" />
        <KpiTile label="Daily call budget" value={quota} icon={Gauge} tone="info" />
        <KpiTile label="Retention" value={`${retention} mo`} icon={ShieldCheck} tone="warning" />
        <KpiTile label="Plan" value={plan} icon={Building2} tone="accent" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard title="Organisation" subtitle="Name and plan shown across the workspace">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="orgName">Organisation name</Label>
              <Input id="orgName" value={name} onChange={(event) => setName(event.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="orgPlan">Plan</Label>
              <select
                id="orgPlan"
                className={SELECT_CLASS}
                value={plan}
                onChange={(event) => setPlan(event.target.value)}
              >
                {["pilot", "team", "enterprise"].map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="orgAccent">Brand accent</Label>
              <div className="flex items-center gap-2">
                <input
                  id="orgAccent"
                  type="color"
                  value={accent}
                  onChange={(event) => setAccent(event.target.value)}
                  className="h-9 w-14 cursor-pointer rounded-lg border border-input bg-card"
                />
                <Input value={accent} onChange={(event) => setAccent(event.target.value)} className="flex-1" />
              </div>
              <span className="text-[11px] font-medium text-muted-foreground">
                Recorded as workspace branding. The interface palette follows the application design system.
              </span>
            </div>
          </div>
        </ChartCard>

        <ChartCard
          title="AI provider"
          subtitle="The reasoning model used by every AI backend function"
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="aiModel">Model</Label>
              <select
                id="aiModel"
                className={SELECT_CLASS}
                value={model}
                onChange={(event) => setModel(event.target.value)}
              >
                <option value="alibaba/qwen-3.7-plus">Qwen 3.7 Plus</option>
                <option value="alibaba/qwen-3.8-max">Qwen 3.8 Max Preview</option>
                <option value="google/gemini-3.6-flash">Gemini 3.6 Flash</option>
                <option value="openai/gpt-5.6-luna">GPT 5.6 Luna</option>
              </select>
              <span className="text-[11px] font-medium text-muted-foreground">
                Changing this records the intended model. The deployed functions call the model configured for
                this project, so a switch here is a governance record rather than a live reroute.
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="aiQuota">Daily call budget</Label>
              <Input
                id="aiQuota"
                type="number"
                min={0}
                value={quota}
                onChange={(event) => setQuota(event.target.value)}
              />
              <span className="text-[11px] font-medium text-muted-foreground">
                Alerts are raised in the usage view when a day exceeds this many calls.
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="retention">Data retention (months)</Label>
              <Input
                id="retention"
                type="number"
                min={1}
                value={retention}
                onChange={(event) => setRetention(event.target.value)}
              />
              <span className="text-[11px] font-medium text-muted-foreground">
                Recorded policy. This build does not run a scheduled purge job, so nothing is deleted
                automatically.
              </span>
            </div>
          </div>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ChartCard title="Roles and access" subtitle="Who is in this workspace and with which role">
          <p className="text-[12.5px] font-medium leading-relaxed text-muted-foreground">
            Roles decide which surfaces open. Every boundary is enforced again by row level security, so a
            hidden menu item is never the only protection.
          </p>
          <Button variant="outline" size="sm" className="mt-3" asChild>
            <Link to="/app/admin/users">
              <Users className="h-3.5 w-3.5" />
              Manage users and roles
            </Link>
          </Button>
        </ChartCard>

        <ChartCard title="Integrations" subtitle="ATS, HRMS, LMS, SSO and messaging">
          <p className="text-[12.5px] font-medium leading-relaxed text-muted-foreground">
            Integrations are stored as configuration records. No live sync, credential or outbound system call
            happens in this build, and the console says so on every row.
          </p>
          <Button variant="outline" size="sm" className="mt-3" asChild>
            <Link to="/app/admin/integrations">
              <Plug className="h-3.5 w-3.5" />
              Review integrations
            </Link>
          </Button>
        </ChartCard>

        <ChartCard title="AI usage and cost" subtitle="Calls, tokens and estimated spend">
          <p className="text-[12.5px] font-medium leading-relaxed text-muted-foreground">
            Every AI call writes a usage row with the model, token counts and a cost estimate, so spend is
            attributable rather than a single opaque number.
          </p>
          <Button variant="outline" size="sm" className="mt-3" asChild>
            <Link to="/app/admin/usage">
              <Gauge className="h-3.5 w-3.5" />
              Open usage
            </Link>
          </Button>
        </ChartCard>
      </div>

      <div className="talent-tile flex items-start gap-3 p-4 shadow-card">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div>
          <div className="text-[12.5px] font-bold text-foreground">Governance posture in this build</div>
          <ul className="mt-1.5 flex flex-col gap-1">
            {[
              "No AI output reaches a person's record without a logged human decision.",
              "A workflow row cannot exist unless its recommendation was approved first — enforced by a database trigger.",
              "The audit log accepts inserts and reads only; there is no update or delete policy.",
              "Risk assessments are readable by HR and the person's manager, and by nobody else.",
            ].map((line) => (
              <li key={line} className="flex items-start gap-2 text-[12px] font-medium leading-relaxed text-muted-foreground">
                <StatusPill tone="success">Enforced</StatusPill>
                <span className="pt-0.5">{line}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
