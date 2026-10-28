import { $, esc } from './dom.js';

export function toast(msg, type = '') {
  let w = $('#toasts');
  if (!w) {
    w = document.createElement('div');
    w.id = 'toasts';
    w.setAttribute('aria-live', 'polite');
    document.body.appendChild(w);
  }
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.textContent = msg;
  w.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

export function modal(html, label = 'Dialog', onClose) {
  const ov = document.createElement('div');
  const prev = document.activeElement;
  ov.className = 'overlay';
  ov.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="${esc(label)}" tabindex="-1">${html}</div>`;
  const key = (e) => {
    if (e.key === 'Escape' && ov === [...document.querySelectorAll('.overlay')].pop()) close();
  };
  const close = () => {
    ov.remove();
    document.removeEventListener('keydown', key);
    prev?.focus?.();
    onClose?.();
  };
  document.addEventListener('keydown', key);
  ov.addEventListener('click', (e) => {
    if (e.target === ov || e.target.closest('[data-close]')) close();
  });
  document.body.appendChild(ov);
  ($('button,input,select,a', ov) || $('.modal', ov)).focus();
  return {
    el: ov,
    close,
    /** Replace the dialog body (used when live data changes while the dialog is open). */
    set(html2) {
      $('.modal', ov).innerHTML = html2;
    },
  };
}

export const confirmDlg = (title, msg, okLabel = 'Confirm') =>
  new Promise((res) => {
    let ok = false;
    const m = modal(
      `<h2>${esc(title)}</h2><p class="muted">${esc(msg)}</p><div class="actions" style="margin-top:20px"><button class="btn" data-close>Cancel</button><button class="btn primary" id="cfOk">${esc(okLabel)}</button></div>`,
      title,
      () => res(ok),
    );
    m.el.querySelector('#cfOk').onclick = () => {
      ok = true;
      m.close();
    };
    m.el.querySelector('#cfOk').focus();
  });

export const copy = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    toast('Copied ' + text);
  } catch {
    toast('Couldn’t copy. Select the text and copy it manually.', 'bad');
  }
};
