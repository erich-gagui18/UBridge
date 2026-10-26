// Shared by the Privacy Notice and the Terms of Use. Both pages are public (Google's consent screen and signed-out
// visitors open them), so this file must NOT import app.js: that would send signed-out visitors to the sign-in page.
// It only does what the pages cannot do alone: follow the theme the person picked inside UBridge.
try {
  const saved = JSON.parse(localStorage.getItem('ub.theme'));
  const dark = saved ? saved === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
} catch {
  /* storage is blocked: keep the default theme */
}
