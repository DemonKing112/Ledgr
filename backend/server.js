/* ──────────────────────────────────────────────────────────────
   MONTRAQ API SERVER
   The main entry point.  Loads environment variables, sets up
   security middleware, mounts all route files, and starts
   listening for requests.
   ────────────────────────────────────────────────────────────── */

require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

const db = require('./db/schema');
const { authLimiter, apiLimiter } = require('./middleware/rateLimiter');

const app = express();
const PORT = process.env.PORT || 3001;

/* ── Security headers ────────────────────────────────────────
   Helmet adds headers like X-Content-Type-Options, Strict-
   Transport-Security, etc. to protect against common attacks.  */
app.use(helmet());

/* ── CORS ────────────────────────────────────────────────────
   Only allow requests from our frontend's origin — not from
   random websites.                                              */
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5500',
  credentials: true,
}));

/* ── Stripe webhook (must be before JSON body parsing) ────── */
app.use('/api/stripe/webhook', require('./routes/stripeWebhook'));

/* ── Body parsing ────────────────────────────────────────────
   Lets us read JSON request bodies (e.g. { email, password }). */
app.use(express.json({ limit: '1mb' }));

/* ── Rate limiting ───────────────────────────────────────────
   Apply stricter limits to auth routes, looser ones elsewhere. */
app.use('/api/auth', authLimiter);
app.use('/api', apiLimiter);

/* ── Routes ──────────────────────────────────────────────────
   Each route file handles one resource (users, expenses, etc.) */
app.use('/api/auth', require('./routes/auth'));
app.use('/api/expenses', require('./routes/expenses'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/receipts', require('./routes/receipts'));
app.use('/api/budgets', require('./routes/budgets'));
app.use('/api/stripe', require('./routes/stripe'));

/* ── Health check ────────────────────────────────────────────
   A simple endpoint deployment platforms can ping to verify
   the server is alive.                                          */
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/* ── 404 handler ─────────────────────────────────────────────
   If no route matched, tell the client what went wrong.        */
app.use((_req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

/* ── Global error handler ────────────────────────────────────
   Catches any unhandled errors so the server doesn't crash.    */
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

/* ── Start the server ────────────────────────────────────────
   Initialize the database first (sql.js needs async setup),
   then start listening for requests.                           */
const dbReady = db.initDb();

if (require.main === module) {
  dbReady.then(() => {
    app.listen(PORT, () => {
      console.log(`Montraq API running on http://localhost:${PORT}`);
    });
  }).catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

/* Export for testing */
module.exports = app;
module.exports.dbReady = dbReady;
