import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/use-profile";

/**
 * Live updates for the AI Action Center. New or actioned recommendations are
 * pushed from the database, so two reviewers do not work the same card twice.
 *
 * The top bar and the Action Center page each mount this hook, so every instance
 * subscribes on its own uniquely-named channel — sharing one channel name across
 * two subscribers makes the client attempt `on()` after `subscribe()` and throw.
 */
export function useRealtimeRecommendations(): void {
  const queryClient = useQueryClient();
  const { org } = useProfile();
  const orgId = org?.id ?? null;
  const channelNameRef = useRef<string | null>(null);

  useEffect(() => {
    if (!orgId) return;

    const channelName = `talent360-action-center-${orgId}-${crypto.randomUUID()}`;
    channelNameRef.current = channelName;

    const channel = supabase
      .channel(channelName)
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
          void queryClient.invalidateQueries({ queryKey: ["talent360-pending-count"] });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
      channelNameRef.current = null;
    };
  }, [orgId, queryClient]);
}
