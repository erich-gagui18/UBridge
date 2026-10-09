// Small DOM helpers shared by every page.
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

// Escape text before putting it into innerHTML.
export const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

const PATHS = {
  home: 'M3 11l9-8 9 8v10H3z',
  plus: 'M12 5v14M5 12h14',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  book: 'M4 5a2 2 0 012-2h5v17H6a2 2 0 00-2 2zM20 5a2 2 0 00-2-2h-5v17h5a2 2 0 012 2z',
  out: 'M9 21H5V3h4M16 17l5-5-5-5M21 12H9',
  moon: 'M21 13A9 9 0 1111 3a7 7 0 0010 10z',
  menu: 'M3 6h18M3 12h18M3 18h18',
  check: 'M5 13l4 4L19 7',
  mail: 'M3 5h18v14H3zM3 5l9 8 9-8',
  up: 'M12 19V5M5 12l7-7 7 7',
  help: 'M9 9a3 3 0 115 2c0 2-3 2-3 4M12 18h.01',
  user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0',
  bell: 'M6 8a6 6 0 1112 0c0 7 3 8 3 8H3s3-1 3-8M10 20a2 2 0 004 0',
};
export const icon = (n) =>
  `<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="${PATHS[n]}"/></svg>`;

export const skel = (n) =>
  Array.from({ length: n }, () => '<div class="sk-card" aria-hidden="true"><i class="sk"></i></div>').join('');
