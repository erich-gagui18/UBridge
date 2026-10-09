import { modal } from './ui.js';
import { esc } from './dom.js';
/** In-app file viewer with previous/next. files: [{name}]; load(file) resolves {url, type, revoke?}. */
export function openViewer(files, start, load) {
  let i = start, off = null;
  const m = modal('<div class="viewer"></div>', 'Evidence viewer', () => off?.());
  m.el.querySelector('.modal').classList.add('wide');
  const paint = async () => {
    off?.(); off = null;
    const f = files[i], box = m.el.querySelector('.viewer');
    box.innerHTML = `<div class="v-bar"><b>${esc(f.name)}</b><span class="muted">${i + 1} of ${files.length}</span></div><div class="v-body"><p class="muted">Loading…</p></div>
      <div class="actions">${files.length > 1 ? '<button class="btn" data-n="-1">Previous</button><button class="btn" data-n="1">Next</button>' : ''}<a class="btn" id="vDl" target="_blank" rel="noopener" hidden>Open / download</a><button class="btn primary" data-close>Close</button></div>`;
    try {
      const r = await load(f), body = box.querySelector('.v-body'), a = box.querySelector('#vDl');
      body.innerHTML = r.type === 'application/pdf' ? `<iframe title="${esc(f.name)}" src="${esc(r.url)}"></iframe>` : `<img alt="${esc(f.name)}" src="${esc(r.url)}">`;
      a.href = r.url; a.download = f.name; a.hidden = false; off = r.revoke;
    } catch { box.querySelector('.v-body').innerHTML = '<p class="notice">Couldn’t open this file. Check your connection and try again.</p>'; }
  };
  m.el.addEventListener('click', (e) => { const n = e.target.closest('[data-n]'); if (n) { i = (i + Number(n.dataset.n) + files.length) % files.length; paint(); } });
  paint();
  return m;
}
