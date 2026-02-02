import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import express from 'express';
import cors from 'cors';
import { sequelize } from './models/index.js';
import projectsRouter from './routes/projects.js';
import planningYearsRouter from './routes/planningYears.js';
import projectMetadataRouter from './routes/projectMetadata.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    message: 'CostPlans API',
    app: `http://localhost:${PORT}/api`,
    health: `http://localhost:${PORT}/api/health`,
    projects: `http://localhost:${PORT}/api/projects`,
  });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'CostPlans API' });
});

app.use('/api/projects', projectsRouter);
app.use('/api/planning-years', planningYearsRouter);
app.use('/api/project-metadata', projectMetadataRouter);

async function start() {
  try {
    await sequelize.authenticate();
    console.log('Database connected.');
    await sequelize.sync({ alter: false });
    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Unable to start server:', err.message);
    process.exit(1);
  }
}

start();
