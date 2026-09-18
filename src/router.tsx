import { Navigate } from "react-router-dom";
import { AppShell } from "@/components/layout/app-shell";
import { RequireAuth } from "@/components/auth/require-auth";
import { RequireRole } from "@/components/auth/require-role";
import RoleRedirect from "./pages/app/role-redirect";
import LoginPage from "./pages/auth/login";
import SignupPage from "./pages/auth/signup";
import CommandCenterPage from "./pages/command-center";
import ActionCenterPage from "./pages/action-center";
import RecruitmentPage from "./pages/recruitment";
import CandidatePage from "./pages/recruitment/candidate";
import InterviewsPage from "./pages/interviews";
import InterviewDetailPage from "./pages/interviews/detail";
import EmployeesPage from "./pages/employees";
import EmployeeDetailPage from "./pages/employees/detail";
import TeamPage from "./pages/team";
import RiskPage from "./pages/risk";
import SkillsPage from "./pages/skills";
import DevelopmentPage from "./pages/development";
import OnboardingPage from "./pages/onboarding";
import TasksPage from "./pages/tasks";
import MyProfilePage from "./pages/my-profile";
import CopilotPage from "./pages/copilot";
import PoliciesPage from "./pages/policies";
import DecisionLogPage from "./pages/decision-log";
import AdminConsolePage from "./pages/admin";
import AdminUsersPage from "./pages/admin/users";
import AdminIntegrationsPage from "./pages/admin/integrations";
import AdminUsagePage from "./pages/admin/usage";
import PracticePage from "./pages/practice";
import PracticeSessionPage from "./pages/practice/session";
import SettingsPage from "./pages/settings";
import NotFound from "./pages/NotFound";

export const routers = [
  {
    path: "/",
    name: "root",
    element: <Navigate to="/app" replace />,
  },
  {
    path: "/login",
    name: "login",
    element: <LoginPage />,
  },
  {
    path: "/signup",
    name: "signup",
    element: <SignupPage />,
  },
  {
    path: "/app",
    name: "workspace",
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { index: true, name: "app-index", element: <RoleRedirect /> },
      {
        path: "command-center",
        name: "command-center",
        element: (
          <RequireRole capabilities={["view_org_overview"]}>
            <CommandCenterPage />
          </RequireRole>
        ),
      },
      {
        path: "action-center",
        name: "action-center",
        element: (
          <RequireRole capabilities={["review_actions_org", "review_actions_team"]}>
            <ActionCenterPage />
          </RequireRole>
        ),
      },
      {
        path: "recruitment",
        name: "recruitment",
        element: (
          <RequireRole capabilities={["view_recruitment"]}>
            <RecruitmentPage />
          </RequireRole>
        ),
      },
      {
        path: "recruitment/:applicationId",
        name: "recruitment-candidate",
        element: (
          <RequireRole capabilities={["view_recruitment"]}>
            <CandidatePage />
          </RequireRole>
        ),
      },
      {
        path: "interviews",
        name: "interviews",
        element: (
          <RequireRole capabilities={["view_interviews"]}>
            <InterviewsPage />
          </RequireRole>
        ),
      },
      {
        path: "interviews/:interviewId",
        name: "interview-detail",
        element: (
          <RequireRole capabilities={["view_interviews"]}>
            <InterviewDetailPage />
          </RequireRole>
        ),
      },
      {
        path: "team",
        name: "team",
        element: (
          <RequireRole capabilities={["view_team"]}>
            <TeamPage />
          </RequireRole>
        ),
      },
      {
        path: "employees",
        name: "employees",
        element: (
          <RequireRole capabilities={["browse_employees", "view_team"]}>
            <EmployeesPage />
          </RequireRole>
        ),
      },
      {
        path: "employees/:employeeId",
        name: "employee-detail",
        element: (
          <RequireRole capabilities={["browse_employees", "view_team", "view_self"]}>
            <EmployeeDetailPage />
          </RequireRole>
        ),
      },
      {
        path: "risk",
        name: "risk",
        element: (
          <RequireRole capabilities={["view_risk_org", "view_risk_team"]}>
            <RiskPage />
          </RequireRole>
        ),
      },
      {
        path: "skills",
        name: "skills",
        element: (
          <RequireRole capabilities={["view_org_overview", "view_team"]}>
            <SkillsPage />
          </RequireRole>
        ),
      },
      {
        path: "development",
        name: "development",
        element: (
          <RequireRole capabilities={["view_org_overview", "view_team", "view_self"]}>
            <DevelopmentPage />
          </RequireRole>
        ),
      },
      { path: "onboarding", name: "onboarding", element: <OnboardingPage /> },
      {
        path: "tasks",
        name: "tasks",
        element: (
          <RequireRole capabilities={["view_self"]}>
            <TasksPage />
          </RequireRole>
        ),
      },
      {
        path: "my-profile",
        name: "my-profile",
        element: (
          <RequireRole capabilities={["view_self"]}>
            <MyProfilePage />
          </RequireRole>
        ),
      },
      { path: "copilot", name: "copilot", element: <CopilotPage /> },
      { path: "policies", name: "policies", element: <PoliciesPage /> },
      {
        path: "decision-log",
        name: "decision-log",
        element: (
          <RequireRole capabilities={["view_decision_log"]}>
            <DecisionLogPage />
          </RequireRole>
        ),
      },
      {
        path: "admin",
        name: "admin",
        element: (
          <RequireRole capabilities={["manage_admin"]}>
            <AdminConsolePage />
          </RequireRole>
        ),
      },
      {
        path: "admin/users",
        name: "admin-users",
        element: (
          <RequireRole capabilities={["manage_users"]}>
            <AdminUsersPage />
          </RequireRole>
        ),
      },
      {
        path: "admin/integrations",
        name: "admin-integrations",
        element: (
          <RequireRole capabilities={["manage_admin"]}>
            <AdminIntegrationsPage />
          </RequireRole>
        ),
      },
      {
        path: "admin/usage",
        name: "admin-usage",
        element: (
          <RequireRole capabilities={["view_admin_usage"]}>
            <AdminUsagePage />
          </RequireRole>
        ),
      },
      { path: "practice", name: "practice", element: <PracticePage /> },
      { path: "practice/:sessionId", name: "practice-session", element: <PracticeSessionPage /> },
      { path: "settings", name: "settings", element: <SettingsPage /> },
    ],
  },
  /* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */
  {
    path: "*",
    name: "not-found",
    element: <NotFound />,
  },
];

declare global {
  interface Window {
    __routers__: typeof routers;
  }
}

window.__routers__ = routers;
