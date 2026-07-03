/* ──────────────────────────────────────────────────────────────
   CATEGORIES PAGE JAVASCRIPT
   List, add, edit, and delete categories.
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

  document.querySelectorAll('[data-stub]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      showToast(`${el.dataset.stub} is coming soon`, 'success');
    });
  });

  let categories = [];
  let editingId = null;

  const form = document.getElementById('category-form');
  const formTitle = document.getElementById('category-form-title');
  const cancelBtn = document.getElementById('cancel-edit-btn');
  const nameInput = document.getElementById('category-name');
  const colorInput = document.getElementById('category-color');

  try {
    categories = await getCategories();
    renderList();
  } catch (err) {
    showToast('Failed to load categories', 'error');
  }

  function renderList() {
    const list = document.getElementById('category-list');
    if (!list) return;

    if (categories.length === 0) {
      list.innerHTML = '<li class="empty-state">No categories yet — add your first one.</li>';
      return;
    }

    list.innerHTML = categories.map(c => `
      <li class="simple-list-item" data-id="${c.id}">
        <span class="simple-list-dot" style="background:${c.color}"></span>
        <span class="simple-list-name">${escapeHtml(c.name)}</span>
        <div class="row-actions" style="margin-left:auto">
          <button class="btn-icon edit-cat-btn" title="Edit" data-id="${c.id}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn-icon delete-btn" title="Delete" data-id="${c.id}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
          </button>
        </div>
      </li>
    `).join('');

    list.querySelectorAll('.edit-cat-btn').forEach(btn => {
      btn.addEventListener('click', () => startEdit(Number(btn.dataset.id)));
    });
    list.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', () => handleDelete(Number(btn.dataset.id)));
    });
  }

  function startEdit(id) {
    const cat = categories.find(c => c.id === id);
    if (!cat) return;
    editingId = id;
    formTitle.textContent = 'Edit Category';
    cancelBtn.style.display = 'inline-flex';
    nameInput.value = cat.name;
    colorInput.value = cat.color;
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function stopEdit() {
    editingId = null;
    formTitle.textContent = 'Add Category';
    cancelBtn.style.display = 'none';
    form.reset();
    colorInput.value = '#3F5D42';
  }

  cancelBtn?.addEventListener('click', stopEdit);

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    try {
      if (editingId) {
        const updated = await updateCategory(editingId, {
          name: nameInput.value,
          color: colorInput.value,
        });
        categories = categories.map(c => c.id === editingId ? updated : c);
        categories.sort((a, b) => a.name.localeCompare(b.name));
        renderList();
        stopEdit();
        showToast('Category updated');
      } else {
        const created = await createCategory({
          name: nameInput.value,
          color: colorInput.value,
        });
        categories.push(created);
        categories.sort((a, b) => a.name.localeCompare(b.name));
        renderList();
        form.reset();
        colorInput.value = '#3F5D42';
        showToast('Category added');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      submitBtn.disabled = false;
    }
  });

  async function handleDelete(id) {
    if (!confirm('Delete this category? Expenses using it will become uncategorized.')) return;
    try {
      await deleteCategory(id);
      categories = categories.filter(c => c.id !== id);
      renderList();
      if (editingId === id) stopEdit();
      showToast('Category deleted');
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
