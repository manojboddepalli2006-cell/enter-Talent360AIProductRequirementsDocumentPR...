import { useState } from "react";
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
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { listDepartments } from "@/lib/api/people";
import { cn } from "@/lib/utils";

interface JobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string | null;
  createdBy: string | null;
  onCreated: () => void;
}

const SELECT_CLASS = cn(
  "h-9 w-full rounded-lg border border-input bg-card px-3 text-[13px] font-medium text-foreground",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
);

export function JobDialog({ open, onOpenChange, orgId, createdBy, onCreated }: JobDialogProps) {
  const [title, setTitle] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [seniority, setSeniority] = useState("Mid");
  const [location, setLocation] = useState("");
  const [skills, setSkills] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const departmentsQuery = useQuery({
    queryKey: ["talent360-departments", orgId ?? "none"],
    enabled: Boolean(orgId) && open,
    queryFn: listDepartments,
  });

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!orgId) {
      setError("Your workspace could not be resolved.");
      return;
    }

    setSubmitting(true);
    try {
      const { error: insertError } = await supabase.from("talent_job_postings").insert({
        org_id: orgId,
        title: title.trim(),
        description: description.trim(),
        department_id: departmentId || departmentsQuery.data?.[0]?.id || null,
        seniority,
        location: location.trim() || null,
        required_skills: skills
          .split(",")
          .map((skill) => skill.trim())
          .filter(Boolean),
        status: "open",
        created_by: createdBy,
      });

      if (insertError) throw new Error(insertError.message);

      toast.success("Job posting created");
      onCreated();
      onOpenChange(false);
      setTitle("");
      setSkills("");
      setDescription("");
      setLocation("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The posting could not be created.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[16px] font-extrabold">New job posting</DialogTitle>
          <DialogDescription className="text-[12.5px] font-medium leading-relaxed">
            The description and required skills are what the match score is measured against, so keep them
            specific about demonstrated work.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="jobTitle">Title</Label>
            <Input
              id="jobTitle"
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Senior Backend Engineer"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="jobDepartment">Department</Label>
              <select
                id="jobDepartment"
                className={SELECT_CLASS}
                value={departmentId}
                onChange={(event) => setDepartmentId(event.target.value)}
              >
                {(departmentsQuery.data ?? []).map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="jobSeniority">Seniority</Label>
              <select
                id="jobSeniority"
                className={SELECT_CLASS}
                value={seniority}
                onChange={(event) => setSeniority(event.target.value)}
              >
                {["Junior", "Mid", "Senior", "Lead", "Executive"].map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="jobLocation">Location</Label>
            <Input
              id="jobLocation"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Lisbon, PT (Hybrid)"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="jobSkills">Required skills</Label>
            <Input
              id="jobSkills"
              value={skills}
              onChange={(event) => setSkills(event.target.value)}
              placeholder="Node.js, PostgreSQL, System Design"
            />
            <span className="text-[11px] font-medium text-muted-foreground">Comma separated</span>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="jobDescription">Description</Label>
            <Textarea
              id="jobDescription"
              required
              className="min-h-[120px]"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What this person will own, the level of autonomy, and the evidence you are looking for."
            />
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
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting ? "Creating…" : "Create posting"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
