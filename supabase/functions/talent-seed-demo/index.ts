import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-session-id",
};

const NL = String.fromCharCode(10);

function hash(seed: string): number {
  let value = 0;
  for (let index = 0; index < seed.length; index += 1) {
    value = (value * 31 + seed.charCodeAt(index)) % 100000;
  }
  return Math.abs(value);
}

function pick(seed: string, min: number, max: number): number {
  return min + (hash(seed) % (max - min + 1));
}

function isoDate(daysFromNow: number): string {
  return new Date(Date.now() + daysFromNow * 86_400_000).toISOString().slice(0, 10);
}

const DEPARTMENTS = ["Engineering", "Product", "Sales", "Marketing", "People & Culture", "Finance"];

const LEADS = [
  { name: "Aarav Menon", dept: "People & Culture", title: "Chief People Officer", seniority: "Executive", location: "Bengaluru, IN" },
  { name: "Priya Raman", dept: "People & Culture", title: "HR Manager", seniority: "Lead", location: "Bengaluru, IN", manager: "Aarav Menon" },
  { name: "Daniel Okafor", dept: "Engineering", title: "Engineering Manager", seniority: "Manager", location: "Lisbon, PT" },
  { name: "Mei Lin", dept: "Sales", title: "Sales Director", seniority: "Manager", location: "Singapore, SG" },
  { name: "Tomas Ferreira", dept: "Product", title: "Head of Product", seniority: "Manager", location: "Lisbon, PT" },
  { name: "Aisha Bello", dept: "Marketing", title: "Marketing Lead", seniority: "Manager", location: "Lagos, NG" },
  { name: "Ravi Kulkarni", dept: "Finance", title: "Finance Manager", seniority: "Manager", location: "Pune, IN" },
];

const MEMBERS = [
  { name: "Nadia Hassan", dept: "Engineering", manager: "Daniel Okafor", title: "Senior Backend Engineer", seniority: "Senior", location: "Cairo, EG" },
  { name: "Liam O'Connor", dept: "Engineering", manager: "Daniel Okafor", title: "Platform Engineer", seniority: "Mid", location: "Dublin, IE" },
  { name: "Sofia Almeida", dept: "Engineering", manager: "Daniel Okafor", title: "Frontend Engineer", seniority: "Mid", location: "Porto, PT" },
  { name: "Kenji Watanabe", dept: "Engineering", manager: "Daniel Okafor", title: "QA Engineer", seniority: "Junior", location: "Osaka, JP" },
  { name: "Elena Petrova", dept: "Product", manager: "Tomas Ferreira", title: "Product Manager", seniority: "Senior", location: "Sofia, BG" },
  { name: "Marcus Boateng", dept: "Product", manager: "Tomas Ferreira", title: "Product Designer", seniority: "Mid", location: "Accra, GH" },
  { name: "Grace Kim", dept: "Sales", manager: "Mei Lin", title: "Account Executive", seniority: "Senior", location: "Seoul, KR" },
  { name: "Dev Sharma", dept: "Sales", manager: "Mei Lin", title: "Sales Development Rep", seniority: "Junior", location: "Delhi, IN" },
  { name: "Chloe Dubois", dept: "Marketing", manager: "Aisha Bello", title: "Content Strategist", seniority: "Mid", location: "Paris, FR" },
  { name: "Omar Haddad", dept: "Marketing", manager: "Aisha Bello", title: "Growth Analyst", seniority: "Mid", location: "Amman, JO" },
  { name: "Ines Garcia", dept: "People & Culture", manager: "Priya Raman", title: "Technical Recruiter", seniority: "Mid", location: "Madrid, ES" },
  { name: "Tomasz Nowak", dept: "Finance", manager: "Ravi Kulkarni", title: "Financial Analyst", seniority: "Mid", location: "Warsaw, PL" },
];

const SKILLS: Array<[string, string]> = [
  ["React", "Engineering"], ["TypeScript", "Engineering"], ["Node.js", "Engineering"], ["PostgreSQL", "Engineering"],
  ["Python", "Engineering"], ["Docker", "Engineering"], ["Kubernetes", "Engineering"], ["AWS", "Engineering"],
  ["CI/CD", "Engineering"], ["System Design", "Engineering"], ["Test Automation", "Engineering"],
  ["Product Strategy", "Product"], ["Roadmapping", "Product"], ["User Research", "Product"],
  ["Figma", "Design"], ["Design Systems", "Design"], ["Consultative Selling", "Sales"], ["Negotiation", "Sales"],
  ["Pipeline Management", "Sales"], ["CRM Hygiene", "Sales"], ["SEO", "Marketing"], ["Content Strategy", "Marketing"],
  ["Marketing Analytics", "Marketing"], ["Technical Recruiting", "People"], ["HR Analytics", "People"],
  ["Coaching", "People"], ["Financial Modelling", "Finance"], ["Budgeting", "Finance"],
  ["Data Analysis", "Core"], ["Stakeholder Management", "Core"],
];

const ROLE_REQUIREMENTS: Array<[string, string, number]> = [
  ["Senior Backend Engineer", "Node.js", 80], ["Senior Backend Engineer", "PostgreSQL", 85],
  ["Senior Backend Engineer", "System Design", 80], ["Senior Backend Engineer", "Docker", 70],
  ["Frontend Engineer", "React", 80], ["Frontend Engineer", "TypeScript", 80],
  ["Frontend Engineer", "Design Systems", 65], ["Frontend Engineer", "Test Automation", 65],
  ["Product Manager", "Product Strategy", 85], ["Product Manager", "Roadmapping", 80],
  ["Product Manager", "User Research", 75], ["Product Manager", "Data Analysis", 70],
  ["Account Executive", "Consultative Selling", 85], ["Account Executive", "Negotiation", 80],
  ["Account Executive", "Pipeline Management", 75],
  ["Financial Analyst", "Financial Modelling", 85], ["Financial Analyst", "Budgeting", 80],
  ["Financial Analyst", "Data Analysis", 75],
];

const POLICY_DOCS: Array<{
  title: string;
  category: string;
  chunks: Array<{ section: string; body: string }>;
}> = [
  {
    title: "Leave & Time Off Policy",
    category: "Leave",
    chunks: [
      { section: "1. Annual leave entitlement", body: "Every full-time employee is entitled to 24 days of paid annual leave per calendar year, accrued monthly at 2 days per month. Part-time employees accrue pro rata based on contracted days. Leave accrues from the first day of employment." },
      { section: "2. Requesting leave", body: "Leave requests must be submitted through the HR system at least 14 calendar days before the intended start date for absences of five days or more, and at least 3 working days before for shorter absences. Managers must respond within 3 working days. A request that has not been answered within that window is not automatically approved." },
      { section: "3. Carry-over and encashment", body: "A maximum of 5 unused leave days may be carried into the following calendar year and must be used by 31 March. Days beyond that limit lapse. Leave is not encashed except on termination of employment, where accrued unused days are paid out at the employee's base daily rate." },
      { section: "4. Sick leave", body: "Employees receive 10 days of paid sick leave per year. Absences of up to 2 consecutive days may be self-certified. Absences longer than 2 consecutive days require a medical certificate submitted within 5 working days of return. Sick leave does not require advance approval, but the employee must notify their manager by the start of their working day." },
      { section: "5. Parental leave", body: "Primary caregivers are entitled to 26 weeks of paid parental leave. Secondary caregivers are entitled to 8 weeks of paid leave, which may be taken in up to three separate blocks within 12 months of birth or adoption. Employees must notify the People team at least 8 weeks before the intended start date where practicable." },
    ],
  },
  {
    title: "Code of Conduct",
    category: "Conduct",
    chunks: [
      { section: "1. Scope and expectations", body: "This code applies to all employees, contractors and interns. It sets the minimum standard of conduct in all work contexts, including offsite events, client sites and internal communication channels. Where local law sets a higher standard, local law prevails." },
      { section: "2. Respect at work", body: "Harassment, discrimination and bullying are prohibited. This includes conduct based on race, gender, gender identity, religion, age, disability, sexual orientation or nationality. Employees who experience or witness such conduct should report it to their manager, to any member of the People team, or through the anonymous reporting channel." },
      { section: "3. Reporting and non-retaliation", body: "Reports are handled confidentially and investigated within 10 working days of receipt. Retaliation against anyone who makes a report in good faith, or who participates in an investigation, is itself a disciplinary matter and is treated as gross misconduct." },
      { section: "4. Confidentiality and data protection", body: "Company, customer and colleague personal data is confidential and must only be accessed on a need-to-know basis. Employees must not move company data to personal devices or personal cloud accounts. Suspected data breaches must be reported to the security contact within 24 hours of discovery." },
    ],
  },
  {
    title: "Remote & Hybrid Working Policy",
    category: "Ways of working",
    chunks: [
      { section: "1. Hybrid baseline", body: "Employees assigned to a hybrid pattern work from an office at least 2 days per week, with Tuesday and Thursday as shared anchor days for teams that can attend. Employees assigned to fully remote contracts have no office attendance requirement." },
      { section: "2. Work location and tax", body: "Employees must work from the country stated in their contract. Working from another country for more than 30 days in a rolling 12-month period requires prior written approval from the People team, because it can create tax and permanent-establishment exposure for the company." },
      { section: "3. Core collaboration hours", body: "Teams define core collaboration hours of not more than 5 hours per day, which must fall between 09:00 and 17:00 in the team's primary time zone. Outside core hours, employees manage their own schedule. Recurring meetings must not be scheduled outside a team's core hours without agreement." },
      { section: "4. Home office equipment", body: "The company provides a laptop, a monitor and a home office allowance of 250 USD per year for remote and hybrid employees. Equipment purchased with the allowance remains company property and must be returned on termination." },
      { section: "5. Right to disconnect", body: "Standard hours are 40 per week, excluding breaks. Employees are not expected to respond to messages outside their working hours, and managers must not create an expectation of out-of-hours availability except for agreed on-call rotations, which are compensated." },
    ],
  },
];

const CANDIDATES = [
  { name: "Arjun Rao", email: "arjun.rao.seed@example.com", location: "Bengaluru, IN", source: "Referral", score: 91, headline: "Staff Backend Engineer", years: 8 },
  { name: "Carlos Mendes", email: "carlos.mendes.seed@example.com", location: "Lisbon, PT", source: "Careers page", score: 87, headline: "Principal Engineer", years: 9 },
  { name: "Beatrice Lang", email: "beatrice.lang.seed@example.com", location: "Lyon, FR", source: "LinkedIn", score: 92, headline: "Senior Product Designer", years: 6 },
  { name: "Fatima Zahra", email: "fatima.zahra.seed@example.com", location: "Casablanca, MA", source: "Referral", score: 88, headline: "Product Designer", years: 4 },
  { name: "Grace Osei", email: "grace.osei.seed@example.com", location: "London, UK", source: "LinkedIn", score: 90, headline: "Enterprise Account Executive", years: 7 },
  { name: "Jonas Weber", email: "jonas.weber.seed@example.com", location: "Berlin, DE", source: "Careers page", score: 63, headline: "HR Operations Specialist", years: 3 },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
    );

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) throw new Error("Sign in before seeding a workspace.");

    const { data: profile, error: profileError } = await supabase
      .from("talent_profiles")
      .select("id, org_id, full_name")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) throw new Error(profileError.message);
    if (!profile) throw new Error("Your workspace profile was not found.");

    const orgId = profile.org_id;

    // Departments are only ever created by this seeder, so their presence is the
    // signal that the workspace has already been structured. Counting employees
    // would trip over the caller's own record, which signup creates.
    const { data: existingDepartments, error: existingError } = await supabase
      .from("talent_departments")
      .select("id")
      .limit(1);

    if (existingError) throw new Error(existingError.message);

    if (existingDepartments?.length) {
      const { data: completed, error: completedError } = await supabase
        .from("talent_audit_log")
        .select("id")
        .eq("action", "workspace.demo_seeded")
        .limit(1);

      if (completedError) throw new Error(completedError.message);

      if (completed?.length) {
        return new Response(
          JSON.stringify({
            ok: true,
            summary: "This workspace has already been populated, so nothing was generated.",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // An earlier attempt stopped part way. Saying so is better than adding a
      // second copy of the same people.
      throw new Error(
        "A previous seeding attempt did not finish, so this workspace is already partly populated. " +
          "Adding a second copy of the same people would corrupt it, so nothing was written. " +
          "Create a fresh organisation to seed a clean benchmark workspace.",
      );
    }

    // ------------------------------------------------------------- structure
    const { data: departments, error: departmentError } = await supabase
      .from("talent_departments")
      .insert(DEPARTMENTS.map((name) => ({ org_id: orgId, name })))
      .select("id, name");

    if (departmentError) throw new Error(departmentError.message);
    const deptId = (departments ?? []).reduce<Record<string, string>>((acc, department) => {
      acc[department.name] = department.id;
      return acc;
    }, {});

    const leaderRows = LEADS.map((lead) => ({
      org_id: orgId,
      full_name: lead.name,
      email: `${lead.name.toLowerCase().replace(/[^a-z]+/g, ".")}@example.com`,
      department_id: deptId[lead.dept] ?? null,
      role_title: lead.title,
      seniority: lead.seniority,
      location: lead.location,
      hire_date: isoDate(-pick(lead.name, 400, 1900)),
      status: "active",
      engagement_score: pick(`${lead.name}-eng`, 72, 92),
    }));

    const { data: insertedLeaders, error: leaderError } = await supabase
      .from("talent_employees")
      .insert(leaderRows)
      .select("id, full_name");

    if (leaderError) throw new Error(leaderError.message);
    const leaderId = (insertedLeaders ?? []).reduce<Record<string, string>>((acc, leader) => {
      acc[leader.full_name] = leader.id;
      return acc;
    }, {});

    const memberRows = MEMBERS.map((member) => ({
      org_id: orgId,
      full_name: member.name,
      email: `${member.name.toLowerCase().replace(/[^a-z]+/g, ".")}@example.com`,
      department_id: deptId[member.dept] ?? null,
      manager_id: leaderId[member.manager] ?? null,
      role_title: member.title,
      seniority: member.seniority,
      location: member.location,
      hire_date: isoDate(-pick(member.name, 120, 1200)),
      status: "active",
      engagement_score: pick(`${member.name}-eng`, 48, 88),
    }));

    const { data: insertedMembers, error: memberError } = await supabase
      .from("talent_employees")
      .insert(memberRows)
      .select("id, full_name, role_title, engagement_score");

    if (memberError) throw new Error(memberError.message);

    const allPeople = [
      ...(insertedLeaders ?? []).map((leader) => ({
        id: leader.id,
        role_title: leaderRows.find((row) => row.full_name === leader.full_name)?.role_title ?? "Team Member",
        engagement_score: leaderRows.find((row) => row.full_name === leader.full_name)?.engagement_score ?? 75,
      })),
      ...(insertedMembers ?? []).map((member) => ({
        id: member.id,
        role_title: member.role_title,
        engagement_score: member.engagement_score ?? 70,
      })),
    ];

    // Map the caller onto their own employee record so their own dashboard works.
    const { data: callerEmployee } = await supabase
      .from("talent_employees")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (callerEmployee && !allPeople.some((person) => person.id === callerEmployee.id)) {
      allPeople.push({ id: callerEmployee.id, role_title: "Team Member", engagement_score: 70 });
    }

    // ----------------------------------------------------------------- skills
    const { data: skills, error: skillError } = await supabase
      .from("talent_skills")
      .insert(SKILLS.map(([name, category]) => ({ org_id: orgId, name, category })))
      .select("id, name");

    if (skillError) throw new Error(skillError.message);
    const skillId = (skills ?? []).reduce<Record<string, string>>((acc, skill) => {
      acc[skill.name] = skill.id;
      return acc;
    }, {});

    const employeeSkillRows = allPeople.flatMap((person) =>
      (skills ?? [])
        .map((skill) => ({ skill, order: hash(`${person.id}${skill.id}`) }))
        .sort((a, b) => a.order - b.order)
        .slice(0, 7)
        .map(({ skill }) => ({
          org_id: orgId,
          employee_id: person.id,
          skill_id: skill.id,
          proficiency: pick(`${person.id}${skill.id}`, 38, 95),
          source: "assessed",
        })),
    );

    if (employeeSkillRows.length) {
      const { error } = await supabase.from("talent_employee_skills").insert(employeeSkillRows);
      if (error) throw new Error(error.message);
    }

    const requirementRows = ROLE_REQUIREMENTS.filter(([, skillName]) => skillId[skillName]).map(
      ([roleTitle, skillName, requiredLevel]) => ({
        org_id: orgId,
        role_title: roleTitle,
        skill_id: skillId[skillName],
        required_level: requiredLevel,
      }),
    );

    if (requirementRows.length) {
      const { error } = await supabase.from("talent_role_skill_requirements").insert(requirementRows);
      if (error) throw new Error(error.message);
    }

    // ------------------------------------------------------------- recruitment
    const jobRows = [
      { title: "Senior Backend Engineer", dept: "Engineering", required: ["Node.js", "PostgreSQL", "System Design", "Docker"], seniority: "Senior", location: "Lisbon, PT (Hybrid)" },
      { title: "Product Designer", dept: "Product", required: ["Figma", "Design Systems", "User Research"], seniority: "Mid", location: "Remote (EU)" },
      { title: "Account Executive, EMEA", dept: "Sales", required: ["Consultative Selling", "Negotiation", "Pipeline Management"], seniority: "Mid", location: "London, UK (Hybrid)" },
      { title: "People Operations Partner", dept: "People & Culture", required: ["Coaching", "HR Analytics", "Stakeholder Management"], seniority: "Mid", location: "Bengaluru, IN" },
    ];

    const { data: jobs, error: jobError } = await supabase
      .from("talent_job_postings")
      .insert(
        jobRows.map((job) => ({
          org_id: orgId,
          title: job.title,
          description: `Own the work behind Talent360's ${job.title} remit. Pair with product and ship weekly.`,
          department_id: deptId[job.dept] ?? null,
          seniority: job.seniority,
          location: job.location,
          required_skills: job.required,
          status: "open",
          created_by: profile.id,
        })),
      )
      .select("id, title");

    if (jobError) throw new Error(jobError.message);
    const jobId = (jobs ?? []).reduce<Record<string, string>>((acc, job) => {
      acc[job.title] = job.id;
      return acc;
    }, {});

    const { data: candidates, error: candidateError } = await supabase
      .from("talent_candidates")
      .insert(
        CANDIDATES.map((candidate) => ({
          org_id: orgId,
          full_name: candidate.name,
          email: candidate.email,
          location: candidate.location,
          source: candidate.source,
          resume_text: `${candidate.years} years of experience. ${candidate.headline}. Delivered work end to end, mentored colleagues and owned outcomes rather than tasks.`,
          parsed_profile: {
            years_experience: candidate.years,
            headline: candidate.headline,
            location: candidate.location,
          },
        })),
      )
      .select("id, email");

    if (candidateError) throw new Error(candidateError.message);
    const candidateId = (candidates ?? []).reduce<Record<string, string>>((acc, candidate) => {
      acc[candidate.email] = candidate.id;
      return acc;
    }, {});

    const stages = ["screened", "interviewing", "offer", "hold", "rejected", "sourced"];
    const applicationRows = CANDIDATES.map((candidate, index) => {
      const jobTitle = index <= 1 ? "Senior Backend Engineer" : index <= 3 ? "Product Designer" : index === 4 ? "Account Executive, EMEA" : "People Operations Partner";
      const score = candidate.score;
      return {
        org_id: orgId,
        candidate_id: candidateId[candidate.email],
        job_posting_id: jobId[jobTitle],
        stage: stages[index] ?? "sourced",
        ai_match_score: score,
        ai_match_breakdown: {
          overall: score,
          criteria: [
            { factor: "Skills match", score: Math.min(98, score + 3), weight: 0.4, note: "Demonstrated against the required skills in the posting." },
            { factor: "Experience", score: Math.max(30, score - 4), weight: 0.35, note: `${candidate.years} years of directly relevant delivery.` },
            { factor: "Role fit", score: score, weight: 0.25, note: "Ownership history matches the autonomy this role needs." },
          ],
          explanation: `${candidate.headline} with ${candidate.years} years of experience. The evidence in the resume supports the scored criteria; the explanation is generated for review rather than applied automatically.`,
          strengths: ["End-to-end ownership", "Evidence of measurable delivery"],
          gaps: score >= 85 ? [] : ["Below the posted experience bar"],
          confidence: Number((0.65 + (score % 25) / 100).toFixed(2)),
        },
        bias_flags: index === 5
          ? [{ type: "pedigree_proxy", note: "Score is shaped by a non-target university credential in the header. Flagged for human review; the score was not adjusted." }]
          : [],
        status: "active",
      };
    }).filter((row) => row.candidate_id && row.job_posting_id);

    if (applicationRows.length) {
      const { error } = await supabase.from("talent_applications").insert(applicationRows);
      if (error) throw new Error(error.message);
    }

    // --------------------------------------------------------------- interviews
    const { data: interviewable } = await supabase
      .from("talent_applications")
      .select("id, candidate:talent_candidates(full_name)")
      .in("stage", ["interviewing", "offer"])
      .limit(3);

    if (interviewable?.length) {
      const { data: interviews, error: interviewError } = await supabase
        .from("talent_interviews")
        .insert(
          interviewable.map((application, index) => ({
            org_id: orgId,
            application_id: application.id,
            interview_type: index % 2 === 0 ? "technical" : "behavioral",
            scheduled_at: new Date(Date.now() - (index + 1) * 2 * 86_400_000).toISOString(),
            status: "awaiting_evaluation",
            requires_human_review: true,
          })),
        )
        .select("id");

      if (interviewError) throw new Error(interviewError.message);

      const questionRows = (interviews ?? []).flatMap((interview) =>
        [
          ["Walk me through a decision you made that you later reversed. What changed your mind?", "Problem Solving", "Looks for evidence-led reversal rather than defensiveness."],
          ["How do you decide what to measure when a system is degrading?", "Technical Knowledge", "Looks for measurement before theory and a falsifiable hypothesis."],
          ["Tell me about a time you had to disagree with someone more senior.", "Communication", "Looks for directness without theatre and use of evidence."],
          ["Describe a piece of work you shipped that you were not proud of.", "Communication", "Looks for honesty and a systemic fix rather than a personal resolution."],
          ["What would make you leave a role like this one?", "Role Fit", "Looks for self-awareness about motivation and conditions."],
        ].map(([question, category, rubric], index) => ({
          org_id: orgId,
          interview_id: interview.id,
          position: index + 1,
          question_text: question,
          category,
          rubric,
        })),
      );

      const { error: questionError } = await supabase.from("talent_interview_questions").insert(questionRows);
      if (questionError) throw new Error(questionError.message);
    }

    // ------------------------------------------------- performance and risk
    const reviewRows = allPeople.flatMap((person) =>
      ["2025 H1", "2025 H2", "2026 H1"].map((period) => ({
        org_id: orgId,
        employee_id: person.id,
        period,
        score: Number((2.4 + pick(`${person.id}${period}`, 0, 26) / 10).toFixed(1)),
        feedback_text:
          "Summarised from the review cycle. Strengths and development areas recorded by the reviewing manager.",
      })),
    );

    if (reviewRows.length) {
      const { error } = await supabase.from("talent_performance_reviews").insert(reviewRows);
      if (error) throw new Error(error.message);
    }

    const engagementRows = allPeople.flatMap((person) =>
      Array.from({ length: 6 }).map((_, index) => {
        const slope = pick(`${person.id}slope`, 0, 6) - 3;
        const value = Math.max(
          12,
          Math.min(99, person.engagement_score + (index - 2) * slope + (pick(`${person.id}${index}`, 0, 8) - 4)),
        );
        const recorded = new Date();
        recorded.setMonth(recorded.getMonth() - (5 - index));
        return {
          org_id: orgId,
          employee_id: person.id,
          source: "pulse-survey",
          value,
          recorded_at: recorded.toISOString(),
        };
      }),
    );

    if (engagementRows.length) {
      const { error } = await supabase.from("talent_engagement_signals").insert(engagementRows);
      if (error) throw new Error(error.message);
    }

    const riskRows = allPeople.map((person) => {
      const slope = pick(`${person.id}slope`, 0, 6) - 3;
      const engagementDir = slope <= -2 ? "down" : slope >= 2 ? "up" : "flat";
      const performanceDir = pick(`${person.id}perf`, 0, 4) === 0 ? "down" : "flat";
      const gapCount = pick(`${person.id}gaps`, 0, 3);
      const skillDir = gapCount >= 2 ? "down" : "flat";
      const downCount = [engagementDir, performanceDir, skillDir].filter((value) => value === "down").length;
      const level = downCount >= 2 ? "high" : downCount === 1 ? "medium" : "low";

      return {
        org_id: orgId,
        employee_id: person.id,
        risk_level: level,
        signals: [
          { factor: "Performance trend", direction: performanceDir, weight: performanceDir === "down" ? "high" : "low", detail: "Compared against the same person's previous review period" },
          { factor: "Engagement trend", direction: engagementDir, weight: engagementDir === "down" ? "high" : "low", detail: "Monthly pulse signal against its own baseline" },
          { factor: "Skill alignment", direction: skillDir, weight: skillDir === "down" ? "medium" : "low", detail: `${gapCount} required skill(s) below the target profile for ${person.role_title}` },
        ],
        explanation:
          level === "high"
            ? "Multiple signals are moving in the same direction. This pattern usually precedes voluntary exit and warrants a conversation this week rather than this quarter."
            : level === "medium"
              ? "One signal has moved against its own baseline while the others are stable. That is a prompt to check in, not a conclusion about intent."
              : "No signal is moving against its baseline. No intervention is indicated.",
        confidence: Number((0.62 + pick(`${person.id}conf`, 0, 28) / 100).toFixed(2)),
      };
    });

    if (riskRows.length) {
      const { error } = await supabase.from("talent_risk_assessments").insert(riskRows);
      if (error) throw new Error(error.message);
    }

    // ---------------------------------------------------------------- policies
    const { data: documents, error: documentError } = await supabase
      .from("talent_policy_documents")
      .insert(
        POLICY_DOCS.map((document) => ({
          org_id: orgId,
          title: document.title,
          category: document.category,
          version: 1,
          status: "indexed",
          uploaded_by: profile.id,
        })),
      )
      .select("id, title");

    if (documentError) throw new Error(documentError.message);
    const documentId = (documents ?? []).reduce<Record<string, string>>((acc, document) => {
      acc[document.title] = document.id;
      return acc;
    }, {});

    const chunkRows = POLICY_DOCS.flatMap((document) =>
      document.chunks.map((chunk, index) => ({
        org_id: orgId,
        document_id: documentId[document.title],
        section: chunk.section,
        chunk_index: index + 1,
        chunk_text: chunk.body,
      })),
    ).filter((chunk) => chunk.document_id);

    if (chunkRows.length) {
      const { error } = await supabase.from("talent_policy_chunks").insert(chunkRows);
      if (error) throw new Error(error.message);
    }

    // -------------------------------------------------------------- onboarding
    const templates = [
      { name: "Engineering onboarding", dept: "Engineering", steps: [
        { key: "env-setup", label: "Local environment and repository access", kind: "task", due_days: 2 },
        { key: "architecture", label: "Architecture walkthrough with your manager", kind: "meeting", due_days: 7 },
        { key: "first-ship", label: "Ship your first change to production", kind: "milestone", due_days: 30 },
        { key: "checkin-30", label: "30-day check-in with your manager", kind: "meeting", due_days: 30 },
      ] },
      { name: "Sales onboarding", dept: "Sales", steps: [
        { key: "crm", label: "CRM access and pipeline hygiene expectations", kind: "task", due_days: 2 },
        { key: "certification", label: "Product certification for the HR buyer", kind: "training", due_days: 10 },
        { key: "shadow", label: "Shadow three discovery calls", kind: "task", due_days: 14 },
        { key: "territory", label: "Territory plan reviewed by leadership", kind: "milestone", due_days: 21 },
      ] },
      { name: "People & Culture onboarding", dept: "People & Culture", steps: [
        { key: "hrms", label: "HR system access and permission review", kind: "task", due_days: 2 },
        { key: "policies", label: "Read the leave, conduct and remote policies", kind: "task", due_days: 5 },
        { key: "confidentiality", label: "Employee data confidentiality briefing", kind: "training", due_days: 7 },
        { key: "first-case", label: "Handle your first employee relations case with support", kind: "milestone", due_days: 45 },
      ] },
    ];

    const { data: insertedTemplates, error: templateError } = await supabase
      .from("talent_onboarding_templates")
      .insert(
        templates.map((template) => ({
          org_id: orgId,
          name: template.name,
          role_title: null,
          department_id: deptId[template.dept] ?? null,
          steps: template.steps,
          is_active: true,
        })),
      )
      .select("id, department_id, steps");

    if (templateError) throw new Error(templateError.message);

    const { data: employeeDepts, error: employeeDeptError } = await supabase
      .from("talent_employees")
      .select("id, department_id, hire_date");

    if (employeeDeptError) throw new Error(employeeDeptError.message);

    const progressRows = (employeeDepts ?? []).flatMap((employee) => {
      const template = (insertedTemplates ?? []).find((entry) => entry.department_id === employee.department_id);
      if (!template) return [];
      const steps = (template.steps ?? []) as unknown as Array<{
        key: string;
        label: string;
        kind: string;
        due_days: number;
      }>;
      return steps.map((step) => ({
        org_id: orgId,
        employee_id: employee.id,
        template_id: template.id,
        step_key: step.key,
        step_label: step.label,
        step_kind: step.kind,
        status: pick(`${employee.id}${step.key}`, 0, 2) === 0 ? "in_progress" : "completed",
        due_date: isoDate(pick(`${employee.id}${step.key}`, -20, 30)),
      }));
    });

    if (progressRows.length) {
      const { error } = await supabase.from("talent_onboarding_progress").insert(progressRows);
      if (error) throw new Error(error.message);
    }

    // -------------------------------------------------- recommendations + flow
    const highRisk = riskRows
      .map((row, index) => ({ row, person: allPeople[index] }))
      .filter((entry) => entry.row.risk_level === "high")
      .slice(0, 3);

    if (highRisk.length) {
      const { data: recommendations, error: recommendationError } = await supabase
        .from("talent_ai_recommendations")
        .insert(
          highRisk.map((entry) => ({
            org_id: orgId,
            module: "monitor",
            entity_type: "employee",
            entity_id: entry.person.id,
            employee_id: entry.person.id,
            title: `Retention risk: ${entry.person.role_title}`,
            summary: "Multiple signals are moving against their own baselines.",
            recommendation: {
              recommendation: "Run a structured stay conversation this week and review workload before the next cycle.",
              confidence: 0.8,
              reasoning_signals: entry.row.signals,
              explanation: entry.row.explanation,
              recommended_actions: ["Manager check-in within 5 working days", "Workload and role-fit review"],
              requires_human_review: true,
            },
            status: "pending",
          })),
        )
        .select("id, employee_id");

      if (recommendationError) throw new Error(recommendationError.message);

      const approved = (recommendations ?? []).slice(0, 1);
      if (approved.length) {
        await supabase
          .from("talent_ai_recommendations")
          .update({ status: "approved", reviewed_by: profile.id, reviewed_at: new Date().toISOString() })
          .eq("id", approved[0].id);

        const { data: workflows, error: workflowError } = await supabase
          .from("talent_workflows")
          .insert({
            org_id: orgId,
            recommendation_id: approved[0].id,
            workflow_type: "retention-check-in",
            status: "active",
            created_by: profile.id,
          })
          .select("id");

        if (workflowError) throw new Error(workflowError.message);

        if (workflows?.length) {
          const workflowId = workflows[0].id;
          const { error: taskError } = await supabase.from("talent_workflow_tasks").insert([
            {
              org_id: orgId,
              workflow_id: workflowId,
              assignee_employee_id: approved[0].employee_id,
              title: "Run the stay conversation",
              description: "Scope the conversation to workload and recognition only. Do not turn it into a performance review.",
              due_date: isoDate(3),
              status: "open",
            },
            {
              org_id: orgId,
              workflow_id: workflowId,
              assignee_employee_id: approved[0].employee_id,
              title: "Re-measure the engagement signal",
              description: "Compare against the pre-intervention baseline and record the delta as an outcome.",
              due_date: isoDate(30),
              status: "open",
            },
          ]);
          if (taskError) throw new Error(taskError.message);

          await supabase.from("talent_outcomes").insert({
            org_id: orgId,
            workflow_id: workflowId,
            metric: "Engagement pulse (30-day delta)",
            before_value: 52,
            after_value: 66,
            resolved: true,
            notes: "Recovered after the check-in. Full re-measurement continues at the 90-day point.",
          });
        }
      }
    }

    await supabase.from("talent_audit_log").insert([
      {
        org_id: orgId,
        actor_id: profile.id,
        actor_name: profile.full_name,
        action: "workspace.demo_seeded",
        entity_type: "organization",
        entity_id: orgId,
        metadata: { people: allPeople.length, model: "generated" },
      },
    ]);

    await supabase.from("talent_integrations").insert([
      { org_id: orgId, category: "ATS", provider: "Greenhouse", status: "not_configured", config: { sync_scope: "jobs,candidates" }, notes: "Configuration record only. No live sync is performed." },
      { org_id: orgId, category: "HRMS", provider: "BambooHR", status: "not_configured", config: { sync_scope: "employee_master_data" }, notes: "Configuration record only. Master data is not synced." },
      { org_id: orgId, category: "Comms", provider: "Slack", status: "not_configured", config: { channels: ["#people-ops"] }, notes: "Configuration record only. In-app notifications are used instead." },
    ]);

    const summary = [
      `Seeded ${allPeople.length} people`,
      `${SKILLS.length} skills`,
      `${applicationRows.length} applications`,
      `${riskRows.length} risk assessments`,
      `${chunkRows.length} policy passages`,
    ].join(" · ");

    return new Response(JSON.stringify({ ok: true, summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The demo workspace could not be generated.";
    console.error("talent-seed-demo failed", message + NL);
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
