import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { sequelize, Project, PlanningYear, ProjectMetadata } from '../models/index.js';

async function seed() {
  try {
    await sequelize.authenticate();
    console.log('Seeding...');

    const [year2025, year2026] = await PlanningYear.bulkCreate([
      { year_label: 2025, status: 'ACTIVE' },
      { year_label: 2026, status: 'DRAFT' },
    ]);

    const [proj1, proj2] = await Project.bulkCreate([
      { wbse_code: 'WBSE-001', project_name: 'Sample Project Alpha', is_active: true },
      { wbse_code: 'WBSE-002', project_name: 'Sample Project Beta', is_active: true },
    ]);

    await ProjectMetadata.bulkCreate([
      {
        project_id: proj1.project_id,
        planning_year_id: year2025.planning_year_id,
        division: 'Division A',
        branch: 'Branch 1',
        section_country: 'Geneva',
        implementing_grant: null,
        trust_fund: null,
        earmarking: null,
        project_end_date: '2025-12-31',
      },
      {
        project_id: proj1.project_id,
        planning_year_id: year2026.planning_year_id,
        division: 'Division A',
        branch: 'Branch 1',
        section_country: 'Geneva',
        implementing_grant: null,
        trust_fund: null,
        earmarking: null,
        project_end_date: '2026-12-31',
      },
    ]);

    console.log('Seed done. Try:');
    console.log('  curl http://localhost:3001/api/projects');
    console.log('  curl http://localhost:3001/api/planning-years');
    console.log('  curl http://localhost:3001/api/project-metadata');
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  }
}

seed();
