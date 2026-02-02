# CostPlans

Cost planning application — **React + JavaScript + PostgreSQL**.

## Stack

- **Frontend:** React (Vite), JavaScript
- **Backend:** Node.js (Express), JavaScript
- **Database:** PostgreSQL with Sequelize

## Prerequisites

- Node.js 18+
- PostgreSQL (create a database named `costplans`, or set `PG_DATABASE`)

**New to this project?** Follow **[SETUP.md](./SETUP.md)** for a step-by-step setup guide (Node, Postgres, `.env`, seed, run).

## Setup

1. **Clone and install**

   ```bash
   cd CostPlans-AI
   npm install
   ```

2. **Environment**

   Copy `.env.example` to `.env` and set your PostgreSQL credentials:

   ```bash
   cp .env.example .env
   ```

3. **Database**

   Start PostgreSQL, then run the server once so Sequelize creates tables:

   ```bash
   npm run dev:server
   ```

   (Stop with Ctrl+C.) Optionally seed sample data:

   ```bash
   npm run db:seed
   ```

4. **Run the app**

   From the repo root:

   ```bash
   npm run dev
   ```

   - API: [http://localhost:3001](http://localhost:3001)  
   - React app: [http://localhost:5173](http://localhost:5173) (proxies `/api` to the server)

## Scripts

| Command | Description |
|--------|-------------|
| `npm run dev` | Run server + client together |
| `npm run dev:server` | Run API only (port 3001) |
| `npm run dev:client` | Run React only (port 5173) |
| `npm run db:seed` | Insert sample projects, planning years, project metadata |
| `npm run db:migrate` | Sync schema (Sequelize `sync`) |

## API

- `GET /api/health` — health check
- `GET /api/projects` — list projects
- `GET /api/projects/:id` — project with metadata
- `POST /api/projects` — create project (body: `wbse_code`, `project_name`)
- `GET /api/planning-years` — list planning years
- `POST /api/planning-years` — create (body: `year_label`, `status`)
- `GET /api/project-metadata` — list (query: `project_id`, `planning_year_id`)
- `GET /api/project-metadata/:id` — one record
- `POST /api/project-metadata` — create (body: `project_id`, `planning_year_id`, `division`, `branch`, `section_country`, …)

## Where we started

- **Core tables:** `projects`, `planning_years`, `project_metadata` (everything else in the schema hangs off these).
- **Next steps:** Add more models from the CSV (users, roles, staffing, OPC, scenarios, etc.) and build UI for cost plan entry and reporting.
