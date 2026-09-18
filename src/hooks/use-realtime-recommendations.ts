import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/use-profile";

/**
 * Live updates for the AI Action Center. New or actioned recommendations are
 * pushed from the database, so two reviewers do not work the same card twice.
 */
export function useRealtimeRecommendations(): void {
  const queryClient = useQueryClient();
  const { org } = useProfile();
  const orgId = org?.id ?? null;

  useEffect(() => {
    if (!orgId) return;

    const channel = supabase
      .channel(`talent360-action-center-${orgId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "talent_ai_recommendations",
          filter: `org_id=eq.${orgId}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["talent360-recommendations"] });
          void queryClient.invalidateQueries({ queryKey: ["talent360-command-center"] });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [orgId, queryClient]);
}
