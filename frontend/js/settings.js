/* ──────────────────────────────────────────────────────────────
   SETTINGS PAGE JAVASCRIPT
   Edit profile name, change password, delete account.
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

  /* ── Avatar dropdown ─────────────────────────────────────────── */
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

  /* ── Load subscription status ────────────────────────────────── */
  try {
    const subRes = await getSubscriptionStatus();
    const subData = await subRes.json();
    const planInfo = document.getElementById('plan-info');
    if (subRes.ok && planInfo) {
      const plan = subData.plan || 'free';
      const label = plan.charAt(0).toUpperCase() + plan.slice(1);
      if (plan === 'free') {
        planInfo.innerHTML =
          '<p class="settings-meta">You are on the <strong>Free</strong> plan.</p>' +
          '<a href="index.html#pricing" class="btn btn-primary" style="margin-top:8px;">Upgrade</a>';
      } else {
        planInfo.innerHTML =
          '<p class="settings-meta">You are on the <strong>' + label + '</strong> plan.</p>' +
          '<button class="btn btn-primary" id="manage-sub-btn" style="margin-top:8px;">Manage Subscription</button>';
        document.getElementById('manage-sub-btn').addEventListener('click', async () => {
          try {
            const portalRes = await createPortalSession();
            const portalData = await portalRes.json();
            if (!portalRes.ok) throw new Error(portalData.error || 'Failed to open portal');
            window.location.href = portalData.url;
          } catch (err) {
            showToast(err.message, 'error');
          }
        });
      }
    }
  } catch (err) {
    const planInfo = document.getElementById('plan-info');
    if (planInfo) planInfo.innerHTML = '<p class="settings-meta">Could not load plan info.</p>';
  }

  /* ── Load current profile ───────────────────────────────────── */
  try {
    const res = await apiFetch('/auth/me');
    const data = await res.json();
    if (!res.ok) throw new Error('Failed to load profile');

    document.getElementById('profile-name').value = data.user.name;
    document.getElementById('profile-email').value = data.user.email;
    document.getElementById('profile-member-since').textContent =
      `Member since ${new Date(data.user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
  } catch (err) {
    showToast('Failed to load profile', 'error');
  }

  /* ── Profile form ────────────────────────────────────────────── */
  document.getElementById('profile-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      const updated = await updateProfile(document.getElementById('profile-name').value);
      document.getElementById('user-name').textContent = updated.name;
      document.getElementById('avatar-initial').textContent = updated.name.trim().charAt(0).toUpperCase();
      showToast('Profile updated');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });

  /* ── Password form ───────────────────────────────────────────── */
  document.getElementById('password-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');

    const current = document.getElementById('current-password').value;
    const next = document.getElementById('new-password').value;
    const confirm = document.getElementById('confirm-new-password').value;

    if (next !== confirm) {
      showToast('New passwords do not match', 'error');
      return;
    }

    btn.disabled = true;
    try {
      await changePassword(current, next);
      showToast('Password updated — please log in again');
      e.target.reset();
      setTimeout(async () => {
        await logout();
        window.location.href = 'login.html';
      }, 1500);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });

  /* ── Delete account ─────────────────────────────────────────── */
  document.getElementById('delete-account-btn')?.addEventListener('click', async () => {
    if (!confirm('Are you absolutely sure? This permanently deletes your account and all data. This cannot be undone.')) return;
    try {
      await deleteAccount();
      window.location.href = 'index.html';
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

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
});
