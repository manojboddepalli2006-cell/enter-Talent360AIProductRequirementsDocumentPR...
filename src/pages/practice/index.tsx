import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRight, Award, History, Loader2, MicVocal, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { KpiTile } from "@/components/common/kpi-tile";
import { StatusPill } from "@/components/common/status-pill";
import { UserCell } from "@/components/common/user-cell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/states";
import {
  createPracticeSession,
  deletePracticeSession,
  listOrgPracticeStats,
  listSessions,
} from "@/lib/api/practice";
import { useProfile } from "@/hooks/use-profile";
import { usePermissions } from "@/hooks/use-permissions";
import { formatDate, formatNumber, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

const FOCUS_AREAS = [
  "Behavioral",
  "Technical Knowledge",
  "Problem Solving",
  "Communication",
  "Role Fit",
];

function scoreTone(score: number | null): "success" | "info" | "warning" | "danger" | "neutral" {
  if (score === null) return "neutral";
  if (score >= 4) return "success";
  if (score >= 3) return "info";
  if (score >= 2) return "warning";
  return "danger";
}

export default function PracticePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile, org } = useProfile();
  const { isHr } = usePermissions();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [mode, setMode] = useState<"text" | "video">("text");
  const [roleTitle, setRoleTitle] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [focusAreas, setFocusAreas] = useState<string[]>(["Behavioral", "Problem Solving"]);
  const [questionCount, setQuestionCount] = useState("5");

  const sessionsQuery = useQuery({ queryKey: ["talent360-practice-sessions"], queryFn: listSessions });
  const orgStatsQuery = useQuery({
    queryKey: ["talent360-practice-org-stats"],
    enabled: isHr,
    queryFn: listOrgPracticeStats,
  });

  const sessions = useMemo(() => sessionsQuery.data ?? [], [sessionsQuery.data]);

  const myStats = useMemo(() => {
    const completed = sessions.filter((session) => session.status === "completed");
    const scores = completed
      .map((session) => (typeof session.overall_score === "number" ? session.overall_score : null))
      .filter((value): value is number => value !== null);
    return {
      total: sessions.length,
      completed: completed.length,
      inProgress: sessions.filter((session) => session.status === "in_progress").length,
      avg: scores.length ? Math.round((scores.reduce((sum, value) => sum + value, 0) / scores.length) * 10) / 10 : null,
      best: scores.length ? Math.max(...scores) : null,
    };
  }, [sessions]);

  const toggleFocus = (area: string) => {
    setFocusAreas((current) =>
      current.includes(area) ? current.filter((item) => item !== area) : [...current, area],
    );
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!org?.id) throw new Error("Your workspace could not be resolved.");
      if (!roleTitle.trim()) throw new Error("Enter the role you are practising for.");
      if (!focusAreas.length) throw new Error("Choose at least one focus area.");
      return createPracticeSession({
        roleTitle: roleTitle.trim(),
        jobDescription,
        focusAreas,
        questionCount: Number(questionCount) || 5,
        mode,
        userId: profile?.id ?? null,
        orgId: org.id,
      });
    },
    onSuccess: async (sessionId) => {
      await queryClient.invalidateQueries({ queryKey: ["talent360-practice-sessions"] });
      setDialogOpen(false);
      setRoleTitle("");
      setJobDescription("");
      navigate(`/app/practice/${sessionId}`);
    },
    onError: (error) => {
      toast.error("Session not created", {
        description: error instanceof Error ? error.message : "The session could not be started.",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deletePracticeSession,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["talent360-practice-sessions"] });
      toast.success("Session deleted");
    },
    onError: (error) => {
      toast.error("Session not deleted", {
        description: error instanceof Error ? error.message : "The session could not be removed.",
      });
    },
  });

  const orgStats = orgStatsQuery.data;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Interview prep"
        description="Practice answering realistic interview questions with the AI as your coach. Answer, get rubric feedback on every response, and finish with a summary you can act on."
        statusLabel={`${myStats.completed} completed`}
        actions={
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            Start practice
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile label="Sessions" value={String(myStats.total)} icon={MicVocal} tone="primary" />
        <KpiTile
          label="In progress"
          value={String(myStats.inProgress)}
          icon={History}
          tone="info"
          footnote="Resume anytime"
        />
        <KpiTile
          label="Average score"
          value={myStats.avg === null ? "—" : `${formatNumber(myStats.avg, 1)} / 5`}
          icon={Award}
          tone="warning"
        />
        <KpiTile
          label="Best score"
          value={myStats.best === null ? "—" : `${formatNumber(myStats.best, 1)} / 5`}
          icon={Award}
          tone="success"
        />
      </div>

      {isHr && orgStats ? (
        <p className="text-[11.5px] font-medium text-muted-foreground">
          Organisation-wide: {orgStats.sessions} sessions · {orgStats.completed} completed · average{" "}
          {orgStats.avgScore === null ? "—" : `${formatNumber(orgStats.avgScore, 1)} / 5`}
        </p>
      ) : null}

      {sessionsQuery.isLoading ? <LoadingState label="Reading your practice history" /> : null}

      {sessionsQuery.error ? (
        <ErrorState
          message={sessionsQuery.error instanceof Error ? sessionsQuery.error.message : "History could not be loaded."}
          onRetry={() => void sessionsQuery.refetch()}
        />
      ) : null}

      {!sessionsQuery.isLoading && !sessionsQuery.error && !sessions.length ? (
        <EmptyState
          icon={<MicVocal className="h-5 w-5" />}
          title="No practice sessions yet"
          description="Start a session for the role you are preparing for. The AI writes the questions, scores each answer, and summarises where to focus next."
          action={
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              Start practice
            </Button>
          }
        />
      ) : null}

      {!sessionsQuery.isLoading && !sessionsQuery.error && sessions.length ? (
        <div className="talent-tile overflow-hidden shadow-card">
          <div className="talent-scroll overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-3 pl-4 text-left talent-label">Role</th>
                  <th className="py-3 pr-4 text-left talent-label">Focus</th>
                  <th className="py-3 pr-4 text-left talent-label">Started</th>
                  <th className="py-3 pr-4 text-left talent-label">Status</th>
                  <th className="py-3 pr-4 text-left talent-label">Score</th>
                  <th className="py-3 pr-4 text-right talent-label">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => (
                  <tr key={session.id} className="border-b border-border last:border-0">
                    <td className="py-3 pl-4 pr-4">
                      <UserCell
                        name={session.role_title}
                        subtext={`${session.question_count} question${session.question_count === 1 ? "" : "s"} · ${session.answeredCount} answered`}
                        tone="primary"
                        trailing={
                          session.mode === "video" ? <StatusPill tone="accent">Video</StatusPill> : undefined
                        }
                      />
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex flex-wrap gap-1">
                        {(session.focus_areas ?? []).slice(0, 2).map((area) => (
                          <StatusPill key={area} tone="neutral">
                            {area}
                          </StatusPill>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-[12px] font-medium text-muted-foreground">
                      {formatDate(session.started_at)} · {formatRelative(session.started_at)}
                    </td>
                    <td className="py-3 pr-4">
                      <StatusPill tone={session.status === "completed" ? "success" : "info"}>
                        {session.status === "completed" ? "Completed" : "In progress"}
                      </StatusPill>
                    </td>
                    <td className="py-3 pr-4">
                      <StatusPill tone={scoreTone(session.overall_score)}>
                        {session.overall_score === null
                          ? "—"
                          : `${formatNumber(Number(session.overall_score), 1)} / 5`}
                      </StatusPill>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button variant="soft" size="sm" asChild>
                          <Link to={session.mode === "video" ? `/app/practice/${session.id}/video` : `/app/practice/${session.id}`}>
                            {session.status === "completed" ? "Review" : "Resume"}
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                        <Button
                          variant="soft-destructive"
                          size="icon-sm"
                          aria-label="Delete session"
                          onClick={() => {
                            if (window.confirm("Delete this practice session?")) {
                              deleteMutation.mutate(session.id);
                            }
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[88vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[17px] font-bold">Start a practice session</DialogTitle>
            <DialogDescription className="text-[12.5px] font-medium leading-relaxed">
              Tell the coach what you are preparing for. Questions are written to probe real evidence, and
              each answer is scored against a rubric.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <span className="talent-label">Interview format</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMode("text")}
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors",
                    mode === "text" ? "border-primary bg-primary-soft" : "border-border bg-card hover:border-primary/40",
                  )}
                >
                  <span className="text-[12.5px] font-semibold text-foreground">Text interview</span>
                  <span className="text-[11px] font-medium leading-snug text-muted-foreground">
                    Type your answers. Best for a quick warm-up.
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode("video")}
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors",
                    mode === "video" ? "border-primary bg-primary-soft" : "border-border bg-card hover:border-primary/40",
                  )}
                >
                  <span className="text-[12.5px] font-semibold text-foreground">Video interview</span>
                  <span className="text-[11px] font-medium leading-snug text-muted-foreground">
                    The AI asks aloud and records your answer on camera.
                  </span>
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="practiceRole">Role you are preparing for</Label>
              <Input
                id="practiceRole"
                required
                value={roleTitle}
                onChange={(event) => setRoleTitle(event.target.value)}
                placeholder="Senior Backend Engineer"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="practiceJd">Job description (optional)</Label>
              <Textarea
                id="practiceJd"
                value={jobDescription}
                onChange={(event) => setJobDescription(event.target.value)}
                placeholder="Paste the posting to tailor the questions to its requirements."
                className="min-h-[90px]"
              />
            </div>

            <div className="flex flex-col gap-2">
              <span className="talent-label">Focus areas</span>
              <div className="flex flex-wrap gap-2">
                {FOCUS_AREAS.map((area) => (
                  <button
                    key={area}
                    type="button"
                    onClick={() => toggleFocus(area)}
                    className={cn(
                      "talent-chip border transition-colors",
                      focusAreas.includes(area)
                        ? "border-primary bg-primary-soft text-primary-soft-foreground"
                        : "border-border bg-card text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {area}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="practiceCount">Number of questions</Label>
              <select
                id="practiceCount"
                value={questionCount}
                onChange={(event) => setQuestionCount(event.target.value)}
                className="h-9 w-full rounded-[10px] border border-input bg-card px-3 text-[13px] font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                <option value="3">3 questions — quick warm-up</option>
                <option value="5">5 questions — standard session</option>
                <option value="8">8 questions — full-length practice</option>
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
              {createMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MicVocal className="h-3.5 w-3.5" />}
              Start session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
