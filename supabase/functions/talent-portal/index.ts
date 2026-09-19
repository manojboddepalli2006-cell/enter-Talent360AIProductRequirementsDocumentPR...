import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-session-id",
};

/**
 * Candidate portal API.
 *
 * The portal is deliberately scoped: a candidate identifies themselves with the
 * email they applied with plus a portal code shown to HR. No platform account or
 * password is involved, matching the PRD's "scoped candidate portal" role.
 *
 * This function is SECURITY DEFINER, so it must re-verify ownership on every read
 * and write it performs — it never trusts the caller's identity.
 */

interface PortalIdentity {
  email?: string;
  code?: string;
}

async function resolveCandidate(supabase: ReturnType<typeof createClient>, identity: PortalIdentity) {
  const email = identity.email?.trim().toLowerCase();
  const code = identity.code?.trim();

  if (!email || !code) return { error: "Enter both your email and your portal code." };

  const { data: candidate, error } = await supabase
    .from("talent_candidates")
    .select("id, org_id, full_name, email, location")
    .ilike("email", email)
    .eq("portal_code", code)
    .maybeSingle();

  if (error) return { error: error.message };
  if (!candidate) return { error: "That email and portal code do not match any application. Check the code your recruiter shared." };

  return { candidate };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // The portal is public and identifies callers by email + portal code, so it
    // runs with the service role and re-verifies ownership on every read/write it
    // performs. The anon key would be blocked by row level security.
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = (await req.json()) as PortalIdentity & { action?: string; questionId?: string; responseText?: string };
    const action = body.action === "save-answer" ? "save-answer" : "lookup";

    const { candidate, error } = await resolveCandidate(supabase, body);
    if (error) {
      return new Response(JSON.stringify({ ok: false, error }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!candidate) {
      return new Response(JSON.stringify({ ok: false, error: "Unknown candidate." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "save-answer") {
      const questionId = body.questionId;
      const responseText = body.responseText?.trim();

      if (!questionId || !responseText) {
        return new Response(JSON.stringify({ ok: false, error: "A question and an answer are required." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // The question must belong to an interview on one of THIS candidate's applications.
      const { data: question, error: questionError } = await supabase
        .from("talent_interview_questions")
        .select("id, org_id, interview:talent_interviews(org_id, application:talent_applications(candidate_id))")
        .eq("id", questionId)
        .maybeSingle();

      if (questionError) return { ok: false, error: questionError.message };
      const interview = question?.interview as unknown as {
        org_id: string;
        application: { candidate_id: string };
      } | null;

      if (!question || !interview || interview.org_id !== candidate.org_id || interview.application.candidate_id !== candidate.id) {
        return new Response(JSON.stringify({ ok: false, error: "That question is not part of your application." }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: existing } = await supabase
        .from("talent_interview_responses")
        .select("id")
        .eq("question_id", questionId)
        .maybeSingle();

      if (existing) {
        const { error: updateError } = await supabase
          .from("talent_interview_responses")
          .update({ response_text: responseText })
          .eq("id", existing.id);
        if (updateError) {
          return new Response(JSON.stringify({ ok: false, error: updateError.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else {
        const { error: insertError } = await supabase.from("talent_interview_responses").insert({
          org_id: question.org_id,
          question_id: questionId,
          response_text: responseText,
        });
        if (insertError) {
          return new Response(JSON.stringify({ ok: false, error: insertError.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      return new Response(JSON.stringify({ ok: true, action }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ------------------------------------------------------------- lookup
    const { data: applications, error: applicationsError } = await supabase
      .from("talent_applications")
      .select(
        "id, stage, status, created_at, ai_match_score, job:talent_job_postings(title, location, seniority), interviews:talent_interviews(id, interview_type, status, questions:talent_interview_questions(id, position, question_text, category, responses:talent_interview_responses(id, question_id, response_text)))",
      )
      .eq("candidate_id", candidate.id)
      .order("created_at", { ascending: false });

    if (applicationsError) {
      return new Response(JSON.stringify({ ok: false, error: applicationsError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        candidate: {
          full_name: candidate.full_name,
          email: candidate.email,
          location: candidate.location,
        },
        applications,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "The candidate portal could not respond.";
    console.error("talent-portal failed", message);
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
