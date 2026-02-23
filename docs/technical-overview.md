# Cost Plans Application — Technical Overview

> Last updated: February 2026

## 1. System Architecture

```
┌─────────────────────┐     HTTP/JSON      ┌───────────────────┐     ODBC 17       ┌──────────────────┐
│   React Frontend    │ ◄──────────────►   │  Node.js / Express │ ◄──────────────►  │  SQL Server      │
│   (Vite + AG Grid)  │     localhost:5173  │  API Server        │     localhost     │  costPlanDB      │
│                     │                    │  localhost:3001     │                   │                  │
└─────────────────────┘                    └───────────────────┘                   └──────────────────┘
        │                                          │                                       │
   TypeScript/React                        TypeScript/Express                     T-SQL Stored Procs
   AG Grid Community                       mssql/msnodesqlv8                      TVPs, MERGE, Views
   Axios HTTP Client                       Windows Auth (ODBC)                    26 Tables, 6 Views
```

### Stack Summary

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React 18, TypeScript, Vite, AG Grid Community, Axios, jsPDF | SPA with editable data grids, PDF export |
| Backend | Node.js, Express.js, TypeScript, `mssql/msnodesqlv8` | REST API, TVP serialization, stored procedure execution |
| Database | SQL Server (MSSQL), SSDT project | Tables, stored procedures, views, user-defined table types |
| Auth | Windows Integrated (ODBC Trusted_Connection) | No password in config; uses domain credentials |

---

## 2. Repository Structure

### CostPlansDatabase (SQL Server Database Project)

```
CostPlanDB/
├── dbo/
│   ├── Tables/                  # 26 table definitions (CREATE TABLE)
│   ├── Stored Procedures/       # ~38 stored procedures
│   ├── Views/                   # 6 views
│   └── Types/                   # 7 Table-Valued Parameter types (TVPs)
├── Scripts/
│   ├── Seed.CostPlanYear.sql    # Initial year data
│   └── Seed.DemoData.sql        # Demo/test data
├── docs/                        # This documentation
└── CostPlanDB.sqlproj           # SSDT project file
```

### costPlansReactProject (Full-Stack Web Application)

```
client/
├── src/
│   ├── App.tsx                  # Router definitions
│   ├── main.tsx                 # Entry point
│   ├── services/api.ts          # Axios API client (all backend calls)
│   ├── types/index.ts           # TypeScript interfaces
│   ├── context/RoleContext.tsx   # Role-based access context
│   ├── pages/                   # Route-level page components
│   │   ├── HomePage.tsx
│   │   ├── CostPlanYearsPage.tsx
│   │   ├── YearOptionsPage.tsx
│   │   ├── ApprovedProjectsPage.tsx
│   │   ├── AllProjectsPage.tsx
│   │   ├── CostPlanEditorPage.tsx    # Main editor (tabs container)
│   │   ├── SalaryParametersPage.tsx
│   │   └── ProjectParametersPage.tsx
│   ├── components/
│   │   ├── Layout.tsx           # Sidebar + main content wrapper
│   │   ├── ColumnToggle.tsx     # Column visibility control
│   │   ├── SummaryPanel.tsx     # Budget summary roll-up
│   │   └── tabs/
│   │       ├── StaffingTab.tsx      # Staff positions entry
│   │       ├── CostingTab.tsx       # Auto-computed salary costing
│   │       ├── OperatingCostsTab.tsx # Operating costs by UMOJA class
│   │       └── ActivityCostsTab.tsx  # Activity-based costs
│   └── utils/generatePdf.ts    # PDF export logic
server/
├── src/
│   ├── index.ts                 # Express entry point
│   ├── config/db.ts             # MSSQL connection pool
│   ├── middleware/errorHandler.ts
│   └── routes/
│       ├── health.ts            # Health check
│       ├── ref.ts               # Reference data lookups
│       ├── costPlanYears.ts     # Financial year CRUD
│       ├── projects.ts          # Project data (staffing, costing, etc.)
│       └── salaryParameters.ts  # Salary parameter saves
└── .env                         # DB_SERVER, DB_DATABASE
```

---

## 3. Data Model

### Dimension / Reference Tables (read-only lookups)

| Table | Purpose |
|-------|---------|
| `ref_divisions` | Organizational divisions (e.g., FOTCD, OTD) |
| `ref_branches` | Branches within divisions |
| `ref_sections` | Sections within branches (linked to country) |
| `ref_countries` | Country master list |
| `ref_duty_stations` | Duty stations per country |
| `ref_post_categories` | Staff categories: PRO, GS, NO, UNV |
| `ref_post_grades` | Grades per category: P-5, G-6, NO-B, etc. |
| `ref_umoja_classes` | UMOJA expenditure classes: 010, 020, 030, etc. |
| `ref_operating_cost_categories` | Categories within each UMOJA class |
| `ref_activity_categories` | Activity types per UMOJA class |
| `ref_user_roles` | Role definitions (SUPER_USER, FINANCE_OFFICER, etc.) |
| `ref_projects` | Master project registry |

### Fact Tables (per-project editable data)

| Table | Purpose | Tab |
|-------|---------|-----|
| `fact_cost_plan_years` | Financial year definitions (2025, 2026, ...) | Financial Years page |
| `fact_approved_projects` | Projects linked to a financial year | Approved Projects page |
| `fact_project_positions` | Individual staff positions with monthly deployments (0/1) | Staffing |
| `fact_deployment` | Aggregated deployment per (grade, country) — legacy | Deployment |
| `fact_operating_costs` | Operating costs per category per project | Operating Costs |
| `fact_activity_costs` | Activity costs per project | Activity Costs |
| `fact_costing` | Staff costing per (grade, country) — auto-generated, with editable budget fields | Costing |
| `fact_country_wise_salary_parameter_sets` | Salary parameters per country per year | Salary Parameters |
| `fact_country_specific_grade_salaries` | Salary amounts per grade per country | Salary Parameters |
| `fact_year_project_parameters` | Project-level parameters (PSC, CSC, ASHI, Appendix) | Project Parameters |
| `fact_users` | User accounts | Admin |
| `fact_position_assignments` | Position assignment history | Future use |

### Mapping Tables

| Table | Purpose |
|-------|---------|
| `map_user_role_assignments` | User ↔ Role assignments |
| `map_section_country` | Section ↔ Country mapping |

### Views

| View | Purpose |
|------|---------|
| `vw_org_hierarchy` | Flattened Section → Branch → Division → Country |
| `vw_post_grades_with_categories` | Grades joined with their category |
| `vw_approved_projects_detail` | Approved projects with full org hierarchy |
| `vw_costing_detail` | Costing rows with grade/category/UMOJA names |
| `vw_operating_costs_detail` | Operating costs with category/UMOJA names |
| `vw_user_roles` | Users with their assigned roles |

---

## 4. Frontend Route Map

| Route | Page Component | Purpose |
|-------|---------------|---------|
| `/` | `HomePage` | Landing page |
| `/projects` | `AllProjectsPage` | Master project list across all years |
| `/financial-years` | `CostPlanYearsPage` | Financial year cards + create new year |
| `/financial-years/:yearCode` | `YearOptionsPage` | Year-level navigation |
| `/financial-years/:yearCode/projects` | `ApprovedProjectsPage` | Projects in a specific year |
| `/financial-years/:yearCode/projects/:wbse` | `CostPlanEditorPage` | **Main editor** with tabs |
| `/financial-years/:yearCode/salary-parameters` | `SalaryParametersPage` | Pivoted salary grid by country |
| `/financial-years/:yearCode/project-parameters` | `ProjectParametersPage` | PSC/CSC/ASHI/Appendix per project |

### CostPlanEditorPage Tabs

| Tab | Component | Data Source |
|-----|-----------|-------------|
| Staffing | `StaffingTab` | `fact_project_positions` |
| Costing | `CostingTab` | `sp_compute_costing` (auto-generated) |
| Operating Costs | `OperatingCostsTab` | `fact_operating_costs` + `ref_operating_cost_categories` |
| Activity Costs | `ActivityCostsTab` | `fact_activity_costs` |
| Summary | `SummaryPanel` | Aggregated from all tabs |

---

## 5. Key Data Flows

### Staffing → Costing Pipeline

```
User enters positions in StaffingTab
    ↓
Save → PUT /api/projects/:id/staffing → usp_save_staffing
    ↓
Frontend calls GET /api/projects/:id/costing
    ↓
Backend runs sp_compute_costing which:
  1. Reads fact_project_positions (monthly deployments)
  2. Joins with salary parameters (cwsp + grade salaries)
  3. Calculates: net_base = salary × posts × post_adj × fx_rate
  4. Applies CSC (common staff costs) by category
  5. Returns per-grade rows + category summary with ASHI & appendix
    ↓
CostingTab displays computed values + editable Released Budget fields
```

### Summary Panel Aggregation

```
SummaryPanel fetches from ALL sources:
  - Costing (sp_compute_costing summary)
  - Staffing (position counts)
  - Operating Costs (category totals)
  - Activity Costs (class totals)
    ↓
Builds category rows (PRO, GS, NO, UNV, OTHER, MORSS)
Computes: Total Released = Released Budget Issued + This Request
Auto-refreshes 1.5s after any tab save (via saveSignal prop)
```

### Q1–Q4 Auto-Split (Operating Costs)

```
When a new row is created: _autoSplit = true
When number_of_units/duration/rate_per_unit changes AND _autoSplit is true:
  total = units × duration × rate × (1 + inflationRate)
  each quarter = Math.round(total / 4)
  q1 gets any rounding remainder
When user manually edits any Q-amount: _autoSplit = false (persists)
```

---

## 6. User-Defined Table Types (TVPs)

TVPs are used to pass arrays of rows from the API to stored procedures in a single database call.

| Type | Used By | Key Fields |
|------|---------|------------|
| `StaffingRowType` | `usp_save_staffing` | project_position_id, position_number, post_grade_id, 12 month columns |
| `CostingEditRowType` | `usp_save_costing` | post_grade_id, post_category_id, country_id, released/request/total budget |
| `OperatingCostRowType` | `usp_save_operating_costs` | operating_cost_category_id, units, duration, rate, q1–q4, budget |
| `ActivityCostRowType` | `usp_save_activity_costs` | activity_cost_id, activity_type, umoja_class_id, q1–q4, budget, text fields |
| `DeploymentRowType` | `usp_save_deployment` | post_grade_id, country_id, 12 month columns |
| `GradeSalaryRowType` | `usp_save_salary_parameters` | post_grade_id, salary_amount, is_usd |
| `IntIdListType` | `usp_delete_staffing_rows` | id |

---

## 7. Roles & Permissions

| Role | Access |
|------|--------|
| `SUPER_USER` | Full access: edit all tabs, manage financial years, manage projects, salary parameters |
| `FINANCE_OFFICER` | Edit: Staffing, Operating Costs, Activity Costs, Released Budget in Costing |
| `VIEWER` | Read-only access to all pages |

Role context is managed via `RoleContext.tsx` on the frontend, with `activeRole` determining which edit buttons and features are visible.
