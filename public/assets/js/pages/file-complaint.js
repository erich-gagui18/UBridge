import { UB } from '../app.js';
(async () => {
  await UB.ready;
  const { $, esc } = UB, f = $('#f');
  const F = ['cSid', 'cCourse', 'cDept', 'cContact', 'student', 'sid', 'program', 'rEmail', 'rDept', 'rContact', 'type', 'date', 'location', 'desc', 'signature'];
  let files = [], offenses = [];

  // Evidence: only offered when Cloud Storage is on. Otherwise say plainly that nothing would be stored.
  // Complainant: name and email come from the signed-in account and cannot be edited here.
  const me = UB.me, student = me.role === 'student';
  $('#cName').value = me.name;
  $('#cEmail').value = me.email;
  $('#filedDate').value = UB.todayPH();
  if (!student) {
    // Faculty have no student number or course, so those two lines are optional for them.
    $('#cSidL').textContent = 'Employee no. (optional)';
    $('#cCourseL').textContent = 'Course (optional)';
    $('#cSidL').classList.remove('req');
    $('#cCourseL').classList.remove('req');
    $('#cSid').placeholder = '';
    $('#cCourse').placeholder = 'Not applicable';
  }
  const norm = (x) => x.replace(/\s+/g, ' ').trim().toLowerCase();
  const PHONE = /^[0-9+() -]{7,20}$/;

  const evidenceOn = UB.USE_STORAGE;
  $('#evOn').hidden = !evidenceOn;
  $('#evOff').hidden = evidenceOn;

  // Offense types come from the handbook catalog (Firestore offenses/{id}); the category follows the type.
  try {
    offenses = await UB.loadOffenses();
  } catch {
    offenses = [];
  }
  offenses.forEach((o) => $('#type').insertAdjacentHTML('beforeend', `<option value="${esc(o.id)}">${esc(o.type)}</option>`));
  if (!offenses.length) {
    $('#noCatalog').hidden = false;
    f.querySelector('.btn.primary').disabled = true;
  }
  const chosen = () => offenses.find((o) => o.id === $('#type').value);
  const showOffense = () => {
    const o = chosen();
    $('#offInfo').hidden = !o;
    if (!o) return;
    $('#offInfo').innerHTML = `<b>Category: <span class="chip ${esc(o.category)}">${esc(o.category)}</span></b>${o.section ? ` <small class="muted">${esc(o.section)}</small>` : ''}${o.sanction ? `<p class="hint">Sanction in the handbook: ${esc(o.sanction)}</p>` : ''}<p class="hint">SAEP reviews the category during assessment. Not sure? <a href="ai-guide.html">Ask the AI Guide</a>.</p>`;
  };
  $('#type').addEventListener('change', showOffense);

  const today = UB.todayPH(); // Philippine date, not the UTC date
  $('#date').max = today;
  const err = (el, m) => {
    const p = el.closest('.field').querySelector('.err');
    p.textContent = m;
    el.setAttribute('aria-invalid', !!m);
    return m;
  };
  const rules = {
    cSid: (v) => (student ? !/^\d{7}$/.test(v) && 'Student no. is 7 digits, e.g. 2407880' : v !== '' && !/^[\w-]{3,20}$/.test(v) && 'Use letters, numbers or hyphens only'),
    cCourse: (v) => student && !v && 'Enter your course, e.g. BSIT',
    cDept: (v) => !v && 'Enter your department',
    cContact: (v) => !PHONE.test(v) && 'Enter a contact number SAEP can reach, e.g. 0917 123 4567',
    student: (v) => !v && 'Enter the respondent’s full name',
    sid: (v) => !/^\d{7}$/.test(v) && 'Student no. is 7 digits, e.g. 2407880',
    program: (v) => !v && 'Enter the course, e.g. BSIT',
    rEmail: (v) => v !== '' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) && 'Enter a valid email address or leave it blank',
    rDept: (v) => !v && 'Enter the respondent’s department',
    rContact: (v) => v !== '' && !PHONE.test(v) && 'Enter a valid contact number or leave it blank',
    type: (v) => !v && 'Select the type of offense',
    date: (v) => (!v ? 'Choose the date it happened' : v > today && 'The date can’t be in the future'),
    location: (v) => !v && 'Enter where it happened',
    desc: (v) => v.length < 30 && 'Add at least 30 characters so SAEP can review it',
    signature: (v) => (!v ? 'Type your full name to sign' : norm(v) !== norm(me.name) && 'Type your name exactly as shown under Complainant'),
  };
  const data = () => Object.fromEntries(F.map((k) => [k, $('#' + k).value.trim()]));
  const store = () => UB.save('draft', data());
  const d = UB.load('draft', null);
  if (d) {
    F.forEach((k) => ($('#' + k).value = d[k] || ''));
    if ($('#type').value !== (d.type || '')) $('#type').value = ''; // saved type no longer in the catalog
    showOffense();
    UB.toast('Draft restored');
  }
  const count = () => {
    const n = $('#desc').value.trim().length;
    $('#cnt').textContent = n < 30 ? `${n} / 30 minimum` : `${n} characters`;
  };
  count();
  let timer;
  f.addEventListener('input', () => {
    count();
    clearTimeout(timer);
    timer = setTimeout(store, 600);
  });
  F.forEach((k) =>
    $('#' + k).addEventListener('blur', (e) => {
      if (e.target.value) err(e.target, rules[k](e.target.value.trim()) || '');
    }),
  );

  const renderFiles = () =>
    ($('#files').innerHTML = files
      .map(
        (x, i) =>
          `<li><span>${esc(x.name)} <small class="muted">${(x.size / 1048576).toFixed(1)} MB</small></span><button type="button" class="link" data-i="${i}" aria-label="Remove ${esc(x.name)}">Remove</button></li>`,
      )
      .join(''));
  // Validate by extension, size AND file signature (magic bytes), then re-type the file from what it really is.
  const SIG = { 'image/png': [0x89, 0x50, 0x4e, 0x47], 'image/jpeg': [0xff, 0xd8, 0xff], 'application/pdf': [0x25, 0x50, 0x44, 0x46] };
  const sniff = async (x) => {
    const b = new Uint8Array(await x.slice(0, 4).arrayBuffer());
    return Object.keys(SIG).find((m) => SIG[m].every((v, i) => b[i] === v));
  };
  const add = async (list) => {
    for (const x of [...list]) {
      if (!/\.(png|jpe?g|pdf)$/i.test(x.name)) { UB.toast(`${x.name}: only PNG, JPG or PDF`, 'bad'); continue; }
      if (x.size === 0 || x.size > 10485760) { UB.toast(`${x.name} must be under 10 MB`, 'bad'); continue; }
      if (x.name.length > 120) { UB.toast(`${x.name}: file name is too long`, 'bad'); continue; }
      if (files.length >= 5) { UB.toast('You can attach up to 5 files', 'bad'); continue; }
      const t = await sniff(x);
      if (!t) { UB.toast(`${x.name} isn’t a real PNG, JPG or PDF`, 'bad'); continue; }
      files.push(new File([x], x.name, { type: t }));
    }
    renderFiles();
  };
  if (evidenceOn) {
    $('#file').onchange = (e) => { add(e.target.files); e.target.value = ''; };
    $('#files').onclick = (e) => {
      const b = e.target.closest('[data-i]');
      if (b) { files.splice(b.dataset.i, 1); renderFiles(); }
    };
    const drop = $('#drop');
    ['dragover', 'dragenter'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
    drop.addEventListener('drop', (e) => add(e.dataTransfer.files));
  }
  $('#draft').onclick = () => { store(); UB.toast('Draft saved on this device'); };

  f.onsubmit = async (e) => {
    e.preventDefault();
    let first = null;
    F.forEach((k) => {
      const el = $('#' + k);
      if (err(el, rules[k](el.value.trim()) || '') && !first) first = el;
    });
    const consent = $('#consent');
    $('#eConsent').textContent = consent.checked ? '' : 'You must agree to the privacy notice to submit';
    if (!consent.checked && !first) first = consent;
    if (first) { UB.toast('Please fix the highlighted fields', 'bad'); return first.focus(); }
    const o = chosen();
    const note = evidenceOn ? '' : ' Evidence files are not stored in this version, so bring any evidence to the SAEP Office.';
    if (!(await UB.confirm('Submit this complaint?', `It goes straight to the SAEP Office and can’t be edited from your account afterwards.${note}`, 'Submit'))) return;
    const btn = f.querySelector('.btn.primary');
    btn.disabled = true;
    btn.textContent = 'Submitting…';
    let c;
    try {
      const v = data();
      const { type: _t, ...rest } = v; // everything on the form except the offense type, which comes from the catalog
      c = await UB.create({ ...rest, offenseId: o.id, type: o.type, offense: o.category }, files);
    } catch (e) {
      btn.disabled = false;
      btn.textContent = 'Submit complaint';
      // The server checks the filing date against its own clock, so a wrong device date or time is rejected.
      return UB.toast(
        e?.code === 'permission-denied'
          ? 'Couldn’t submit. Check that your device date and time are correct, then try again.'
          : 'Couldn’t submit. Check your connection and try again.',
        'bad',
      );
    }
    UB.drop('draft');
    if (c.uploadFailed) UB.toast('Submitted, but some evidence didn’t upload. Tell SAEP or re-send it.', 'bad');
    UB.modal(
      `<div class="done-msg"><div class="ok">${UB.icon('check')}</div><h2>Complaint submitted</h2><p class="muted">SAEP will review it. Your case number is</p><p><b style="font-size:20px">${esc(c.id)}</b> <button class="link" type="button" data-copy="${esc(c.id)}">Copy</button></p>
      ${evidenceOn ? '' : '<p class="notice">No evidence files were stored. Bring them to the SAEP Office and quote this case number.</p>'}
      <div class="actions"><a class="btn" href="dashboard.html">Back home</a><a class="btn primary" href="my-complaints.html?case=${encodeURIComponent(c.id)}">Track this case</a></div></div>`,
      'Complaint submitted',
    );
  };
})();
