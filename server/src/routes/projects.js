import { Router } from 'express';
import { Project, ProjectMetadata, PlanningYear } from '../models/index.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const projects = await Project.findAll({
      where: { is_active: true },
      order: [['project_name', 'ASC']],
    });
    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const project = await Project.findByPk(req.params.id, {
      include: [
        {
          model: ProjectMetadata,
          include: [{ model: PlanningYear, attributes: ['planning_year_id', 'year_label', 'status'] }],
        },
      ],
    });
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { wbse_code, project_name, is_active = true } = req.body;
    if (!wbse_code || !project_name) {
      return res.status(400).json({ error: 'wbse_code and project_name are required' });
    }
    const project = await Project.create({ wbse_code, project_name, is_active });
    res.status(201).json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
