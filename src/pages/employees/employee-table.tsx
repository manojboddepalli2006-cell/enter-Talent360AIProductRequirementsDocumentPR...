import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Eye, Search, Users } from "lucide-react";
import { StatusPill } from "@/components/common/status-pill";
import { UserCell } from "@/components/common/user-cell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/common/states";
import { RISK_LABELS, RISK_TONE } from "@/lib/domain";
import { formatDate } from "@/lib/format";
import type { EmployeeWithContext } from "@/lib/api/people";
import { cn } from "@/lib/utils";

interface EmployeeTableProps {
  employees: EmployeeWithContext[];
  /** Managers never see the org-wide risk column, so it is opt-in. */
  showRisk?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}

const SELECT_CLASS = cn(
  "h-8 rounded-lg border border-input bg-card px-2.5 text-[12px] font-semibold text-foreground",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
);

export function EmployeeTable({
  employees,
  showRisk = true,
  emptyTitle = "No people in this view",
  emptyDescription = "Adjust the filters, or add people to the workspace.",
}: EmployeeTableProps) {
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("all");
  const [risk, setRisk] = useState("all");

  const departments = useMemo(() => {
    const names = new Set<string>();
    employees.forEach((employee) => {
      if (employee.departmentName) names.add(employee.departmentName);
    });
    return Array.from(names).sort();
  }, [employees]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return employees.filter((employee) => {
      if (department !== "all" && employee.departmentName !== department) return false;
      if (showRisk && risk !== "all") {
        if (risk === "none" ? employee.latestRisk !== null : employee.latestRisk !== risk) return false;
      }
      if (!term) return true;
      return (
        employee.full_name.toLowerCase().includes(term) ||
        employee.role_title.toLowerCase().includes(term) ||
        (employee.email ?? "").toLowerCase().includes(term)
      );
    });
  }, [employees, search, department, risk, showRisk]);

  return (
    <div className="flex flex-col gap-3">
      <div className="talent-tile flex flex-wrap items-center justify-between gap-2 p-3 shadow-card">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search people"
              className="h-8 w-[220px] pl-8"
            />
          </div>
          <select
            className={SELECT_CLASS}
            value={department}
            onChange={(event) => setDepartment(event.target.value)}
            aria-label="Filter by department"
          >
            <option value="all">All departments</option>
            {departments.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          {showRisk ? (
            <select
              className={SELECT_CLASS}
              value={risk}
              onChange={(event) => setRisk(event.target.value)}
              aria-label="Filter by risk"
            >
              <option value="all">Any risk</option>
              <option value="high">High risk</option>
              <option value="medium">Medium risk</option>
              <option value="low">Low risk</option>
              <option value="none">Not assessed</option>
            </select>
          ) : null}
        </div>
        <span className="pr-1 text-[11.5px] font-semibold text-muted-foreground">
          {filtered.length} of {employees.length}
        </span>
      </div>

      {!filtered.length ? (
        <EmptyState icon={<Users className="h-5 w-5" />} title={emptyTitle} description={emptyDescription} />
      ) : (
        <div className="talent-tile overflow-hidden shadow-card">
          <div className="talent-scroll overflow-x-auto">
            <table className="w-full min-w-[880px] border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-3 pl-4 text-left talent-label">Person</th>
                  <th className="py-3 pr-4 text-left talent-label">Role</th>
                  <th className="py-3 pr-4 text-left talent-label">Department</th>
                  <th className="py-3 pr-4 text-left talent-label">Manager</th>
                  <th className="py-3 pr-4 text-left talent-label">Tenure</th>
                  <th className="py-3 pr-4 text-left talent-label">Engagement</th>
                  {showRisk ? <th className="py-3 pr-4 text-left talent-label">Risk</th> : null}
                  <th className="py-3 pr-4 text-right talent-label">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((employee) => (
                  <tr key={employee.id} className="border-b border-border last:border-0">
                    <td className="py-3 pl-4 pr-4">
                      <UserCell name={employee.full_name} subtext={employee.email} />
                    </td>
                    <td className="py-3 pr-4 text-[12.5px] font-semibold text-foreground">
                      {employee.role_title}
                      {employee.seniority ? (
                        <span className="block text-[11px] font-medium text-muted-foreground">
                          {employee.seniority}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-3 pr-4 text-[12.5px] font-medium text-muted-foreground">
                      {employee.departmentName ?? "Unassigned"}
                    </td>
                    <td className="py-3 pr-4 text-[12.5px] font-medium text-muted-foreground">
                      {employee.managerName ?? "—"}
                    </td>
                    <td className="py-3 pr-4 text-[12.5px] font-medium text-muted-foreground">
                      {employee.hire_date ? formatDate(employee.hire_date) : "—"}
                    </td>
                    <td className="py-3 pr-4">
                      {employee.engagement_score === null ? (
                        <span className="text-[12.5px] font-medium text-muted-foreground">—</span>
                      ) : (
                        <StatusPill
                          tone={
                            employee.engagement_score >= 75
                              ? "success"
                              : employee.engagement_score >= 60
                                ? "info"
                                : "warning"
                          }
                        >
                          {employee.engagement_score}
                        </StatusPill>
                      )}
                    </td>
                    {showRisk ? (
                      <td className="py-3 pr-4">
                        {employee.latestRisk ? (
                          <StatusPill tone={RISK_TONE[employee.latestRisk] ?? "neutral"}>
                            {RISK_LABELS[employee.latestRisk] ?? employee.latestRisk}
                          </StatusPill>
                        ) : (
                          <span className="text-[11.5px] font-medium text-muted-foreground">Not assessed</span>
                        )}
                      </td>
                    ) : null}
                    <td className="py-3 pr-4 text-right">
                      <Button variant="soft" size="sm" asChild>
                        <Link to={`/app/employees/${employee.id}`}>
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
