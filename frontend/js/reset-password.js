/* ──────────────────────────────────────────────────────────────
   RESET PASSWORD PAGE LOGIC
   ────────────────────────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('reset-form');
  const errorEl = document.getElementById('auth-error');
  const token = new URLSearchParams(window.location.search).get('token');

  if (!token) {
    errorEl.textContent = 'Missing or invalid reset link.';
    form.querySelector('button[type="submit"]').disabled = true;
  }

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');

    const newPassword = document.getElementById('new-password').value;
    const confirm = document.getElementById('confirm-password').value;

    if (newPassword !== confirm) {
      errorEl.textContent = 'Passwords do not match';
      return;
    }

    btn.disabled = true;
    errorEl.textContent = '';

    try {
      await resetPassword(token, newPassword);
      errorEl.style.color = 'var(--primary)';
      errorEl.textContent = 'Password reset — redirecting to log in...';
      setTimeout(() => window.location.href = 'login.html', 1500);
    } catch (err) {
      errorEl.textContent = err.message;
      btn.disabled = false;
    }
  });
});
