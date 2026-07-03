/* ──────────────────────────────────────────────────────────────
   FORGOT PASSWORD PAGE LOGIC
   ────────────────────────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('forgot-form');
  const errorEl = document.getElementById('auth-error');
  const devBox = document.getElementById('dev-token-box');
  const devLink = document.getElementById('dev-reset-link');

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    const email = document.getElementById('email').value;

    btn.disabled = true;
    errorEl.textContent = '';
    devBox.style.display = 'none';

    try {
      const data = await forgotPassword(email);

      if (data.devResetToken) {
        const url = `reset-password.html?token=${encodeURIComponent(data.devResetToken)}`;
        devLink.href = url;
        devLink.textContent = url;
        devBox.style.display = 'block';
      } else {
        errorEl.style.color = 'var(--primary)';
        errorEl.textContent = data.message;
      }
    } catch (err) {
      errorEl.textContent = err.message;
    } finally {
      btn.disabled = false;
    }
  });
});
