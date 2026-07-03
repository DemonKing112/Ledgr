/* ──────────────────────────────────────────────────────────────
   BUDGET ROUTES
   Lets users set an optional monthly spending limit per
   category, and see how it compares to their actual spend.
   ────────────────────────────────────────────────────────────── */

const express = require('express');
const router = express.Router();
const db = require('../db/schema');
const authenticate = require('../middleware/auth');
const { budgetRules, idParam } = require('../middleware/validate');

router.use(authenticate);

/* ── GET /api/budgets ─────────────────────────────────────────
   Returns all budgets for the logged-in user, joined with the
   category name/color for display.                             */
router.get('/', (req, res) => {
  const budgets = db.prepare(`
    SELECT
      b.id,
      b.category_id,
      c.name  AS category_name,
      c.color AS category_color,
      b.monthly_limit
    FROM budgets b
    JOIN categories c ON c.id = b.category_id
    WHERE b.user_id = ?
    ORDER BY c.name
  `).all(req.userId);

  res.json({ budgets });
});

/* ── POST /api/budgets ────────────────────────────────────────
   Creates a budget for a category. One budget per category —
   trying to create a second one for the same category fails.   */
router.post('/', budgetRules, (req, res) => {
  const { category_id, monthly_limit } = req.body;

  const category = db.prepare('SELECT id FROM categories WHERE id = ? AND user_id = ?')
    .get(category_id, req.userId);
  if (!category) {
    return res.status(404).json({ error: 'Category not found' });
  }

  const existing = db.prepare('SELECT id FROM budgets WHERE user_id = ? AND category_id = ?')
    .get(req.userId, category_id);
  if (existing) {
    return res.status(409).json({ error: 'A budget already exists for this category' });
  }

  const result = db.prepare(`
    INSERT INTO budgets (user_id, category_id, monthly_limit) VALUES (?, ?, ?)
  `).run(req.userId, category_id, monthly_limit);

  const budget = db.prepare(`
    SELECT b.id, b.category_id, c.name AS category_name, c.color AS category_color, b.monthly_limit
    FROM budgets b JOIN categories c ON c.id = b.category_id
    WHERE b.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json({ budget });
});

/* ── PUT /api/budgets/:id ─────────────────────────────────────
   Updates a budget's monthly limit.                             */
router.put('/:id', idParam, (req, res) => {
  const { id } = req.params;
  const { monthly_limit } = req.body;

  if (!monthly_limit || monthly_limit <= 0) {
    return res.status(400).json({ error: 'Monthly limit must be a positive number' });
  }

  const existing = db.prepare('SELECT id FROM budgets WHERE id = ? AND user_id = ?')
    .get(id, req.userId);
  if (!existing) {
    return res.status(404).json({ error: 'Budget not found' });
  }

  db.prepare(`
    UPDATE budgets SET monthly_limit = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?
  `).run(monthly_limit, id, req.userId);

  const budget = db.prepare(`
    SELECT b.id, b.category_id, c.name AS category_name, c.color AS category_color, b.monthly_limit
    FROM budgets b JOIN categories c ON c.id = b.category_id
    WHERE b.id = ?
  `).get(id);

  res.json({ budget });
});

/* ── DELETE /api/budgets/:id ──────────────────────────────────
   Removes a budget.                                             */
router.delete('/:id', idParam, (req, res) => {
  const { id } = req.params;

  const result = db.prepare('DELETE FROM budgets WHERE id = ? AND user_id = ?')
    .run(id, req.userId);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Budget not found' });
  }

  res.json({ message: 'Budget deleted' });
});

module.exports = router;
