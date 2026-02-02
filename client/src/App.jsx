import { useState, useEffect } from 'react';

const API = '/api';

export default function App() {
  const [projects, setProjects] = useState([]);
  const [planningYears, setPlanningYears] = useState([]);
  const [projectMetadata, setProjectMetadata] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/projects`).then((r) => (r.ok ? r.json() : [])),
      fetch(`${API}/planning-years`).then((r) => (r.ok ? r.json() : [])),
      fetch(`${API}/project-metadata`).then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([p, y, m]) => {
        setProjects(p);
        setPlanningYears(y);
        setProjectMetadata(m);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="app loading">Loading...</div>;
  if (error) return <div className="app error">Error: {error}</div>;

  return (
    <div className="app">
      <header>
        <h1>CostPlans</h1>
        <p>React + Node + PostgreSQL</p>
      </header>

      <section>
        <h2>Projects</h2>
        <ul>
          {projects.length === 0 ? (
            <li>No projects. Run <code>npm run db:seed</code> in server to add sample data.</li>
          ) : (
            projects.map((p) => (
              <li key={p.project_id}>
                <strong>{p.wbse_code}</strong> — {p.project_name}
              </li>
            ))
          )}
        </ul>
      </section>

      <section>
        <h2>Planning years</h2>
        <ul>
          {planningYears.length === 0 ? (
            <li>No planning years.</li>
          ) : (
            planningYears.map((y) => (
              <li key={y.planning_year_id}>
                {y.year_label} — <span className="status">{y.status}</span>
              </li>
            ))
          )}
        </ul>
      </section>

      <section>
        <h2>Project metadata (project × year)</h2>
        <ul>
          {projectMetadata.length === 0 ? (
            <li>No project metadata.</li>
          ) : (
            projectMetadata.map((m) => (
              <li key={m.project_metadata_id}>
                {m.Project?.wbse_code} / {m.PlanningYear?.year_label} — {m.division}, {m.branch}, {m.section_country}
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
