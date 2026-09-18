import { useState } from "react";
import { AlertCircle, Check, Loader2, PencilLine, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { RecommendationWithContext, ReviewResult } from "@/lib/api/actions";
import { approveRecommendation, modifyRecommendation, rejectRecommendation } from "@/lib/api/actions";
import { useProfile } from "@/hooks/use-profile";
import { useSession } from "@/hooks/use-session";

export type DecisionMode = "approve" | "modify" | "reject";

interface DecisionDialogProps {
  mode: DecisionMode | null;
  recommendation: RecommendationWithContext | null;
  onClose: () => void;
  onDone: (result: ReviewResult) => void;
}

const COPY: Record<DecisionMode, { title: string; description: string; cta: string }> = {
  approve: {
    title: "Approve recommendation",
    description:
      "Approving creates the workflow and its tasks. The recommendation, your name and the timestamp are written to the AI Decision Log.",
    cta: "Approve and create workflow",
  },
  modify: {
    title: "Approve with changes",
    description:
      "Edit the actions before approving. The original AI actions and your revision are both recorded, so the change is auditable.",
    cta: "Save changes and create workflow",
  },
  reject: {
    title: "Reject recommendation",
    description:
      "Rejecting creates nothing. A reason is required so the decision can be reviewed later.",
    cta: "Reject recommendation",
  },
};

export function DecisionDialog({ mode, recommendation, onClose, onDone }: DecisionDialogProps) {
  const { profile, org } = useProfile();
  const { user } = useSession();

  // The parent remounts this dialog per card (via `key`), so initialising from
  // props here is safe and needs no state-syncing effect.
  const [actions, setActions] = useState<string[]>(
    () => recommendation?.structured?.recommended_actions ?? [],
  );
  const [reason, setReason] = useState("");
  const [dueInDays, setDueInDays] = useState("7");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!mode || !recommendation) return null;

  const copy = COPY[mode];

  const handleSubmit = async () => {
    if (!org?.id) {
      setError("Your workspace could not be resolved.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const base = {
      recommendation,
      orgId: org.id,
      actorId: user?.id ?? null,
      actorName: profile?.full_name ?? user?.email ?? "Unknown reviewer",
      dueInDays: Number(dueInDays) || 7,
    };

    try {
      let result: ReviewResult;
      if (mode === "approve") {
        result = await approveRecommendation(base);
      } else if (mode === "modify") {
        const cleaned = actions.map((action) => action.trim()).filter(Boolean);
        if (!cleaned.length) {
          setError("Keep at least one action, or use Reject instead.");
          setSubmitting(false);
          return;
        }
        result = await modifyRecommendation({ ...base, actions: cleaned });
      } else {
        result = await rejectRecommendation({ ...base, rejectionReason: reason });
      }
      onDone(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The decision could not be recorded.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={mode !== null} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[16px] font-extrabold">
            {mode === "approve" ? (
              <Check className="h-4 w-4 text-success" />
            ) : mode === "modify" ? (
              <PencilLine className="h-4 w-4 text-info" />
            ) : (
              <X className="h-4 w-4 text-destructive" />
            )}
            {copy.title}
          </DialogTitle>
          <DialogDescription className="text-[12.5px] font-medium leading-relaxed">
            {copy.description}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-border bg-muted/40 p-3">
            <div className="talent-label">Recommendation</div>
            <p className="mt-1 text-[13px] font-bold text-foreground">{recommendation.title}</p>
            {recommendation.employeeName || recommendation.candidateName ? (
              <p className="mt-0.5 text-[11.5px] font-medium text-muted-foreground">
                {recommendation.employeeName ?? recommendation.candidateName}
                {recommendation.employeeTitle ? ` · ${recommendation.employeeTitle}` : ""}
                {recommendation.jobTitle ? ` · ${recommendation.jobTitle}` : ""}
              </p>
            ) : null}
          </div>

          {mode === "modify" ? (
            <div className="flex flex-col gap-2">
              <Label>Actions to create</Label>
              <div className="flex flex-col gap-2">
                {actions.map((action, index) => (
                  <div key={`action-${index}`} className="flex items-center gap-2">
                    <Input
                      value={action}
                      onChange={(event) => {
                        const next = [...actions];
                        next[index] = event.target.value;
                        setActions(next);
                      }}
                    />
                    <Button
                      type="button"
                      variant="soft-destructive"
                      size="icon-sm"
                      aria-label="Remove action"
                      onClick={() => setActions(actions.filter((_, position) => position !== index))}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setActions([...actions, ""])}>
                Add action
              </Button>
            </div>
          ) : null}

          {mode === "approve" || mode === "modify" ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="dueInDays">Task due in</Label>
              <select
                id="dueInDays"
                value={dueInDays}
                onChange={(event) => setDueInDays(event.target.value)}
                className={cn(
                  "h-9 w-full rounded-lg border border-input bg-card px-3 text-[13px] font-medium text-foreground",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                )}
              >
                <option value="3">3 days</option>
                <option value="7">7 days</option>
                <option value="14">14 days</option>
                <option value="30">30 days</option>
              </select>
            </div>
          ) : null}

          {mode === "reject" ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="reason">Reason for rejection</Label>
              <Textarea
                id="reason"
                required
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="For example: the confidence estimate is too low and only one signal moved, so acting now would create noise."
              />
            </div>
          ) : null}

          {error ? (
            <div className="flex items-start gap-2 rounded-lg bg-destructive-soft px-3 py-2.5 text-destructive-soft-foreground">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="text-[12.5px] font-semibold leading-snug">{error}</span>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant={mode === "reject" ? "destructive" : "default"}
            onClick={() => void handleSubmit()}
            disabled={submitting || (mode === "reject" && reason.trim().length < 4)}
          >
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {copy.cta}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
