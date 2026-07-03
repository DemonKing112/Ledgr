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

const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000;
const SALT_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

async function issueTokens(userId) {
  const accessToken = jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );

  const refreshToken = crypto.randomBytes(40).toString('hex');
  const refreshHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS).toISOString();

  await db.query(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
    [userId, refreshHash, expiresAt]
  );

  return { accessToken, refreshToken };
}

router.post('/signup', signupRules, async (req, res) => {
  try {
    const { email, name, password } = req.body;

    const { rows: existing } = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const { rows } = await db.query(
      'INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING id',
      [email, name, passwordHash]
    );
    const userId = rows[0].id;

    const defaultCategories = [
      { name: 'Software', color: '#8B5CF6', icon: 'monitor' },
      { name: 'Travel', color: '#F59E0B', icon: 'plane' },
      { name: 'Office Supplies', color: '#10B981', icon: 'briefcase' },
      { name: 'Meals', color: '#EF4444', icon: 'utensils' },
      { name: 'Marketing', color: '#3B82F6', icon: 'megaphone' },
    ];
    for (const cat of defaultCategories) {
      await db.query(
        'INSERT INTO categories (user_id, name, color, icon) VALUES ($1, $2, $3, $4)',
        [userId, cat.name, cat.color, cat.icon]
      );
    }

    const tokens = await issueTokens(userId);

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

router.post('/login', loginRules, async (req, res) => {
  try {
    const { email, password } = req.body;

    const { rows } = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = rows[0];
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const tokens = await issueTokens(user.id);

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

router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }

    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    const { rows } = await db.query(
      'SELECT * FROM refresh_tokens WHERE token_hash = $1', [tokenHash]
    );
    const stored = rows[0];

    if (!stored) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    if (new Date(stored.expires_at) < new Date()) {
      await db.query('DELETE FROM refresh_tokens WHERE id = $1', [stored.id]);
      return res.status(401).json({ error: 'Refresh token has expired — please log in again' });
    }

    await db.query('DELETE FROM refresh_tokens WHERE id = $1', [stored.id]);

    const tokens = await issueTokens(stored.user_id);

    res.json({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
  } catch (err) {
    console.error('Refresh error:', err);
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

router.get('/me', authenticate, async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT id, email, name, created_at FROM users WHERE id = $1', [req.userId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user: rows[0] });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

router.post('/logout', authenticate, async (req, res) => {
  try {
    await db.query('DELETE FROM refresh_tokens WHERE user_id = $1', [req.userId]);
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

router.patch('/me', authenticate, updateProfileRules, async (req, res) => {
  try {
    const { name } = req.body;
    await db.query(
      'UPDATE users SET name = $1, updated_at = NOW() WHERE id = $2',
      [name, req.userId]
    );
    const { rows } = await db.query(
      'SELECT id, email, name, created_at FROM users WHERE id = $1', [req.userId]
    );
    res.json({ user: rows[0] });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

router.patch('/password', authenticate, changePasswordRules, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const { rows } = await db.query('SELECT * FROM users WHERE id = $1', [req.userId]);
    const user = rows[0];
    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await db.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [newHash, req.userId]
    );
    await db.query('DELETE FROM refresh_tokens WHERE user_id = $1', [req.userId]);

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('Password change error:', err);
    res.status(500).json({ error: 'Something went wrong changing your password' });
  }
});

router.delete('/me', authenticate, async (req, res) => {
  try {
    await db.query('DELETE FROM users WHERE id = $1', [req.userId]);
    res.json({ message: 'Account deleted' });
  } catch (err) {
    console.error('Delete account error:', err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

router.post('/forgot-password', forgotPasswordRules, async (req, res) => {
  try {
    const { email } = req.body;
    const { rows } = await db.query('SELECT id FROM users WHERE email = $1', [email]);

    if (rows.length === 0) {
      return res.json({ message: 'If that email exists, a reset link has been generated.' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS).toISOString();

    await db.query(
      'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [rows[0].id, tokenHash, expiresAt]
    );

    res.json({
      message: 'If that email exists, a reset link has been generated.',
      devResetToken: resetToken,
    });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

router.post('/reset-password', resetPasswordRules, async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const { rows } = await db.query(
      'SELECT * FROM password_reset_tokens WHERE token_hash = $1', [tokenHash]
    );
    const stored = rows[0];

    if (!stored || new Date(stored.expires_at) < new Date()) {
      if (stored) await db.query('DELETE FROM password_reset_tokens WHERE id = $1', [stored.id]);
      return res.status(401).json({ error: 'Reset link is invalid or has expired' });
    }

    const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await db.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [newHash, stored.user_id]
    );

    await db.query('DELETE FROM password_reset_tokens WHERE id = $1', [stored.id]);
    await db.query('DELETE FROM refresh_tokens WHERE user_id = $1', [stored.user_id]);

    res.json({ message: 'Password reset successfully — you can now log in' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Something went wrong resetting your password' });
  }
});

module.exports = router;
