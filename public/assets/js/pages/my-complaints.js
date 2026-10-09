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
  let cur = null; // the open case dialog: {id, m, dirty, history, audit, stopHistory, stopAudit}
  UB.loadOffenses().then((l) => { offenses = Object.fromEntries(l.map((o) => [o.id, o])); }).catch(() => {});

  const stats = () => {
    const n = (s) => data.filter((c) => c.status === s).length;
    const p = data.length ? Math.round((n('resolved') / data.length) * 100) : 0;
    $('#stats').innerHTML = [[data.length, 'Total filed', ''], [n('submitted') + n('review'), 'Submitted / in review', 'Needs follow-up'], [n('hearing'), 'For hearing', 'Scheduled'], [n('resolved'), 'Resolved', p + '% resolution']]
      .map(([v, a, s]) => `<div class="card stat"><b>${v}</b><span>${a}</span>${s ? `<small>${s}</small>` : ''}</div>`).join('');
  };
  const render = () => {
    const q = $('#q').value.trim().toLowerCase(), st = $('#st').value;
    const rows = data.filter((c) => (!st || c.status === st) && (!q || [c.id, c.student, c.sid, c.type, c.offenseOther, c.program, c.filedByName].some((x) => String(x ?? '').toLowerCase().includes(q))));
    $('#rows').innerHTML = rows.map((c) => `<tr><td>${esc(c.id)}</td><td><b>${esc(c.student)}</b><small>${esc(c.sid)} · ${esc([c.program, c.section].filter(Boolean).join(' '))}</small></td>${staff ? `<td>${esc(c.filedByName)}<small>${esc(c.filedByRole || '')}</small></td>` : ''}<td><span class="chip ${UB.degClass(c.offense)}">${esc(c.offense)}</span></td><td>${UB.fmt(c.filed)}</td><td>${UB.chip(c.status)}</td><td><button class="link" data-id="${esc(c.id)}">View</button></td></tr>`).join('');
    $('#none').hidden = !loaded || rows.length > 0;
    stats();
  };

  const evidence = (c) => {
    if (!c.files?.length) return 'No evidence attached';
    let k = -1;
    return `<ul class="ev">${c.files.map((x) => (x.path ? `<li><button class="link ev-btn" type="button" data-ev="${++k}" title="View ${esc(x.name)}">${/\.pdf$/i.test(x.name) ? 'PDF' : 'IMG'} · ${esc(x.name)}</button></li>` : `<li>${esc(x.name)} <small class="muted">(name only, file not stored)</small></li>`)).join('')}</ul>`;
  };
  // The progress bar and the history are drawn from the same case + history data in one pass, so they can't disagree.
  const reached = (c, hist) => Object.fromEntries([['submitted', UB.fmtTs(c.createdAt)], ...hist.map((h) => [h.to, UB.fmtTs(h.at)])]);
  const timeline = (c, hist) => {
    const who = (h) => (staff ? esc(cur?.audit?.[h.id] || h.byName || 'SAEP Staff') : 'SAEP Staff');
    const lag = hist.length < (c.hCount || 0); // the case already changed but its history entry hasn't arrived yet
    const items = [`<li><b>Filed</b><small>${esc(c.filedByName)} · ${UB.fmtTs(c.createdAt)}</small></li>`,
      ...hist.map((h, k) => `<li class="${k === hist.length - 1 && !lag ? 'latest' : ''}"><b>${UB.STATUS[h.from]} → ${UB.STATUS[h.to]}</b><small>${who(h)} · ${UB.fmtTs(h.at)}</small>${h.remark ? `<p>${esc(h.remark)}</p>` : ''}</li>`),
      ...(lag ? ['<li class="sync"><b>Updating…</b><small>Fetching the latest history</small></li>'] : [])];
    return `<ol class="hist" aria-label="Status history" aria-live="polite">${items.join('')}</ol>`;
  };
  const modalHtml = (c) => {
    const o = offenses[c.offenseId], hist = cur?.history || [];
    const form = staff ? `<div class="staffbox"><h3>Update this case</h3>
      <div class="field"><label for="ns">Status</label><select id="ns">${UB.ORDER.map((s) => `<option value="${s}" ${s === c.status ? 'selected' : ''}>${UB.STATUS[s]}</option>`).join('')}</select></div>
      <div class="field" id="hdF" ${c.status === 'hearing' ? '' : 'hidden'}><label for="hd" class="req">Hearing date</label><input id="hd" type="date" value="${esc(c.hearingDate || '')}"></div>
      <div class="field" id="rsF" ${c.status === 'resolved' ? '' : 'hidden'}><label for="rs" class="req">Resolution note</label><textarea id="rs" maxlength="2000" style="min-height:90px">${esc(c.resolution || '')}</textarea></div>
      ${UB.proc.processForm(c, { commission: UB.proc.commissionOf(c, data) })}
      <div class="field"><label for="rm">Remark for the history</label><input id="rm" maxlength="500" placeholder="e.g. Both parties notified" aria-describedby="rmHint"><small class="muted" id="rmHint">Optional, but required (5+ characters) when moving a case back to an earlier status.</small></div></div>` : '';
    return `<div class="case-head"><div><h2>${esc(c.id)} <button class="link" type="button" data-copy="${esc(c.id)}">Copy</button></h2><p class="muted">${esc(UB.offenseLabel(c))}</p></div><span class="live"><i></i>Live</span></div>
      ${UB.progress(c.status, reached(c, hist))}
      <div class="case-grid"><div class="case-main"><dl><dt>Respondent</dt><dd>${esc(c.student)} (${esc(c.sid)})</dd><dt>Course</dt><dd>${esc([c.program, c.section].filter(Boolean).join(' '))}</dd>
      ${c.rDept ? `<dt>Department</dt><dd>${esc(c.rDept)}</dd>` : ''}${c.rEmail || c.rContact ? `<dt>Respondent contact</dt><dd>${[c.rEmail, c.rContact].filter(Boolean).map(esc).join(' · ')}</dd>` : ''}
      ${staff ? `<dt>Complainant</dt><dd>${esc(c.filedByName)} · ${esc(c.filedByRole || '')}${c.filedByEmail ? ` · ${esc(c.filedByEmail)}` : ''}</dd>${c.cDept || c.cContact ? `<dt>Complainant details</dt><dd>${[c.cSid, c.cCourse, c.cDept, c.cContact].filter(Boolean).map(esc).join(' · ')}</dd>` : ''}` : ''}
      ${c.signatureImg ? `<dt>Signature</dt><dd><img class="sigimg" alt="Complainant signature" src="${esc(c.signatureImg)}">${c.signature ? `<small class="muted" style="display:block">${esc(c.signature)}</small>` : ''}</dd>` : c.signature && staff ? `<dt>E-signature</dt><dd>${esc(c.signature)}</dd>` : ''}
      <dt>Received</dt><dd>${UB.fmtTs(c.createdAt)}</dd>${UB.proc.processRows(c, { staff, commission: UB.proc.commissionOf(c, data) })}
      <dt>Category</dt><dd>${esc(c.offense === 'Unclassified' ? 'Unclassified (SAEP to assess)' : c.offense)}${o?.section ? ` <small class="muted">${esc(o.section)}</small>` : ''}</dd>${o?.sanction ? `<dt>Handbook sanction</dt><dd>${esc(o.sanction)}</dd>` : ''}
      <dt>Incident</dt><dd>${UB.fmt(c.date)}</dd><dt>Filed</dt><dd>${UB.fmt(c.filed)}</dd><dt>Updated</dt><dd>${UB.fmtTs(c.updatedAt || c.createdAt)}</dd>
      ${c.resolution ? `<dt>Decision</dt><dd>${esc(c.resolution)}</dd>` : ''}
      <dt>Location</dt><dd>${esc(c.location)}</dd><dt>Description</dt><dd>${esc(c.desc)}</dd><dt>Evidence</dt><dd>${evidence(c)}</dd></dl></div>
      <aside class="case-side"><h3>History</h3>${timeline(c, hist)}${form}</aside></div>
      <div class="actions"><button class="btn" data-close>Close</button>${staff ? '<button class="btn primary" id="sv">Save changes</button>' : ''}</div>`;
  };
  const paintModal = () => {
    const c = data.find((x) => x.id === cur?.id);
    if (!c) return;
    // Don't wipe what a staff member is typing; tell them instead.
    if (cur.dirty) { if ((c.hCount || 0) !== cur.seen) { UB.toast('This case was just updated by someone else. Close and reopen it to see the latest.', 'bad'); cur.seen = c.hCount || 0; } return; }
    cur.seen = c.hCount || 0;
    if (cur.status && cur.status !== c.status) UB.toast(`Status updated: ${UB.STATUS[c.status]}`);
    cur.status = c.status;
    cur.m.set(modalHtml(c));
  };

  const save = async () => {
    const c = data.find((x) => x.id === cur.id), el = cur.m.el, v = (s) => el.querySelector(s)?.value ?? '';
    const status = v('#ns'), hearingDate = status === 'hearing' ? v('#hd') : (c.hearingDate || ''), resolution = status === 'resolved' ? v('#rs').trim() : (c.resolution || ''), remark = v('#rm').trim();
    const pr = UB.proc.readProcess(el, c, status);
    if (pr.error) return UB.toast(pr.error, 'bad');
    const notes = UB.proc.describeChanges(c, pr.values), pChanged = UB.proc.processChanged(c, pr.values);
    if (status === 'hearing' && !hearingDate) return UB.toast('Choose the hearing date.', 'bad');
    if (status === 'resolved' && resolution.length < 5) return UB.toast('Add a resolution note (at least 5 characters).', 'bad');
    // Reopening or stepping back is allowed (mistakes happen) but must be explained in the history.
    if (UB.ORDER.indexOf(status) < UB.ORDER.indexOf(c.status) && remark.length < 5)
      return UB.toast('Add a remark (at least 5 characters) explaining why the case is moving back.', 'bad');
    if (status === c.status && hearingDate === (c.hearingDate || '') && resolution === (c.resolution || '') && !pChanged && !remark) return UB.toast('Nothing has changed');
    if (!(await UB.confirm('Save changes?', `${c.id}: “${UB.STATUS[c.status]}” → “${UB.STATUS[status]}”. The filer will be notified in the app.`, 'Save'))) return;
    try {
      await UB.updateCase(c, { status, hearingDate, resolution, remark, process: pr.values, notes });
      cur.dirty = false; cur.m.close(); UB.toast('Case updated');
    } catch (e) {
      UB.toast(e.code === 'permission-denied' ? 'The case changed while you were editing. Reopen it and try again.' : 'Couldn’t update the case. Try again.', 'bad');
    }
  };

  const open = (id) => {
    const c = data.find((x) => x.id === id); if (!c) return;
    cur = { id, dirty: false, history: [], audit: {}, seen: c.hCount || 0, status: c.status };
    cur.m = UB.modal(modalHtml(c), 'Complaint ' + id, () => { cur.stopHistory?.(); cur.stopAudit?.(); cur = null; });
    cur.stopHistory = UB.watchHistory(id, (h) => { if (!cur) return; cur.history = h; if (!cur.dirty) paintModal(); }, () => {});
    // Only staff may read the audit entries; students never subscribe.
    if (staff) cur.stopAudit = UB.watchAudit(id, (a) => { if (!cur) return; cur.audit = a; if (!cur.dirty) paintModal(); }, () => {});
    const el = cur.m.el;
    el.querySelector('.modal').classList.add('wide');
    el.addEventListener('input', () => { if (cur) cur.dirty = true; });
    el.addEventListener('change', (e) => {
      if (e.target.id === 'pNotice' && e.target.value) {
        const due = el.querySelector('#pDue'), min = UB.proc.addDays(e.target.value, UB.proc.ANSWER_DAYS);
        due.min = min; if (!due.value || due.value < min) due.value = min;
      }
      if (e.target.id !== 'ns') return;
      el.querySelector('#hdF').hidden = e.target.value !== 'hearing';
      el.querySelector('#rsF').hidden = e.target.value !== 'resolved';
      el.querySelector('#pDec').hidden = e.target.value !== 'resolved';
    });
    el.addEventListener('click', async (e) => {
      if (e.target.closest('#sv')) return save();
      const b = e.target.closest('[data-ev]'); if (!b) return;
      const c = data.find((x) => x.id === cur?.id); if (!c) return;
      UB.openViewer(c.files.filter((x) => x.path), Number(b.dataset.ev), (f) => UB.loadEvidence(c, f));
    });
  };

  $('#q').oninput = render; $('#st').onchange = render;
  $('#rows').onclick = (e) => { const b = e.target.closest('[data-id]'); if (b) open(b.dataset.id); };
  if (staff) $('#sync').onclick = async () => {
    if (!(await UB.confirm('Publish the offense list?', 'This writes data/offenses.json to Firestore so students can pick from it. Check that it matches the College Discipline Board Manual first. Entries no longer in the file are removed.', 'Publish'))) return;
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
