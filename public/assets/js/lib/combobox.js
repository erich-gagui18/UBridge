import { esc } from './dom.js';
// Searchable select. items: [{id, label, group, hint}] already ordered by group. The chosen id lives in a hidden input.
const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
export function combobox({ input, hidden, list, items, onPick, emptyText = 'No offense matches. Try fewer words.' }) {
  let open = false, act = -1, shown = [];
  const mark = (t, q) => {
    const i = q && norm(t).length === t.length ? norm(t).indexOf(q) : -1;
    return i < 0 ? esc(t) : `${esc(t.slice(0, i))}<mark>${esc(t.slice(i, i + q.length))}</mark>${esc(t.slice(i + q.length))}`;
  };
  const draw = () => {
    // Once something is chosen, reopening the list shows every option again instead of only the chosen one.
    const cur = items.find((x) => x.id === hidden.value);
    const q = cur && input.value === cur.label ? '' : norm(input.value.trim());
    shown = q ? items.filter((o) => norm(`${o.label} ${o.group} ${o.hint || ''}`).includes(q)) : items;
    let g = '';
    list.innerHTML = shown.length
      ? shown.map((o, i) => (o.group && o.group !== g ? ((g = o.group), `<li class="cb-g" role="presentation">${esc(g)}</li>`) : '') +
          `<li role="option" id="${list.id}-${i}" data-i="${i}" aria-selected="${i === act}">${mark(o.label, q)}${o.hint ? `<small>${esc(o.hint)}</small>` : ''}</li>`).join('')
      : `<li class="cb-none" role="presentation">${esc(emptyText)}</li>`;
    input.setAttribute('aria-activedescendant', act >= 0 && shown[act] ? `${list.id}-${act}` : '');
  };
  const show = (v) => { open = v; list.hidden = !v; input.setAttribute('aria-expanded', v); if (v) draw(); };
  const pick = (o) => {
    hidden.value = o ? o.id : ''; input.value = o ? o.label : ''; show(false);
    hidden.dispatchEvent(new Event('change', { bubbles: true })); onPick?.(o);
  };
  input.addEventListener('input', () => { const had = hidden.value; hidden.value = ''; act = 0; show(true); if (had) onPick?.(null); });
  input.addEventListener('focus', () => { act = -1; input.select(); show(true); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault(); if (!open) show(true);
      act = (act + (e.key === 'ArrowDown' ? 1 : -1) + shown.length) % (shown.length || 1);
      draw(); list.querySelector('[aria-selected=true]')?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter' && open) {
      e.preventDefault(); const o = shown[act] || (shown.length === 1 ? shown[0] : null); if (o) pick(o);
    } else if (e.key === 'Escape' && open) { e.stopPropagation(); show(false); }
  });
  list.addEventListener('mousedown', (e) => { const li = e.target.closest('[data-i]'); if (li) { e.preventDefault(); pick(shown[li.dataset.i]); } });
  input.addEventListener('blur', () => setTimeout(() => { show(false); input.value = items.find((x) => x.id === hidden.value)?.label || ''; }, 120));
  return { setItems(next) { items = next; act = -1; if (open) draw(); }, set(id) { const o = items.find((x) => x.id === id); hidden.value = o ? o.id : ''; input.value = o ? o.label : ''; } };
}
