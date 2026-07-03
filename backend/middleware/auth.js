/* ──────────────────────────────────────────────────────────────
   AUTH MIDDLEWARE
   Checks the JWT access token on every protected route.
   If the token is missing or expired the request is rejected
   with a 401 before it ever reaches the route handler.
   ────────────────────────────────────────────────────────────── */

const jwt = require('jsonwebtoken');

function authenticate(req, res, next) {
  /* The token travels in the "Authorization" header like:
     Authorization: Bearer eyJhbGciOi...                        */
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = header.split(' ')[1];

  try {
    /* Verify the token hasn't been tampered with and isn't expired */
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    /* Attach the user's id to the request so routes can use it */
    req.userId = payload.userId;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = authenticate;
