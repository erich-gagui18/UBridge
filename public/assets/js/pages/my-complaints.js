import {UB} from '../app.js';
(async () => {
  await UB.ready;
  const {$, esc} = UB, staff = UB.isStaff();
  $('#t').textContent = staff ? 'All cases' : 'My complaints'; $('#s').textContent = staff ? 'Review and update every complaint filed with SAEP.' : 'Track the status of every report you’ve filed.';
  if (!staff) $('#cta').innerHTML = '<a class="btn primary" href="file-complaint.html">New complaint</a>';
  $('#stats').innerHTML = UB.skel(4); $('#rows').innerHTML = `<tr><td colspan="6">${UB.skel(3)}</td></tr>`;
  let data = []; const reload = async () => { try { data = await UB.list(); } catch { UB.toast('Couldn’t load complaints. Check your connection and refresh.', 'bad'); } };
  await reload();
  UB.ORDER.forEach(s => $('#st').insertAdjacentHTML('beforeend', `<option value="${s}">${UB.STATUS[s]}</option>`));
  const stats = () => { const l = data, n = s => l.filter(c => c.status === s).length, p = l.length ? Math.round(n('resolved') / l.length * 100) : 0;
    $('#stats').innerHTML = [[l.length, 'Total filed', ''], [n('submitted') + n('review'), 'Submitted / in review', 'Needs follow-up'], [n('hearing'), 'For hearing', 'Scheduled'], [n('resolved'), 'Resolved', p + '% resolution']].map(([v, a, s]) => `<div class="card stat"><b>${v}</b><span>${a}</span>${s ? `<small>${s}</small>` : ''}</div>`).join(''); };
  const render = () => {
    const q = $('#q').value.trim().toLowerCase(), st = $('#st').value;
    const rows = data.filter(c => (!st || c.status === st) && (!q || [c.id, c.student, c.sid, c.type, c.program].some(x => String(x ?? '').toLowerCase().includes(q)))).sort((a, b) => b.filed.localeCompare(a.filed));
    $('#rows').innerHTML = rows.map(c => `<tr><td>${esc(c.id)}</td><td><b>${esc(c.student)}</b><small>${esc(c.sid)} · ${esc(c.program)} ${esc(c.section)}</small></td><td><span class="chip ${esc(c.offense)}">${esc(c.offense)}</span></td><td>${UB.fmt(c.filed)}</td><td>${UB.chip(c.status)}</td><td><button class="link" data-id="${esc(c.id)}">View</button></td></tr>`).join('');
    $('#none').hidden = rows.length > 0; stats();
  };
  const open = id => {
    const c = data.find(x => x.id === id); if (!c) return;
    const i = UB.ORDER.indexOf(c.status);
    const m = UB.modal(`<h2>${esc(c.id)} <button class="link" type="button" data-copy="${esc(c.id)}">Copy</button></h2><p class="muted">${esc(c.type)}</p>
      <div class="steps" aria-label="Progress: ${UB.STATUS[c.status]}">${UB.ORDER.map((s, k) => `<span class="${k <= i ? 'done' : ''}">${UB.STATUS[s]}</span>`).join('')}</div>
      <dl><dt>Student</dt><dd>${esc(c.student)} (${esc(c.sid)})</dd><dt>Program</dt><dd>${esc(c.program)} ${esc(c.section)}</dd><dt>Category</dt><dd>${esc(c.offense)}</dd><dt>Incident</dt><dd>${UB.fmt(c.date)}</dd><dt>Filed</dt><dd>${UB.fmt(c.filed)}</dd><dt>Updated</dt><dd>${UB.fmtTs(c.updatedAt || c.createdAt)}</dd><dt>Location</dt><dd>${esc(c.location)}</dd><dt>Description</dt><dd>${esc(c.desc)}</dd><dt>Evidence</dt><dd>${c.files?.length ? c.files.map(x => x.path ? `<button class="link" data-f="${esc(x.path)}">${esc(x.name)}</button>` : esc(x.name)).join(' ') : 'None attached'}</dd></dl>
      ${staff ? `<div class="field"><label for="ns">Update status</label><select id="ns">${UB.ORDER.map(s => `<option value="${s}" ${s === c.status ? 'selected' : ''}>${UB.STATUS[s]}</option>`).join('')}</select></div>` : ''}
      <div class="actions"><button class="btn" data-close>Close</button>${staff ? '<button class="btn primary" id="sv">Save status</button>' : ''}</div>`, 'Complaint ' + c.id);
    m.el.addEventListener('click', async e => { const b = e.target.closest('[data-f]'); if (!b) return; try { window.open(await UB.evidenceUrl(b.dataset.f), '_blank', 'noopener'); } catch { UB.toast('Couldn’t open that file.', 'bad'); } });
    if (staff) m.el.querySelector('#sv').onclick = async () => { const ns = m.el.querySelector('#ns').value; if (ns === c.status) return UB.toast('Status is unchanged'); if (!await UB.confirm('Update status?', `Change ${id} from “${UB.STATUS[c.status]}” to “${UB.STATUS[ns]}”? The filer will see the new status.`, 'Update')) return; try { await UB.setStatus(id, ns); m.close(); await reload(); render(); UB.toast('Status updated'); } catch { UB.toast('Couldn’t update the status. Try again.', 'bad'); } };
  };
  $('#q').oninput = render; $('#st').onchange = render;
  $('#rows').onclick = e => { const b = e.target.closest('[data-id]'); if (b) open(b.dataset.id); };
  render(); const k = new URLSearchParams(location.search).get('case'); if (k) open(k);
})();
