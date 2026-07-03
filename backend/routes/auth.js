/* ──────────────────────────────────────────────────────────────
   AUTH ROUTES
   Handles user signup, login, token refresh, and "who am I?"
   Passwords are hashed with bcrypt before storage.
   JWTs are issued in pairs: a short-lived access token and a
   longer-lived refresh token.
   ────────────────────────────────────────────────────────────── */

const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const router = express.Router();
const db = require('../db/schema');
const authenticate = require('../middleware/auth');
const {
  signupRules,
  loginRules,
  updateProfileRules,
  changePasswordRules,
  forgotPasswordRules,
  resetPasswordRules,
} = require('../middleware/validate');

/* How long a password reset token stays valid */
const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

/* How many rounds bcrypt uses to hash — 12 is a good balance
   between security and speed                                    */
const SALT_ROUNDS = 12;

/* Token lifetimes */
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/* Helper: create both tokens for a user */
function issueTokens(userId) {
  const accessToken = jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );

  const refreshToken = crypto.randomBytes(40).toString('hex');
  const refreshHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS).toISOString();

  /* Save the hashed refresh token in the database */
  db.prepare(`
    INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
    VALUES (?, ?, ?)
  `).run(userId, refreshHash, expiresAt);

  return { accessToken, refreshToken };
}

/* ── POST /api/auth/signup ───────────────────────────────────
   Creates a new user account.  The password is hashed before
   being stored — we never keep the plain-text version.         */
router.post('/signup', signupRules, async (req, res) => {
  try {
    const { email, name, password } = req.body;

    /* Check if this email is already registered */
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    /* Hash the password so it's safe to store */
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    /* Insert the new user */
    const result = db.prepare(`
      INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)
    `).run(email, name, passwordHash);

    const userId = result.lastInsertRowid;

    /* Give every new user a few starter categories */
    const defaultCategories = [
      { name: 'Software', color: '#8B5CF6', icon: 'monitor' },
      { name: 'Travel', color: '#F59E0B', icon: 'plane' },
      { name: 'Office Supplies', color: '#10B981', icon: 'briefcase' },
      { name: 'Meals', color: '#EF4444', icon: 'utensils' },
      { name: 'Marketing', color: '#3B82F6', icon: 'megaphone' },
    ];
    const insertCat = db.prepare(`
      INSERT INTO categories (user_id, name, color, icon) VALUES (?, ?, ?, ?)
    `);
    for (const cat of defaultCategories) {
      insertCat.run(userId, cat.name, cat.color, cat.icon);
    }

    /* Issue tokens so the user is logged in immediately */
    const tokens = issueTokens(userId);

    res.status(201).json({
      user: { id: userId, email, name },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Something went wrong during signup' });
  }
});

/* ── POST /api/auth/login ────────────────────────────────────
   Verifies email + password and returns fresh tokens.          */
router.post('/login', loginRules, async (req, res) => {
  try {
    const { email, password } = req.body;

    /* Look up the user by email */
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    /* Compare the supplied password against the stored hash */
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const tokens = issueTokens(user.id);

    res.json({
      user: { id: user.id, email: user.email, name: user.name },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Something went wrong during login' });
  }
});

/* ── POST /api/auth/refresh ──────────────────────────────────
   Exchanges a valid refresh token for a new access token.
   The old refresh token is consumed and a new one is issued.   */
router.post('/refresh', (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }

    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    /* Find this refresh token in the database */
    const stored = db.prepare(`
      SELECT * FROM refresh_tokens WHERE token_hash = ?
    `).get(tokenHash);

    if (!stored) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    /* Check if it's expired */
    if (new Date(stored.expires_at) < new Date()) {
      db.prepare('DELETE FROM refresh_tokens WHERE id = ?').run(stored.id);
      return res.status(401).json({ error: 'Refresh token has expired — please log in again' });
    }

    /* Delete the old token (single-use) */
    db.prepare('DELETE FROM refresh_tokens WHERE id = ?').run(stored.id);

    /* Issue fresh tokens */
    const tokens = issueTokens(stored.user_id);

    res.json({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
  } catch (err) {
    console.error('Refresh error:', err);
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

/* ── GET /api/auth/me ────────────────────────────────────────
   Returns the currently logged-in user's profile.
   Requires a valid access token.                               */
router.get('/me', authenticate, (req, res) => {
  const user = db.prepare('SELECT id, email, name, created_at FROM users WHERE id = ?')
    .get(req.userId);

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({ user });
});

/* ── POST /api/auth/logout ───────────────────────────────────
   Deletes all refresh tokens for this user, forcing re-login.  */
router.post('/logout', authenticate, (req, res) => {
  db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').run(req.userId);
  res.json({ message: 'Logged out successfully' });
});

/* ── PATCH /api/auth/me ──────────────────────────────────────
   Updates the current user's display name.                    */
router.patch('/me', authenticate, updateProfileRules, (req, res) => {
  const { name } = req.body;

  db.prepare(`
    UPDATE users SET name = ?, updated_at = datetime('now') WHERE id = ?
  `).run(name, req.userId);

  const user = db.prepare('SELECT id, email, name, created_at FROM users WHERE id = ?')
    .get(req.userId);

  res.json({ user });
});

/* ── PATCH /api/auth/password ────────────────────────────────
   Changes the current user's password. Requires the current
   password so nobody can hijack an unattended session.        */
router.patch('/password', authenticate, changePasswordRules, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    db.prepare(`
      UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?
    `).run(newHash, req.userId);

    /* Invalidate all existing sessions so the new password takes
       effect everywhere immediately. */
    db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').run(req.userId);

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('Password change error:', err);
    res.status(500).json({ error: 'Something went wrong changing your password' });
  }
});

/* ── DELETE /api/auth/me ─────────────────────────────────────
   Permanently deletes the current user's account and all of
   their data (expenses, categories, projects, budgets cascade
   via foreign keys).                                          */
router.delete('/me', authenticate, (req, res) => {
  db.prepare('DELETE FROM users WHERE id = ?').run(req.userId);
  res.json({ message: 'Account deleted' });
});

/* ── POST /api/auth/forgot-password ──────────────────────────
   Generates a password reset token. There's no email service
   configured, so — unlike a production app — the token is
   returned directly in the response instead of being emailed.
   Always responds the same way whether or not the email
   exists, so callers can't use this to discover accounts.      */
router.post('/forgot-password', forgotPasswordRules, (req, res) => {
  const { email } = req.body;
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);

  if (!user) {
    return res.json({ message: 'If that email exists, a reset link has been generated.' });
  }

  const resetToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
  const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS).toISOString();

  db.prepare(`
    INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
    VALUES (?, ?, ?)
  `).run(user.id, tokenHash, expiresAt);

  res.json({
    message: 'If that email exists, a reset link has been generated.',
    /* Dev-mode only: in production this token would be emailed,
       never returned to the client. */
    devResetToken: resetToken,
  });
});

/* ── POST /api/auth/reset-password ───────────────────────────
   Exchanges a valid reset token for a new password.            */
router.post('/reset-password', resetPasswordRules, async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const stored = db.prepare(`
      SELECT * FROM password_reset_tokens WHERE token_hash = ?
    `).get(tokenHash);

    if (!stored || new Date(stored.expires_at) < new Date()) {
      if (stored) db.prepare('DELETE FROM password_reset_tokens WHERE id = ?').run(stored.id);
      return res.status(401).json({ error: 'Reset link is invalid or has expired' });
    }

    const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    db.prepare(`
      UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?
    `).run(newHash, stored.user_id);

    /* Single-use token + invalidate existing sessions */
    db.prepare('DELETE FROM password_reset_tokens WHERE id = ?').run(stored.id);
    db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').run(stored.user_id);

    res.json({ message: 'Password reset successfully — you can now log in' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Something went wrong resetting your password' });
  }
});

module.exports = router;
