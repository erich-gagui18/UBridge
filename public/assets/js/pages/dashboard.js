import { UB } from '../app.js';
(async () => {
  await UB.ready;
  const { $, esc } = UB, staff = UB.isStaff();
  const hr = Number(new Date().toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'Asia/Manila' })) % 24;
  $('#greet').textContent = hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
  $('#recent').innerHTML = UB.skel(3);
  $('#t').textContent = staff ? 'SAEP dashboard' : `Welcome, ${UB.me.name.split(' ')[0]}`;
  $('#s').textContent = staff ? '1st Semester, A.Y. 2026–2027' : 'Here is where your complaints stand.';
  $('#cta').innerHTML = staff
    ? '<button class="btn primary" id="exp">Export report</button>'
    : '<a class="btn primary" href="file-complaint.html">File a complaint</a>';
  // Built once: later live updates only change the numbers (they count up) so nothing flickers or replays.
  $('#stats').innerHTML = [0, 1, 2, 3].map(() => '<div class="card stat" data-reveal><b data-v="0">0</b><span></span><small></small></div>').join('');
  $('#stack').innerHTML = UB.ORDER.map((s) => `<i class="seg ${s}" style="flex-grow:0" title="${UB.STATUS[s]}"></i>`).join('');
  $('#legend').innerHTML = UB.ORDER.map((s) => `<li><span class="chip ${s}">${UB.STATUS[s]}</span><b data-v="0">0</b></li>`).join('');
  UB.stagger(document);

  let list = [], first = true, trackKey = '';
  const render = () => {
    const n = (s) => list.filter((c) => c.status === s).length;
    const pct = list.length ? Math.round((n('resolved') / list.length) * 100) : 0;
    const next = list.filter((c) => c.status === 'hearing' && c.hearingDate >= UB.todayPH()).map((c) => c.hearingDate).sort()[0];
    const cards = [
      [list.length, staff ? 'Total complaints' : 'Total filed', ''],
      [n('submitted') + n('review'), 'Submitted / in review', staff ? 'Needs attention' : 'Waiting on SAEP'],
      [n('hearing'), 'For hearing', next ? `Next: ${UB.fmt(next)}` : 'Scheduled'],
      [n('resolved'), 'Resolved', pct + '% resolution'],
    ];
    UB.$$('#stats .stat').forEach((el, k) => {
      el.children[1].textContent = cards[k][1]; el.children[2].textContent = cards[k][2];
      UB.countUp(el.children[0], cards[k][0]);
    });
    // pipeline: ring + stacked bar grow with CSS transitions; legend numbers count up
    requestAnimationFrame(() => {
      $('#rgFg').style.strokeDashoffset = 100 - pct;
      UB.$$('#stack .seg').forEach((el, k) => (el.style.flexGrow = n(UB.ORDER[k])));
    });
    UB.countUp($('#rgV'), pct, 1100, '%');
    UB.$$('#legend b').forEach((el, k) => UB.countUp(el, n(UB.ORDER[k])));
    $('#pipeNote').textContent = list.length ? `${list.length} case${list.length === 1 ? '' : 's'} in total` : 'No cases yet';
    const latest = !staff && list[0];
    const key = latest ? `${latest.id}:${latest.status}` : '';
    if (key !== trackKey) {
      trackKey = key;
      $('#track').innerHTML = latest ? `<div class="latest-case"><h3>Your latest case · ${esc(latest.id)}</h3><p class="muted">${esc(UB.offenseLabel(latest))}</p>${UB.progress(latest.status)}<a class="link" href="my-complaints.html?case=${encodeURIComponent(latest.id)}">Open details</a></div>` : '';
    }
    const recent = list.slice(0, 5), rv = first ? ' data-reveal' : '';
    $('#recent').innerHTML = recent.length
      ? recent.map((c) => `<a class="row"${rv} href="my-complaints.html?case=${encodeURIComponent(c.id)}"><div><b>${esc(UB.offenseLabel(c))}</b><small class="muted">${esc(c.student)} · ${esc(c.id)} · ${UB.fmt(c.filed)}${staff ? ` · filed by ${esc(c.filedByName)}` : ''}</small></div>${UB.chip(c.status)}</a>`).join('')
      : '<div class="empty"><b>No complaints yet</b>Filed complaints will show up here.</div>';
    const by = {};
    list.forEach((c) => (by[c.type] = (by[c.type] || 0) + 1));
    const top = Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 4);
    $('#bars').innerHTML = top.length
      ? top.map(([t, c]) => { const p = Math.round((c / list.length) * 100); return `<div class="bar"><div><span>${esc(t)}</span><span>${p}%</span></div><div class="track"><i style="width:${first ? 0 : p}%" data-w="${p}"></i></div></div>`; }).join('')
      : '<div class="empty">No data yet.</div>';
    requestAnimationFrame(() => requestAnimationFrame(() => UB.$$('#bars i[data-w]').forEach((el) => (el.style.width = el.dataset.w + '%'))));
    UB.stagger($('#recent'));
    first = false;
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
        ...list.map((c) => [c.id, c.student, c.sid, c.program, c.rDept || '', c.rEmail || '', c.rContact || '', c.offense, UB.offenseLabel(c), c.date, c.filed, UB.STATUS[c.status], c.hearingDate || '', c.filedByName, c.filedByEmail || '', c.cSid || '', c.cCourse || '', c.cDept || '', c.cContact || '']),
      ];
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob(['\uFEFF' + rows.map((r) => r.map(cell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' }));
      a.download = 'ubridge-report.csv';
      a.click();
      UB.toast('Report downloaded');
    };
})();
