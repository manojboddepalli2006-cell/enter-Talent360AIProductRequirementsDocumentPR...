import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type EmployeeRow = Database["public"]["Tables"]["talent_employees"]["Row"];
export type DepartmentRow = Database["public"]["Tables"]["talent_departments"]["Row"];
export type RiskRow = Database["public"]["Tables"]["talent_risk_assessments"]["Row"];
export type SkillRow = Database["public"]["Tables"]["talent_skills"]["Row"];

export interface EmployeeWithContext extends EmployeeRow {
  departmentName: string | null;
  managerName: string | null;
  latestRisk: string | null;
  averageProficiency: number | null;
}

/**
 * Directory read. For HR this returns the organisation; for a manager RLS narrows
 * the same query to their direct reports, so no scope flag is needed here.
 */
export async function listEmployees(): Promise<EmployeeWithContext[]> {
  const [employeesResult, departmentsResult, risksResult, skillsResult] = await Promise.all([
    supabase.from("talent_employees").select("*").order("full_name"),
    supabase.from("talent_departments").select("id, name"),
    supabase.from("talent_risk_assessments").select("employee_id, risk_level, assessed_at"),
    supabase.from("talent_employee_skills").select("employee_id, proficiency"),
  ]);

  const error =
    employeesResult.error ?? departmentsResult.error ?? risksResult.error ?? skillsResult.error;
  if (error) throw new Error(error.message);

  const employees = employeesResult.data ?? [];
  const departments = departmentsResult.data ?? [];
  const risks = risksResult.data ?? [];
  const skills = skillsResult.data ?? [];

  const departmentNames = departments.reduce<Record<string, string>>((acc, department) => {
    acc[department.id] = department.name;
    return acc;
  }, {});

  const employeeNames = employees.reduce<Record<string, string>>((acc, employee) => {
    acc[employee.id] = employee.full_name;
    return acc;
  }, {});

  const latestRisk = risks.reduce<Record<string, { level: string; at: string }>>((acc, risk) => {
    const current = acc[risk.employee_id];
    if (!current || new Date(risk.assessed_at) > new Date(current.at)) {
      acc[risk.employee_id] = { level: risk.risk_level, at: risk.assessed_at };
    }
    return acc;
  }, {});

  const proficiency = skills.reduce<Record<string, { total: number; count: number }>>((acc, row) => {
    const current = acc[row.employee_id] ?? { total: 0, count: 0 };
    current.total += row.proficiency ?? 0;
    current.count += 1;
    acc[row.employee_id] = current;
    return acc;
  }, {});

  return employees.map((employee) => {
    const stats = proficiency[employee.id];
    return {
      ...employee,
      departmentName: employee.department_id ? (departmentNames[employee.department_id] ?? null) : null,
      managerName: employee.manager_id ? (employeeNames[employee.manager_id] ?? null) : null,
      latestRisk: latestRisk[employee.id]?.level ?? null,
      averageProficiency: stats && stats.count ? Math.round(stats.total / stats.count) : null,
    };
  });
}

export interface EmployeeSkillWithMeta {
  skillId: string;
  skillName: string;
  category: string;
  proficiency: number;
  source: string;
  requiredLevel: number | null;
  gap: number | null;
}

export interface Employee360 {
  employee: EmployeeRow;
  departmentName: string | null;
  managerName: string | null;
  skills: EmployeeSkillWithMeta[];
  performance: Database["public"]["Tables"]["talent_performance_reviews"]["Row"][];
  engagement: Array<{ recorded_at: string; value: number }>;
  risk: RiskRow | null;
  onboarding: Database["public"]["Tables"]["talent_onboarding_progress"]["Row"][];
  learning: Array<
    Database["public"]["Tables"]["talent_learning_recommendations"]["Row"] & { skillName: string | null }
  >;
  recommendations: Database["public"]["Tables"]["talent_ai_recommendations"]["Row"][];
}

export async function fetchEmployee360(employeeId: string): Promise<Employee360 | null> {
  const { data: employee, error: employeeError } = await supabase
    .from("talent_employees")
    .select("*")
    .eq("id", employeeId)
    .maybeSingle();

  if (employeeError) throw new Error(employeeError.message);
  if (!employee) return null;

  const [
    departmentResult,
    managerResult,
    skillResult,
    requirementResult,
    performanceResult,
    engagementResult,
    riskResult,
    onboardingResult,
    learningResult,
    recommendationResult,
  ] = await Promise.all([
    employee.department_id
      ? supabase.from("talent_departments").select("name").eq("id", employee.department_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    employee.manager_id
      ? supabase.from("talent_employees").select("full_name").eq("id", employee.manager_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("talent_employee_skills")
      .select("proficiency, source, skill:talent_skills(id, name, category)")
      .eq("employee_id", employeeId),
    supabase
      .from("talent_role_skill_requirements")
      .select("skill_id, required_level")
      .eq("role_title", employee.role_title),
    supabase
      .from("talent_performance_reviews")
      .select("*")
      .eq("employee_id", employeeId)
      .order("period", { ascending: true }),
    supabase
      .from("talent_engagement_signals")
      .select("recorded_at, value")
      .eq("employee_id", employeeId)
      .order("recorded_at", { ascending: true }),
    supabase
      .from("talent_risk_assessments")
      .select("*")
      .eq("employee_id", employeeId)
      .order("assessed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("talent_onboarding_progress")
      .select("*")
      .eq("employee_id", employeeId)
      .order("due_date", { ascending: true }),
    supabase
      .from("talent_learning_recommendations")
      .select("*, skill:talent_skills(name)")
      .eq("employee_id", employeeId)
      .order("priority"),
    supabase
      .from("talent_ai_recommendations")
      .select("*")
      .eq("employee_id", employeeId)
      .order("created_at", { ascending: false }),
  ]);

  const firstError = [
    skillResult.error,
    requirementResult.error,
    performanceResult.error,
    engagementResult.error,
    riskResult.error,
    onboardingResult.error,
    learningResult.error,
    recommendationResult.error,
  ].find(Boolean);

  if (firstError) throw new Error(firstError.message);

  const requirements = (requirementResult.data ?? []).reduce<Record<string, number>>((acc, row) => {
    acc[row.skill_id] = row.required_level;
    return acc;
  }, {});

  const skills: EmployeeSkillWithMeta[] = (
    (skillResult.data ?? []) as unknown as Array<{
      proficiency: number;
      source: string;
      skill: { id: string; name: string; category: string } | null;
    }>
  )
    .filter((row) => row.skill)
    .map((row) => {
      const requiredLevel = requirements[row.skill!.id] ?? null;
      return {
        skillId: row.skill!.id,
        skillName: row.skill!.name,
        category: row.skill!.category,
        proficiency: row.proficiency,
        source: row.source,
        requiredLevel,
        gap: requiredLevel === null ? null : requiredLevel - row.proficiency,
      };
    })
    .sort((a, b) => (b.gap ?? -999) - (a.gap ?? -999));

  return {
    employee,
    departmentName: (departmentResult.data as { name: string } | null)?.name ?? null,
    managerName: (managerResult.data as { full_name: string } | null)?.full_name ?? null,
    skills,
    performance: performanceResult.data ?? [],
    engagement: engagementResult.data ?? [],
    risk: (riskResult.data as RiskRow | null) ?? null,
    onboarding: onboardingResult.data ?? [],
    learning: (
      (learningResult.data ?? []) as unknown as Array<
        Database["public"]["Tables"]["talent_learning_recommendations"]["Row"] & {
          skill: { name: string } | null;
        }
      >
    ).map((row) => ({ ...row, skillName: row.skill?.name ?? null })),
    recommendations: recommendationResult.data ?? [],
  };
}

export interface RiskWithEmployee extends RiskRow {
  employeeName: string | null;
  roleTitle: string | null;
  departmentName: string | null;
}

/**
 * Latest risk assessment per employee. RLS limits this to the organisation for HR
 * and to direct reports for a manager, and excludes the employee entirely.
 */
export async function listRiskAssessments(): Promise<RiskWithEmployee[]> {
  const [riskResult, employeeResult, departmentResult] = await Promise.all([
    supabase.from("talent_risk_assessments").select("*").order("assessed_at", { ascending: false }),
    supabase.from("talent_employees").select("id, full_name, role_title, department_id"),
    supabase.from("talent_departments").select("id, name"),
  ]);

  const error = riskResult.error ?? employeeResult.error ?? departmentResult.error;
  if (error) throw new Error(error.message);

  const employees = employeeResult.data ?? [];
  const departments = departmentResult.data ?? [];
  const departmentNames = departments.reduce<Record<string, string>>((acc, department) => {
    acc[department.id] = department.name;
    return acc;
  }, {});

  const byId = employees.reduce<Record<string, (typeof employees)[number]>>((acc, employee) => {
    acc[employee.id] = employee;
    return acc;
  }, {});

  const seen = new Set<string>();
  const latest: RiskWithEmployee[] = [];

  for (const risk of riskResult.data ?? []) {
    if (seen.has(risk.employee_id)) continue;
    // The employee record may be outside the caller's scope, in which case the
    // row is skipped rather than rendered with an empty name.
    const employee = byId[risk.employee_id];
    if (!employee) continue;
    seen.add(risk.employee_id);
    latest.push({
      ...risk,
      employeeName: employee.full_name,
      roleTitle: employee.role_title,
      departmentName: employee.department_id ? (departmentNames[employee.department_id] ?? null) : null,
    });
  }

  return latest;
}

export interface SkillGapRow {
  skillId: string;
  skillName: string;
  category: string;
  averageProficiency: number;
  requiredLevel: number;
  roleTitle: string;
  gap: number;
  people: number;
}

/** Aggregated gap between the assessed profile and the target profile per role. */
export async function listSkillGaps(): Promise<SkillGapRow[]> {
  const [requirementResult, skillResult, employeeResult, employeeSkillResult] = await Promise.all([
    supabase.from("talent_role_skill_requirements").select("role_title, skill_id, required_level"),
    supabase.from("talent_skills").select("id, name, category"),
    supabase.from("talent_employees").select("id, role_title"),
    supabase.from("talent_employee_skills").select("employee_id, skill_id, proficiency"),
  ]);

  const error =
    requirementResult.error ?? skillResult.error ?? employeeResult.error ?? employeeSkillResult.error;
  if (error) throw new Error(error.message);

  const skills = (skillResult.data ?? []).reduce<Record<string, SkillRow>>((acc, skill) => {
    acc[skill.id] = skill as SkillRow;
    return acc;
  }, {});

  const employees = employeeResult.data ?? [];
  const employeeSkills = employeeSkillResult.data ?? [];

  const proficiencyByEmployee = employeeSkills.reduce<Record<string, Record<string, number>>>(
    (acc, row) => {
      acc[row.employee_id] = acc[row.employee_id] ?? {};
      acc[row.employee_id][row.skill_id] = row.proficiency;
      return acc;
    },
    {},
  );

  return (requirementResult.data ?? [])
    .map((requirement) => {
      const skill = skills[requirement.skill_id];
      if (!skill) return null;

      const inRole = employees.filter((employee) => employee.role_title === requirement.role_title);
      const values = inRole
        .map((employee) => proficiencyByEmployee[employee.id]?.[requirement.skill_id])
        .filter((value): value is number => typeof value === "number");

      if (!values.length) return null;

      const average = Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
      return {
        skillId: requirement.skill_id,
        skillName: skill.name,
        category: skill.category,
        averageProficiency: average,
        requiredLevel: requirement.required_level,
        roleTitle: requirement.role_title,
        gap: requirement.required_level - average,
        people: values.length,
      };
    })
    .filter((row): row is SkillGapRow => row !== null)
    .sort((a, b) => b.gap - a.gap);
}

export async function listDepartments(): Promise<DepartmentRow[]> {
  const { data, error } = await supabase.from("talent_departments").select("*").order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function updateEmployeeProfile(
  employeeId: string,
  patch: Partial<Database["public"]["Tables"]["talent_employees"]["Update"]>,
): Promise<void> {
  const { error } = await supabase.from("talent_employees").update(patch).eq("id", employeeId);
  if (error) throw new Error(error.message);
}

export async function completeOnboardingStep(stepId: string, complete: boolean): Promise<void> {
  const { error } = await supabase
    .from("talent_onboarding_progress")
    .update({
      status: complete ? "completed" : "in_progress",
      completed_at: complete ? new Date().toISOString() : null,
    })
    .eq("id", stepId);
  if (error) throw new Error(error.message);
}
