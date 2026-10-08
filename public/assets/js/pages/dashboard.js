import {UB} from '../app.js';
(async () => {
  await UB.ready; UB.$('#stats').innerHTML = UB.skel(4); UB.$('#recent').innerHTML = UB.skel(3);
  const {$, esc} = UB, list = await UB.list(), staff = UB.isStaff(), n = s => list.filter(c => c.status === s).length;
  $('#t').textContent = staff ? 'SAEP dashboard' : `Welcome, ${UB.me.name.split(' ')[0]}`;
  $('#s').textContent = staff ? '1st Semester, A.Y. 2026–2027' : 'Here is where your complaints stand.';
  $('#cta').innerHTML = staff ? '<button class="btn primary" id="exp">Export report</button>' : '<a class="btn primary" href="file-complaint.html">File a complaint</a>';
  const pct = list.length ? Math.round(n('resolved') / list.length * 100) : 0;
  $('#stats').innerHTML = [[list.length, staff ? 'Total complaints' : 'Total filed', ''], [n('submitted') + n('review'), 'Submitted / in review', staff ? 'Needs attention' : 'Waiting on SAEP'], [n('hearing'), 'For hearing', 'Scheduled'], [n('resolved'), 'Resolved', pct + '% resolution']]
    .map(([v, l, s]) => `<div class="card stat"><b>${v}</b><span>${l}</span>${s ? `<small>${s}</small>` : ''}</div>`).join('');
  const recent = [...list].sort((a, b) => b.filed.localeCompare(a.filed)).slice(0, 5);
  $('#recent').innerHTML = recent.length ? recent.map(c => `<a class="row" href="my-complaints.html?case=${encodeURIComponent(c.id)}"><div><b>${esc(c.type)}</b><small class="muted">${esc(c.student)} · ${esc(c.id)} · ${UB.fmt(c.filed)}</small></div>${UB.chip(c.status)}</a>`).join('')
    : '<div class="empty"><b>No complaints yet</b>Filed complaints will show up here.</div>';
  const by = {}; list.forEach(c => by[c.type] = (by[c.type] || 0) + 1);
  const top = Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 4);
  $('#bars').innerHTML = top.length ? top.map(([t, c]) => { const p = Math.round(c / list.length * 100); return `<div class="bar"><div><span>${esc(t)}</span><span>${p}%</span></div><div class="track"><i style="width:${p}%"></i></div></div>`; }).join('') : '<div class="empty">No data yet.</div>';
  if (staff) $('#exp').onclick = () => {
    // Neutralise spreadsheet formulas (CSV injection) and add a BOM so Excel reads UTF-8.
    const cell = x => { let s = String(x ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return `"${s.replace(/"/g, '""')}"`; };
    const rows = [['Case','Student','Student ID','Program','Section','Offense','Type','Date','Status'], ...list.map(c => [c.id, c.student, c.sid, c.program, c.section, c.offense, c.type, c.date, UB.STATUS[c.status]])];
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\uFEFF' + rows.map(r => r.map(cell).join(',')).join('\n')], {type: 'text/csv;charset=utf-8'}));
    a.download = 'ubridge-report.csv'; a.click(); UB.toast('Report downloaded');
  };
})();
