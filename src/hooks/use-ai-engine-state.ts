import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AiEngineState } from "@/components/brand/live-ai-orb";

/**
 * Derives the global AI engine state from real activity:
 * - a recent AI call means the engine is currently processing
 * - pending recommendations mean a decision is ready for a human
 * - active workflows mean Enter Pro is executing
 * Falls back to operational, and offline when the backend cannot be reached.
 */
export function useAiEngineState(): { state: AiEngineState; lastRunAt: string | null } {
  const query = useQuery({
    queryKey: ["talent360-ai-engine-state"],
    refetchInterval: 45_000,
    queryFn: async () => {
      const [usageResult, recsResult, flowsResult] = await Promise.all([
        supabase.from("talent_ai_usage").select("created_at").order("created_at", { ascending: false }).limit(1),
        supabase.from("talent_ai_recommendations").select("id").eq("status", "pending"),
        supabase.from("talent_workflows").select("id").eq("status", "active"),
      ]);

      const error = usageResult.error ?? recsResult.error ?? flowsResult.error;
      if (error) throw new Error(error.message);

      return {
        lastRunAt: usageResult.data?.[0]?.created_at ?? null,
        pending: recsResult.data?.length ?? 0,
        activeFlows: flowsResult.data?.length ?? 0,
      };
    },
  });

  if (query.isError) return { state: "offline", lastRunAt: null };
  if (!query.data) return { state: "operational", lastRunAt: null };

  const { lastRunAt, pending, activeFlows } = query.data;
  const minutesSinceRun = lastRunAt ? (Date.now() - new Date(lastRunAt).getTime()) / 60000 : Infinity;

  if (minutesSinceRun < 2) return { state: "processing", lastRunAt };
  if (pending > 0) return { state: "recommendation", lastRunAt };
  if (activeFlows > 0) return { state: "workflow", lastRunAt };
  return { state: "operational", lastRunAt };
}
