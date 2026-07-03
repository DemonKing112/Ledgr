const request = require('supertest');

if (!process.env.DATABASE_URL) {
  const path = require('path');
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
}
process.env.JWT_SECRET = 'test-secret-not-for-production';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-not-for-production';
process.env.FRONTEND_URL = 'http://localhost:5500';

const app = require('../server');
const db = require('../db/schema');

let accessToken;
let refreshToken;
let expenseId;

beforeAll(async () => {
  await app.dbReady;
  await db.query("DELETE FROM expenses WHERE user_id IN (SELECT id FROM users WHERE email = 'test@example.com')");
  await db.query("DELETE FROM budgets WHERE user_id IN (SELECT id FROM users WHERE email = 'test@example.com')");
  await db.query("DELETE FROM categories WHERE user_id IN (SELECT id FROM users WHERE email = 'test@example.com')");
  await db.query("DELETE FROM projects WHERE user_id IN (SELECT id FROM users WHERE email = 'test@example.com')");
  await db.query("DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE email = 'test@example.com')");
  await db.query("DELETE FROM password_reset_tokens WHERE user_id IN (SELECT id FROM users WHERE email = 'test@example.com')");
  await db.query("DELETE FROM users WHERE email = 'test@example.com'");
}, 30000);

afterAll(async () => {
  await db.query("DELETE FROM expenses WHERE user_id IN (SELECT id FROM users WHERE email = 'test@example.com')");
  await db.query("DELETE FROM budgets WHERE user_id IN (SELECT id FROM users WHERE email = 'test@example.com')");
  await db.query("DELETE FROM categories WHERE user_id IN (SELECT id FROM users WHERE email = 'test@example.com')");
  await db.query("DELETE FROM projects WHERE user_id IN (SELECT id FROM users WHERE email = 'test@example.com')");
  await db.query("DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE email = 'test@example.com')");
  await db.query("DELETE FROM password_reset_tokens WHERE user_id IN (SELECT id FROM users WHERE email = 'test@example.com')");
  await db.query("DELETE FROM users WHERE email = 'test@example.com'");
  await db.end();
}, 30000);

describe('Auth', () => {
  test('POST /api/auth/signup — creates a new user', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'test@example.com', name: 'Test User', password: 'securepass123' });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('test@example.com');
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();

    accessToken = res.body.accessToken;
    refreshToken = res.body.refreshToken;
  });

  test('POST /api/auth/signup — rejects duplicate email', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'test@example.com', name: 'Dupe', password: 'securepass123' });

    expect(res.status).toBe(409);
  });

  test('POST /api/auth/signup — rejects weak password', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'weak@example.com', name: 'Weak', password: 'short' });

    expect(res.status).toBe(400);
  });

  test('POST /api/auth/login — returns tokens for valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'securepass123' });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    accessToken = res.body.accessToken;
    refreshToken = res.body.refreshToken;
  });

  test('POST /api/auth/login — rejects wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'wrongpassword' });

    expect(res.status).toBe(401);
  });

  test('POST /api/auth/refresh — issues new tokens', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    accessToken = res.body.accessToken;
    refreshToken = res.body.refreshToken;
  });

  test('GET /api/auth/me — returns current user', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('test@example.com');
  });

  test('GET /api/auth/me — rejects missing token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});

describe('Expenses', () => {
  test('POST /api/expenses — creates an expense', async () => {
    const res = await request(app)
      .post('/api/expenses')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        amount: 49.99,
        description: 'Test expense',
        date: '2025-06-15',
      });

    expect(res.status).toBe(201);
    expect(parseFloat(res.body.expense.amount)).toBe(49.99);
    expenseId = res.body.expense.id;
  });

  test('POST /api/expenses — rejects invalid data', async () => {
    const res = await request(app)
      .post('/api/expenses')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ amount: -5, description: '', date: 'not-a-date' });

    expect(res.status).toBe(400);
  });

  test('GET /api/expenses — lists user expenses', async () => {
    const res = await request(app)
      .get('/api/expenses')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.expenses)).toBe(true);
    expect(res.body.expenses.length).toBeGreaterThan(0);
  });

  test('PUT /api/expenses/:id — updates an expense', async () => {
    const res = await request(app)
      .put(`/api/expenses/${expenseId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        amount: 75.00,
        description: 'Updated test expense',
        date: '2025-06-20',
      });

    expect(res.status).toBe(200);
    expect(parseFloat(res.body.expense.amount)).toBe(75);
  });

  test('DELETE /api/expenses/:id — deletes an expense', async () => {
    const res = await request(app)
      .delete(`/api/expenses/${expenseId}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
  });

  test('DELETE /api/expenses/:id — 404 for already deleted', async () => {
    const res = await request(app)
      .delete(`/api/expenses/${expenseId}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(404);
  });

  test('GET /api/expenses — rejects unauthenticated request', async () => {
    const res = await request(app).get('/api/expenses');
    expect(res.status).toBe(401);
  });
});

describe('Health', () => {
  test('GET /api/health — returns ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
