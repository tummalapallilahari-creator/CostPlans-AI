# Cost Plans Database — Architecture & Data Flow

## 1. Table Ownership per `approved_project_id`

Every project (identified by `approved_project_id`) has data spread across these tables:

| Table | Purpose | Editable? |
|-------|---------|-----------|
| `fact_project_positions` | Individual staff positions with per-position month values | Yes (Staffing tab) |
| `fact_deployment` | Legacy aggregated months per (grade, country) | Kept for historical imports only |
| `fact_activity_costs` | Activity-based costs | Yes (Activity Costs tab) |
| `fact_operating_costs` | Operating costs by category | Yes (Operating Costs tab) |
| `fact_costing` | Staff costing per (grade, country) — editable budget fields only | **Auto-generated** by `sp_compute_costing` |
| **Summary** | Grand total across costing + activities + operating | **Dynamic / computed** |

---

## 2. Table Schemas (Current)

### `fact_project_positions`

Stores one row per individual staff member/position, including per-position monthly deployment values.

| Column | Type | Source |
|--------|------|--------|
| `project_position_id` | INT PK | Auto |
| `approved_project_id` | INT FK | Project context |
| `position_number` | NVARCHAR(50) | User input |
| `post_grade_id` | INT FK → ref_post_grades | Dropdown (cascading from category) |
| `country_id` | INT FK → ref_countries | Dropdown (defaults to project country) |
| `duty_station_id` | INT FK → ref_duty_stations | Dropdown (cascading from country) |
| `encumbered` | NVARCHAR(200) NULL | Employee name (free text) |
| `funding_start_date` | SMALLDATETIME | Date input |
| `funding_end_date` | SMALLDATETIME | Date input |
| `jan_posts`..`dec_posts` | DECIMAL(6,2) NULL | Monthly deployment (0–1 per position) |
| `notes` | NVARCHAR(500) | User input |
| `is_active` | BIT | System |

**Unique constraint**: `(approved_project_id, position_number)`

### `fact_deployment` (legacy — kept but not primary source)

Stores aggregated month values per (grade, country). Populated by the import stored procedure for historical data. **Not written to by the Staffing tab** — `sp_compute_costing` reads directly from `fact_project_positions`.

| Column | Type | Notes |
|--------|------|-------|
| `deployment_id` | INT PK | Auto |
| `approved_project_id` | INT FK | Project context |
| `post_grade_id` | INT FK | Grade (implies category) |
| `country_id` | INT FK | Country for salary lookup |
| `jan_posts`..`dec_posts` | DECIMAL(6,2) | Aggregated month values |
| `is_active` | BIT | System |

**Unique constraint**: `(approved_project_id, post_grade_id, country_id)`

### `fact_position_assignments` (kept in DB, unused by code)

This table is retained in the database schema but is not used by any application code. It may be removed in a future cleanup.

### `fact_year_project_parameters`

| Column | Type | Notes |
|--------|------|-------|
| `year_project_parameter_id` | INT PK | Auto |
| `approved_project_id` | INT FK | One per project |
| `programme_support_costs` | DECIMAL(18,6) | PSC rate (stored as decimal, e.g. 0.13 = 13%) |
| `common_staff_costs_professional` | DECIMAL(18,6) | CSC PRO rate |
| `common_staff_costs_general` | DECIMAL(18,6) | CSC GS rate |
| `common_staff_costs_national` | DECIMAL(18,6) | CSC NO rate |
| `ashi` | DECIMAL(18,6) | After-Service Health Insurance rate |
| `appendix` | DECIMAL(18,6) | Appendix factor |
| `notes` | NVARCHAR(500) | User input |
| `is_active` | BIT | System |

---

## 3. Staffing Tab — Save Flow

When the user clicks "Save Changes", the staffing tab writes to **1 table only**: `fact_project_positions`.

```
┌──────────────────────────────────────────────────────────┐
│                    STAFFING TAB (UI)                      │
│                                                          │
│  Category | Grade | Country | Duty Station | Position #  │
│  Encumbered | Start | End | Jan | Feb | ... | Dec        │
└─────────────────────────┬────────────────────────────────┘
                          │
                    PUT /staffing
                          │
                          ▼
               ┌─────────────────────┐
               │ fact_project_       │
               │ positions           │
               │                     │
               │ position_number     │
               │ post_grade_id       │
               │ country_id          │
               │ duty_station_id     │
               │ encumbered          │
               │ funding_start_date  │
               │ funding_end_date    │
               │ jan_posts..dec_posts│  ← clamped 0 ≤ x ≤ 1
               └─────────────────────┘
```

### Why country_id matters

A project based in Kenya may have an employee stationed in Switzerland.
That employee's **salary** and **post adjustment factor** come from Switzerland's
`fact_country_wise_salary_parameter_sets`, not Kenya's.

However, the **Common Staff Cost (CSC)** rate comes from the **project parameters**
(`fact_year_project_parameters`), which are project-wide.

---

## 4. Costing — Auto-Generation via `sp_compute_costing`

`fact_costing` stores only user-editable budget fields (`released_budget_approved`, `this_request`, `total_released_budget`). All cost amounts are **live-computed** by the stored procedure.

### How it works

1. **Aggregate months** from `fact_project_positions` grouped by `(post_grade_id, COALESCE(country_id, project_default_country))`.
2. **Look up salary** from `fact_country_specific_grade_salaries` via the country's `fact_country_wise_salary_parameter_sets`.
3. **Compute quarterly costs** using the formula below.
4. **Return two result sets**: per-grade rows (joined with any saved `fact_costing` budget fields) and per-category summaries (with ASHI/appendix surcharges).

### Inputs that trigger a costing recomputation

| Source Table | What Changed | Effect |
|---|---|---|
| `fact_project_positions` | Month values or country_id | Aggregated months change → cost amounts change |
| `fact_country_wise_salary_parameter_sets` | exchange_rate, post_adjustment_multiplier | Cost formula inputs change |
| `fact_country_specific_grade_salaries` | salary_amount for a grade | Net base amount changes |
| `fact_year_project_parameters` | CSC rates, ASHI, appendix | Common staff cost, ASHI surcharge, appendix surcharge change |

### Costing formula (per grade+country aggregation)

```
For each unique (post_grade_id, eff_country_id) from active positions:

  nb   = salary_amount                     (from grade_salaries via CWSP)
  padj = post_adjustment_multiplier        (from CWSP for that country)
  fx   = exchange_rate_to_usd              (from CWSP for that country)
  csc  = csc_rate for category             (from project_parameters: PRO/GS/NO)

  ms1 = SUM(jan_posts + feb_posts + mar_posts)   across all positions with same grade+country
  ms2 = SUM(apr_posts + may_posts + jun_posts)
  ms3 = SUM(jul_posts + aug_posts + sep_posts)
  ms4 = SUM(oct_posts + nov_posts + dec_posts)

  PRO:  q = (nb + nb×padj/100 + csc×nb) × ms / 12
  GS:   q = ((nb + csc×nb) × ms / 12) / fx
  NO:   q = ((nb + csc×nb) × ms / 12) / fx
  UNV:  q = (nb × ms / 12) [/ fx if National UNV]

Per-category summary adds ASHI and Appendix surcharges:
  ashi_q   = ashi_rate × subtotal_q
  appendix_q = appendix_rate × (subtotal_q + ashi_q)   [GS/NO only]
  total_q  = subtotal_q + ashi_q + appendix_q
```

---

## 5. Summary — Dynamic Aggregation

The project summary combines data from three cost sources:

```
SUMMARY = fact_costing (staff costs, via sp_compute_costing)
        + fact_operating_costs (operating costs)
        + fact_activity_costs (activity costs)
```

Any change in **any** of these three tables must dynamically update the summary.

The summary is **not stored** — it is computed on-the-fly via frontend aggregation from the API responses.

### What affects the summary

| Change in... | Cascades to... |
|---|---|
| Position month values | → Costing recomputed → Summary changes |
| Employee country_id | → Different salary params used → Costing recomputed → Summary changes |
| Salary parameters (CWSP) | → Costing recomputed → Summary changes |
| Project parameters (CSC/ASHI/appendix/PSC) | → Costing recomputed → Summary changes |
| Operating costs (manual edit) | → Summary changes directly |
| Activity costs (manual edit) | → Summary changes directly |

---

## 6. Full Relationship Map

```
ref_countries ◄──────────── ref_duty_stations
     │                           │
     │                           │
     ▼                           ▼
fact_project_positions ──── (country_id, duty_station_id)
     │                      + jan_posts..dec_posts per position
     │
     │  sp_compute_costing aggregates by (grade, country)
     │
     │  ┌── fact_country_wise_salary_parameter_sets
     │  ├── fact_country_specific_grade_salaries
     │  ├── fact_year_project_parameters
     │  │
     │  ▼
     │  fact_costing (live-computed amounts, saved budget fields)
     │  │
     │  ▼
     └──────────────────► SUMMARY ◄── fact_activity_costs
                                  ◄── fact_operating_costs
```

---

## 7. PDF Generation

The PDF export (`generateProjectPdf`) fetches all data via API and renders:

1. **Project Details** — WBSE, name, division, branch, section, country
2. **Project Parameters** — PSC, CSC (PRO/GS/NO), ASHI, Appendix rates
3. **Country Salary Parameters** — exchange rate, post adjustment, grade salaries
4. **Deployment** — aggregated months by grade (from `staffing-month-summary` endpoint)
5. **Staff Costing** — per-grade cost breakdown with Q1-Q4 and budget columns
6. **Operating Costs** — grouped by Umoja class
7. **Activity Costs** — with type, Umoja class, responsibility
8. **Staffing** — position details grouped by category
9. **Budget Summary** — full breakdown: 010 Staff + Activities/OPC + Grants + PSC = Grand Total
