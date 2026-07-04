/* ──────────────────────────────────────────────────────────────
   REPORTS PAGE JAVASCRIPT
   Full category breakdown, month-over-month trend, and biggest
   expenses — computed client-side from real expense data.
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
  document.getElementById('report-period-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const menu = document.getElementById('report-period-menu');
    const wasOpen = menu.classList.contains('open');
    closeAllDropdowns();
    if (!wasOpen) menu.classList.add('open');
  });
  document.addEventListener('click', closeAllDropdowns);

  let allExpenses = [];
  let period = 'all-time';

  const now = new Date();
  const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthKey = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;

  const PALETTE = ['#3F5D42', '#C99A3E', '#6D5BD0', '#5C8AC9', '#C44536'];

  document.querySelectorAll('#report-period-menu .dropdown-item').forEach(item => {
    item.addEventListener('click', () => {
      period = item.dataset.period;
      document.querySelectorAll('#report-period-menu .dropdown-item').forEach(i => i.classList.toggle('active', i === item));
      document.getElementById('report-period-label').textContent = item.textContent;
      render();
    });
  });

  try {
    allExpenses = await getExpenses();
    render();
  } catch (err) {
    showToast('Failed to load expenses', 'error');
  }

  function expensesForPeriod() {
    if (period === 'all-time') return allExpenses;
    const key = period === 'last-month' ? lastMonthKey : thisMonthKey;
    return allExpenses.filter(e => e.date.startsWith(key));
  }

  function render() {
    const current = expensesForPeriod();
    renderSummary(current);
    renderCategoryBreakdown(current);
    renderTrend();
    renderBiggest(current);
  }

  function renderSummary(current) {
    const total = current.reduce((s, e) => s + Number(e.amount), 0);
    document.getElementById('report-total').textContent = formatMoney(total);
    document.getElementById('report-count').textContent = current.length;
    document.getElementById('report-average').textContent = formatMoney(current.length ? total / current.length : 0);
  }

  function renderCategoryBreakdown(current) {
    const listEl = document.getElementById('report-category-list');
    if (!listEl) return;

    const byCategory = {};
    current.forEach(e => {
      const name = e.category_name || 'Uncategorized';
      byCategory[name] = (byCategory[name] || 0) + Number(e.amount);
    });

    const entries = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
    const total = entries.reduce((s, [, v]) => s + v, 0);

    if (entries.length === 0) {
      listEl.innerHTML = '<li class="empty-state">No expenses in this period</li>';
      return;
    }

    listEl.innerHTML = entries.map(([name, value], i) => `
      <li>
        <span class="legend-name">
          <span class="legend-dot" style="background:${PALETTE[i % PALETTE.length]}"></span>
          ${escapeHtml(name)}
        </span>
        <span>${formatMoney(value)} · ${Math.round((value / total) * 100)}%</span>
      </li>
    `).join('');
  }

  function renderTrend() {
    const trendEl = document.getElementById('report-trend-list');
    if (!trendEl) return;

    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        label: d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      });
    }

    const totals = months.map(m => allExpenses
      .filter(e => e.date.startsWith(m.key))
      .reduce((s, e) => s + Number(e.amount), 0));
    const max = Math.max(...totals, 1);

    trendEl.innerHTML = months.map((m, i) => `
      <div class="report-trend-row">
        <span>${m.label}</span>
        <div class="budget-bar-track" style="flex:1; margin: 0 12px;">
          <div class="budget-bar-fill" style="width:${Math.round((totals[i] / max) * 100)}%"></div>
        </div>
        <span>${formatMoney(totals[i])}</span>
      </div>
    `).join('');
  }

  function renderBiggest(current) {
    const tbody = document.getElementById('report-biggest-tbody');
    if (!tbody) return;

    const biggest = [...current].sort((a, b) => Number(b.amount) - Number(a.amount)).slice(0, 10);

    if (biggest.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No expenses in this period</td></tr>';
      return;
    }

    tbody.innerHTML = biggest.map(e => `
      <tr>
        <td>${formatDate(e.date)}</td>
        <td>${escapeHtml(e.description)}</td>
        <td>
          <span class="cat-pill" style="background:${e.category_color || '#8A8577'}20; color:${e.category_color || '#8A8577'}">
            ${escapeHtml(e.category_name || 'Uncategorized')}
          </span>
        </td>
        <td class="amount-cell">$${Number(e.amount).toFixed(2)}</td>
      </tr>
    `).join('');
  }

  function formatMoney(n) { return `$${Number(n).toFixed(2)}`; }

  function formatDate(dateStr) {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
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

  document.getElementById('export-csv-btn')?.addEventListener('click', () => {
    const current = expensesForPeriod();
    if (current.length === 0) { showToast('No expenses to export', 'error'); return; }
    const header = 'Date,Description,Category,Project,Amount';
    const rows = current.map(e =>
      [e.date, `"${(e.description || '').replace(/"/g, '""')}"`, e.category_name || '', e.project_name || '', Number(e.amount).toFixed(2)].join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `montraq-expenses-${period}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('CSV exported');
  });

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
});
