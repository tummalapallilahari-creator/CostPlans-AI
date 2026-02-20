# Cost Plans — Developer Cheatsheet

Quick reference for every page, route, table, and operation.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript, Vite, AG Grid Community, React Router v6 |
| Backend | Node.js + Express + TypeScript, `mssql/msnodesqlv8` (Windows Auth) |
| Database | SQL Server (SSDT project), 26 tables, 6 views, 6 stored procedures |
| PDF | jsPDF + jspdf-autotable |
| Dev server | `tsx watch` (backend), Vite dev server (frontend), port 3001 / 5173 |

---

## Frontend Routes → Pages

| Route | Page Component | What it does |
|-------|---------------|--------------|
| `/` | HomePage | Landing page with hero, feature cards, quick links |
| `/projects` | AllProjectsPage | Master project list with filter panel (div/branch/section/country) |
| `/financial-years` | CostPlanYearsPage | Grid of financial year cards (2025, 2026...) |
| `/financial-years/:yearCode` | YearOptionsPage | Three cards: Projects, Salary Params, Project Params |
| `/financial-years/:yearCode/projects` | ApprovedProjectsPage | AG Grid of approved projects for that year + manage projects modal |
| `/financial-years/:yearCode/projects/:wbse` | CostPlanEditorPage | **Main editor** — 4 tabs: Staffing, Operating Costs, Activity Costs, Costing + Summary panel |
| `/financial-years/:yearCode/salary-parameters` | SalaryParametersPage | AG Grid pivot table of salary params by country × grade |
| `/financial-years/:yearCode/project-parameters` | ProjectParametersPage | AG Grid of PSC/CSC/ASHI/Appendix per project |

---

## Page → API Calls → Tables (The Full Chain)

### HomePage
- No API calls. Static content.

### AllProjectsPage
- `GET /api/projects` → reads `ref_projects` + org hierarchy + `fact_approved_projects`
- `POST /api/projects` → inserts into `ref_projects`
- `GET /api/ref/divisions`, `/ref/branches/:id`, `/ref/sections/:id` → filter dropdowns

### CostPlanYearsPage
- `GET /api/cost-plan-years` → reads `fact_cost_plan_years`

### YearOptionsPage
- `GET /api/cost-plan-years/:yearCode` → reads `fact_cost_plan_years`

### ApprovedProjectsPage
- `GET /api/cost-plan-years/:yearCode/projects` → reads `fact_approved_projects` + org hierarchy
- `POST /api/cost-plan-years/:yearCode/projects` → inserts into `fact_approved_projects`
- `DELETE /api/cost-plan-years/:yearCode/projects/:id` → soft-deletes `fact_approved_projects` (is_active=0)
- `POST /api/cost-plan-years/:yearCode/projects/create-new` → inserts `ref_projects` + `fact_approved_projects`
- `GET /api/cost-plan-years/:yearCode/available-projects` → projects not yet in this year

### CostPlanEditorPage (the big one)

**On load:**
- `GET /projects/:id/parameters` → `fact_year_project_parameters`
- `GET /projects/:id/country-salary-params` → `fact_country_wise_salary_parameter_sets` + `fact_country_specific_grade_salaries`
- `GET /projects/:id/linked-years` → other years for same project

**Staffing Tab:**
- `GET /projects/:id/staffing` → `fact_project_positions` + ref tables
- `PUT /projects/:id/staffing` → UPDATE/INSERT `fact_project_positions` (months clamped 0-1)
- `DELETE /projects/:id/staffing/rows` → DELETE `fact_project_positions` by IDs
- Add Row / Duplicate Row / Delete Selected → local state + save

**Operating Costs Tab:**
- `GET /projects/:id/operating-costs` → `ref_operating_cost_categories` template + `fact_operating_costs`
- `PUT /projects/:id/operating-costs` → MERGE `fact_operating_costs`

**Activity Costs Tab:**
- `GET /projects/:id/activity-costs` → `fact_activity_costs` + `ref_umoja_classes`
- `PUT /projects/:id/activity-costs` → UPDATE/INSERT `fact_activity_costs`

**Costing Tab:**
- `GET /projects/:id/costing` → executes `sp_compute_costing` → returns live-computed rows + summary
- `PUT /projects/:id/costing` → MERGE `fact_costing` (saves budget fields only: released, this_request, total_released, notes) → re-runs SP → returns fresh data

**Save button (top-level):**
- Saves project parameters → `PUT /projects/:id/parameters` → UPDATE/INSERT `fact_year_project_parameters`
- Saves CWSP → `PUT /projects/:id/country-salary-params` → UPDATE `fact_country_wise_salary_parameter_sets`
- Triggers `saveSignal` to all 4 tabs simultaneously

**Import button:**
- `POST /projects/:targetId/import-from/:sourceId` → executes `sp_import_cost_plan_data`

**PDF button:**
- Fetches all data (staffing-month-summary, operating, activity, costing, staffing)
- Generates PDF client-side with jsPDF

### SalaryParametersPage
- `GET /api/cost-plan-years/:yearCode/salary-parameters` → `fact_country_wise_salary_parameter_sets` + `fact_country_specific_grade_salaries` (pivoted)
- `PUT /api/salary-parameters/:cwspSetId` → UPDATE `fact_country_wise_salary_parameter_sets` + MERGE `fact_country_specific_grade_salaries`
- `POST /api/cost-plan-years/:yearCode/salary-parameters` → INSERT new country CWSP set
- `POST /api/cost-plan-years/:yearCode/salary-parameters/import-from/:sourceYearCode` → bulk copy from another year

### ProjectParametersPage
- `GET /api/cost-plan-years/:yearCode/project-parameters` → all projects' params for that year
- `PUT /api/projects/:id/parameters` → UPDATE/INSERT `fact_year_project_parameters`

---

## Stored Procedures

| SP | Called by | What it does |
|----|----------|-------------|
| `sp_compute_costing` | GET/PUT `/projects/:id/costing` | Aggregates months from `fact_project_positions` by (grade, country), looks up salaries from CWSP, computes quarterly costs using CSC/post-adj/FX rates. Returns 2 result sets: detail rows + category summaries with ASHI/appendix. |
| `sp_import_cost_plan_data` | POST `/projects/:id/import-from/:sourceId` | Copies deployment, positions, operating costs, activity costs, costing, project params from source to target project. Only copies if target table is empty. |
| `sp_get_operating_costs` | Not used by Node.js (legacy) | Returns operating costs via `vw_operating_costs_detail` |
| `sp_get_approved_projects` | Not used by Node.js (legacy) | Returns approved projects via `vw_approved_projects_detail` |
| `sp_get_user_permissions` | Not used by Node.js (legacy) | Returns user roles via `vw_user_roles` |
| `sp_get_costing_by_project` | Not used by Node.js (legacy) | Returns costing via `vw_costing_detail` |

---

## Costing Formula (the hardest question)

```
For each unique (grade, country) aggregated from fact_project_positions:

  nb   = net base salary (from fact_country_specific_grade_salaries)
  padj = post adjustment multiplier (from CWSP for that country)
  fx   = exchange rate to USD (from CWSP for that country)
  csc  = common staff cost rate (from fact_year_project_parameters, varies by PRO/GS/NO)

  Quarter months = SUM of 3 monthly posts across all positions with same grade+country

  PRO:  q = (nb + nb*padj/100 + csc*nb) * quarter_months / 12
  GS:   q = ((nb + csc*nb) * quarter_months / 12) / fx
  NO:   q = ((nb + csc*nb) * quarter_months / 12) / fx
  UNV:  q = nb * quarter_months / 12 [/ fx if National UNV]

Summary adds:
  ASHI     = ashi_rate * subtotal
  Appendix = appendix_rate * (subtotal + ASHI)  [GS/NO only]
```

---

## Key Data Flow Diagram

```
User enters staffing positions (Staffing Tab)
    ↓ PUT /staffing
    ↓ writes → fact_project_positions (months + metadata)
    ↓
User opens Costing Tab
    ↓ GET /costing
    ↓ executes sp_compute_costing
    ↓ reads → fact_project_positions (aggregates months)
    ↓ reads → fact_country_wise_salary_parameter_sets (FX, post adj)
    ↓ reads → fact_country_specific_grade_salaries (base salary)
    ↓ reads → fact_year_project_parameters (CSC rates)
    ↓ LEFT JOINs → fact_costing (saved budget fields)
    ↓ returns → live-computed amounts + saved budget fields
    ↓
Summary Panel aggregates costing + operating + activity costs
```

---

## Table Quick Reference

| Table | Written by | Read by |
|-------|-----------|---------|
| `ref_countries` | Seed only | Everywhere (dropdowns) |
| `ref_duty_stations` | Seed only | Staffing Tab dropdown |
| `ref_post_grades` / `ref_post_categories` | Seed only | Staffing, Costing |
| `ref_umoja_classes` | Seed only | Activity Costs, Costing |
| `ref_operating_cost_categories` | Seed only | Operating Costs |
| `ref_projects` | AllProjectsPage, ApprovedProjectsPage | Project lists |
| `fact_cost_plan_years` | Seed only | Year pages |
| `fact_approved_projects` | ApprovedProjectsPage | Everywhere per-project |
| `fact_project_positions` | Staffing Tab | Staffing Tab, sp_compute_costing |
| `fact_deployment` | sp_import (legacy) | Deployment Tab (legacy) |
| `fact_operating_costs` | Operating Costs Tab | Operating Costs Tab, Summary |
| `fact_activity_costs` | Activity Costs Tab | Activity Costs Tab, Summary |
| `fact_costing` | Costing Tab (budget fields only) | Costing Tab (LEFT JOIN with SP) |
| `fact_year_project_parameters` | CostPlanEditor, ProjectParametersPage | sp_compute_costing, CostPlanEditor |
| `fact_country_wise_salary_parameter_sets` | SalaryParametersPage, CostPlanEditor | sp_compute_costing, CostPlanEditor |
| `fact_country_specific_grade_salaries` | SalaryParametersPage | sp_compute_costing |
| `fact_position_assignments` | Nothing (future use) | Nothing |

---

## Role System

- Roles loaded from `ref_user_roles` via `GET /api/ref/user-roles`
- `RoleContext` provides `activeRole` and `canEdit` (true unless `REGULAR_USER`)
- Edit buttons, Save, Add Row etc. hidden when `!canEdit`

---

## Percentage Fields (gotcha)

- PSC, CSC PRO/GS/NO, ASHI, Appendix are stored as **decimals** (e.g. `0.27619` = 27.619%)
- Frontend divides by 100 on input, multiplies by 100 on display
- DB type: `DECIMAL(18,6)` for all percentage columns

---

## Backend File Map

| File | What it does |
|------|-------------|
| `server/src/index.ts` | Express setup, mounts routers, port 3001 |
| `server/src/config/db.ts` | SQL Server connection pool (Windows Auth, ODBC) |
| `server/src/routes/ref.ts` | 10 GET endpoints for reference/dropdown data |
| `server/src/routes/costPlanYears.ts` | Year CRUD, approved projects management, salary import |
| `server/src/routes/projects.ts` | Per-project data: staffing, costing, operating, activity, params |
| `server/src/routes/salaryParameters.ts` | PUT to save salary parameter set + grade salaries |
| `server/src/routes/health.ts` | Health check endpoint |
| `server/src/middleware/errorHandler.ts` | Global error handler (500 + console.error) |

---

## Frontend File Map

| File | What it does |
|------|-------------|
| `client/src/App.tsx` | Router config, RoleProvider wrapper |
| `client/src/services/api.ts` | All API calls (axios, baseURL `/api`) |
| `client/src/types/index.ts` | All TypeScript interfaces |
| `client/src/context/RoleContext.tsx` | Role state management |
| `client/src/utils/generatePdf.ts` | PDF generation with jsPDF |
| `client/src/components/Layout.tsx` | App shell: header, nav, outlet |
| `client/src/components/SummaryPanel.tsx` | Budget summary aggregation |
| `client/src/components/ColumnToggle.tsx` | Show/hide AG Grid columns |
