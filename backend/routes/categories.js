/* ──────────────────────────────────────────────────────────────
   CATEGORY ROUTES
   Lets users manage their expense categories (list & create).
   ────────────────────────────────────────────────────────────── */

const express = require('express');
const router = express.Router();
const db = require('../db/schema');
const authenticate = require('../middleware/auth');
const { categoryRules, idParam } = require('../middleware/validate');

router.use(authenticate);

/* ── GET /api/categories ─────────────────────────────────────
   Returns all categories belonging to the logged-in user.      */
router.get('/', (req, res) => {
  const categories = db.prepare(
    'SELECT * FROM categories WHERE user_id = ? ORDER BY name'
  ).all(req.userId);

  res.json({ categories });
});

/* ── POST /api/categories ────────────────────────────────────
   Creates a new category.                                      */
router.post('/', categoryRules, (req, res) => {
  const { name, color, icon } = req.body;

  const result = db.prepare(`
    INSERT INTO categories (user_id, name, color, icon)
    VALUES (?, ?, ?, ?)
  `).run(req.userId, name, color || '#8B5CF6', icon || 'tag');

  const category = db.prepare('SELECT * FROM categories WHERE id = ?')
    .get(result.lastInsertRowid);

  res.status(201).json({ category });
});

/* ── PUT /api/categories/:id ─────────────────────────────────
   Updates an existing category. Only the owner can edit it.   */
router.put('/:id', idParam, categoryRules, (req, res) => {
  const { id } = req.params;
  const { name, color, icon } = req.body;

  const existing = db.prepare('SELECT id FROM categories WHERE id = ? AND user_id = ?')
    .get(id, req.userId);
  if (!existing) {
    return res.status(404).json({ error: 'Category not found' });
  }

  db.prepare(`
    UPDATE categories SET name = ?, color = ?, icon = ? WHERE id = ? AND user_id = ?
  `).run(name, color || '#8B5CF6', icon || 'tag', id, req.userId);

  const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
  res.json({ category });
});

/* ── DELETE /api/categories/:id ──────────────────────────────
   Deletes a category. Expenses that used it keep their record
   but their category_id is cleared (ON DELETE SET NULL).      */
router.delete('/:id', idParam, (req, res) => {
  const { id } = req.params;

  const result = db.prepare('DELETE FROM categories WHERE id = ? AND user_id = ?')
    .run(id, req.userId);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Category not found' });
  }

  res.json({ message: 'Category deleted' });
});

module.exports = router;
