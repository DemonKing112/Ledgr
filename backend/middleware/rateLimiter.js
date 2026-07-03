/* ──────────────────────────────────────────────────────────────
   RATE LIMITER
   Prevents brute-force attacks on login/signup by limiting
   how many requests one IP address can make per time window.
   ────────────────────────────────────────────────────────────── */

const rateLimit = require('express-rate-limit');

/* Auth endpoints: 20 attempts per 15-minute window per IP */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts — please try again in 15 minutes' },
});

/* General API: 200 requests per minute per IP */
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Rate limit exceeded — slow down a bit' },
});

module.exports = { authLimiter, apiLimiter };
