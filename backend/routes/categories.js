const express = require('express');
const router = express.Router();
const db = require('../db/schema');
const authenticate = require('../middleware/auth');
const { categoryRules, idParam } = require('../middleware/validate');

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM categories WHERE user_id = $1 ORDER BY name', [req.userId]
    );
    res.json({ categories: rows });
  } catch (err) {
    console.error('List categories error:', err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

router.post('/', categoryRules, async (req, res) => {
  try {
    const { name, color, icon } = req.body;
    const { rows } = await db.query(
      'INSERT INTO categories (user_id, name, color, icon) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.userId, name, color || '#8B5CF6', icon || 'tag']
    );
    res.status(201).json({ category: rows[0] });
  } catch (err) {
    console.error('Create category error:', err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

router.put('/:id', idParam, categoryRules, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, color, icon } = req.body;

    const { rows: existing } = await db.query(
      'SELECT id FROM categories WHERE id = $1 AND user_id = $2', [id, req.userId]
    );
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    await db.query(
      'UPDATE categories SET name = $1, color = $2, icon = $3 WHERE id = $4 AND user_id = $5',
      [name, color || '#8B5CF6', icon || 'tag', id, req.userId]
    );

    const { rows } = await db.query('SELECT * FROM categories WHERE id = $1', [id]);
    res.json({ category: rows[0] });
  } catch (err) {
    console.error('Update category error:', err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

router.delete('/:id', idParam, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      'DELETE FROM categories WHERE id = $1 AND user_id = $2', [id, req.userId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    res.json({ message: 'Category deleted' });
  } catch (err) {
    console.error('Delete category error:', err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

module.exports = router;
