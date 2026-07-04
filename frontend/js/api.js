/* ──────────────────────────────────────────────────────────────
   API CLIENT
   A small helper that handles all communication with the
   backend.  It automatically attaches the auth token to every
   request and refreshes it when it expires.
   ────────────────────────────────────────────────────────────── */

const API_BASE = 'https://montraq-api-hdhe.onrender.com/api';

/* ── Token management ────────────────────────────────────────
   Tokens are stored in localStorage so they survive page
   refreshes.  (For a real production app you'd want the
   refresh token in an httpOnly cookie instead.)                */

function getAccessToken() {
  return localStorage.getItem('montraq_access_token');
}

function getRefreshToken() {
  return localStorage.getItem('montraq_refresh_token');
}

function saveTokens(accessToken, refreshToken) {
  localStorage.setItem('montraq_access_token', accessToken);
  localStorage.setItem('montraq_refresh_token', refreshToken);
}

function clearTokens() {
  localStorage.removeItem('montraq_access_token');
  localStorage.removeItem('montraq_refresh_token');
  localStorage.removeItem('montraq_user');
}

function saveUser(user) {
  localStorage.setItem('montraq_user', JSON.stringify(user));
}

function getUser() {
  const raw = localStorage.getItem('montraq_user');
  return raw ? JSON.parse(raw) : null;
}

/* ── Core fetch wrapper ──────────────────────────────────────
   Sends a request to the API with the right headers.
   If the access token has expired, it tries to refresh it
   once before giving up.                                       */

async function apiFetch(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  /* Attach the access token if we have one */
  const token = getAccessToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response = await fetch(url, { ...options, headers });

  /* If we got a 401, try refreshing the token and retrying */
  if (response.status === 401 && getRefreshToken()) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      headers['Authorization'] = `Bearer ${getAccessToken()}`;
      response = await fetch(url, { ...options, headers });
    }
  }

  return response;
}

/* ── Token refresh ───────────────────────────────────────────
   Sends the refresh token to get a new access token.
   Returns true if it worked, false if the user needs to
   log in again.

   Refresh tokens are single-use, so if several requests 401
   at the same time (e.g. the dashboard's Promise.all on load)
   they must NOT each call this independently — only the first
   refresh would succeed and the others would wipe out its
   result by calling clearTokens(). Sharing one in-flight
   promise means every caller waits for, and agrees on, the
   same outcome.                                                */

let refreshPromise = null;

async function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: getRefreshToken() }),
      });

      if (!response.ok) {
        clearTokens();
        return false;
      }

      const data = await response.json();
      saveTokens(data.accessToken, data.refreshToken);
      return true;
    } catch {
      clearTokens();
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/* ── Auth API calls ──────────────────────────────────────────*/

async function signup(email, name, password) {
  const res = await fetch(`${API_BASE}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, name, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.errors?.[0] || 'Signup failed');
  saveTokens(data.accessToken, data.refreshToken);
  saveUser(data.user);
  return data;
}

async function login(email, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.errors?.[0] || 'Login failed');
  saveTokens(data.accessToken, data.refreshToken);
  saveUser(data.user);
  return data;
}

async function logout() {
  try {
    await apiFetch('/auth/logout', { method: 'POST' });
  } catch { /* ignore — we're clearing locally either way */ }
  clearTokens();
}

async function updateProfile(name) {
  const res = await apiFetch('/auth/me', {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.errors?.[0] || 'Failed to update profile');
  saveUser(data.user);
  return data.user;
}

async function changePassword(currentPassword, newPassword) {
  const res = await apiFetch('/auth/password', {
    method: 'PATCH',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.errors?.[0] || 'Failed to change password');
  return data;
}

async function deleteAccount() {
  const res = await apiFetch('/auth/me', { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete account');
  clearTokens();
}

async function forgotPassword(email) {
  const res = await fetch(`${API_BASE}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.errors?.[0] || 'Request failed');
  return data;
}

async function resetPassword(token, newPassword) {
  const res = await fetch(`${API_BASE}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, newPassword }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.errors?.[0] || 'Reset failed');
  return data;
}

/* ── Expense API calls ───────────────────────────────────────*/

async function getExpenses() {
  const res = await apiFetch('/expenses');
  if (!res.ok) throw new Error('Failed to load expenses');
  return (await res.json()).expenses;
}

async function getExpenseSummary() {
  const res = await apiFetch('/expenses/summary');
  if (!res.ok) throw new Error('Failed to load summary');
  return await res.json();
}

async function createExpense(expense) {
  const res = await apiFetch('/expenses', {
    method: 'POST',
    body: JSON.stringify(expense),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.errors?.[0] || 'Failed to create expense');
  return data.expense;
}

async function updateExpense(id, expense) {
  const res = await apiFetch(`/expenses/${id}`, {
    method: 'PUT',
    body: JSON.stringify(expense),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.errors?.[0] || 'Failed to update expense');
  return data.expense;
}

async function deleteExpense(id) {
  const res = await apiFetch(`/expenses/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete expense');
}

/* ── Category & Project API calls ────────────────────────────*/

async function getCategories() {
  const res = await apiFetch('/categories');
  if (!res.ok) throw new Error('Failed to load categories');
  return (await res.json()).categories;
}

async function getProjects() {
  const res = await apiFetch('/projects');
  if (!res.ok) throw new Error('Failed to load projects');
  return (await res.json()).projects;
}

async function createCategory(category) {
  const res = await apiFetch('/categories', {
    method: 'POST',
    body: JSON.stringify(category),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.errors?.[0] || 'Failed to create category');
  return data.category;
}

async function createProject(project) {
  const res = await apiFetch('/projects', {
    method: 'POST',
    body: JSON.stringify(project),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.errors?.[0] || 'Failed to create project');
  return data.project;
}

async function updateCategory(id, category) {
  const res = await apiFetch(`/categories/${id}`, {
    method: 'PUT',
    body: JSON.stringify(category),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.errors?.[0] || 'Failed to update category');
  return data.category;
}

async function deleteCategory(id) {
  const res = await apiFetch(`/categories/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete category');
}

async function updateProject(id, project) {
  const res = await apiFetch(`/projects/${id}`, {
    method: 'PUT',
    body: JSON.stringify(project),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.errors?.[0] || 'Failed to update project');
  return data.project;
}

async function deleteProject(id) {
  const res = await apiFetch(`/projects/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete project');
}

/* ── Budget API calls ─────────────────────────────────────────*/

async function getBudgets() {
  const res = await apiFetch('/budgets');
  if (!res.ok) throw new Error('Failed to load budgets');
  return (await res.json()).budgets;
}

async function createBudget(budget) {
  const res = await apiFetch('/budgets', {
    method: 'POST',
    body: JSON.stringify(budget),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.errors?.[0] || 'Failed to create budget');
  return data.budget;
}

async function updateBudget(id, monthly_limit) {
  const res = await apiFetch(`/budgets/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ monthly_limit }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.errors?.[0] || 'Failed to update budget');
  return data.budget;
}

async function deleteBudget(id) {
  const res = await apiFetch(`/budgets/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete budget');
}

/* ── Receipt API calls ────────────────────────────────────────*/

async function scanReceipt(file) {
  const formData = new FormData();
  formData.append('receipt', file);

  const token = getAccessToken();
  const res = await fetch(`${API_BASE}/receipts/scan`, {
    method: 'POST',
    headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to process receipt');
  return data;
}

/* ── Stripe API calls ─────────────────────────────────────────*/

async function createCheckoutSession(plan) {
  const res = await apiFetch('/stripe/checkout', {
    method: 'POST',
    body: JSON.stringify({ plan }),
  });
  return res;
}

async function createPortalSession() {
  const res = await apiFetch('/stripe/portal', { method: 'POST' });
  return res;
}

async function getSubscriptionStatus() {
  const res = await apiFetch('/stripe/status');
  return res;
}
