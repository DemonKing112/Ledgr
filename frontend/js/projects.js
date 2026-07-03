/* ──────────────────────────────────────────────────────────────
   PROJECTS PAGE JAVASCRIPT
   List, add, edit, and delete projects.
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

  let projects = [];
  let editingId = null;

  const form = document.getElementById('project-form');
  const formTitle = document.getElementById('project-form-title');
  const cancelBtn = document.getElementById('cancel-edit-btn');
  const nameInput = document.getElementById('project-name');
  const clientInput = document.getElementById('project-client');

  try {
    projects = await getProjects();
    renderList();
  } catch (err) {
    showToast('Failed to load projects', 'error');
  }

  function renderList() {
    const list = document.getElementById('project-list');
    if (!list) return;

    if (projects.length === 0) {
      list.innerHTML = '<li class="empty-state">No projects yet — add your first one.</li>';
      return;
    }

    list.innerHTML = projects.map(p => `
      <li class="simple-list-item" data-id="${p.id}">
        <span class="simple-list-name">${escapeHtml(p.name)}</span>
        <span class="simple-list-sub">${escapeHtml(p.client_name || '—')}</span>
        <div class="row-actions">
          <button class="btn-icon edit-proj-btn" title="Edit" data-id="${p.id}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn-icon delete-btn" title="Delete" data-id="${p.id}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
          </button>
        </div>
      </li>
    `).join('');

    list.querySelectorAll('.edit-proj-btn').forEach(btn => {
      btn.addEventListener('click', () => startEdit(Number(btn.dataset.id)));
    });
    list.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', () => handleDelete(Number(btn.dataset.id)));
    });
  }

  function startEdit(id) {
    const proj = projects.find(p => p.id === id);
    if (!proj) return;
    editingId = id;
    formTitle.textContent = 'Edit Project';
    cancelBtn.style.display = 'inline-flex';
    nameInput.value = proj.name;
    clientInput.value = proj.client_name || '';
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function stopEdit() {
    editingId = null;
    formTitle.textContent = 'Add Project';
    cancelBtn.style.display = 'none';
    form.reset();
  }

  cancelBtn?.addEventListener('click', stopEdit);

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    try {
      if (editingId) {
        const updated = await updateProject(editingId, {
          name: nameInput.value,
          client_name: clientInput.value || null,
        });
        projects = projects.map(p => p.id === editingId ? updated : p);
        renderList();
        stopEdit();
        showToast('Project updated');
      } else {
        const created = await createProject({
          name: nameInput.value,
          client_name: clientInput.value || null,
        });
        projects.unshift(created);
        renderList();
        form.reset();
        showToast('Project added');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      submitBtn.disabled = false;
    }
  });

  async function handleDelete(id) {
    if (!confirm('Delete this project? Expenses using it will keep their record but lose the project link.')) return;
    try {
      await deleteProject(id);
      projects = projects.filter(p => p.id !== id);
      renderList();
      if (editingId === id) stopEdit();
      showToast('Project deleted');
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
