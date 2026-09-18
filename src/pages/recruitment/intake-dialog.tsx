import { useState } from "react";
import { FileText, Upload, Wand2 } from "lucide-react";
import { toast } from "sonner";
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
import { StatusPill } from "@/components/common/status-pill";
import { extractTextFromFile, MIN_USEFUL_TEXT } from "@/lib/extraction";
import { createCandidateApplication } from "@/lib/api/recruitment";
import type { JobPostingRow } from "@/lib/api/recruitment";
import { useProfile } from "@/hooks/use-profile";
import { cn } from "@/lib/utils";

interface IntakeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobs: JobPostingRow[];
  onCreated: (applicationId: string) => void;
}

type ExtractionState =
  | { kind: "idle" }
  | { kind: "working"; fileName: string }
  | { kind: "ok"; fileName: string; characters: number }
  | { kind: "failed"; fileName: string; reason: string };

export function IntakeDialog({ open, onOpenChange, jobs, onCreated }: IntakeDialogProps) {
  const { org } = useProfile();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [location, setLocation] = useState("");
  const [source, setSource] = useState("Direct");
  const [jobPostingId, setJobPostingId] = useState(jobs[0]?.id ?? "");
  const [resumeText, setResumeText] = useState("");
  const [extraction, setExtraction] = useState<ExtractionState>({ kind: "idle" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolvedJobId = jobPostingId || jobs[0]?.id || "";

  const handleFile = async (file: File) => {
    setExtraction({ kind: "working", fileName: file.name });
    const result = await extractTextFromFile(file);

    if (!result.ok) {
      // Deliberately falls back to the paste field rather than submitting blank text.
      setExtraction({ kind: "failed", fileName: file.name, reason: result.reason ?? "The file could not be read." });
      return;
    }

    setResumeText(result.text);
    setExtraction({ kind: "ok", fileName: file.name, characters: result.text.length });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!org?.id) {
      setError("Your workspace could not be resolved.");
      return;
    }
    if (!resolvedJobId) {
      setError("Create a job posting first, then add candidates to it.");
      return;
    }
    if (resumeText.trim().length < MIN_USEFUL_TEXT) {
      setError("Resume text is required. Upload a PDF or DOCX, or paste the resume text.");
      return;
    }

    setSubmitting(true);
    try {
      const applicationId = await createCandidateApplication(
        {
          fullName: fullName.trim(),
          email: email.trim(),
          location: location.trim(),
          source,
          jobPostingId: resolvedJobId,
          resumeText: resumeText.trim(),
          sourceFileName: extraction.kind === "ok" ? extraction.fileName : null,
        },
        org.id,
      );

      toast.success("Candidate added", { description: `${fullName} is now in the pipeline as sourced.` });
      onCreated(applicationId);
      onOpenChange(false);
      setFullName("");
      setEmail("");
      setLocation("");
      setResumeText("");
      setExtraction({ kind: "idle" });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The candidate could not be created.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[16px] font-extrabold">Add a candidate</DialogTitle>
          <DialogDescription className="text-[12.5px] font-medium leading-relaxed">
            Upload a resume and the text is read in your browser. Only the extracted text is stored —
            the original file is not retained by this workspace.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="candidateName">Full name</Label>
              <Input
                id="candidateName"
                required
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Arjun Rao"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="candidateEmail">Email</Label>
              <Input
                id="candidateEmail"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="arjun.rao@example.com"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="candidateLocation">Location</Label>
              <Input
                id="candidateLocation"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                placeholder="Bengaluru, IN"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="candidateSource">Source</Label>
              <select
                id="candidateSource"
                value={source}
                onChange={(event) => setSource(event.target.value)}
                className={cn(
                  "h-9 w-full rounded-lg border border-input bg-card px-3 text-[13px] font-medium text-foreground",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                )}
              >
                {["Direct", "Referral", "LinkedIn", "Careers page", "Job board", "Agency"].map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="candidateJob">Job posting</Label>
            <select
              id="candidateJob"
              value={resolvedJobId}
              onChange={(event) => setJobPostingId(event.target.value)}
              className={cn(
                "h-9 w-full rounded-lg border border-input bg-card px-3 text-[13px] font-medium text-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
              )}
            >
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.title}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2 rounded-xl border border-dashed border-input bg-muted/30 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-[12.5px] font-bold text-foreground">Resume</div>
                <div className="text-[11px] font-medium text-muted-foreground">
                  PDF, DOCX, TXT or Markdown · text is extracted locally
                </div>
              </div>
              <label className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-lg bg-primary-soft px-3 text-[12px] font-bold text-primary-soft-foreground transition-colors hover:bg-primary-soft/70">
                <Upload className="h-3.5 w-3.5" />
                Choose file
                <input
                  type="file"
                  accept=".pdf,.docx,.txt,.md,application/pdf"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void handleFile(file);
                  }}
                />
              </label>
            </div>

            {extraction.kind === "working" ? (
              <div className="text-[11.5px] font-semibold text-muted-foreground">
                Reading {extraction.fileName}…
              </div>
            ) : null}

            {extraction.kind === "ok" ? (
              <div className="flex items-center gap-2">
                <StatusPill tone="success" icon={<FileText className="h-3 w-3" />}>
                  {extraction.characters.toLocaleString()} characters read
                </StatusPill>
                <span className="truncate text-[11px] font-medium text-muted-foreground">
                  {extraction.fileName}
                </span>
              </div>
            ) : null}

            {extraction.kind === "failed" ? (
              <div className="flex flex-col gap-1">
                <StatusPill tone="warning">{extraction.fileName}</StatusPill>
                <p className="text-[11.5px] font-semibold leading-snug text-warning-soft-foreground">
                  {extraction.reason} Paste the resume text below instead.
                </p>
              </div>
            ) : null}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="resumeText">Resume text</Label>
              <Textarea
                id="resumeText"
                required
                className="min-h-[160px]"
                value={resumeText}
                onChange={(event) => setResumeText(event.target.value)}
                placeholder="Paste the resume here, or let the uploader fill it in."
              />
              <span className="text-[11px] font-medium text-muted-foreground">
                {resumeText.trim().length} characters
              </span>
            </div>
          </div>

          {error ? (
            <div className="rounded-lg bg-destructive-soft px-3 py-2.5 text-[12.5px] font-semibold text-destructive-soft-foreground">
              {error}
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={submitting} title="Then run the AI match from the candidate page">
              {submitting ? "Adding…" : "Add candidate"}
              <Wand2 className="h-3.5 w-3.5" />
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
