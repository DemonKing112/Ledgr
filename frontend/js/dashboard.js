/* ──────────────────────────────────────────────────────────────
   DASHBOARD JAVASCRIPT
   Loads all expenses, derives period-based stats, and renders
   the overview: stat cards, category donut + legend, recent
   expenses table, and the insight banner. Also wires up the
   date-range filter, category filter, avatar menu, and the
   full-report / insights modals.
   ────────────────────────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', async () => {

  /* ── Auth guard — redirect to login if not signed in ──────── */
  if (!getAccessToken()) {
    window.location.href = 'login.html';
    return;
  }

  /* Show the user's name + avatar initial in the top bar */
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

  /* ── Sidebar toggle (mobile) ────────────────────────────────── */
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

  /* ── Stubbed nav items — not built yet, show a toast instead ─ */
  document.querySelectorAll('[data-stub]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      closeAllDropdowns();
      showToast(`${el.dataset.stub} is coming soon`, 'success');
    });
  });

  /* ── Generic dropdown handling ──────────────────────────────
     Each dropdown-wrap has one trigger button and one
     .dropdown-menu. Clicking the trigger toggles it; clicking
     outside or pressing Escape closes all of them.             */
  function closeAllDropdowns() {
    document.querySelectorAll('.dropdown-menu.open').forEach(m => m.classList.remove('open'));
  }

  document.getElementById('date-range-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const menu = document.getElementById('date-range-menu');
    const wasOpen = menu.classList.contains('open');
    closeAllDropdowns();
    if (!wasOpen) menu.classList.add('open');
  });

  document.getElementById('category-filter-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const menu = document.getElementById('category-filter-menu');
    const wasOpen = menu.classList.contains('open');
    closeAllDropdowns();
    if (!wasOpen) menu.classList.add('open');
  });

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
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeAllDropdowns(); closeAllModals(); }
  });

  /* ── Modal handling ──────────────────────────────────────────── */
  function openModal(id) {
    document.getElementById(id)?.classList.add('open');
  }
  function closeAllModals() {
    document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
  }
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeAllModals();
    });
  });
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', closeAllModals);
  });

  /* ── State ─────────────────────────────────────────────────── */
  let allExpenses = [];
  let categories = [];
  let period = 'this-month';   // 'this-month' | 'last-month' | 'all-time'
  let categoryFilter = '';     // '' means all categories
  const PALETTE = ['#3F5D42', '#C99A3E', '#6D5BD0', '#5C8AC9', '#C44536'];
  let chart = null;
  let lastCategoryEntries = [];

  const now = new Date();
  const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthKey = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;

  const PERIOD_LABELS = {
    'this-month': now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    'last-month': lastMonthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    'all-time': 'All Time',
  };

  /* ── Date range dropdown selection ──────────────────────────── */
  document.querySelectorAll('#date-range-menu .dropdown-item').forEach(item => {
    item.addEventListener('click', () => {
      period = item.dataset.period;
      document.querySelectorAll('#date-range-menu .dropdown-item').forEach(i => i.classList.toggle('active', i === item));
      document.getElementById('date-range-label').textContent = PERIOD_LABELS[period];
      render();
    });
  });

  /* ── Load data from the API ─────────────────────────────────── */
  try {
    [allExpenses, categories] = await Promise.all([getExpenses(), getCategories()]);
    populateCategoryFilter();
    render();
  } catch (err) {
    if (err.message.includes('401') || err.message.includes('Authentication')) {
      clearTokens();
      window.location.href = 'login.html';
      return;
    }
    showToast('Failed to load data — check your connection', 'error');
  }

  /* Re-fetch if the page is restored from the browser's
     back/forward cache, so data never goes stale silently. */
  window.addEventListener('pageshow', async (e) => {
    if (!e.persisted) return;
    try {
      allExpenses = await getExpenses();
      render();
    } catch { /* non-critical on a bfcache restore */ }
  });

  function populateCategoryFilter() {
    const menu = document.getElementById('category-filter-menu');
    if (!menu) return;
    menu.innerHTML = '<button class="dropdown-item active" data-category="">All Categories</button>' +
      categories.map(c => `<button class="dropdown-item" data-category="${c.id}">${escapeHtml(c.name)}</button>`).join('');

    menu.querySelectorAll('.dropdown-item').forEach(item => {
      item.addEventListener('click', () => {
        categoryFilter = item.dataset.category;
        menu.querySelectorAll('.dropdown-item').forEach(i => i.classList.toggle('active', i === item));
        document.getElementById('category-filter-label').textContent = item.textContent;
        render();
      });
    });
  }

  /* ── Period filtering ───────────────────────────────────────── */
  function expensesForPeriod() {
    if (period === 'all-time') return allExpenses;
    const key = period === 'last-month' ? lastMonthKey : thisMonthKey;
    return allExpenses.filter(e => e.date.startsWith(key));
  }

  function comparisonExpenses() {
    /* The "vs" period used for delta chips — only meaningful for
       This Month (vs last month). Other views hide the delta. */
    if (period === 'this-month') return allExpenses.filter(e => e.date.startsWith(lastMonthKey));
    if (period === 'last-month') {
      const prev = new Date(lastMonthDate.getFullYear(), lastMonthDate.getMonth() - 1, 1);
      const prevKey = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
      return allExpenses.filter(e => e.date.startsWith(prevKey));
    }
    return [];
  }

  function render() {
    const current = expensesForPeriod();
    const comparison = comparisonExpenses();

    renderStats(current, comparison);
    renderCategoryChart(current);
    renderRecentExpenses(current);
    renderInsight(current, comparison);
  }

  /* ── Stat cards ─────────────────────────────────────────────── */
  function renderStats(current, comparison) {
    const totalCurrent = sum(current);
    const totalComparison = sum(comparison);
    const showDelta = period !== 'all-time';

    const daysInPeriod = period === 'this-month'
      ? now.getDate()
      : new Date(lastMonthDate.getFullYear(), lastMonthDate.getMonth() + 1, 0).getDate();
    const avgCurrent = period === 'all-time'
      ? (current.length ? totalCurrent / uniqueDayCount(current) : 0)
      : (daysInPeriod ? totalCurrent / daysInPeriod : 0);
    const avgComparison = comparison.length ? totalComparison / uniqueDayCount(comparison) : 0;

    const subLabel = period === 'all-time' ? 'All Time' : PERIOD_LABELS[period];
    document.getElementById('stat-total-spent-sub').textContent = subLabel;

    setText('stat-total-spent', formatMoney(totalCurrent));
    setChip('stat-total-spent-chip', showDelta ? percentChange(totalCurrent, totalComparison) : { text: '—', up: true }, showDelta);

    setText('stat-avg-daily', formatMoney(avgCurrent));
    setChip('stat-avg-daily-chip', showDelta ? percentChange(avgCurrent, avgComparison) : { text: '—', up: true }, showDelta);

    setText('stat-total-count', String(current.length));
    setChip('stat-total-count-chip', showDelta ? percentChange(current.length, comparison.length) : { text: '—', up: true }, showDelta);

    const largest = [...current].sort((a, b) => Number(b.amount) - Number(a.amount))[0];
    if (largest) {
      setText('stat-largest-amount', formatMoney(Number(largest.amount)));
      setText('stat-largest-desc', largest.description);
      setText('stat-largest-date', formatDate(largest.date));
    } else {
      setText('stat-largest-amount', '$0.00');
      setText('stat-largest-desc', 'No expenses yet');
      setText('stat-largest-date', '—');
    }
  }

  function uniqueDayCount(list) {
    return new Set(list.map(e => e.date)).size || 1;
  }

  function percentChange(current, previous) {
    if (!previous) return current > 0 ? { text: 'New', up: true } : { text: '—', up: true };
    const pct = ((current - previous) / previous) * 100;
    return { text: `${pct >= 0 ? '↗' : '↘'} ${Math.abs(pct).toFixed(1)}%`, up: pct >= 0 };
  }

  function setChip(id, change, showDelta) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = change.text;
    el.classList.toggle('stat-chip-red', showDelta && !change.up);
    const label = el.parentElement?.querySelector('.stat-delta-label');
    if (label) label.style.display = showDelta ? '' : 'none';
  }

  /* ── Category donut + legend ────────────────────────────────── */
  function renderCategoryChart(current) {
    const canvas = document.getElementById('category-chart');
    const legendEl = document.getElementById('chart-legend');
    if (!canvas) return;

    const filtered = categoryFilter
      ? current.filter(e => String(e.category_id) === categoryFilter)
      : current;

    const byCategory = {};
    filtered.forEach(e => {
      const name = e.category_name || 'Uncategorized';
      byCategory[name] = (byCategory[name] || 0) + Number(e.amount);
    });

    let entries = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
    lastCategoryEntries = entries;

    let displayEntries = entries;
    if (displayEntries.length > 5) {
      const top = displayEntries.slice(0, 4);
      const otherTotal = displayEntries.slice(4).reduce((s, [, v]) => s + v, 0);
      displayEntries = [...top, ['Others', otherTotal]];
    }

    const total = displayEntries.reduce((s, [, v]) => s + v, 0);
    const labels = displayEntries.map(([name]) => name);
    const data = displayEntries.map(([, v]) => v);
    const colors = displayEntries.map((_, i) => PALETTE[i % PALETTE.length]);

    if (chart) chart.destroy();

    if (total === 0) {
      if (legendEl) legendEl.innerHTML = '<li class="empty-state">No expenses in this period</li>';
      return;
    }

    chart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors,
          borderWidth: 2,
          borderColor: '#ffffff',
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.label}: ${formatMoney(ctx.parsed)}`,
            },
          },
          datalabels: {
            color: '#fff',
            font: { weight: '700', size: 13 },
            formatter: (value) => `${Math.round((value / total) * 100)}%`,
          },
        },
      },
      plugins: window.ChartDataLabels ? [window.ChartDataLabels] : [],
    });

    if (legendEl) {
      legendEl.innerHTML = displayEntries.map(([name, value], i) => `
        <li>
          <span class="legend-name">
            <span class="legend-dot" style="background:${colors[i]}"></span>
            ${escapeHtml(name)}
          </span>
          <span class="legend-amount">${formatMoney(value)}</span>
        </li>
      `).join('');
    }
  }

  /* ── Recent expenses table ──────────────────────────────────── */
  function renderRecentExpenses(current) {
    const tbody = document.getElementById('recent-tbody');
    const showingLabel = document.getElementById('recent-showing-label');
    if (!tbody) return;

    const filtered = categoryFilter
      ? current.filter(e => String(e.category_id) === categoryFilter)
      : current;
    const recent = filtered.slice(0, 5);

    if (showingLabel) {
      showingLabel.textContent = `Showing ${recent.length} of ${filtered.length} expense${filtered.length !== 1 ? 's' : ''}`;
    }

    if (recent.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-state">No expenses in this period — add one on the Expenses page.</td></tr>`;
      return;
    }

    tbody.innerHTML = recent.map(exp => `
      <tr data-id="${exp.id}">
        <td>${formatDate(exp.date)}</td>
        <td>${escapeHtml(exp.description)}</td>
        <td>
          <span class="cat-pill" style="background:${exp.category_color || '#8A8577'}20; color:${exp.category_color || '#8A8577'}">
            ${escapeHtml(exp.category_name || 'Uncategorized')}
          </span>
        </td>
        <td class="amount-cell">$${Number(exp.amount).toFixed(2)}</td>
        <td>
          <div class="row-actions">
            <a class="btn-icon edit-btn" title="Edit" href="expenses.html?edit=${exp.id}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </a>
            <button class="btn-icon delete-btn" title="Delete" data-id="${exp.id}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', () => handleDelete(Number(btn.dataset.id)));
    });
  }

  async function handleDelete(id) {
    if (!confirm('Delete this expense? This cannot be undone.')) return;
    try {
      await deleteExpense(id);
      allExpenses = allExpenses.filter(e => e.id !== id);
      render();
      showToast('Expense deleted');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  /* ── Insight banner ─────────────────────────────────────────── */
  function renderInsight(current, comparison) {
    const titleEl = document.getElementById('insight-title');
    const descEl = document.getElementById('insight-desc');
    if (!titleEl || !descEl) return;

    const totalCurrent = sum(current);
    const totalComparison = sum(comparison);

    if (period === 'all-time' || !totalComparison) {
      titleEl.textContent = current.length ? 'Here\'s the big picture' : 'Welcome!';
      descEl.textContent = current.length
        ? `You've logged ${current.length} expense${current.length !== 1 ? 's' : ''} totaling ${formatMoney(totalCurrent)}.`
        : 'Add a few expenses to start seeing personalized spending insights here.';
      return;
    }

    const pct = ((totalCurrent - totalComparison) / totalComparison) * 100;
    if (pct <= 0) {
      titleEl.textContent = "You're on track!";
      descEl.textContent = `You've spent ${Math.abs(pct).toFixed(1)}% less compared to last month. Keep it up! 🎉`;
    } else {
      titleEl.textContent = 'Heads up!';
      descEl.textContent = `You've spent ${pct.toFixed(1)}% more compared to last month.`;
    }
  }

  /* ── View Full Report modal ─────────────────────────────────── */
  document.getElementById('view-report-btn')?.addEventListener('click', () => {
    const listEl = document.getElementById('report-modal-list');
    if (!listEl) return;

    if (lastCategoryEntries.length === 0) {
      listEl.innerHTML = '<li class="empty-state">No expenses in this period yet</li>';
    } else {
      const total = lastCategoryEntries.reduce((s, [, v]) => s + v, 0);
      listEl.innerHTML = lastCategoryEntries.map(([name, value], i) => `
        <li>
          <span class="legend-name">
            <span class="legend-dot" style="background:${PALETTE[i % PALETTE.length]}"></span>
            ${escapeHtml(name)}
          </span>
          <span>${formatMoney(value)} · ${Math.round((value / total) * 100)}%</span>
        </li>
      `).join('');
    }
    openModal('report-modal');
  });

  /* ── View Insights modal ────────────────────────────────────── */
  document.getElementById('view-insights-btn')?.addEventListener('click', () => {
    const bodyEl = document.getElementById('insights-modal-body');
    if (!bodyEl) return;

    const current = expensesForPeriod();
    const total = sum(current);
    const topCategory = lastCategoryEntries[0];
    const largest = [...current].sort((a, b) => Number(b.amount) - Number(a.amount))[0];
    const avgPerExpense = current.length ? total / current.length : 0;

    bodyEl.innerHTML = `
      <p class="modal-stat"><strong>${PERIOD_LABELS[period] || 'All Time'}</strong> — ${current.length} expense${current.length !== 1 ? 's' : ''} totaling <strong>${formatMoney(total)}</strong></p>
      <p class="modal-stat">Top category: <strong>${topCategory ? escapeHtml(topCategory[0]) : '—'}</strong>${topCategory ? ` (${formatMoney(topCategory[1])})` : ''}</p>
      <p class="modal-stat">Average per expense: <strong>${formatMoney(avgPerExpense)}</strong></p>
      <p class="modal-stat">Biggest single expense: <strong>${largest ? escapeHtml(largest.description) : '—'}</strong>${largest ? ` (${formatMoney(Number(largest.amount))} on ${formatDate(largest.date)})` : ''}</p>
    `;
    openModal('insights-modal');
  });

  /* ── Export (CSV of the currently selected period) ─────────── */
  document.getElementById('export-btn')?.addEventListener('click', () => {
    const current = expensesForPeriod();
    if (current.length === 0) {
      showToast('No expenses to export for this period', 'error');
      return;
    }
    const rows = [
      ['Date', 'Description', 'Category', 'Project', 'Amount'],
      ...current.map(e => [e.date, e.description, e.category_name || '', e.project_name || '', e.amount]),
    ];
    const csv = rows.map(r => r.map(escapeCsv).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `montraq-expenses-${period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });

  function escapeCsv(val) {
    const str = String(val ?? '');
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  }

  /* ── Toast notifications ───────────────────────────────────── */
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

  /* ── Helpers ────────────────────────────────────────────────── */
  function sum(list) {
    return list.reduce((s, e) => s + Number(e.amount), 0);
  }

  function formatMoney(n) {
    return `$${Number(n).toFixed(2)}`;
  }

  function formatDate(dateStr) {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
});
