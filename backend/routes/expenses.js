/* ──────────────────────────────────────────────────────────────
   EXPENSE ROUTES
   Full CRUD for expenses.  Every query is scoped to the
   logged-in user so nobody can see anyone else's data.
   ────────────────────────────────────────────────────────────── */

const express = require('express');
const router = express.Router();
const db = require('../db/schema');
const authenticate = require('../middleware/auth');
const { expenseRules, idParam } = require('../middleware/validate');

/* All expense routes require a valid access token */
router.use(authenticate);

/* ── GET /api/expenses ───────────────────────────────────────
   Returns all expenses for the logged-in user, newest first.
   Includes the category name and project name via JOINs.       */
router.get('/', (req, res) => {
  const expenses = db.prepare(`
    SELECT
      e.id,
      e.amount,
      e.description,
      e.date,
      e.receipt_url,
      e.category_id,
      c.name  AS category_name,
      c.color AS category_color,
      e.project_id,
      p.name  AS project_name,
      e.created_at
    FROM expenses e
    LEFT JOIN categories c ON c.id = e.category_id
    LEFT JOIN projects   p ON p.id = e.project_id
    WHERE e.user_id = ?
    ORDER BY e.date DESC, e.created_at DESC
  `).all(req.userId);

  res.json({ expenses });
});

/* ── GET /api/expenses/summary ───────────────────────────────
   Returns spend totals grouped by category — used for the
   dashboard chart.                                              */
router.get('/summary', (req, res) => {
  const summary = db.prepare(`
    SELECT
      c.name  AS category,
      c.color AS color,
      SUM(e.amount) AS total
    FROM expenses e
    LEFT JOIN categories c ON c.id = e.category_id
    WHERE e.user_id = ?
    GROUP BY e.category_id
    ORDER BY total DESC
  `).all(req.userId);

  const grandTotal = summary.reduce((sum, row) => sum + row.total, 0);

  res.json({ summary, grandTotal });
});

/* ── POST /api/expenses ──────────────────────────────────────
   Creates a new expense for the logged-in user.                */
router.post('/', expenseRules, (req, res) => {
  try {
    const { amount, description, date, category_id, project_id } = req.body;

    const result = db.prepare(`
      INSERT INTO expenses
      (user_id, amount, description, date, category_id, project_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      req.userId,
      amount,
      description,
      date,
      category_id || null,
      project_id || null
    );

    const expense = db.prepare(`
      SELECT
        e.*,
        c.name AS category_name,
        c.color AS category_color,
        p.name AS project_name
      FROM expenses e
      LEFT JOIN categories c ON c.id = e.category_id
      LEFT JOIN projects p ON p.id = e.project_id
      WHERE e.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json({ expense });

  } catch (err) {
    console.error("INSERT FAILED:", err);
    res.status(500).json({
      error: err.message,
      stack: err.stack
    });
  }
});

/* ── PUT /api/expenses/:id ───────────────────────────────────
   Updates an existing expense.  Only the owner can edit it.    */
router.put('/:id', idParam, expenseRules, (req, res) => {
  const { id } = req.params;
  const { amount, description, date, category_id, project_id } = req.body;

  /* Make sure this expense belongs to the current user */
  const existing = db.prepare('SELECT id FROM expenses WHERE id = ? AND user_id = ?')
    .get(id, req.userId);

  if (!existing) {
    return res.status(404).json({ error: 'Expense not found' });
  }

  db.prepare(`
    UPDATE expenses
    SET amount = ?, description = ?, date = ?, category_id = ?, project_id = ?,
        updated_at = datetime('now')
    WHERE id = ? AND user_id = ?
  `).run(amount, description, date, category_id || null, project_id || null, id, req.userId);

  const expense = db.prepare(`
    SELECT
      e.*, c.name AS category_name, c.color AS category_color, p.name AS project_name
    FROM expenses e
    LEFT JOIN categories c ON c.id = e.category_id
    LEFT JOIN projects   p ON p.id = e.project_id
    WHERE e.id = ?
  `).get(id);

  res.json({ expense });
});

/* ── DELETE /api/expenses/:id ────────────────────────────────
   Permanently removes an expense.  Only the owner can do this. */
router.delete('/:id', idParam, (req, res) => {
  const { id } = req.params;

  const result = db.prepare('DELETE FROM expenses WHERE id = ? AND user_id = ?')
    .run(id, req.userId);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Expense not found' });
  }

  res.json({ message: 'Expense deleted' });
});

module.exports = router;
