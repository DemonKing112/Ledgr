/* ──────────────────────────────────────────────────────────────
   PROJECT ROUTES
   Lets users manage client projects for grouping expenses.
   ────────────────────────────────────────────────────────────── */

const express = require('express');
const router = express.Router();
const db = require('../db/schema');
const authenticate = require('../middleware/auth');
const { projectRules, idParam } = require('../middleware/validate');

router.use(authenticate);

/* ── GET /api/projects ───────────────────────────────────────
   Returns all projects belonging to the logged-in user.        */
router.get('/', (req, res) => {
  const projects = db.prepare(
    'SELECT * FROM projects WHERE user_id = ? ORDER BY created_at DESC'
  ).all(req.userId);

  res.json({ projects });
});

/* ── POST /api/projects ──────────────────────────────────────
   Creates a new project.                                       */
router.post('/', projectRules, (req, res) => {
  const { name, client_name } = req.body;

  const result = db.prepare(`
    INSERT INTO projects (user_id, name, client_name) VALUES (?, ?, ?)
  `).run(req.userId, name, client_name || null);

  const project = db.prepare('SELECT * FROM projects WHERE id = ?')
    .get(result.lastInsertRowid);

  res.status(201).json({ project });
});

/* ── PUT /api/projects/:id ───────────────────────────────────
   Updates an existing project. Only the owner can edit it.    */
router.put('/:id', idParam, projectRules, (req, res) => {
  const { id } = req.params;
  const { name, client_name } = req.body;

  const existing = db.prepare('SELECT id FROM projects WHERE id = ? AND user_id = ?')
    .get(id, req.userId);
  if (!existing) {
    return res.status(404).json({ error: 'Project not found' });
  }

  db.prepare(`
    UPDATE projects SET name = ?, client_name = ? WHERE id = ? AND user_id = ?
  `).run(name, client_name || null, id, req.userId);

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  res.json({ project });
});

/* ── DELETE /api/projects/:id ────────────────────────────────
   Deletes a project. Expenses that used it keep their record
   but their project_id is cleared (ON DELETE SET NULL).       */
router.delete('/:id', idParam, (req, res) => {
  const { id } = req.params;

  const result = db.prepare('DELETE FROM projects WHERE id = ? AND user_id = ?')
    .run(id, req.userId);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Project not found' });
  }

  res.json({ message: 'Project deleted' });
});

module.exports = router;
