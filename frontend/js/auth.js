/* ──────────────────────────────────────────────────────────────
   AUTH PAGE LOGIC
   Handles the login and signup forms — sends credentials to
   the API, shows errors, and redirects on success.
   ────────────────────────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', () => {
  /* If the user is already logged in, send them to the dashboard */
  if (getAccessToken()) {
    window.location.href = 'dashboard.html';
    return;
  }

  /* ── Login form ──────────────────────────────────────────── */
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errorEl = document.getElementById('auth-error');
      const btn = loginForm.querySelector('button[type="submit"]');

      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;

      /* Disable the button to prevent double-clicks */
      btn.disabled = true;
      btn.textContent = 'Signing in...';
      errorEl.textContent = '';

      try {
        await login(email, password);
        window.location.href = 'dashboard.html';
      } catch (err) {
        errorEl.textContent = err.message;
        btn.disabled = false;
        btn.textContent = 'Sign In';
      }
    });
  }

  /* ── Signup form ─────────────────────────────────────────── */
  const signupForm = document.getElementById('signup-form');
  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errorEl = document.getElementById('auth-error');
      const btn = signupForm.querySelector('button[type="submit"]');

      const name = document.getElementById('name').value;
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      const confirm = document.getElementById('confirm-password').value;

      if (password !== confirm) {
        errorEl.textContent = 'Passwords do not match';
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Creating account...';
      errorEl.textContent = '';

      try {
        await signup(email, name, password);
        window.location.href = 'dashboard.html';
      } catch (err) {
        errorEl.textContent = err.message;
        btn.disabled = false;
        btn.textContent = 'Create Account';
      }
    });
  }
});
