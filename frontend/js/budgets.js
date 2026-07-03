/* ──────────────────────────────────────────────────────────────
   BUDGETS PAGE JAVASCRIPT
   Set a monthly limit per category and show progress against
   this month's actual spend (computed from real expense data).
   ────────────────────────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', async () => {

  if (!getAccessToken()) {
    window.location.href = 'login.html';
    return;
  }

  const user = getUser();
  const nameEl = document.getElementById('user-name');
  const initialEl = document.getElementById('avatar-initial');
  if (user) {
    if (nameEl) nameEl.textContent = user.name;
    if (initialEl) initialEl.textContent = (user.name || 'U').trim().charAt(0).toUpperCase();
  }

  async function doLogout() {
    await logout();
    window.location.href = 'index.html';
  }
  document.getElementById('logout-btn')?.addEventListener('click', doLogout);
  document.getElementById('menu-logout-btn')?.addEventListener('click', doLogout);

  const sidebar = document.getElementById('sidebar');
  const scrim = document.getElementById('sidebar-scrim');
  document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
    sidebar.classList.add('open');
    scrim.classList.add('open');
  });
  scrim?.addEventListener('click', () => {
    sidebar.classList.remove('open');
    scrim.classList.remove('open');
  });

  function closeAllDropdowns() {
    document.querySelectorAll('.dropdown-menu.open').forEach(m => m.classList.remove('open'));
  }
  document.getElementById('avatar-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const menu = document.getElementById('avatar-menu');
    const wasOpen = menu.classList.contains('open');
    closeAllDropdowns();
    if (!wasOpen) menu.classList.add('open');
  });
  document.getElementById('avatar-chevron')?.addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('avatar-btn')?.click();
  });
  document.addEventListener('click', closeAllDropdowns);

  let categories = [];
  let budgets = [];
  let expenses = [];

  const now = new Date();
  const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  try {
    [categories, budgets, expenses] = await Promise.all([getCategories(), getBudgets(), getExpenses()]);
    populateCategorySelect();
    renderList();
  } catch (err) {
    showToast('Failed to load budgets', 'error');
  }

  function spentThisMonth(categoryId) {
    return expenses
      .filter(e => e.date.startsWith(thisMonthKey) && e.category_id === categoryId)
      .reduce((s, e) => s + Number(e.amount), 0);
  }

  function populateCategorySelect() {
    const select = document.getElementById('budget-category');
    if (!select) return;
    const budgeted = new Set(budgets.map(b => b.category_id));
    const available = categories.filter(c => !budgeted.has(c.id));

    select.innerHTML = '<option value="">Select a category</option>' +
      available.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  }

  function renderList() {
    const list = document.getElementById('budget-list');
    if (!list) return;

    if (budgets.length === 0) {
      list.innerHTML = '<li class="empty-state">No budgets set yet — pick a category and a monthly limit.</li>';
      return;
    }

    list.innerHTML = budgets.map(b => {
      const spent = spentThisMonth(b.category_id);
      const pct = Math.min(100, Math.round((spent / b.monthly_limit) * 100));
      const over = spent > b.monthly_limit;

      return `
        <li class="budget-item" data-id="${b.id}">
          <div class="budget-item-header">
            <span class="budget-item-name">
              <span class="simple-list-dot" style="background:${b.category_color}"></span>
              ${escapeHtml(b.category_name)}
            </span>
            <span class="budget-item-amounts">$${spent.toFixed(2)} / $${Number(b.monthly_limit).toFixed(2)}</span>
          </div>
          <div class="budget-bar-track">
            <div class="budget-bar-fill ${over ? 'over-budget' : ''}" style="width:${pct}%"></div>
          </div>
          <div class="budget-item-footer">
            <span>${over ? `Over budget by $${(spent - b.monthly_limit).toFixed(2)}` : `${pct}% used`}</span>
            <div class="budget-item-actions">
              <button class="btn-icon edit-budget-btn" title="Edit limit" data-id="${b.id}">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button class="btn-icon delete-btn" title="Delete" data-id="${b.id}">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
              </button>
            </div>
          </div>
        </li>
      `;
    }).join('');

    list.querySelectorAll('.edit-budget-btn').forEach(btn => {
      btn.addEventListener('click', () => handleEdit(Number(btn.dataset.id)));
    });
    list.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', () => handleDelete(Number(btn.dataset.id)));
    });
  }

  document.getElementById('budget-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const categoryId = document.getElementById('budget-category').value;
    const limit = document.getElementById('budget-limit').value;

    if (!categoryId) {
      showToast('Pick a category first', 'error');
      return;
    }

    submitBtn.disabled = true;
    try {
      const created = await createBudget({ category_id: Number(categoryId), monthly_limit: parseFloat(limit) });
      budgets.push(created);
      populateCategorySelect();
      renderList();
      e.target.reset();
      showToast('Budget set');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      submitBtn.disabled = false;
    }
  });

  async function handleEdit(id) {
    const budget = budgets.find(b => b.id === id);
    if (!budget) return;
    const next = prompt(`New monthly limit for ${budget.category_name}:`, budget.monthly_limit);
    if (next === null) return;
    const parsed = parseFloat(next);
    if (!parsed || parsed <= 0) {
      showToast('Enter a valid positive amount', 'error');
      return;
    }
    try {
      const updated = await updateBudget(id, parsed);
      budgets = budgets.map(b => b.id === id ? updated : b);
      renderList();
      showToast('Budget updated');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function handleDelete(id) {
    if (!confirm('Remove this budget?')) return;
    try {
      await deleteBudget(id);
      budgets = budgets.filter(b => b.id !== id);
      populateCategorySelect();
      renderList();
      showToast('Budget removed');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
});
