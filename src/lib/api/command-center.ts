import { supabase } from "@/integrations/supabase/client";
import { formatMonth } from "@/lib/format";

export interface Slice {
  name: string;
  value: number;
  key?: string;
}

export interface TrendPoint {
  label: string;
  value: number;
  secondary?: number;
}

export interface CommandCenterData {
  kpis: {
    headcount: number;
    openRoles: number;
    candidatesInPipeline: number;
    pendingRecommendations: number;
    highRisk: number;
    openTasks: number;
    interviewsAwaitingEvaluation: number;
    avgEngagement: number;
  };
  roleDistribution: Slice[];
  pipelineByStage: Slice[];
  pipelineBySource: Slice[];
  onboardingByStatus: Slice[];
  statusSplit: Slice[];
  applicationTrend: TrendPoint[];
  riskTrend: TrendPoint[];
  departmentLoad: Slice[];
  evaluationProgress: {
    evaluated: number;
    total: number;
    percent: number;
  };
  aiSpend: {
    tokens: number;
    cost: number;
    runs: number;
  };
}

const SHORT_MONTHS = 6;
const TREND_WEEKS = 10;

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function weekStart(date: Date): Date {
  const copy = new Date(date);
  const day = (copy.getDay() + 6) % 7; // Monday-first
  copy.setDate(copy.getDate() - day);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function countBy<T>(rows: T[], key: (row: T) => string | null | undefined): Record<string, number> {
  return rows.reduce<Record<string, number>>((acc, row) => {
    const resolved = key(row);
    if (!resolved) return acc;
    acc[resolved] = (acc[resolved] ?? 0) + 1;
    return acc;
  }, {});
}

/**
 * Single aggregate read for the Workforce Command Center.
 * Aggregation happens in the client because the dataset for a pilot workspace is
 * small and this keeps the shape explicit instead of relying on PostgREST grouping.
 * Every underlying query is still scoped by row level security for the caller.
 */
export async function fetchCommandCenter(): Promise<CommandCenterData> {
  const [
    profilesResult,
    employeesResult,
    departmentsResult,
    riskResult,
    applicationsResult,
    onboardingResult,
    recommendationsResult,
    interviewsResult,
    tasksResult,
    usageResult,
    jobsResult,
  ] = await Promise.all([
    supabase.from("talent_profiles").select("id, role"),
    supabase
      .from("talent_employees")
      .select("id, status, department_id, engagement_score, hire_date, role_title"),
    supabase.from("talent_departments").select("id, name"),
    supabase.from("talent_risk_assessments").select("risk_level, assessed_at, employee_id"),
    supabase
      .from("talent_applications")
      .select("id, stage, created_at, ai_match_score, candidate:talent_candidates(source)"),
    supabase.from("talent_onboarding_progress").select("status"),
    supabase.from("talent_ai_recommendations").select("id, status, module"),
    supabase.from("talent_interviews").select("id, status, overall_score"),
    supabase.from("talent_workflow_tasks").select("id, status, due_date"),
    supabase.from("talent_ai_usage").select("total_tokens, cost_estimate"),
    supabase.from("talent_job_postings").select("id, status"),
  ]);

  const firstError = [
    profilesResult.error,
    employeesResult.error,
    departmentsResult.error,
    riskResult.error,
    applicationsResult.error,
    onboardingResult.error,
    recommendationsResult.error,
    interviewsResult.error,
    tasksResult.error,
    usageResult.error,
    jobsResult.error,
  ].find(Boolean);

  if (firstError) throw new Error(firstError.message);

  const profiles = profilesResult.data ?? [];
  const employees = employeesResult.data ?? [];
  const departments = departmentsResult.data ?? [];
  const risks = riskResult.data ?? [];
  const applications = applicationsResult.data ?? [];
  const onboarding = onboardingResult.data ?? [];
  const recommendations = recommendationsResult.data ?? [];
  const interviews = interviewsResult.data ?? [];
  const tasks = tasksResult.data ?? [];
  const usage = usageResult.data ?? [];
  const jobs = jobsResult.data ?? [];

  const departmentNames = departments.reduce<Record<string, string>>((acc, department) => {
    acc[department.id] = department.name;
    return acc;
  }, {});

  const profileRoles = countBy(profiles, (row) => row.role);
  const roleLabels: Record<string, string> = {
    org_admin: "Org admins",
    hr_admin: "HR admins",
    manager: "Managers",
    employee: "Employees",
  };

  const roleDistribution: Slice[] = Object.entries(profileRoles)
    .map(([key, value]) => ({ key, name: roleLabels[key] ?? key, value }))
    .sort((a, b) => b.value - a.value);

  const stageLabels: Record<string, string> = {
    sourced: "Sourced",
    screened: "Screened",
    interviewing: "Interviewing",
    offer: "Offer",
    hired: "Hired",
    hold: "Hold",
    rejected: "Rejected",
  };

  const pipelineByStage: Slice[] = Object.entries(countBy(applications, (row) => row.stage))
    .map(([key, value]) => ({ key, name: stageLabels[key] ?? key, value }))
    .sort((a, b) => b.value - a.value);

  const sourceCounts = countBy(
    applications,
    (row) => (row.candidate as { source: string | null } | null)?.source ?? "Unknown",
  );
  const pipelineBySource: Slice[] = Object.entries(sourceCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const onboardingStatusLabels: Record<string, string> = {
    completed: "Completed",
    in_progress: "In progress",
    pending: "Not started",
  };
  const onboardingByStatus: Slice[] = Object.entries(countBy(onboarding, (row) => row.status))
    .map(([key, value]) => ({ key, name: onboardingStatusLabels[key] ?? key, value }))
    .sort((a, b) => b.value - a.value);

  const employeeStatusLabels: Record<string, string> = {
    active: "Active",
    onboarding: "Onboarding",
    offboarding: "Offboarding",
    inactive: "Inactive",
  };
  const statusSplit: Slice[] = Object.entries(countBy(employees, (row) => row.status))
    .map(([key, value]) => ({ key, name: employeeStatusLabels[key] ?? key, value }))
    .sort((a, b) => b.value - a.value);

  // Applications raised per week over the trailing window.
  const now = new Date();
  const applicationTrend: TrendPoint[] = Array.from({ length: TREND_WEEKS }).map((_, index) => {
    const start = weekStart(new Date(now.getTime() - (TREND_WEEKS - 1 - index) * 7 * 86_400_000));
    const end = new Date(start.getTime() + 7 * 86_400_000);
    const value = applications.filter((row) => {
      const created = new Date(row.created_at);
      return created >= start && created < end;
    }).length;
    return {
      label: start.toLocaleDateString("en-US", { day: "numeric", month: "short" }),
      value,
    };
  });

  // Latest assessment per employee, grouped by month.
  const latestByEmployee = new Map<string, { level: string; assessedAt: string }>();
  risks.forEach((row) => {
    const current = latestByEmployee.get(row.employee_id);
    if (!current || new Date(row.assessed_at) > new Date(current.assessedAt)) {
      latestByEmployee.set(row.employee_id, { level: row.risk_level, assessedAt: row.assessed_at });
    }
  });

  const riskTrend: TrendPoint[] = Array.from({ length: SHORT_MONTHS }).map((_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (SHORT_MONTHS - 1 - index), 1);
    const key = monthKey(date);
    const inMonth = [...latestByEmployee.values()].filter(
      (entry) => monthKey(new Date(entry.assessedAt)) === key,
    );
    const elevated = inMonth.filter((entry) => entry.level !== "low").length;
    return { label: formatMonth(date.toISOString()), value: elevated };
  });

  const departmentCounts = countBy(employees, (row) =>
    row.department_id ? (departmentNames[row.department_id] ?? "Unassigned") : "Unassigned",
  );
  const maxDepartment = Math.max(1, ...Object.values(departmentCounts));
  const departmentLoad: Slice[] = Object.entries(departmentCounts)
    .map(([name, value]) => ({ name, value, key: String(Math.round((value / maxDepartment) * 100)) }))
    .sort((a, b) => b.value - a.value);

  const evaluated = interviews.filter((row) => row.overall_score !== null).length;
  const totalInterviews = interviews.length;

  const engagementValues = employees
    .map((row) => row.engagement_score)
    .filter((value): value is number => typeof value === "number");

  const usageTotals = usage.reduce(
    (acc, row) => {
      acc.tokens += row.total_tokens ?? 0;
      acc.cost += Number(row.cost_estimate ?? 0);
      acc.runs += 1;
      return acc;
    },
    { tokens: 0, cost: 0, runs: 0 },
  );

  return {
    kpis: {
      headcount: employees.length,
      openRoles: jobs.filter((job) => job.status === "open").length,
      candidatesInPipeline: applications.filter(
        (row) => !["rejected", "hired"].includes(row.stage ?? ""),
      ).length,
      pendingRecommendations: recommendations.filter((row) => row.status === "pending").length,
      highRisk: [...latestByEmployee.values()].filter((entry) => entry.level === "high").length,
      openTasks: tasks.filter((row) => row.status === "open").length,
      interviewsAwaitingEvaluation: interviews.filter((row) => row.overall_score === null).length,
      avgEngagement: engagementValues.length
        ? Math.round(engagementValues.reduce((sum, value) => sum + value, 0) / engagementValues.length)
        : 0,
    },
    roleDistribution,
    pipelineByStage,
    pipelineBySource,
    onboardingByStatus,
    statusSplit,
    applicationTrend,
    riskTrend,
    departmentLoad,
    evaluationProgress: {
      evaluated,
      total: totalInterviews,
      percent: totalInterviews ? Math.round((evaluated / totalInterviews) * 100) : 0,
    },
    aiSpend: {
      tokens: usageTotals.tokens,
      cost: Number(usageTotals.cost.toFixed(2)),
      runs: usageTotals.runs,
    },
  };
}
