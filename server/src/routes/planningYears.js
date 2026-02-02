import { Router } from 'express';
import { PlanningYear } from '../models/index.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const years = await PlanningYear.findAll({
      order: [['year_label', 'DESC']],
    });
    res.json(years);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { year_label, status = 'DRAFT' } = req.body;
    if (year_label == null) {
      return res.status(400).json({ error: 'year_label is required' });
    }
    const year = await PlanningYear.create({ year_label, status });
    res.status(201).json(year);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
