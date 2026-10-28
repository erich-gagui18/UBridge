// Shared by the public pages: home, Privacy Notice and Terms of Use. Google's consent
// screen and signed-out visitors open them, so this file must NOT import app.js: that would
// send them to the sign-in page.
const moon =
  '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 13A9 9 0 1111 3a7 7 0 0010 10z"/></svg>';

const applyTheme = (theme) => {
  document.documentElement.dataset.theme = theme;
};

try {
  const saved = JSON.parse(localStorage.getItem('ub.theme'));
  applyTheme(saved ? saved : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
} catch {
  /* storage is blocked: keep the default theme */
}

const themeBtn = document.getElementById('themeBtn');
if (themeBtn) {
  themeBtn.innerHTML = moon;
  themeBtn.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    try {
      localStorage.setItem('ub.theme', JSON.stringify(next));
    } catch {
      /* ignore */
    }
  });
}

document.querySelectorAll('[data-back]').forEach((el) => {
  el.addEventListener('click', (e) => {
    try {
      const ref = document.referrer;
      if (!ref || history.length < 2) return;
      const from = new URL(ref);
      if (from.origin !== location.origin || from.pathname === location.pathname) return;
      e.preventDefault();
      history.back();
    } catch {
      /* keep the fallback href (home) */
    }
  });
});
