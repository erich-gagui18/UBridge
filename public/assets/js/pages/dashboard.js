import { UB } from '../app.js';
(async () => {
  await UB.ready;
  const { $, esc } = UB, staff = UB.isStaff();
  $('#stats').innerHTML = UB.skel(4);
  $('#recent').innerHTML = UB.skel(3);
  $('#t').textContent = staff ? 'SAEP dashboard' : `Welcome, ${UB.me.name.split(' ')[0]}`;
  $('#s').textContent = staff ? '1st Semester, A.Y. 2026–2027' : 'Here is where your complaints stand.';
  $('#cta').innerHTML = staff
    ? '<button class="btn primary" id="exp">Export report</button>'
    : '<a class="btn primary" href="file-complaint.html">File a complaint</a>';

  let list = [];
  const render = () => {
    const n = (s) => list.filter((c) => c.status === s).length;
    const pct = list.length ? Math.round((n('resolved') / list.length) * 100) : 0;
    const next = list.filter((c) => c.status === 'hearing' && c.hearingDate >= UB.todayPH()).map((c) => c.hearingDate).sort()[0];
    $('#stats').innerHTML = [
      [list.length, staff ? 'Total complaints' : 'Total filed', ''],
      [n('submitted') + n('review'), 'Submitted / in review', staff ? 'Needs attention' : 'Waiting on SAEP'],
      [n('hearing'), 'For hearing', next ? `Next: ${UB.fmt(next)}` : 'Scheduled'],
      [n('resolved'), 'Resolved', pct + '% resolution'],
    ]
      .map(([v, l, s]) => `<div class="card stat"><b>${v}</b><span>${l}</span>${s ? `<small>${s}</small>` : ''}</div>`)
      .join('');
    const recent = list.slice(0, 5);
    $('#recent').innerHTML = recent.length
      ? recent
          .map(
            (c) =>
              `<a class="row" href="my-complaints.html?case=${encodeURIComponent(c.id)}"><div><b>${esc(c.type)}</b><small class="muted">${esc(c.student)} · ${esc(c.id)} · ${UB.fmt(c.filed)}${staff ? ` · filed by ${esc(c.filedByName)}` : ''}</small></div>${UB.chip(c.status)}</a>`,
          )
          .join('')
      : '<div class="empty"><b>No complaints yet</b>Filed complaints will show up here.</div>';
    const by = {};
    list.forEach((c) => (by[c.type] = (by[c.type] || 0) + 1));
    const top = Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 4);
    $('#bars').innerHTML = top.length
      ? top
          .map(([t, c]) => {
            const p = Math.round((c / list.length) * 100);
            return `<div class="bar"><div><span>${esc(t)}</span><span>${p}%</span></div><div class="track"><i style="width:${p}%"></i></div></div>`;
          })
          .join('')
      : '<div class="empty">No data yet.</div>';
  };

  // Real-time: the page updates by itself when a case is filed or its status changes.
  const stop = UB.watchCases(
    (l) => {
      list = l;
      render();
    },
    () => UB.toast('Couldn’t load complaints. Check your connection and refresh.', 'bad'),
  );
  addEventListener('pagehide', stop);

  if (staff)
    $('#exp').onclick = () => {
      // Neutralise spreadsheet formulas (CSV injection) and add a BOM so Excel reads UTF-8.
      const cell = (x) => {
        let s = String(x ?? '');
        if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
        return `"${s.replace(/"/g, '""')}"`;
      };
      const rows = [
        ['Case', 'Respondent', 'Respondent student no.', 'Respondent course', 'Respondent department', 'Respondent email', 'Respondent contact', 'Offense', 'Type', 'Incident date', 'Filed', 'Status', 'Hearing date', 'Complainant', 'Complainant email', 'Complainant student no.', 'Complainant course', 'Complainant department', 'Complainant contact'],
        ...list.map((c) => [c.id, c.student, c.sid, c.program, c.rDept || '', c.rEmail || '', c.rContact || '', c.offense, c.type, c.date, c.filed, UB.STATUS[c.status], c.hearingDate || '', c.filedByName, c.filedByEmail || '', c.cSid || '', c.cCourse || '', c.cDept || '', c.cContact || '']),
      ];
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob(['\uFEFF' + rows.map((r) => r.map(cell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' }));
      a.download = 'ubridge-report.csv';
      a.click();
      UB.toast('Report downloaded');
    };
})();
