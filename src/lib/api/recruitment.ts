import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type ApplicationRow = Database["public"]["Tables"]["talent_applications"]["Row"];
export type CandidateRow = Database["public"]["Tables"]["talent_candidates"]["Row"];
export type JobPostingRow = Database["public"]["Tables"]["talent_job_postings"]["Row"];
export type InterviewRow = Database["public"]["Tables"]["talent_interviews"]["Row"];

export interface ApplicationWithContext extends ApplicationRow {
  candidate: CandidateRow | null;
  job: JobPostingRow | null;
  interviewCount: number;
}

const APPLICATION_SELECT =
  "*, candidate:talent_candidates(*), job:talent_job_postings(*), interviews:talent_interviews(id)";

export async function listJobPostings(): Promise<JobPostingRow[]> {
  const { data, error } = await supabase
    .from("talent_job_postings")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listApplications(): Promise<ApplicationWithContext[]> {
  const { data, error } = await supabase
    .from("talent_applications")
    .select(APPLICATION_SELECT)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (
    (data ?? []) as Array<
      ApplicationRow & {
        candidate: CandidateRow | null;
        job: JobPostingRow | null;
        interviews: Array<{ id: string }>;
      }
    >
  ).map((row) => ({
    ...row,
    interviewCount: row.interviews?.length ?? 0,
  }));
}

export interface ApplicationDetail {
  application: ApplicationWithContext;
  interviews: Array<InterviewRow & { scoreCount: number }>;
}

export async function fetchApplicationDetail(id: string): Promise<ApplicationDetail | null> {
  const { data, error } = await supabase
    .from("talent_applications")
    .select(`${APPLICATION_SELECT}, interviews:talent_interviews(*, responses:talent_interview_responses(score))`)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const row = data as unknown as ApplicationRow & {
    candidate: CandidateRow | null;
    job: JobPostingRow | null;
    interviews: Array<InterviewRow & { responses: Array<{ score: number | null }> }>;
  };

  const { interviews, ...application } = row;

  return {
    application: { ...application, interviewCount: interviews?.length ?? 0 },
    interviews: (interviews ?? []).map((interview) => ({
      ...interview,
      scoreCount: (interview.responses ?? []).filter((response) => response.score !== null).length,
    })),
  };
}

export async function moveApplicationStage(id: string, stage: string): Promise<void> {
  const { error } = await supabase
    .from("talent_applications")
    .update({ stage, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export interface NewCandidateInput {
  fullName: string;
  email: string;
  location?: string;
  source?: string;
  jobPostingId: string;
  resumeText: string;
  /** Original filename, kept for reference; the file itself is not retained. */
  sourceFileName?: string | null;
}

/**
 * Creates the candidate and their application in one step from the intake form.
 * Resume text is extracted in the browser and stored as text: this workspace does
 * not retain the original uploaded file.
 */
export async function createCandidateApplication(
  input: NewCandidateInput,
  orgId: string,
): Promise<string> {
  const { data: candidate, error: candidateError } = await supabase
    .from("talent_candidates")
    .insert({
      org_id: orgId,
      full_name: input.fullName,
      email: input.email,
      location: input.location ?? null,
      source: input.source ?? "Direct",
      resume_text: input.resumeText,
      parsed_profile: input.sourceFileName ? { source_file: input.sourceFileName } : null,
    })
    .select("id")
    .single();

  if (candidateError) throw new Error(candidateError.message);

  const { data: application, error: applicationError } = await supabase
    .from("talent_applications")
    .insert({
      org_id: orgId,
      candidate_id: candidate.id,
      job_posting_id: input.jobPostingId,
      stage: "sourced",
      status: "active",
    })
    .select("id")
    .single();

  if (applicationError) throw new Error(applicationError.message);
  return application.id;
}

export async function recordApplicationDecision(
  id: string,
  stage: string,
  actorId: string | null,
): Promise<void> {
  const { error } = await supabase
    .from("talent_applications")
    .update({ stage, decided_by: actorId, decided_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}
