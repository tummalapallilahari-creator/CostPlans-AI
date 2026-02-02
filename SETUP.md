# CostPlans — Step-by-step setup guide

Follow these steps in order. Do them from the **project root** (`CostPlans-AI/`) unless a step says otherwise.

---

## Step 1: Check Node.js

You need **Node.js 18 or newer**.

**Check:**

```bash
node -v
```

You should see something like `v18.x.x` or `v20.x.x`. If you don’t have Node, install it from [nodejs.org](https://nodejs.org/) (LTS).

---

## Step 2: Install PostgreSQL (if needed)

You need **PostgreSQL** installed and running.

**Check if it’s installed:**

```bash
psql --version
```

- **macOS (Homebrew):**  
  `brew install postgresql@16` then `brew services start postgresql@16`
- **Windows:**  
  Download from [postgresql.org/download/windows](https://www.postgresql.org/download/windows/) and run the installer; ensure “Launch at system startup” is enabled.
- **Linux (Ubuntu/Debian):**  
  `sudo apt install postgresql postgresql-contrib` then `sudo systemctl start postgresql`

**Check that it’s running:**

```bash
# macOS / Linux
pg_isready -h localhost

# Or try opening a session (default user is often "postgres" or your OS username)
psql -h localhost -U postgres -d postgres -c "SELECT 1"
```

If that fails, start the PostgreSQL service for your OS (e.g. `brew services start postgresql@16` on macOS).

---

## Step 3: Create the database and user (optional but recommended)

Create a database named `costplans` and, if you like, a dedicated user.

**Option A — Using default `postgres` user:**

```bash
psql -h localhost -U postgres -d postgres
```

In the `psql` prompt:

```sql
CREATE DATABASE costplans;
\q
```

**Option B — Create a user and database:**

```bash
psql -h localhost -U postgres -d postgres
```

In the `psql` prompt:

```sql
CREATE USER costplans_user WITH PASSWORD 'your_secure_password';
CREATE DATABASE costplans OWNER costplans_user;
\q
```

Use `costplans_user` and `your_secure_password` in your `.env` in the next step.

---

## Step 4: Open the project and install dependencies

From the **project root** (`CostPlans-AI/`):

```bash
cd /path/to/CostPlans-AI
npm install
```

This installs dependencies for the root, **client**, and **server** (workspaces). You should see no errors.

---

## Step 5: Create your `.env` file

In the **project root**, copy the example env file:

```bash
cp .env.example .env
```

Open `.env` in an editor and set your PostgreSQL values. Example:

**If using default `postgres` user (and no password):**

```env
PG_HOST=localhost
PG_PORT=5432
PG_DATABASE=costplans
PG_USER=postgres
PG_PASSWORD=
PORT=3001
NODE_ENV=development
```

**If you created a user (e.g. `costplans_user`):**

```env
PG_HOST=localhost
PG_PORT=5432
PG_DATABASE=costplans
PG_USER=costplans_user
PG_PASSWORD=your_secure_password
PORT=3001
NODE_ENV=development
```

Save the file. Do **not** commit `.env` (it’s in `.gitignore`).

---

## Step 6: Start the server once (creates tables)

Still in the **project root**:

```bash
npm run dev:server
```

You should see:

- `Database connected.`
- `Server running at http://localhost:3001`

Sequelize will create the tables (`projects`, `planning_years`, `project_metadata`) on first connect.

**Stop the server:** press `Ctrl+C` in the terminal.

---

## Step 7: Seed sample data (optional)

To have sample projects and planning years in the app:

```bash
npm run db:seed
```

You should see `Seeding...` then `Seed done. Try:` with curl examples. If that appears, the seed ran successfully.

---

## Step 8: Run the full app (server + React)

From the **project root**:

```bash
npm run dev
```

This starts:

1. **API server** at **http://localhost:3001**
2. **React app** at **http://localhost:5173**

Leave this terminal open. You should see logs from both.

---

## Step 9: Verify in the browser

1. Open **http://localhost:5173** in your browser.
2. You should see **CostPlans** and three sections:
   - **Projects** — list of projects (or a message to run `db:seed` if you skipped Step 7).
   - **Planning years** — e.g. 2025, 2026.
   - **Project metadata** — project × year rows.

If you see that, the setup is complete.

---

## Step 10: Verify the API (optional)

In a **new** terminal (keep `npm run dev` running in the first):

```bash
curl http://localhost:3001/api/health
```

Expected: `{"status":"ok","message":"CostPlans API"}`

```bash
curl http://localhost:3001/api/projects
```

Expected: JSON array of projects (empty `[]` if you didn’t seed, or 2 projects if you did).

---

## Troubleshooting

| Problem | What to try |
|--------|-----------------|
| `node: command not found` | Install Node.js from nodejs.org (LTS). |
| `psql: command not found` or connection refused | Install/start PostgreSQL (Step 2). |
| `password authentication failed` | Fix `PG_USER` and `PG_PASSWORD` in `.env`; ensure the user can connect with `psql -h localhost -U your_user -d costplans`. |
| `database "costplans" does not exist` | Create the database (Step 3). |
| `npm install` fails | Run `npm install` from project root; ensure Node 18+. |
| Port 3001 or 5173 already in use | Stop the other app using that port, or set `PORT=3002` in `.env` for the server (and update client proxy if needed). |
| Blank page or “Error” in the app | Ensure the server is running and reachable at http://localhost:3001; check the browser console (F12) for errors. |

---

## Quick reference after setup

- **Start app:** `npm run dev` (from project root)
- **API only:** `npm run dev:server`
- **React only:** `npm run dev:client` (needs API for data)
- **Reseed data:** `npm run db:seed`
- **App URL:** http://localhost:5173  
- **API URL:** http://localhost:3001
