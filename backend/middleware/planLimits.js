const db = require('../db/schema');

const LIMITS = {
  free:     { expenses: 50, categories: 5, projects: 3, budgets: 3 },
  pro:      { expenses: Infinity, categories: Infinity, projects: Infinity, budgets: Infinity },
  business: { expenses: Infinity, categories: Infinity, projects: Infinity, budgets: Infinity },
};

function checkLimit(resource, table) {
  return async (req, res, next) => {
    try {
      const { rows } = await db.query(
        `SELECT plan FROM users WHERE id = $1`, [req.userId]
      );
      const plan = rows[0]?.plan || 'free';
      const limit = LIMITS[plan]?.[resource] ?? LIMITS.free[resource];

      if (limit === Infinity) return next();

      const { rows: countRows } = await db.query(
        `SELECT COUNT(*)::int AS count FROM ${table} WHERE user_id = $1`, [req.userId]
      );

      if (countRows[0].count >= limit) {
        return res.status(403).json({
          error: `Free plan is limited to ${limit} ${resource}. Upgrade to Pro for unlimited access.`,
          upgrade: true,
        });
      }

      next();
    } catch (err) {
      console.error('Plan limit check error:', err);
      next();
    }
  };
}

module.exports = {
  expenseLimit:  checkLimit('expenses', 'expenses'),
  categoryLimit: checkLimit('categories', 'categories'),
  projectLimit:  checkLimit('projects', 'projects'),
  budgetLimit:   checkLimit('budgets', 'budgets'),
};
