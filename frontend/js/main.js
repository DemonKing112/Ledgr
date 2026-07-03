/* ──────────────────────────────────────────────────────────────
   MARKETING SITE — MAIN JAVASCRIPT
   Handles the mobile menu, sticky nav, scroll-reveal animations,
   FAQ accordion, and smooth-scroll navigation.
   ────────────────────────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', () => {

  /* ── Mobile menu toggle ──────────────────────────────────── */
  const hamburger = document.getElementById('hamburger');
  const mobileMenu = document.getElementById('mobile-menu');
  const menuOverlay = document.getElementById('menu-overlay');

  if (hamburger && mobileMenu) {
    hamburger.addEventListener('click', () => {
      const open = mobileMenu.classList.toggle('open');
      hamburger.classList.toggle('open');
      menuOverlay.classList.toggle('open');
      hamburger.setAttribute('aria-expanded', open);
      document.body.style.overflow = open ? 'hidden' : '';
    });

    /* Close menu when clicking the overlay or a link */
    menuOverlay.addEventListener('click', closeMenu);
    mobileMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', closeMenu);
    });

    function closeMenu() {
      mobileMenu.classList.remove('open');
      hamburger.classList.remove('open');
      menuOverlay.classList.remove('open');
      hamburger.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    }
  }

  /* ── Sticky nav — add a background on scroll ────────────── */
  const nav = document.getElementById('main-nav');
  if (nav) {
    window.addEventListener('scroll', () => {
      nav.classList.toggle('scrolled', window.scrollY > 40);
    }, { passive: true });
  }

  /* ── Scroll-reveal animations ──────────────────────────────
     Elements with class "reveal" fade in with a gentle rise
     as they enter the viewport.  We skip the effect entirely
     if the user prefers reduced motion.                        */
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!prefersReducedMotion) {
    const reveals = document.querySelectorAll('.reveal');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    reveals.forEach(el => observer.observe(el));
  } else {
    /* If reduced motion is on, show everything immediately */
    document.querySelectorAll('.reveal').forEach(el => {
      el.classList.add('revealed');
    });
  }

  /* ── FAQ accordion ─────────────────────────────────────────
     Clicking a question expands/collapses the answer.
     Only one answer is open at a time.                         */
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(item => {
    const question = item.querySelector('.faq-question');
    question.addEventListener('click', () => {
      const wasOpen = item.classList.contains('open');

      /* Close all other FAQs */
      faqItems.forEach(i => i.classList.remove('open'));

      /* Toggle the clicked one */
      if (!wasOpen) item.classList.add('open');
    });
  });

  /* ── Smooth scroll for anchor links ────────────────────────
     Clicking a nav link like "#pricing" scrolls smoothly
     instead of jumping.                                        */
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', (e) => {
      const target = document.querySelector(link.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  /* ── Update nav login/dashboard link ───────────────────────
     If the user is already logged in, show "Dashboard" instead
     of "Log In" in the nav.                                    */
  const token = localStorage.getItem('ledgr_access_token');
  if (token) {
    document.querySelectorAll('.nav-login-link').forEach(link => {
      link.textContent = 'Dashboard';
      link.href = 'dashboard.html';
    });
  }
});
