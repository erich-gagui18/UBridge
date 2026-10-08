import { UB } from '../app.js';
(async () => {
  await UB.ready;
  const { $, esc } = UB, staff = UB.isStaff();
  $('#t').textContent = staff ? 'All cases' : 'My complaints';
  $('#s').textContent = staff ? 'Review and update every complaint filed with SAEP.' : 'Track the status of every report you’ve filed.';
  $('#cta').innerHTML = staff ? '<button class="btn" id="sync">Sync offense list</button>' : '<a class="btn primary" href="file-complaint.html">New complaint</a>';
  $('#head').innerHTML = `<tr><th>Case no.</th><th>Student</th>${staff ? '<th>Filed by</th>' : ''}<th>Offense</th><th>Filed</th><th>Status</th><th></th></tr>`;
  $('#stats').innerHTML = UB.skel(4);
  $('#rows').innerHTML = `<tr><td colspan="${staff ? 7 : 6}">${UB.skel(3)}</td></tr>`;
  UB.ORDER.forEach((s) => $('#st').insertAdjacentHTML('beforeend', `<option value="${s}">${UB.STATUS[s]}</option>`));

  let data = [], offenses = {}, loaded = false;
  let cur = null; // the open case dialog: {id, m, dirty, history, stopHistory}
  UB.loadOffenses().then((l) => { offenses = Object.fromEntries(l.map((o) => [o.id, o])); }).catch(() => {});

  const stats = () => {
    const n = (s) => data.filter((c) => c.status === s).length;
    const p = data.length ? Math.round((n('resolved') / data.length) * 100) : 0;
    $('#stats').innerHTML = [[data.length, 'Total filed', ''], [n('submitted') + n('review'), 'Submitted / in review', 'Needs follow-up'], [n('hearing'), 'For hearing', 'Scheduled'], [n('resolved'), 'Resolved', p + '% resolution']]
      .map(([v, a, s]) => `<div class="card stat"><b>${v}</b><span>${a}</span>${s ? `<small>${s}</small>` : ''}</div>`).join('');
  };
  const render = () => {
    const q = $('#q').value.trim().toLowerCase(), st = $('#st').value;
    const rows = data.filter((c) => (!st || c.status === st) && (!q || [c.id, c.student, c.sid, c.type, c.program, c.filedByName].some((x) => String(x ?? '').toLowerCase().includes(q))));
    $('#rows').innerHTML = rows.map((c) => `<tr><td>${esc(c.id)}</td><td><b>${esc(c.student)}</b><small>${esc(c.sid)} · ${esc(c.program)} ${esc(c.section)}</small></td>${staff ? `<td>${esc(c.filedByName)}<small>${esc(c.filedByRole || '')}</small></td>` : ''}<td><span class="chip ${esc(c.offense)}">${esc(c.offense)}</span></td><td>${UB.fmt(c.filed)}</td><td>${UB.chip(c.status)}</td><td><button class="link" data-id="${esc(c.id)}">View</button></td></tr>`).join('');
    $('#none').hidden = !loaded || rows.length > 0;
    stats();
  };

  const evidence = (c) => {
    if (!c.files?.length) return UB.USE_STORAGE ? 'None attached' : 'No files stored (uploads are not available in this version)';
    return c.files.map((x) => (x.path ? `<button class="link" data-f="${esc(x.path)}">${esc(x.name)}</button>` : `${esc(x.name)} <small class="muted">(name only, file not stored)</small>`)).join(' ');
  };
  const timeline = (c, hist) => {
    const who = (n) => (staff ? esc(n) : 'SAEP Staff');
    const items = [`<li><b>Filed</b><small>${esc(c.filedByName)} · ${UB.fmtTs(c.createdAt)}</small></li>`, ...hist.map((h) => `<li><b>${UB.STATUS[h.from]} → ${UB.STATUS[h.to]}</b><small>${who(h.byName)} · ${UB.fmtTs(h.at)}</small>${h.remark ? `<p>${esc(h.remark)}</p>` : ''}</li>`)];
    return `<ol class="hist" aria-label="Status history">${items.join('')}</ol>`;
  };
  const modalHtml = (c) => {
    const i = UB.ORDER.indexOf(c.status), o = offenses[c.offenseId];
    const form = staff ? `<div class="staffbox"><h3>Update this case</h3>
      <div class="field"><label for="ns">Status</label><select id="ns">${UB.ORDER.map((s) => `<option value="${s}" ${s === c.status ? 'selected' : ''}>${UB.STATUS[s]}</option>`).join('')}</select></div>
      <div class="field" id="hdF" ${c.status === 'hearing' ? '' : 'hidden'}><label for="hd" class="req">Hearing date</label><input id="hd" type="date" value="${esc(c.hearingDate || '')}"></div>
      <div class="field" id="rsF" ${c.status === 'resolved' ? '' : 'hidden'}><label for="rs" class="req">Resolution note</label><textarea id="rs" maxlength="2000" style="min-height:90px">${esc(c.resolution || '')}</textarea></div>
      <div class="field"><label for="rm">Remark for the history (optional)</label><input id="rm" maxlength="500" placeholder="e.g. Both parties notified"></div></div>` : '';
    return `<h2>${esc(c.id)} <button class="link" type="button" data-copy="${esc(c.id)}">Copy</button></h2><p class="muted">${esc(c.type)}</p>
      <div class="steps" aria-label="Progress: ${UB.STATUS[c.status]}">${UB.ORDER.map((s, k) => `<span class="${k <= i ? 'done' : ''}">${UB.STATUS[s]}</span>`).join('')}</div>
      <dl><dt>Student</dt><dd>${esc(c.student)} (${esc(c.sid)})</dd><dt>Program</dt><dd>${esc(c.program)} ${esc(c.section)}</dd>
      ${staff ? `<dt>Filed by</dt><dd>${esc(c.filedByName)} · ${esc(c.filedByRole || '')}${c.filedByEmail ? ` · ${esc(c.filedByEmail)}` : ''}</dd>` : ''}
      <dt>Category</dt><dd>${esc(c.offense)}${o?.section ? ` <small class="muted">${esc(o.section)}</small>` : ''}</dd>${o?.sanction ? `<dt>Handbook sanction</dt><dd>${esc(o.sanction)}</dd>` : ''}
      <dt>Incident</dt><dd>${UB.fmt(c.date)}</dd><dt>Filed</dt><dd>${UB.fmt(c.filed)}</dd><dt>Updated</dt><dd>${UB.fmtTs(c.updatedAt || c.createdAt)}</dd>
      ${c.hearingDate ? `<dt>Hearing date</dt><dd>${UB.fmt(c.hearingDate)}</dd>` : ''}${c.resolution ? `<dt>Resolution</dt><dd>${esc(c.resolution)}</dd>` : ''}
      <dt>Location</dt><dd>${esc(c.location)}</dd><dt>Description</dt><dd>${esc(c.desc)}</dd><dt>Evidence</dt><dd>${evidence(c)}</dd></dl>
      <h3>History</h3>${timeline(c, cur?.history || [])}${form}
      <div class="actions"><button class="btn" data-close>Close</button>${staff ? '<button class="btn primary" id="sv">Save changes</button>' : ''}</div>`;
  };
  const paintModal = () => {
    const c = data.find((x) => x.id === cur?.id);
    if (!c) return;
    // Don't wipe what a staff member is typing; tell them instead.
    if (cur.dirty) { if ((c.hCount || 0) !== cur.seen) { UB.toast('This case was just updated by someone else. Close and reopen it to see the latest.', 'bad'); cur.seen = c.hCount || 0; } return; }
    cur.seen = c.hCount || 0;
    cur.m.set(modalHtml(c));
  };

  const save = async () => {
    const c = data.find((x) => x.id === cur.id), el = cur.m.el, v = (s) => el.querySelector(s)?.value ?? '';
    const status = v('#ns'), hearingDate = status === 'hearing' ? v('#hd') : (c.hearingDate || ''), resolution = status === 'resolved' ? v('#rs').trim() : (c.resolution || ''), remark = v('#rm').trim();
    if (status === 'hearing' && !hearingDate) return UB.toast('Choose the hearing date.', 'bad');
    if (status === 'resolved' && resolution.length < 5) return UB.toast('Add a resolution note (at least 5 characters).', 'bad');
    if (status === c.status && hearingDate === (c.hearingDate || '') && resolution === (c.resolution || '') && !remark) return UB.toast('Nothing has changed');
    if (!(await UB.confirm('Save changes?', `${c.id}: “${UB.STATUS[c.status]}” → “${UB.STATUS[status]}”. The filer will be notified in the app.`, 'Save'))) return;
    try {
      await UB.updateCase(c, { status, hearingDate, resolution, remark });
      cur.dirty = false; cur.m.close(); UB.toast('Case updated');
    } catch (e) {
      UB.toast(e.code === 'permission-denied' ? 'The case changed while you were editing. Reopen it and try again.' : 'Couldn’t update the case. Try again.', 'bad');
    }
  };

  const open = (id) => {
    const c = data.find((x) => x.id === id); if (!c) return;
    cur = { id, dirty: false, history: [], seen: c.hCount || 0 };
    cur.m = UB.modal(modalHtml(c), 'Complaint ' + id, () => { cur.stopHistory?.(); cur = null; });
    cur.stopHistory = UB.watchHistory(id, (h) => { if (!cur) return; cur.history = h; if (!cur.dirty) paintModal(); }, () => {});
    const el = cur.m.el;
    el.addEventListener('input', () => { if (cur) cur.dirty = true; });
    el.addEventListener('change', (e) => {
      if (e.target.id !== 'ns') return;
      el.querySelector('#hdF').hidden = e.target.value !== 'hearing';
      el.querySelector('#rsF').hidden = e.target.value !== 'resolved';
    });
    el.addEventListener('click', async (e) => {
      if (e.target.closest('#sv')) return save();
      const b = e.target.closest('[data-f]'); if (!b) return;
      try { window.open(await UB.evidenceUrl(b.dataset.f), '_blank', 'noopener'); } catch { UB.toast('Couldn’t open that file.', 'bad'); }
    });
  };

  $('#q').oninput = render; $('#st').onchange = render;
  $('#rows').onclick = (e) => { const b = e.target.closest('[data-id]'); if (b) open(b.dataset.id); };
  if (staff) $('#sync').onclick = async () => {
    if (!(await UB.confirm('Publish the offense list?', 'This writes data/offenses.json to Firestore so students can pick from it. Check that it matches handbook Section VII first.', 'Publish'))) return;
    try { const r = await UB.syncOffenses(); UB.toast(r.provisional ? `Published ${r.count} types, ${r.provisional} still marked provisional in offenses.json` : `Published ${r.count} offense types`, r.provisional ? 'bad' : ''); offenses = Object.fromEntries((await UB.loadOffenses()).map((o) => [o.id, o])); }
    catch { UB.toast('Couldn’t publish the offense list.', 'bad'); }
  };

  const wanted = new URLSearchParams(location.search).get('case');
  let first = true;
  const stop = UB.watchCases((l) => {
    data = l; loaded = true; render();
    if (first && wanted) open(wanted);
    first = false;
    if (cur) paintModal();
  }, () => UB.toast('Couldn’t load complaints. Check your connection and refresh.', 'bad'));
  addEventListener('pagehide', stop);
})();
