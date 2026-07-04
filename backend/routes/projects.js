const express = require('express');
const router = express.Router();
const db = require('../db/schema');
const authenticate = require('../middleware/auth');
const { projectRules, idParam } = require('../middleware/validate');
const { projectLimit } = require('../middleware/planLimits');

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM projects WHERE user_id = $1 ORDER BY created_at DESC', [req.userId]
    );
    res.json({ projects: rows });
  } catch (err) {
    console.error('List projects error:', err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

router.post('/', projectLimit, projectRules, async (req, res) => {
  try {
    const { name, client_name } = req.body;
    const { rows } = await db.query(
      'INSERT INTO projects (user_id, name, client_name) VALUES ($1, $2, $3) RETURNING *',
      [req.userId, name, client_name || null]
    );
    res.status(201).json({ project: rows[0] });
  } catch (err) {
    console.error('Create project error:', err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

router.put('/:id', idParam, projectRules, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, client_name } = req.body;

    const { rows: existing } = await db.query(
      'SELECT id FROM projects WHERE id = $1 AND user_id = $2', [id, req.userId]
    );
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    await db.query(
      'UPDATE projects SET name = $1, client_name = $2 WHERE id = $3 AND user_id = $4',
      [name, client_name || null, id, req.userId]
    );

    const { rows } = await db.query('SELECT * FROM projects WHERE id = $1', [id]);
    res.json({ project: rows[0] });
  } catch (err) {
    console.error('Update project error:', err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

router.delete('/:id', idParam, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      'DELETE FROM projects WHERE id = $1 AND user_id = $2', [id, req.userId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json({ message: 'Project deleted' });
  } catch (err) {
    console.error('Delete project error:', err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

module.exports = router;
