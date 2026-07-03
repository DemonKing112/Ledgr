/* ──────────────────────────────────────────────────────────────
   RECEIPTS PAGE JAVASCRIPT
   Upload a receipt image to the (stubbed) scan endpoint.
   The backend doesn't run real OCR yet — this wires up the
   real upload UI against that placeholder so the flow is ready
   to swap in a real scanning service later.
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

  const dropzone = document.getElementById('receipt-dropzone');
  const fileInput = document.getElementById('receipt-input');
  const resultEl = document.getElementById('receipt-result');

  fileInput?.addEventListener('change', () => {
    if (fileInput.files[0]) handleFile(fileInput.files[0]);
  });

  dropzone?.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('drag-over');
  });
  dropzone?.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
  dropzone?.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });

  async function handleFile(file) {
    if (!file.type.startsWith('image/')) {
      showToast('Please choose an image file', 'error');
      return;
    }

    resultEl.style.display = 'block';
    resultEl.innerHTML = `Processing "${escapeHtml(file.name)}"...`;

    try {
      const data = await scanReceipt(file);
      resultEl.innerHTML = `
        <strong>${escapeHtml(file.name)}</strong>
        <p style="margin-top:8px;">${escapeHtml(data.message)}</p>
        <p style="margin-top:8px; color: var(--text-muted); font-size: 0.875rem;">
          Amount: ${data.extracted.amount ?? '—'} · Vendor: ${data.extracted.vendor ?? '—'} · Date: ${data.extracted.date ?? '—'}
        </p>
      `;
    } catch (err) {
      resultEl.innerHTML = `<span style="color: var(--error);">${escapeHtml(err.message)}</span>`;
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
