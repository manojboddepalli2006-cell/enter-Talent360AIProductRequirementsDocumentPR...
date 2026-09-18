# Talent360 AI — Build Plan

## Context

The PRD describes **Talent360 AI**, an HR/workforce-intelligence platform with three cooperating layers: an **AI reasoning engine** (Qwen), a **workflow/orchestration layer**, and a **human-in-the-loop reviewer** who approves every consequential recommendation.

The PRD specifies a Next.js + NestJS + Python + Redis + pgvector stack. **None of that runs here.** This project is a Vite + React + TypeScript + Tailwind + shadcn app backed by Enter Cloud. So the plan keeps the *product* exactly as specified and re-maps the *infrastructure* onto what the platform actually provides (see §3). That mapping is honest, not decorative: no queue service, no vector database, no third-party ATS sync is faked.

The visual target is the "Administrator / Promo" admin panel you linked (`github.com/Sivamani100/administrationofpromo`) and the three screenshots: fixed dark sidebar (`#131722`), light `#F4F5FA` canvas, white 12px-radius cards, a horizontal row of KPI stat tiles, a chart-card grid on the dashboard, and filter-tabs + data tables on list pages. We adopt that shell and card language, but the navigation and content are Talent360's own modules — not the Promo influencer/campaign screens.

**Confirmed with you:** full 9-module MVP with depth on the core; four real roles (Org Admin, HR Admin, People Manager, Employee); Qwen 3.7 Plus as the reasoning model; keep the reference palette exactly.

---

## 1. Scope

**In scope (this build):** all 9 PRD modules, real auth, real database, real AI calls, real RBAC enforced in the database.

**Deliberately out of scope** (called out so nothing is mistaken for finished):
- Payroll processing, legal/compliance automation, SOC2 controls (PRD §2 non-goals, §16 Phases 3–4).
- Live third-party integrations (Greenhouse, BambooHR, LMS, Slack, SMTP). No backend can reach them here. The Admin Console stores **integration configuration records** with a shape-validation "Test connection" — no external sync is performed, and the UI says so.
- Video/audio interview capture (PRD §5.2 marks it v2). Interview responses are text.
- Embedded vector database. RAG is implemented with Postgres full-text ranking (§5).
- UI localization. Existing i18n plumbing is left untouched but no language switcher is surfaced in the new shell — every new screen is English-only.

---

## 2. Design system (fidelity to the screenshots)

All tokens go in `src/index.css` + `tailwind.config.ts`. No hardcoded colors in components.

| Token | Light value | Source |
|---|---|---|
| `--background` | `230 33% 97%` (`#F4F5FA`) | canvas |
| `--card` / `--popover` | `0 0% 100%` | card surface |
| `--foreground` | `222 47% 11%` (`#0F172A`) | headings/body |
| `--muted-foreground` | `215 16% 47%` (`#64748B`) | subtext |
| `--border` / `--input` | `214 32% 95%` (`#F1F5F9`) | hairlines |
| `--primary` | `262 83% 58%` (`#7C3AED`) | active tabs, primary actions |
| `--primary-soft` | `262 83% 96%` (`#F3E8FF`) | role pills |
| `--accent` | `330 81% 60%` (`#EC4899`) | logo, trend series |
| `--success` / `--warning` / `--info` / `--danger` | `160 84% 39%` / `38 92% 50%` / `217 91% 60%` / `0 72% 51%` | status + charts |
| `--success-soft` … `--danger-soft` | 10% tint backgrounds | status pills |
| `--chart-1..5` | purple, blue, pink, amber, green | Recharts series |
| `--radius` | `0.75rem` (12px) | card radius |

Sidebar keeps its own dark scale in both themes (it is dark in the reference regardless): `--sidebar-background: 222 29% 10%` (`#131722`), `--sidebar-accent: 221 26% 19%` (`#252B3B`) for the active item, `--sidebar-foreground: 216 14% 61%` (`#8E98A8`) for inactive text.

Dark mode: the reference's sun/moon control is kept, so a full `.dark` token set is authored (canvas `222 47% 6%`, cards `222 40% 10%`). Every component uses semantic tokens only, and dark mode is verified on three representative screens.

Typography: Inter, loaded in `index.html`; extra-bold KPI numerals (24–28px), 11–12px uppercase tracked table headers, 13–14px semibold row text, 11–12px muted subtext.

Reusable primitives built once and used everywhere (in `src/components/common/`): `StatusPill` (soft-tint + solid-text variants), `FilterTabs`, `KpiTile`, `ChartCard`, `SectionHeader`, `DataTableShell`, `UserCell` (initial-avatar chip), `EmptyState`, `LoadingState`, `ErrorState`, `PageHeader` (title + "Live Overview" label + outlined action buttons).

Existing shadcn primitives are reused rather than rebuilt: `Collapsible`, `ScrollArea`, `Avatar`, `DropdownMenu`, `Command`, `Dialog`, `Sheet`, `Table`, `Tabs`, `Progress`, `Badge`, `Button`, `Input`, `Textarea`, `Select`, `Checkbox`, `Switch`, `Tooltip`, `Card`, `Chart`, `sonner`, `use-toast`.

---

## 3. Architecture mapping (PRD → this platform)

| PRD component | Implementation here |
|---|---|
| Next.js frontend | Vite + React 19 + React Router 7 + TanStack Query (already installed) |
| NestJS API + API gateway | Enter Cloud REST (PostgREST) + RLS as the authorization gate |
| FastAPI AI service | Enter Cloud backend functions (`supabase/functions/*`) |
| PostgreSQL system of record | Enter Cloud Postgres |
| pgvector + Qdrant | `tsvector` column + GIN index + a `security definer` ranked-search SQL function |
| Redis + BullMQ job queue | DB-backed job rows (`talent_ai_jobs`) with status polling + optimistic UI |
| WebSocket / Socket.IO | Postgres realtime (`supabase_realtime` publication) on the recommendations table |
| S3/R2 storage | Enter Cloud Storage bucket for resumes, policy documents, certificates |
| Keycloak/Auth0 + SSO | Enter Cloud auth: email + password, signup trigger, role column |
| Enter Pro workflow engine | `talent_workflows` / `talent_workflow_tasks` / `talent_outcomes`, written on approval |
| Qwen reasoning engine | Qwen 3.7 Plus via Enter AI, called only from backend functions |

Client-side privilege checks are treated as **UX only**. Authorization lives in RLS policies and `security definer` functions; the client never decides access.

---

## 4. Data model

Prefix `talent_`. Before creating anything, list existing tables; on a name collision append a stable project short ID (e.g. `talent_profiles_4e617b0a`). Existing tables are never modified. `public.profiles` is not touched — this business gets its own tables.

**Identity & access:** `talent_orgs`, `talent_profiles` (user → org, `role` in `org_admin|hr_admin|manager|employee`, `full_name`, `avatar_url`, `title`, `status`), `talent_departments`, `talent_audit_log`.

**People:** `talent_employees` (org, optional `user_id`, department, `manager_id`, `role_title`, `hire_date`, `status`), `talent_skills`, `talent_employee_skills`, `talent_role_skill_requirements`.

**Recruitment:** `talent_job_postings`, `talent_candidates`, `talent_applications` (stage, `ai_match_score`, `ai_match_breakdown`, `bias_flags`, `status`), `talent_interviews`, `talent_interview_questions`, `talent_interview_responses`.

**Performance / risk:** `talent_performance_reviews`, `talent_engagement_signals`, `talent_risk_assessments` (`risk_level`, `signals`, `explanation`, `confidence`).

**AI & workflow:** `talent_ai_recommendations` (`module`, `entity_type`, `entity_id`, payload, `status`, `reviewed_by`, `reviewed_at`, `rejection_reason`), `talent_workflows`, `talent_workflow_tasks`, `talent_outcomes`.

**Knowledge base:** `talent_policy_documents`, `talent_policy_chunks` (with generated `tsvector` + GIN index), `talent_copilot_queries`.

**Onboarding / learning:** `talent_onboarding_templates`, `talent_onboarding_progress`, `talent_learning_recommendations`.

**Governance:** `talent_ai_usage`, `talent_ai_jobs`, `talent_integrations`.

**RBAC helper functions** (all `security definer`, `search_path` pinned): `talent_current_org()`, `talent_current_role()`, `talent_is_hr()` (org_admin or hr_admin), `talent_is_manager_of(employee_id)`, `talent_my_employee_id()`, `talent_search_policy_chunks(query, k)` (ranked retrieval).

**RLS** is enabled in the same migration that creates each table, with policies per the visibility matrix:

| Table group | HR | Manager | Employee |
|---|---|---|---|
| org/departments/skills/policy docs | org-wide | read | read |
| employees, performance, engagement | org-wide | direct reports only | self only |
| `talent_risk_assessments` | org-wide | direct reports only | **no access** |
| interviews, candidates, applications | org-wide | none | none |
| recommendations, workflows, tasks | org-wide | own team's | own tasks only |
| audit log / AI usage | read | none | none |

**Signup trigger** on `auth.users` creates the `talent_profiles` row (plus `talent_employees` row) from `raw_user_meta_data`, so app profiles are never read out of `auth`.

**Seed data.** One curated demo organization, `Talent360 Demo Corp`, inserted with fixed UUIDs: 6 departments, ~22 employees, 4 demo logins (one per role), 30 skills + employee skills + role requirements, 4 job postings, 12 candidates / 14 applications spread across pipeline stages with match scores and one bias-flagged candidate, 6 interviews with questions and scored responses, 3 performance periods, 6 months of engagement signals, risk assessments, ~10 AI recommendations across modules (pending / approved / rejected), workflows + tasks + outcomes, 3 policy documents + ~40 chunks, 3 onboarding templates + progress, learning recommendations, audit entries, and 14 days of AI usage. A `talent-seed-demo` backend function generates an equivalent compact dataset for organizations created by signup.

---

## 5. Auth & RBAC

- Email + password only. **Login and signup both ship** (never one without the other). `supabase_configure_auth` enables email signup and auto-confirm so no mail round-trip is needed for testing.
- Signup sends `emailRedirectTo: ${window.location.origin}/` and passes `full_name`, `role`, `org_name` in `options.data`; the trigger creates org + profile + employee row.
- Signup offers **"Join the demo workspace" (default)** or **"Create a new organization"**; a new org shows empty states plus a "Seed demo workspace" action.
- Login shows four one-click demo role chips (fill only, no auto-submit) so a reviewer can see each scoped view immediately.
- Session: one `useSession` hook using `supabase.auth.onAuthStateChange`, storing **both user and session**, listener registered **before** the initial session fetch, callback non-async, and any client call inside it deferred with `setTimeout(…, 0)`.
- `RequireAuth` + `RequireRole` route guards for UX; RLS is the real gate.

---

## 6. AI layer

Model: **Qwen 3.7 Plus** (`alibaba/qwen-3.7-plus`). Before writing any AI code: enable AI capability, re-load the `enter_llm_integration` skill, then read the protocol reference matching that model's `Protocol` value and follow it exactly (endpoint, request shape, SSE event names). The currently-rendered skill still shows unresolved placeholders, which confirms AI capability is not yet on.

Every AI call is server-side, in one backend function per responsibility, each writing a `talent_ai_usage` row:

| Function | Job |
|---|---|
| `talent-ai-resume-match` | resume + JD → structured match score, weighted breakdown, "why" rationale, bias flags |
| `talent-ai-interview` | generate structured questions from JD + resume, and evaluate responses per rubric |
| `talent-ai-risk` | batch-assess performance / engagement / skill-alignment trends → risk level + signals + explanation |
| `talent-ai-development` | skill gap → learning and mobility recommendations |
| `talent-ai-copilot` | RAG answer over policy chunks, streamed, with citations and escalation flag |
| `talent-ai-recommendations` | turn module outputs into `talent_ai_recommendations` rows routed to the Action Center |
| `talent-seed-demo` | generate a demo dataset for a newly created organization |

**Structured contract** (PRD §8.2) is enforced by prompt + a tolerant JSON extractor (`src/lib/ai-parse.ts`) with one repair retry: `{ recommendation, confidence, reasoning_signals[], explanation, recommended_actions[], requires_human_review }`. Every AI-derived row surfaces `reasoning_signals` + `explanation` — the UI never shows a bare number.

**Human-in-the-loop is a database guarantee, not a UI convention:** AI writes only `status = 'pending'` recommendations (plus derived analysis rows). Workflows and tasks are created only by the approve/modify transition, and a trigger blocks a workflow from existing without an approved parent recommendation. Reject writes a reason and creates nothing.

**PII handling:** prompts carry entity UUIDs and job/skill text, not names or emails, where the task allows; names are re-joined after the call. Bias flags are surfaced for HR review and never auto-filter.

---

## 7. Routes & screens

Shell: `/login`, `/signup` (no shell), everything else inside `AppShell` with the dark sidebar, topbar, and ⌘K command palette.

| Route | Module | Depth |
|---|---|---|
| `/app/command-center` | Workforce Command Center | **Deep** — 6 KPI tiles + 8 chart cards mirroring the reference grid (role donut, headcount bars, active-status gauge, source pie, applications sparkline, verification dial, attrition-risk area, department progress list) over live queries |
| `/app/action-center` | AI Action Center | **Deep** — card queue (insight → signals → explanation → approve / modify / reject), realtime updates, workflow + task creation on approve |
| `/app/recruitment` | Recruitment Intelligence | **Deep** — pipeline kanban, filter-tab table matching the reference, resume intake (paste or PDF/DOCX upload with client-side text extraction), AI match run |
| `/app/recruitment/:applicationId` | Candidate | Deep — match breakdown, "Why this score?", bias flags, decisions |
| `/app/interviews`, `/app/interviews/:id` | Interview Agent | Question generation, response entry, rubric scoring, human-review flag |
| `/app/employees`, `/app/employees/:id` | Employee 360 | **Deep** — unified profile: performance trend, skills vs target role, gap radar, development plan, onboarding status |
| `/app/risk` | Workforce Risk AI | Risk level + signal breakdown, manager-scoped vs org-scoped |
| `/app/skills` | Skill Intelligence | Gap heatmap by role/department |
| `/app/onboarding` | Adaptive Onboarding | Employee checklist + org templates |
| `/app/my-profile` | Employee self view | Self-scoped Employee 360 + tasks |
| `/app/copilot` | HR Policy Copilot | Streamed chat with cited policy snippets + escalation, query log |
| `/app/decision-log` | AI Decision Log | Filterable trail + CSV export |
| `/app/admin`, `/app/admin/users` | Admin Console | Integrations (config records, honestly labeled), AI provider/usage/quota, roles, retention, branding |
| `/app/settings` | Settings | Profile + preferences |

---

## 8. Dependencies to add

`@microsoft/fetch-event-source` (SSE chat, required by the AI skill), `pdfjs-dist` (PDF resume/policy text extraction), `mammoth` (DOCX extraction). Both extractors fall back to a manual paste field when extracted text is under 50 characters. `recharts`, `date-fns`, `zod`, `react-hook-form`, `lucide-react` are already installed.

---

## 9. File structure

```
src/
  components/
    layout/     app-shell.tsx · app-sidebar.tsx · app-topbar.tsx · nav-config.ts · command-palette.tsx
    common/     kpi-tile.tsx · chart-card.tsx · status-pill.tsx · filter-tabs.tsx · data-table-shell.tsx
                section-header.tsx · page-header.tsx · user-cell.tsx · empty-state.tsx · states.tsx
    dashboard/  charts/donut.tsx · bars.tsx · gauge.tsx · pie.tsx · sparkline.tsx · radial.tsx
                area.tsx · progress-list.tsx
    auth/       auth-layout.tsx · require-auth.tsx · require-role.tsx
  hooks/        use-session.ts · use-current-profile.ts · use-permissions.ts
                use-realtime-recommendations.ts · use-ai-jobs.ts
  lib/          ai-parse.ts · format.ts · csv.ts · extraction.ts (pdf/docx → text)
                api/  command-center.ts · recruitment.ts · interviews.ts · employees.ts · risk.ts
                      actions.ts · copilot.ts · policies.ts · onboarding.ts · admin.ts · decision-log.ts
  pages/        command-center/ · action-center/ · recruitment/ · interviews/ · employees/ · risk/
                skills/ · onboarding/ · my-profile/ · copilot/ · decision-log/ · admin/ · settings/
                auth/ (login, signup) · NotFound.tsx
supabase/functions/  talent-ai-*/index.ts · talent-seed-demo/index.ts
```

`src/router.tsx` gains all routes with semantic `name` values. `CodeGuideline.md`'s structure section is updated because new modules and pages are added.

---

## Implementation checklist

**Foundations**
- [ ] Enable Enter Cloud, then inspect existing tables before creating anything
- [ ] `supabase_configure_auth`: email signup on, auto-confirm on
- [ ] Enable AI capability; re-load `enter_llm_integration` and read the Qwen 3.7 Plus protocol reference
- [ ] Add `@microsoft/fetch-event-source`, `pdfjs-dist`, `mammoth`
- [ ] Rewrite `src/index.css` tokens (light + dark + dark sidebar + chart/status scales) and extend `tailwind.config.ts`
- [ ] Load Inter in `index.html`, set radius 12px, page-title scale
- [ ] Build `src/components/common/*` primitives and verify each renders in light and dark

**Data layer**
- [ ] Migrations create every `talent_*` table with RLS enabled in the same migration
- [ ] `security definer` helpers created, `search_path` pinned
- [ ] RLS policies written per the §4 visibility matrix, including zero employee access to `talent_risk_assessments`
- [ ] Signup trigger creates `talent_orgs` + `talent_profiles` + `talent_employees` from signup metadata
- [ ] Trigger/constraint prevents a `talent_workflows` row without an approved recommendation
- [ ] `tsvector` column + GIN index on `talent_policy_chunks`; `talent_search_policy_chunks` ranked retrieval works
- [ ] Realtime publication added for `talent_ai_recommendations`
- [ ] Storage bucket created for resumes and policy documents
- [ ] Demo org seeded across all modules (fixed UUIDs, the §4 inventory)
- [ ] Re-running the demo seed does not duplicate rows

**Auth & shell**
- [ ] `useSession` stores user + session, registers listener before the initial fetch, defers client calls in the callback
- [ ] Login + signup pages ship together; demo role chips fill credentials without submitting
- [ ] Signup joins the demo workspace by default, or creates a new org
- [ ] Signup with a new org shows empty states and a working "Seed demo workspace" action
- [ ] `AppShell` renders dark sidebar with grouped collapsible nav, active-item highlight, collapse toggle, user card, and ⌘K palette
- [ ] `RequireAuth` / `RequireRole` guard routes; the app never reads another org's data

**Core modules**
- [ ] Command Center renders all 6 KPI tiles + 8 chart cards from live queries, no placeholder numbers
- [ ] Action Center lists pending recommendations; approve creates workflow + tasks and flips status; modify edits then creates; reject stores a reason and creates nothing
- [ ] Action Center receives a realtime update when a recommendation row changes
- [ ] Recruitment pipeline kanban moves an application between stages and persists it
- [ ] Resume intake extracts text from a real PDF and from DOCX, and falls back to paste on failure
- [ ] Resume match returns score + weighted breakdown + rationale + bias flags and stores them
- [ ] Employee directory table + filter tabs behave like the reference (search, tab filter, pagination)
- [ ] Employee 360 shows performance trend, skill-vs-target gap, development plan
- [ ] Employee self view shows only the signed-in employee's data

**Intelligence modules**
- [ ] Interview Agent generates questions from JD + resume and persists them
- [ ] Interview evaluation writes per-criterion scores + rationale + `requires_human_review`
- [ ] Risk AI writes per-employee level + signal breakdown + explanation, and a manager sees only direct reports
- [ ] Skill-gap heatmap aggregates across department/role
- [ ] Onboarding checklist tracks completion; templates configurable by HR

**Copilot, governance, admin**
- [ ] Policy upload extracts, chunks, and stores a document with its chunks
- [ ] Copilot streams an answer, cites the retrieved policy chunks, and flags escalation on low confidence
- [ ] Copilot queries are logged to `talent_copilot_queries`
- [ ] Decision Log lists every recommendation transition with actor + timestamp and exports CSV
- [ ] Admin Console reads and writes AI provider config, shows usage/quota, and manages roles and retention
- [ ] Integration records are clearly labeled as configuration only, with no simulated "synced" success
- [ ] Every AI function writes a `talent_ai_usage` row with provider, model, tokens, cost estimate

**Docs**
- [ ] `CodeGuideline.md` structure section updated for the new components, hooks, lib, pages, and functions

## Verification checklist

- [ ] `pnpm lint` passes with no errors
- [ ] `pnpm exec tsc --noEmit` passes with no errors
- [ ] `pnpm run build` completes successfully
- [ ] Login as `org_admin` → Command Center shows org-wide KPIs, risk, and all modules in nav
- [ ] Login as `hr_admin` → Action Center approve creates a workflow + tasks (row visible in the DB check)
- [ ] Login as `manager` → `/app/risk` and `/app/employees` list **only** direct reports; another team's employee is absent
- [ ] Login as `manager` → `/app/action-center` shows only own-team recommendations
- [ ] Login as `employee` → nav hides recruitment/interviews/risk, and `/app/employees/:otherId` returns no rows (RLS denial, not a UI hide)
- [ ] Login as `employee` → `/app/copilot` answers with at least one cited policy chunk
- [ ] Negative: a candidate/application row for another org is not readable when queried with the signed-in session
- [ ] Negative: no workflow row can exist without an approved parent recommendation (direct insert is rejected)
- [ ] Negative: an AI call failure surfaces the backend `error.message` in the UI rather than a blank card
- [ ] Boundary: a brand-new org (signup → create new) renders empty states, not zero-filled charts, and "Seed demo workspace" populates it
- [ ] Boundary: resume intake with a scanned/empty PDF falls back to the paste field instead of submitting blank text
- [ ] Boundary: Copilot with a question whose policy has no matching chunk returns an escalation message, not an invented answer
- [ ] Dark mode checked on Command Center, Action Center, and Login for contrast and invisible-text regressions
- [ ] Responsive check at `mobile_390` and `desktop_1280` on Command Center, Action Center, Recruitment, Copilot, and Login — no horizontal overflow, sidebar collapses to a drawer
- [ ] `get_console_logs` shows no runtime errors on the five screens above
