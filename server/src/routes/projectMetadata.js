import { Router } from 'express';
import { ProjectMetadata, Project, PlanningYear } from '../models/index.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { project_id, planning_year_id } = req.query;
    const where = {};
    if (project_id) where.project_id = project_id;
    if (planning_year_id) where.planning_year_id = planning_year_id;

    const list = await ProjectMetadata.findAll({
      where: Object.keys(where).length ? where : undefined,
      include: [
        { model: Project, attributes: ['project_id', 'wbse_code', 'project_name'] },
        { model: PlanningYear, attributes: ['planning_year_id', 'year_label', 'status'] },
      ],
      order: [
        ['project_id', 'ASC'],
        ['planning_year_id', 'ASC'],
      ],
    });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const meta = await ProjectMetadata.findByPk(req.params.id, {
      include: [
        { model: Project },
        { model: PlanningYear },
      ],
    });
    if (!meta) return res.status(404).json({ error: 'Project metadata not found' });
    res.json(meta);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const {
      project_id,
      planning_year_id,
      division,
      branch,
      section_country,
      implementing_grant,
      trust_fund,
      earmarking,
      project_end_date,
    } = req.body;
    if (!project_id || !planning_year_id || !division || !branch || !section_country) {
      return res.status(400).json({
        error: 'project_id, planning_year_id, division, branch, section_country are required',
      });
    }
    const meta = await ProjectMetadata.create({
      project_id,
      planning_year_id,
      division,
      branch,
      section_country,
      implementing_grant: implementing_grant || null,
      trust_fund: trust_fund || null,
      earmarking: earmarking || null,
      project_end_date: project_end_date || null,
    });
    res.status(201).json(meta);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
