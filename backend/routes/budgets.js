const express = require('express');
const router = express.Router();
const db = require('../db/schema');
const authenticate = require('../middleware/auth');
const { budgetRules, idParam } = require('../middleware/validate');

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT b.id, b.category_id, c.name AS category_name, c.color AS category_color, b.monthly_limit
      FROM budgets b
      JOIN categories c ON c.id = b.category_id
      WHERE b.user_id = $1
      ORDER BY c.name
    `, [req.userId]);
    res.json({ budgets: rows });
  } catch (err) {
    console.error('List budgets error:', err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

router.post('/', budgetRules, async (req, res) => {
  try {
    const { category_id, monthly_limit } = req.body;

    const { rows: catRows } = await db.query(
      'SELECT id FROM categories WHERE id = $1 AND user_id = $2', [category_id, req.userId]
    );
    if (catRows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const { rows: existingRows } = await db.query(
      'SELECT id FROM budgets WHERE user_id = $1 AND category_id = $2', [req.userId, category_id]
    );
    if (existingRows.length > 0) {
      return res.status(409).json({ error: 'A budget already exists for this category' });
    }

    const { rows: inserted } = await db.query(
      'INSERT INTO budgets (user_id, category_id, monthly_limit) VALUES ($1, $2, $3) RETURNING id',
      [req.userId, category_id, monthly_limit]
    );

    const { rows } = await db.query(`
      SELECT b.id, b.category_id, c.name AS category_name, c.color AS category_color, b.monthly_limit
      FROM budgets b JOIN categories c ON c.id = b.category_id
      WHERE b.id = $1
    `, [inserted[0].id]);

    res.status(201).json({ budget: rows[0] });
  } catch (err) {
    console.error('Create budget error:', err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

router.put('/:id', idParam, async (req, res) => {
  try {
    const { id } = req.params;
    const { monthly_limit } = req.body;

    if (!monthly_limit || monthly_limit <= 0) {
      return res.status(400).json({ error: 'Monthly limit must be a positive number' });
    }

    const { rows: existing } = await db.query(
      'SELECT id FROM budgets WHERE id = $1 AND user_id = $2', [id, req.userId]
    );
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Budget not found' });
    }

    await db.query(
      'UPDATE budgets SET monthly_limit = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3',
      [monthly_limit, id, req.userId]
    );

    const { rows } = await db.query(`
      SELECT b.id, b.category_id, c.name AS category_name, c.color AS category_color, b.monthly_limit
      FROM budgets b JOIN categories c ON c.id = b.category_id
      WHERE b.id = $1
    `, [id]);

    res.json({ budget: rows[0] });
  } catch (err) {
    console.error('Update budget error:', err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

router.delete('/:id', idParam, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      'DELETE FROM budgets WHERE id = $1 AND user_id = $2', [id, req.userId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Budget not found' });
    }
    res.json({ message: 'Budget deleted' });
  } catch (err) {
    console.error('Delete budget error:', err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

module.exports = router;
