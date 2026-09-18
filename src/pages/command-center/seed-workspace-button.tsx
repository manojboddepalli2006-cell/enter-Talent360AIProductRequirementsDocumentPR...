import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/use-profile";

/**
 * Generates a realistic demo dataset inside the caller's own organisation.
 * Runs server-side so the generated rows are written atomically and the client
 * never has to hold a privileged role.
 */
export function SeedWorkspaceButton() {
  const queryClient = useQueryClient();
  const { org } = useProfile();
  const [state, setState] = useState<"idle" | "working" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const handleSeed = async () => {
    setState("working");
    setMessage(null);

    const { data, error } = await supabase.functions.invoke("talent-seed-demo", {
      body: { orgName: org?.name ?? null },
      headers: { "Content-Type": "application/json" },
    });

    if (error) {
      setState("error");
      setMessage(error.message);
      return;
    }

    const result = data as { ok?: boolean; error?: string; summary?: string } | null;
    if (result?.error || result?.ok === false) {
      setState("error");
      setMessage(result.error ?? "The demo workspace could not be generated.");
      return;
    }

    setState("done");
    setMessage(result?.summary ?? "Demo workspace generated.");
    await queryClient.invalidateQueries();
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <Button onClick={() => void handleSeed()} disabled={state === "working"}>
        {state === "working" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {state === "working" ? "Generating workspace" : "Seed demo workspace"}
      </Button>
      {message ? (
        <p
          className={
            state === "error"
              ? "max-w-sm text-[12px] font-semibold text-destructive"
              : "max-w-sm text-[12px] font-semibold text-success"
          }
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
