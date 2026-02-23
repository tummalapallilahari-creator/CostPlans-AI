# Cost Plans Application — Developer's Guide

> Last updated: February 2026

---

## 1. Getting Started

### Prerequisites

- Node.js 18+
- SQL Server with ODBC Driver 17 (Windows Integrated Auth)
- The `costPlanDB` database deployed from the SSDT project

### Setup

```bash
# Clone both repositories
git clone <CostPlansDatabase-repo>
git clone <costPlansReactProject-repo>

# Deploy the database (from Visual Studio or sqlpackage)
# Publish the CostPlanDB.sqlproj to your SQL Server instance

# Configure the backend
cd costPlansReactProject/server
cp .env.example .env
# Edit .env:
#   DB_SERVER=localhost
#   DB_DATABASE=costPlanDB
#   SERVER_PORT=3001

npm install
npm run dev

# Start the frontend
cd ../client
npm install
npm run dev
```

The client runs on `http://localhost:5173` and proxies API calls to `http://localhost:3001`.

### Database Connection

The backend connects via Windows Integrated Authentication (no username/password):

```typescript
// server/src/config/db.ts
const connectionString =
  `Driver={ODBC Driver 17 for SQL Server};Server=${server};Database=${database};Trusted_Connection=yes;`;

const config: any = { connectionString, options: { useUTC: true } };

let pool: sql.ConnectionPool | null = null;

export async function getPool(): Promise<sql.ConnectionPool> {
  if (!pool) {
    pool = await new sql.ConnectionPool(config).connect();
  }
  return pool;
}
```

---

## 2. API Reference

### Base URL: `/api`

All routes are mounted in `server/src/index.ts`:

```typescript
app.use('/api/health', healthRouter);
app.use('/api/ref', refRouter);
app.use('/api/cost-plan-years', costPlanYearsRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/salary-parameters', salaryParametersRouter);
```

---

### 2.1 Reference Data (`/api/ref`)

Read-only lookups. Each calls a single `usp_get_*` stored procedure.

| Method | Endpoint | SP Called | Returns |
|--------|----------|-----------|---------|
| GET | `/ref/divisions` | `usp_get_divisions` | All divisions |
| GET | `/ref/branches/:divisionId` | `usp_get_branches_by_division` | Branches in a division |
| GET | `/ref/sections/:branchId` | `usp_get_sections_by_branch` | Sections in a branch |
| GET | `/ref/post-grades` | `usp_get_post_grades` | All grade codes with categories |
| GET | `/ref/post-categories` | `usp_get_post_categories` | PRO, GS, NO, UNV |
| GET | `/ref/umoja-classes` | `usp_get_umoja_classes` | UMOJA expenditure classes |
| GET | `/ref/operating-cost-categories` | `usp_get_operating_cost_categories` | Categories per UMOJA class |
| GET | `/ref/countries` | `usp_get_countries` | Country list |
| GET | `/ref/duty-stations` | `usp_get_duty_stations` | Duty stations per country |
| GET | `/ref/user-roles` | `usp_get_user_roles` | Role definitions |

---

### 2.2 Financial Years (`/api/cost-plan-years`)

| Method | Endpoint | SP Called | Purpose |
|--------|----------|-----------|---------|
| GET | `/cost-plan-years` | `usp_get_cost_plan_years` | List all years |
| POST | `/cost-plan-years` | `usp_create_cost_plan_year` | Create a new year |
| GET | `/cost-plan-years/:yearCode` | `usp_get_cost_plan_year_by_code` | Single year details |
| GET | `/:yearCode/projects` | `usp_get_year_projects` | Projects in year |
| POST | `/:yearCode/projects` | `usp_add_project_to_year` | Link project to year |
| DELETE | `/:yearCode/projects/:id` | `usp_remove_project_from_year` | Soft-delete link |
| POST | `/:yearCode/projects/create-new` | `usp_create_project_and_link_to_year` | Create + link |
| GET | `/:yearCode/available-projects` | `usp_get_year_available_projects` | Unlinked projects |
| GET | `/:yearCode/salary-parameters` | `usp_get_year_salary_parameters` | Salary grid data |
| POST | `/:yearCode/salary-parameters` | `usp_add_salary_parameter_country` | Add country |
| POST | `/:yearCode/salary-parameters/import-from/:src` | `usp_import_salary_parameters` | Copy from year |
| GET | `/:yearCode/project-parameters` | `usp_get_year_project_parameters` | Parameters grid |

#### Create Financial Year — Backend Logic

```typescript
// POST /api/cost-plan-years
router.post('/', async (req, res, next) => {
  const { year_code, year_name, status, start_date, end_date } = req.body;
  // Validation: all required
  const result = await pool.request()
    .input('year_code', sql.Int, year_code)
    .input('year_name', sql.NVarChar(100), year_name)
    .input('status', sql.NVarChar(20), status || 'FUTURE')
    .input('start_date', sql.SmallDateTime, new Date(start_date))
    .input('end_date', sql.SmallDateTime, new Date(end_date))
    .execute('dbo.usp_create_cost_plan_year');
  res.json({ success: true, cost_plan_year_id: result.recordset[0]?.cost_plan_year_id });
});
```

#### Create Financial Year — Stored Procedure

```sql
CREATE PROCEDURE dbo.usp_create_cost_plan_year
    @year_code INT, @year_name NVARCHAR(100),
    @status NVARCHAR(20) = 'FUTURE',
    @start_date SMALLDATETIME, @end_date SMALLDATETIME
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM dbo.fact_cost_plan_years WHERE year_code = @year_code)
    BEGIN
        RAISERROR('A financial year with code %d already exists.', 16, 1, @year_code);
        RETURN;
    END
    INSERT INTO dbo.fact_cost_plan_years (year_code, year_name, [status], start_date, end_date)
    VALUES (@year_code, @year_name, @status, @start_date, @end_date);
    SELECT SCOPE_IDENTITY() AS cost_plan_year_id;
END
```

---

### 2.3 Project Data (`/api/projects`)

| Method | Endpoint | SP Called | Purpose |
|--------|----------|-----------|---------|
| GET | `/projects` | `usp_get_projects_list` | Master project list |
| POST | `/projects` | `usp_create_project` | Create ref_project |
| GET | `/:id/staffing` | `usp_get_project_staffing` | Staff positions |
| PUT | `/:id/staffing` | `usp_save_staffing` | Save positions (TVP) |
| DELETE | `/:id/staffing/rows` | `usp_delete_staffing_rows` | Delete positions |
| GET | `/:id/deployment` | `usp_get_project_deployment` | Deployment grid |
| PUT | `/:id/deployment` | `usp_save_deployment` | Save deployment (TVP) |
| GET | `/:id/operating-costs` | `usp_get_project_operating_costs` | Operating costs |
| PUT | `/:id/operating-costs` | `usp_save_operating_costs` | Save operating costs (TVP) |
| GET | `/:id/activity-costs` | `usp_get_project_activity_costs` | Activity costs |
| PUT | `/:id/activity-costs` | `usp_save_activity_costs` | Save activity costs (TVP) |
| GET | `/:id/costing` | `sp_compute_costing` | Compute costing |
| PUT | `/:id/costing` | `usp_save_costing` | Save budget fields (TVP) |
| GET | `/:id/parameters` | `usp_get_project_parameters` | Project parameters |
| PUT | `/:id/parameters` | `usp_save_project_parameters` | Save parameters |
| GET | `/:id/country-salary-params` | `usp_get_project_country_salary_params` | Country salary data |
| PUT | `/:id/country-salary-params` | `usp_save_project_country_salary_params` | Save salary params |
| GET | `/:id/linked-years` | `usp_get_project_linked_years` | Same project in other years |
| POST | `/:id/import-from/:sourceId` | `sp_import_cost_plan_data` | Copy data from another year |

---

## 3. Stored Procedures — Core Logic

### 3.1 `usp_save_staffing` — Save Staff Positions

Accepts a TVP of `StaffingRowType`. Rows with `project_position_id IS NOT NULL` are UPDATEd; rows with `NULL` are INSERTed.

```sql
CREATE PROCEDURE dbo.usp_save_staffing
    @approved_project_id INT,
    @rows dbo.StaffingRowType READONLY
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    BEGIN TRANSACTION;

    -- Update existing positions
    UPDATE pp
    SET pp.position_number = r.position_number,
        pp.encumbered = r.encumbered,
        pp.post_grade_id = r.post_grade_id,
        pp.duty_station_id = r.duty_station_id,
        pp.country_id = r.country_id,
        pp.funding_start_date = r.funding_start_date,
        pp.funding_end_date = r.funding_end_date,
        pp.jan_posts = r.jan_posts, pp.feb_posts = r.feb_posts,
        pp.mar_posts = r.mar_posts, pp.apr_posts = r.apr_posts,
        pp.may_posts = r.may_posts, pp.jun_posts = r.jun_posts,
        pp.jul_posts = r.jul_posts, pp.aug_posts = r.aug_posts,
        pp.sep_posts = r.sep_posts, pp.oct_posts = r.oct_posts,
        pp.nov_posts = r.nov_posts, pp.dec_posts = r.dec_posts,
        pp.notes = r.notes,
        pp.updated_at = SYSUTCDATETIME()
    FROM dbo.fact_project_positions pp
    JOIN @rows r ON r.project_position_id = pp.project_position_id
    WHERE r.project_position_id IS NOT NULL;

    -- Insert new positions
    INSERT INTO dbo.fact_project_positions
        (approved_project_id, position_number, encumbered,
         post_grade_id, duty_station_id, country_id,
         funding_start_date, funding_end_date,
         jan_posts, feb_posts, mar_posts, apr_posts,
         may_posts, jun_posts, jul_posts, aug_posts,
         sep_posts, oct_posts, nov_posts, dec_posts, notes)
    SELECT @approved_project_id, r.position_number, r.encumbered,
           r.post_grade_id, r.duty_station_id, r.country_id,
           r.funding_start_date, r.funding_end_date,
           r.jan_posts, r.feb_posts, r.mar_posts, r.apr_posts,
           r.may_posts, r.jun_posts, r.jul_posts, r.aug_posts,
           r.sep_posts, r.oct_posts, r.nov_posts, r.dec_posts, r.notes
    FROM @rows r
    WHERE r.project_position_id IS NULL;

    COMMIT TRANSACTION;
    SELECT @@ROWCOUNT AS rows_affected;
END
```

#### Backend TVP Construction

```typescript
// PUT /api/projects/:id/staffing
const clamp01 = (v: any) => Math.max(0, Math.min(1, parseFloat(v) || 0));

const tvp = new sql.Table('dbo.StaffingRowType');
tvp.columns.add('project_position_id', sql.Int, { nullable: true });
tvp.columns.add('position_number', sql.NVarChar(50), { nullable: true });
tvp.columns.add('encumbered', sql.NVarChar(200), { nullable: true });
tvp.columns.add('post_grade_id', sql.Int);
tvp.columns.add('duty_station_id', sql.Int, { nullable: true });
tvp.columns.add('country_id', sql.Int, { nullable: true });
tvp.columns.add('funding_start_date', sql.SmallDateTime, { nullable: true });
tvp.columns.add('funding_end_date', sql.SmallDateTime, { nullable: true });
// ... 12 month columns as sql.Decimal(6,2)
tvp.columns.add('notes', sql.NVarChar(500), { nullable: true });

for (const r of rows) {
  const posId = (r.project_position_id && !String(r.project_position_id).startsWith('new-'))
    ? r.project_position_id : null;   // null = new row → INSERT
  tvp.rows.add(posId, r.position_number, r.encumbered, r.post_grade_id, ...);
}

await pool.request()
  .input('approved_project_id', sql.Int, projectId)
  .input('rows', tvp)
  .execute('dbo.usp_save_staffing');
```

---

### 3.2 `sp_compute_costing` — Auto-Compute Salary Costs

This is the most complex SP. It reads staffing positions + salary parameters and computes quarterly costing amounts per grade per country.

**Inputs:** `@approved_project_id INT`

**Returns two result sets:**
1. Per (grade, country) rows with computed amounts + editable budget fields
2. Category-level summary with CSC, ASHI, and appendix applied

**Core logic steps:**

1. Read project parameters (CSC rates, ASHI, appendix) from `fact_year_project_parameters`
2. Get the project's default country and CWSP set from the org hierarchy
3. Build a `#costing` temp table by:
   - Aggregating monthly posts from `fact_project_positions` per (grade, country)
   - Joining with `fact_country_specific_grade_salaries` for salary amounts
   - Joining with `fact_country_wise_salary_parameter_sets` for FX rate, post adjustment
   - Computing: `net_base = salary × total_months × post_adj_multiplier × fx_rate`
   - Splitting into quarters: Q1 (Jan–Mar posts), Q2 (Apr–Jun), Q3 (Jul–Sep), Q4 (Oct–Dec)
4. First result set: LEFT JOIN `#costing` with `fact_costing` to include editable fields
5. Second result set: Aggregate by category, apply CSC percentages, ASHI, appendix

---

### 3.3 `usp_save_costing` — Save Budget Fields

Uses MERGE to upsert into `fact_costing`. Only budget-related fields (released, request, total) are user-editable. Then re-runs `sp_compute_costing` to return fresh data.

```sql
CREATE PROCEDURE dbo.usp_save_costing
    @approved_project_id INT,
    @rows dbo.CostingEditRowType READONLY
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @yearId INT, @umojaId INT;
    SELECT @yearId = ap.cost_plan_year_id
    FROM dbo.fact_approved_projects ap
    WHERE ap.approved_project_id = @approved_project_id;

    SELECT TOP 1 @umojaId = umoja_class_id
    FROM dbo.ref_umoja_classes WHERE umoja_class_code = N'010';

    IF @yearId IS NULL OR @umojaId IS NULL
        THROW 50010, 'Missing cost_plan_year or umoja_class for project', 1;

    BEGIN TRANSACTION;

    MERGE dbo.fact_costing AS tgt
    USING (
        SELECT r.post_grade_id, r.post_category_id, r.country_id,
               r.released_budget_approved, r.this_request,
               r.total_released_budget, r.notes,
               cwsp.cwsp_parameter_set_id
        FROM @rows r
        LEFT JOIN dbo.fact_country_wise_salary_parameter_sets cwsp
              ON cwsp.cost_plan_year_id = @yearId
             AND cwsp.country_id = r.country_id
        WHERE ISNULL(r.released_budget_approved, 0) != 0
           OR ISNULL(r.this_request, 0) != 0
           OR ISNULL(r.total_released_budget, 0) != 0
           OR r.notes IS NOT NULL
    ) AS src
    ON tgt.approved_project_id = @approved_project_id
       AND tgt.post_grade_id = src.post_grade_id
       AND (tgt.country_id = src.country_id
            OR (tgt.country_id IS NULL AND src.country_id IS NULL))
    WHEN MATCHED THEN UPDATE SET
        released_budget_approved = src.released_budget_approved,
        this_request = src.this_request,
        total_released_budget = src.total_released_budget,
        notes = src.notes,
        updated_at = SYSUTCDATETIME()
    WHEN NOT MATCHED AND src.cwsp_parameter_set_id IS NOT NULL THEN INSERT
        (cost_plan_year_id, approved_project_id, umoja_class_id,
         post_category_id, post_grade_id, country_id,
         cwsp_parameter_set_id,
         released_budget_approved, this_request,
         total_released_budget, notes)
    VALUES
        (@yearId, @approved_project_id, @umojaId,
         src.post_category_id, src.post_grade_id, src.country_id,
         src.cwsp_parameter_set_id,
         src.released_budget_approved, src.this_request,
         src.total_released_budget, src.notes);

    COMMIT TRANSACTION;

    -- Re-compute and return fresh data
    EXEC dbo.sp_compute_costing @approved_project_id = @approved_project_id;
END
```

---

### 3.4 `usp_save_operating_costs` — Save Operating Costs

Uses MERGE on `(approved_project_id, operating_cost_category_id)`:

```sql
MERGE dbo.fact_operating_costs AS tgt
USING @rows AS src
ON tgt.approved_project_id = @approved_project_id
   AND tgt.operating_cost_category_id = src.operating_cost_category_id
WHEN MATCHED THEN UPDATE SET
    number_of_units = src.number_of_units,
    duration = src.duration,
    rate_per_unit = src.rate_per_unit,
    q1_amount = src.q1_amount, q2_amount = src.q2_amount,
    q3_amount = src.q3_amount, q4_amount = src.q4_amount,
    released_budget_approved = src.released_budget_approved,
    this_request = src.this_request,
    total_released_budget = src.total_released_budget,
    notes = src.notes,
    updated_at = SYSUTCDATETIME()
WHEN NOT MATCHED THEN INSERT (...)
VALUES (...);
```

---

### 3.5 `usp_save_activity_costs` — Save Activity Costs

Uses UPDATE + INSERT pattern (same as staffing). Rows with `activity_cost_id IS NOT NULL` → UPDATE; rows with `NULL` → INSERT.

---

### 3.6 `usp_save_salary_parameters` — Save Country Salary Grid

Updates the CWSP set header, then uses MERGE to upsert individual grade salaries:

```sql
BEGIN TRANSACTION;

UPDATE dbo.fact_country_wise_salary_parameter_sets
SET currency_code = @currency_code,
    exchange_rate_to_usd = @exchange_rate_to_usd,
    post_adjustment_multiplier = @post_adjustment_multiplier,
    inflation_rate = @inflation_rate,
    notes = @notes,
    updated_at = SYSUTCDATETIME()
WHERE cwsp_parameter_set_id = @cwsp_parameter_set_id;

MERGE dbo.fact_country_specific_grade_salaries AS tgt
USING @grades AS src
  ON tgt.cwsp_parameter_set_id = @cwsp_parameter_set_id
  AND tgt.post_grade_id = src.post_grade_id
WHEN MATCHED THEN
  UPDATE SET salary_amount = src.salary_amount, is_usd = src.is_usd,
             notes = src.notes, updated_at = SYSUTCDATETIME()
WHEN NOT MATCHED THEN
  INSERT (cwsp_parameter_set_id, post_grade_id, salary_amount, is_usd, notes)
  VALUES (@cwsp_parameter_set_id, src.post_grade_id, src.salary_amount,
          src.is_usd, src.notes);

COMMIT TRANSACTION;
```

---

### 3.7 `sp_import_cost_plan_data` — Copy Data Between Years

Copies all data from a source project to a target project (different financial year, same WBSE). For each of 6 tables, if the target has no rows, it copies from source:

- `fact_deployment`
- `fact_year_project_parameters`
- `fact_operating_costs`
- `fact_activity_costs`
- `fact_costing`
- `fact_project_positions`

Returns a summary of `table_name` and `rows_imported`.

---

## 4. Frontend Components — Key Patterns

### 4.1 AG Grid Configuration

All data grids use AG Grid Community Edition. Key patterns:

```typescript
<AgGridReact
  rowData={rows}
  columnDefs={columnDefs}
  onCellValueChanged={onCellValueChanged}
  onSelectionChanged={onSelectionChanged}
  enableCellTextSelection={true}           // Allow text selection
  undoRedoCellEditing={true}               // Ctrl+Z/Y support
  undoRedoCellEditingLimit={20}
  rowSelection={canEdit
    ? { mode: 'multiRow', checkboxes: true, headerCheckbox: true }
    : undefined}                           // Object-based API (v32+)
  headerHeight={34}
  rowHeight={26}
  getRowId={(params) => String(params.data.id)}
/>
```

**Important:** The `rowSelection` prop MUST use the object-based API (`{ mode: 'multiRow', checkboxes: true, headerCheckbox: true }`), NOT the deprecated string-based API (`rowSelection='multiple'`). The string API causes individual row checkboxes to not fire selection events in newer AG Grid versions.

### 4.2 Custom Paste Handler

Since AG Grid Community doesn't support clipboard processing, each tab implements a custom `onPaste` handler:

```typescript
const handlePaste = useCallback((e: React.ClipboardEvent) => {
  if (!editMode || !gridApiRef.current) return;
  const api = gridApiRef.current;
  const focusedCell = api.getFocusedCell();
  if (!focusedCell) return;
  e.preventDefault();

  const clipText = e.clipboardData.getData('text/plain');
  const pasteRows = clipText.split(/\r?\n/).filter(l => l.trim()).map(l => l.split('\t'));
  const startRow = focusedCell.rowIndex;

  for (let r = 0; r < pasteRows.length; r++) {
    const rowNode = api.getDisplayedRowAtIndex(startRow + r);
    if (!rowNode?.data) continue;
    for (let c = 0; c < pasteRows[r].length; c++) {
      // Parse and assign values to editable columns starting from focused cell
    }
    api.applyTransaction({ update: [rowNode.data] });
  }
  setDirty(true);
}, [editMode]);
```

### 4.3 Date Handling

Dates are stored as `SMALLDATETIME` in SQL Server. To avoid timezone shifting when pasting dates from Excel:

```typescript
function normalizeDate(val: any): string | null {
  if (!val) return null;
  const s = String(val).trim();
  // Try YYYY-MM-DD first
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  // Try DD-MM-YYYY or MM-DD-YYYY
  const parts = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
  if (parts) return `${parts[3]}-${parts[1].padStart(2,'0')}-${parts[2].padStart(2,'0')}`;
  return null;
}
```

**Critical:** Never use `new Date(dateString)` for date-only values — JavaScript interprets them as UTC midnight, which shifts to the previous day in negative-offset timezones.

### 4.4 Copy Buttons Pattern

Each tab implements "Copy Row(s)" and "Copy Column" buttons that write to the clipboard:

```typescript
const copySelectedRows = useCallback(() => {
  if (selectedRows.length === 0) return;
  const headers = COPY_FIELDS.map(f => COLUMN_LABELS[f] || f).join('\t');
  const lines = selectedRows.map(row =>
    COPY_FIELDS.map(f => (row as any)[f] ?? '').join('\t')
  );
  navigator.clipboard.writeText([headers, ...lines].join('\n'));
}, [selectedRows]);
```

### 4.5 Dynamic Summary Panel Refresh

The `SummaryPanel` automatically refreshes after saves via a `saveSignal` prop:

```typescript
// CostPlanEditorPage passes saveSignal (incremented on save)
<SummaryPanel projectId={projectId} saveSignal={saveSignal} />

// Inside SummaryPanel:
useEffect(() => {
  if (initialSave.current) { initialSave.current = false; return; }
  const timer = setTimeout(() => loadData(), 1500); // Wait for tab saves to complete
  return () => clearTimeout(timer);
}, [saveSignal]);
```

---

## 5. Table-Valued Parameters (TVPs) — Full Definitions

### StaffingRowType

```sql
CREATE TYPE dbo.StaffingRowType AS TABLE (
    project_position_id INT NULL,          -- NULL = new row (INSERT)
    position_number     NVARCHAR(50) NULL,
    encumbered          NVARCHAR(200) NULL,
    post_grade_id       INT NOT NULL,
    duty_station_id     INT NULL,
    country_id          INT NULL,
    funding_start_date  SMALLDATETIME NULL,
    funding_end_date    SMALLDATETIME NULL,
    jan_posts DECIMAL(6,2) NULL, feb_posts DECIMAL(6,2) NULL,
    mar_posts DECIMAL(6,2) NULL, apr_posts DECIMAL(6,2) NULL,
    may_posts DECIMAL(6,2) NULL, jun_posts DECIMAL(6,2) NULL,
    jul_posts DECIMAL(6,2) NULL, aug_posts DECIMAL(6,2) NULL,
    sep_posts DECIMAL(6,2) NULL, oct_posts DECIMAL(6,2) NULL,
    nov_posts DECIMAL(6,2) NULL, dec_posts DECIMAL(6,2) NULL,
    notes NVARCHAR(500) NULL
);
```

### CostingEditRowType

```sql
CREATE TYPE dbo.CostingEditRowType AS TABLE (
    post_grade_id            INT NOT NULL,
    post_category_id         INT NOT NULL,
    country_id               INT NULL,
    released_budget_approved DECIMAL(18,2) NULL,
    this_request             DECIMAL(18,2) NULL,
    total_released_budget    DECIMAL(18,2) NULL,
    notes                    NVARCHAR(500) NULL
);
```

### OperatingCostRowType

```sql
CREATE TYPE dbo.OperatingCostRowType AS TABLE (
    operating_cost_category_id INT NOT NULL,
    number_of_units   DECIMAL(18,2) NULL,
    duration          DECIMAL(18,2) NULL,
    rate_per_unit     DECIMAL(18,2) NULL,
    q1_amount         DECIMAL(18,2) NULL,
    q2_amount         DECIMAL(18,2) NULL,
    q3_amount         DECIMAL(18,2) NULL,
    q4_amount         DECIMAL(18,2) NULL,
    released_budget_approved DECIMAL(18,2) NULL,
    this_request      DECIMAL(18,2) NULL,
    total_released_budget DECIMAL(18,2) NULL,
    notes             NVARCHAR(500) NULL
);
```

### ActivityCostRowType

```sql
CREATE TYPE dbo.ActivityCostRowType AS TABLE (
    activity_cost_id               INT NULL,       -- NULL = new row (INSERT)
    cost_plan_year_id              INT NULL,
    activity_type                  NVARCHAR(50) NULL,
    umoja_class_id                 INT NULL,
    result_oe                      NVARCHAR(500) NULL,
    output_text                    NVARCHAR(1000) NULL,
    activity_text                  NVARCHAR(1000) NULL,
    responsibility                 NVARCHAR(500) NULL,
    gender_equality_main_objective NVARCHAR(10) NULL,
    source_text                    NVARCHAR(500) NULL,
    object_description             NVARCHAR(1000) NULL,
    commitment_id                  INT NULL,
    potential_future_rb            NVARCHAR(10) NULL,
    q1_amount DECIMAL(18,2) NULL, q2_amount DECIMAL(18,2) NULL,
    q3_amount DECIMAL(18,2) NULL, q4_amount DECIMAL(18,2) NULL,
    released_budget_approved DECIMAL(18,2) NULL,
    this_request DECIMAL(18,2) NULL,
    total_released_budget DECIMAL(18,2) NULL,
    notes NVARCHAR(500) NULL
);
```

### DeploymentRowType

```sql
CREATE TYPE dbo.DeploymentRowType AS TABLE (
    post_grade_id INT NOT NULL,
    country_id    INT NULL,
    jan_posts DECIMAL(6,2) NULL, feb_posts DECIMAL(6,2) NULL,
    mar_posts DECIMAL(6,2) NULL, apr_posts DECIMAL(6,2) NULL,
    may_posts DECIMAL(6,2) NULL, jun_posts DECIMAL(6,2) NULL,
    jul_posts DECIMAL(6,2) NULL, aug_posts DECIMAL(6,2) NULL,
    sep_posts DECIMAL(6,2) NULL, oct_posts DECIMAL(6,2) NULL,
    nov_posts DECIMAL(6,2) NULL, dec_posts DECIMAL(6,2) NULL,
    notes NVARCHAR(500) NULL
);
```

### GradeSalaryRowType

```sql
CREATE TYPE dbo.GradeSalaryRowType AS TABLE (
    post_grade_id  INT NOT NULL,
    salary_amount  DECIMAL(19,4) NOT NULL,
    is_usd         BIT NOT NULL,
    notes          NVARCHAR(500) NULL
);
```

### IntIdListType

```sql
CREATE TYPE dbo.IntIdListType AS TABLE (
    id INT NOT NULL
);
```

---

## 6. Table Definitions — Complete Schema

### fact_cost_plan_years

```sql
CREATE TABLE dbo.fact_cost_plan_years (
    cost_plan_year_id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    year_code         INT NOT NULL UNIQUE,
    year_name         NVARCHAR(100) NOT NULL,
    [status]          NVARCHAR(20) NOT NULL CHECK (status IN ('CLOSED','CURRENT','FUTURE')),
    start_date        SMALLDATETIME NOT NULL,
    end_date          SMALLDATETIME NOT NULL,
    created_by        INT NULL REFERENCES dbo.fact_users(user_id),
    created_at        DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at        DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
    CHECK (start_date <= end_date)
);
```

### fact_approved_projects

```sql
CREATE TABLE dbo.fact_approved_projects (
    approved_project_id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    cost_plan_year_id   INT NOT NULL REFERENCES dbo.fact_cost_plan_years,
    project_id          INT NOT NULL REFERENCES dbo.ref_projects,
    section_id          INT NOT NULL REFERENCES dbo.ref_sections,
    project_wbse        NVARCHAR(50) NOT NULL,
    project_name        NVARCHAR(500) NOT NULL,
    trust_fund          NVARCHAR(80) NULL,
    earmarking_type     NVARCHAR(80) NULL,
    implementing_grant  NVARCHAR(120) NULL,
    project_start_date  DATE NULL,
    project_end_date    DATE NULL,
    carried_over_flag   BIT NOT NULL DEFAULT 0,
    finance_officer_incharge INT NULL REFERENCES dbo.fact_users,
    is_active           BIT NOT NULL DEFAULT 1,
    created_by          INT NULL REFERENCES dbo.fact_users,
    created_at          DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at          DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
    UNIQUE (cost_plan_year_id, project_id)
);
```

### fact_project_positions

```sql
CREATE TABLE dbo.fact_project_positions (
    project_position_id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    approved_project_id INT NOT NULL REFERENCES dbo.fact_approved_projects,
    position_number     NVARCHAR(50) NOT NULL,
    encumbered          NVARCHAR(200) NULL,
    post_grade_id       INT NOT NULL REFERENCES dbo.ref_post_grades,
    duty_station_id     INT NULL REFERENCES dbo.ref_duty_stations,
    country_id          INT NULL REFERENCES dbo.ref_countries,
    funding_start_date  SMALLDATETIME NULL,
    funding_end_date    SMALLDATETIME NULL,
    jan_posts DECIMAL(6,2) NULL, feb_posts DECIMAL(6,2) NULL,
    mar_posts DECIMAL(6,2) NULL, apr_posts DECIMAL(6,2) NULL,
    may_posts DECIMAL(6,2) NULL, jun_posts DECIMAL(6,2) NULL,
    jul_posts DECIMAL(6,2) NULL, aug_posts DECIMAL(6,2) NULL,
    sep_posts DECIMAL(6,2) NULL, oct_posts DECIMAL(6,2) NULL,
    nov_posts DECIMAL(6,2) NULL, dec_posts DECIMAL(6,2) NULL,
    notes               NVARCHAR(500) NULL,
    is_active           BIT NOT NULL DEFAULT 1,
    created_at          DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at          DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME()
);
```

### fact_costing

```sql
CREATE TABLE dbo.fact_costing (
    costing_id              INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    cost_plan_year_id       INT NOT NULL REFERENCES dbo.fact_cost_plan_years,
    approved_project_id     INT NOT NULL REFERENCES dbo.fact_approved_projects,
    umoja_class_id          INT NOT NULL REFERENCES dbo.ref_umoja_classes,
    post_category_id        INT NOT NULL REFERENCES dbo.ref_post_categories,
    post_grade_id           INT NOT NULL REFERENCES dbo.ref_post_grades,
    country_id              INT NULL REFERENCES dbo.ref_countries,
    cwsp_parameter_set_id   INT NOT NULL REFERENCES dbo.fact_country_wise_salary_parameter_sets,
    net_base_amount         DECIMAL(18,2) NULL,
    common_staff_cost_amount DECIMAL(18,2) NULL,
    q1_amount DECIMAL(18,2) NULL, q2_amount DECIMAL(18,2) NULL,
    q3_amount DECIMAL(18,2) NULL, q4_amount DECIMAL(18,2) NULL,
    released_budget_approved  DECIMAL(18,2) NULL,  -- User-editable
    this_request              DECIMAL(18,2) NULL,  -- User-editable
    total_released_budget     DECIMAL(18,2) NULL,  -- User-editable
    notes NVARCHAR(500) NULL,
    is_active BIT NOT NULL DEFAULT 1,
    created_at DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
    UNIQUE (cost_plan_year_id, approved_project_id, post_grade_id, country_id)
);
```

### fact_operating_costs

```sql
CREATE TABLE dbo.fact_operating_costs (
    operating_cost_id       INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    cost_plan_year_id       INT NOT NULL REFERENCES dbo.fact_cost_plan_years,
    approved_project_id     INT NOT NULL REFERENCES dbo.fact_approved_projects,
    operating_cost_category_id INT NOT NULL REFERENCES dbo.ref_operating_cost_categories,
    number_of_units DECIMAL(18,2) NULL,
    duration        DECIMAL(18,2) NULL,
    rate_per_unit   DECIMAL(18,2) NULL,
    q1_amount DECIMAL(18,2) NULL, q2_amount DECIMAL(18,2) NULL,
    q3_amount DECIMAL(18,2) NULL, q4_amount DECIMAL(18,2) NULL,
    released_budget_approved  DECIMAL(18,2) NULL,
    this_request              DECIMAL(18,2) NULL,
    total_released_budget     DECIMAL(18,2) NULL,
    notes NVARCHAR(500) NULL,
    is_active BIT NOT NULL DEFAULT 1,
    created_at DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
    CHECK (number_of_units >= 0 OR number_of_units IS NULL),
    CHECK (duration >= 0 OR duration IS NULL),
    CHECK (rate_per_unit >= 0 OR rate_per_unit IS NULL)
);
```

### fact_activity_costs

```sql
CREATE TABLE dbo.fact_activity_costs (
    activity_cost_id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    cost_plan_year_id    INT NOT NULL REFERENCES dbo.fact_cost_plan_years,
    approved_project_id  INT NOT NULL REFERENCES dbo.fact_approved_projects,
    activity_type        NVARCHAR(50) NOT NULL,
    umoja_class_id       INT NULL REFERENCES dbo.ref_umoja_classes,
    result_oe            NVARCHAR(500) NULL,
    output_text          NVARCHAR(1000) NULL,
    activity_text        NVARCHAR(1000) NULL,
    responsibility       NVARCHAR(500) NULL,
    gender_equality_main_objective NVARCHAR(10) NULL CHECK (gender_equality_main_objective IN ('Yes','No')),
    source_text          NVARCHAR(500) NULL,
    object_description   NVARCHAR(1000) NULL,
    commitment_id        INT NULL,
    potential_future_rb  NVARCHAR(10) NULL CHECK (potential_future_rb IN ('Yes','No')),
    q1_amount DECIMAL(18,2) NULL, q2_amount DECIMAL(18,2) NULL,
    q3_amount DECIMAL(18,2) NULL, q4_amount DECIMAL(18,2) NULL,
    released_budget_approved DECIMAL(18,2) NULL,
    this_request DECIMAL(18,2) NULL,
    total_released_budget DECIMAL(18,2) NULL,
    notes NVARCHAR(500) NULL,
    is_active BIT NOT NULL DEFAULT 1,
    created_at DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME()
);
```

### fact_country_wise_salary_parameter_sets

```sql
CREATE TABLE dbo.fact_country_wise_salary_parameter_sets (
    cwsp_parameter_set_id      INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    cost_plan_year_id          INT NOT NULL REFERENCES dbo.fact_cost_plan_years,
    country_id                 INT NOT NULL REFERENCES dbo.ref_countries,
    currency_code              CHAR(3) NULL,
    exchange_rate_to_usd       DECIMAL(18,6) NULL,
    post_adjustment_multiplier DECIMAL(18,6) NULL,
    inflation_rate             DECIMAL(18,6) NULL,
    notes                      NVARCHAR(500) NULL,
    is_active BIT NOT NULL DEFAULT 1,
    created_at DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
    UNIQUE (cost_plan_year_id, country_id)
);
```

### fact_country_specific_grade_salaries

```sql
CREATE TABLE dbo.fact_country_specific_grade_salaries (
    grade_salary_id        INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    cwsp_parameter_set_id  INT NOT NULL REFERENCES dbo.fact_country_wise_salary_parameter_sets,
    post_grade_id          INT NOT NULL REFERENCES dbo.ref_post_grades,
    salary_amount          DECIMAL(19,4) NOT NULL,
    is_usd                 BIT NOT NULL DEFAULT 1,
    notes                  NVARCHAR(500) NULL,
    is_active BIT NOT NULL DEFAULT 1,
    created_at DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
    UNIQUE (cwsp_parameter_set_id, post_grade_id)
);
```

---

## 7. Common Development Tasks

### Adding a New Column to an Existing Table

1. **Database:** Add column to the `CREATE TABLE` in `dbo/Tables/table_name.sql`
2. **TVP:** If the column needs to be saved, add it to the relevant `dbo/Types/TypeName.sql`
3. **Stored Procedure:** Update the `usp_save_*` SP to include the column in UPDATE/INSERT
4. **Backend Route:** Update the TVP construction in `server/src/routes/` to add the column
5. **Frontend Type:** Add to the TypeScript interface in `client/src/types/index.ts`
6. **Frontend Component:** Add the column definition to the AG Grid `columnDefs`
7. **Publish:** Deploy the SSDT project, restart the backend

### Adding a New Tab/Page

1. Create the component in `client/src/components/tabs/` or `client/src/pages/`
2. Add the route in `client/src/App.tsx`
3. Create any needed API functions in `client/src/services/api.ts`
4. Create the backend route in `server/src/routes/`
5. Create stored procedures and tables as needed in the SSDT project

### Debugging Save Failures

1. Check the browser Network tab for the PUT/POST response
2. Look at the server console for `[ERROR]` messages
3. Common causes:
   - **NOT NULL constraint:** A required column missing from the TVP
   - **UNIQUE constraint:** Duplicate key (e.g., same position in same project)
   - **Foreign key:** Invalid ID reference (grade, country, etc.)
   - **TVP column order:** Columns must be added to the `sql.Table()` in the exact order defined in the type

### Testing Stored Procedures Directly

```sql
-- Test sp_compute_costing
EXEC dbo.sp_compute_costing @approved_project_id = 413;

-- Test usp_get_project_staffing
EXEC dbo.usp_get_project_staffing @approved_project_id = 413;

-- Check project positions
SELECT * FROM dbo.fact_project_positions WHERE approved_project_id = 413;
```

---

## 8. Known Constraints & Decisions

| Decision | Rationale |
|----------|-----------|
| AG Grid Community (not Enterprise) | No license cost; `cellSelection` (range select) is unavailable |
| Windows Integrated Auth | Deployed within OHCHR network; no password management needed |
| TVPs for bulk saves | Single database round-trip per save; transactional consistency |
| `SMALLDATETIME` for dates | Sufficient precision for funding dates; avoids timezone issues |
| `DECIMAL(18,2)` for money | No floating-point rounding; 2 decimal places for currency |
| Month posts clamped to 0/1 | Business rule: one person can only be in one location per month |
| Position total months ≤ 12 | Validated client-side; prevents a position from exceeding one year |
| `_autoSplit` flag in Operating Costs | Client-side only; auto-splits Q1–Q4 until user manually edits a quarter |
