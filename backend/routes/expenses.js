const express = require('express');
const router = express.Router();
const db = require('../db/schema');
const authenticate = require('../middleware/auth');
const { expenseRules, idParam } = require('../middleware/validate');
const { expenseLimit } = require('../middleware/planLimits');

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT
        e.id, e.amount, e.description, e.date, e.receipt_url,
        e.category_id, c.name AS category_name, c.color AS category_color,
        e.project_id, p.name AS project_name, e.created_at
      FROM expenses e
      LEFT JOIN categories c ON c.id = e.category_id
      LEFT JOIN projects   p ON p.id = e.project_id
      WHERE e.user_id = $1
      ORDER BY e.date DESC, e.created_at DESC
    `, [req.userId]);
    res.json({ expenses: rows });
  } catch (err) {
    console.error('List expenses error:', err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

router.get('/summary', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT
        c.name AS category, c.color AS color, SUM(e.amount) AS total
      FROM expenses e
      LEFT JOIN categories c ON c.id = e.category_id
      WHERE e.user_id = $1
      GROUP BY e.category_id, c.name, c.color
      ORDER BY total DESC
    `, [req.userId]);

    const grandTotal = rows.reduce((sum, row) => sum + parseFloat(row.total), 0);
    res.json({ summary: rows, grandTotal });
  } catch (err) {
    console.error('Expense summary error:', err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

router.post('/', expenseLimit, expenseRules, async (req, res) => {
  try {
    const { amount, description, date, category_id, project_id } = req.body;

    const { rows: inserted } = await db.query(`
      INSERT INTO expenses (user_id, amount, description, date, category_id, project_id)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING id
    `, [req.userId, amount, description, date, category_id || null, project_id || null]);

    const { rows } = await db.query(`
      SELECT e.*, c.name AS category_name, c.color AS category_color, p.name AS project_name
      FROM expenses e
      LEFT JOIN categories c ON c.id = e.category_id
      LEFT JOIN projects p ON p.id = e.project_id
      WHERE e.id = $1
    `, [inserted[0].id]);

    res.status(201).json({ expense: rows[0] });
  } catch (err) {
    console.error('Create expense error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', idParam, expenseRules, async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, description, date, category_id, project_id } = req.body;

    const { rows: existing } = await db.query(
      'SELECT id FROM expenses WHERE id = $1 AND user_id = $2', [id, req.userId]
    );
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    await db.query(`
      UPDATE expenses
      SET amount = $1, description = $2, date = $3, category_id = $4, project_id = $5, updated_at = NOW()
      WHERE id = $6 AND user_id = $7
    `, [amount, description, date, category_id || null, project_id || null, id, req.userId]);

    const { rows } = await db.query(`
      SELECT e.*, c.name AS category_name, c.color AS category_color, p.name AS project_name
      FROM expenses e
      LEFT JOIN categories c ON c.id = e.category_id
      LEFT JOIN projects   p ON p.id = e.project_id
      WHERE e.id = $1
    `, [id]);

    res.json({ expense: rows[0] });
  } catch (err) {
    console.error('Update expense error:', err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

router.delete('/:id', idParam, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      'DELETE FROM expenses WHERE id = $1 AND user_id = $2', [id, req.userId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }
    res.json({ message: 'Expense deleted' });
  } catch (err) {
    console.error('Delete expense error:', err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

module.exports = router;
