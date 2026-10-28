import { UB } from '../app.js';
(async () => {
  await UB.ready;
  const { $, esc } = UB,
    me = UB.me,
    role = me.role;
  const q = new URLSearchParams(location.search);
  const next =
    ['file-complaint', 'dashboard'].includes(q.get('next')) && !(role === 'staff' && q.get('next') === 'file-complaint')
      ? q.get('next')
      : '';
  const roleLbl = { student: 'Student', faculty: 'Faculty', staff: 'SAEP Staff' }[role];
  const input = (id, label, { req = true, ph = '', max = 120, mode = '', type = 'text', hint = '' } = {}) =>
    `<div class="field"><label${req ? ' class="req"' : ''} for="${id}">${esc(label)}</label><input id="${id}" type="${type}" maxlength="${max}"${mode ? ` inputmode="${mode}"` : ''} placeholder="${esc(ph)}" autocomplete="off">${hint ? `<p class="hint">${esc(hint)}</p>` : ''}<p class="err"></p></div>`;

  $('#pEmail').textContent = me.email;
  $('#pRole').textContent = roleLbl;
  $('#av').textContent = me.name[0];
  $('#sub').textContent =
    role === 'staff'
      ? 'Keep your office details current. They appear with the updates you make on cases.'
      : 'Fill this in once. Your complaint form uses these details, so you don’t type them again.';
  $('#detNote').textContent =
    role === 'staff'
      ? 'Fields marked * are required.'
      : 'Fields marked * are required before you can file a complaint. SAEP sees these details on the complaints you file.';

  const departments = role === 'staff' ? [] : await UB.loadAcademics();
  const section = (title, sub, fields) =>
    `<section class="card sec"><h2>${title}</h2><p class="sec-sub">${sub}</p><div class="cols">${fields.join('')}</div></section>`;
  const personal = [
    input('name', 'Full name', { ph: 'Dela Cruz, Juan M.', hint: 'Shown on your complaints and used as your printed name.' }),
  ];
  if (role === 'student') personal.push(input('sid', 'Student no.', { max: 7, mode: 'numeric', ph: '2407880', hint: '7 digits.' }));
  if (role === 'faculty') personal.push(input('sid', 'Employee no.', { req: false, max: 20, ph: 'Optional' }));
  const work = [];
  if (role !== 'staff')
    work.push(
      UB.pickerHtml({
        id: 'pDept',
        label: 'Department',
        placeholder: 'Search or choose your department…',
        hint: role === 'student' ? 'Choosing a course fills this in for you.' : '',
      }),
    );
  if (role === 'student')
    work.push(
      UB.pickerHtml({
        id: 'pCourse',
        label: 'Course',
        placeholder: 'Search or choose your course…',
        hint: 'Choosing a department narrows this list.',
      }),
      input('section', 'Year & section', { req: false, max: 20, ph: 'e.g. 4B (optional)' }),
    );
  if (role === 'faculty') work.push(input('position', 'Position', { req: false, max: 80, ph: 'e.g. Instructor (optional)' }));
  if (role === 'staff') work.push(input('position', 'Position / designation', { max: 80, ph: 'e.g. SAEP Coordinator' }));
  $('#groups').innerHTML =
    section('Personal', 'Who you are on the complaints you file.', personal) +
    section(role === 'staff' ? 'Office' : 'School', role === 'staff' ? 'Your role at the SAEP Office.' : 'Where you study or teach.', work) +
    section('Contact', 'How the SAEP Office can reach you about a case.', [
      input('contact', 'Contact no.', { max: 20, type: 'tel', ph: '09XX XXX XXXX', hint: 'A mobile number the office can call or text.' }),
    ]);

  const pp =
    role === 'staff'
      ? null
      : UB.pairPicker({
          $,
          departments,
          dept: 'pDept',
          course: role === 'student' ? 'pCourse' : null,
          onChange: () => paint(),
        });
  const set = (id, v) => {
    const e = $('#' + id);
    if (e) e.value = v || '';
  };
  ['name', 'sid', 'section', 'position', 'contact'].forEach((k) => set(k, me[k]));
  pp?.set({ dept: me.dept, course: me.course });

  const flag = (el, m) => {
    const p = el.closest('.field').querySelector('.err');
    p.textContent = m || '';
    el.setAttribute('aria-invalid', !!m);
    return m;
  };
  const NEED_TOTAL = UB.missingFields({ role, name: '', sid: '', dept: '', course: '', contact: '', position: '' }).length;
  const val = (id) => ($('#' + id)?.value || '').trim();
  const liveProfile = () => {
    const ac = pp ? pp.value() : { dept: '', course: '' };
    return { role, name: val('name'), sid: val('sid'), position: val('position'), contact: val('contact'), dept: ac.dept, course: ac.course };
  };
  // Completion meter: follows what is typed, so people see it fill as they go.
  const meter = () => {
    const miss = UB.missingFields(liveProfile());
    const done = NEED_TOTAL - miss.length;
    $('#progTxt').textContent = miss.length ? `${done} of ${NEED_TOTAL} required details` : 'All required details filled';
    $('#progSub').textContent = miss.length ? `Still needed: ${miss.join(', ')}` : 'You are ready to file complaints.';
    $('#meterFill').style.width = (NEED_TOTAL ? (done / NEED_TOTAL) * 100 : 100) + '%';
    $('.prof-hero').classList.toggle('complete', !miss.length);
  };
  // Pill + notice follow what is saved, not what is typed.
  const paint = () => {
    const miss = UB.missingFields(UB.me);
    $('#pName').textContent = UB.me.name;
    $('#av').textContent = UB.me.name[0];
    $('#state').textContent = miss.length ? 'Profile incomplete' : 'Profile complete';
    $('#state').className = 'pill' + (miss.length ? '' : ' ok');
    const n = $('#need');
    n.hidden = !miss.length;
    n.innerHTML = miss.length
      ? `<b>${q.get('need') ? 'Welcome to UBridge. ' : ''}Complete your profile to continue.</b> Still needed: ${esc(miss.join(', '))}.${next === 'file-complaint' ? ' You’ll go straight back to the complaint form after saving.' : ''}`
      : '';
    meter();
    // The sidebar reminder follows the saved profile too, without waiting for the next page.
    if (!miss.length) document.querySelectorAll('.nav .warn-dot, .me .warn').forEach((x) => x.remove());
  };
  paint();

  // Unsaved changes: shown next to Save, and the browser asks before the page is closed.
  const snap = () => JSON.stringify([...['name', 'sid', 'section', 'position', 'contact'].map(val), liveProfile().dept, liveProfile().course]);
  let saved = snap(),
    msgTimer = 0;
  const note = (t, cls = '') => {
    const m = $('#saveMsg');
    clearTimeout(msgTimer);
    m.textContent = t;
    m.className = 'dirty ' + cls;
    m.hidden = !t;
  };
  const touch = () => {
    meter();
    if (snap() !== saved) note('Unsaved changes');
    else note('');
  };
  $('#f').addEventListener('input', touch);
  $('#f').addEventListener('change', touch);
  addEventListener('beforeunload', (e) => {
    if (snap() !== saved) e.preventDefault();
  });

  // Check each plain field when the person leaves it, so a mistake is shown next to it, not only after Save.
  const rules = {
    name: () => (val('name').length < 2 ? 'Enter your full name' : ''),
    sid: () =>
      role === 'student'
        ? !/^\d{7}$/.test(val('sid'))
          ? 'Student no. is 7 digits, e.g. 2407880'
          : ''
        : role === 'faculty' && val('sid') && !/^[\w-]{3,20}$/.test(val('sid'))
          ? 'Use letters, numbers or hyphens only'
          : '',
    position: () => (role === 'staff' && !val('position') ? 'Enter your position at the SAEP Office' : ''),
    contact: () => (!UB.PHONE.test(val('contact')) ? 'Enter a contact number SAEP can reach, e.g. 0917 123 4567' : ''),
  };
  $('#f').addEventListener('focusout', (e) => {
    const id = e.target.id;
    if (rules[id] && e.target.matches('input')) flag(e.target, rules[id]());
  });

  $('#f').onsubmit = async (e) => {
    e.preventDefault();
    const v = val;
    let first = null;
    const bad = (id, m) => {
      if (flag($('#' + id), m) && !first) first = $('#' + id);
    };
    Object.keys(rules).forEach((id) => {
      if ($('#' + id)) bad(id, rules[id]());
    });
    let academic = { dept: '', course: '' };
    if (pp) {
      academic = pp.value();
      const c = pp.check();
      if (c.dept) {
        flag($('#pDeptQ'), c.dept);
        first ||= $('#pDeptQ');
      } else flag($('#pDeptQ'), '');
      if (role === 'student') {
        if (c.course) {
          flag($('#pCourseQ'), c.course);
          first ||= $('#pCourseQ');
        } else flag($('#pCourseQ'), '');
      }
    }
    if (first) {
      UB.toast('Please fix the highlighted fields', 'bad');
      return first.focus();
    }
    const values = { name: v('name'), contact: v('contact') };
    if (role === 'student')
      Object.assign(values, { sid: v('sid'), dept: academic.dept, course: academic.course, section: v('section') });
    if (role === 'faculty') Object.assign(values, { sid: v('sid'), dept: academic.dept, position: v('position') });
    if (role === 'staff') values.position = v('position');
    const btn = $('#save');
    btn.disabled = true;
    btn.textContent = 'Saving…';
    note('');
    try {
      await UB.saveProfile(values);
    } catch (x) {
      btn.disabled = false;
      btn.textContent = 'Save profile';
      return UB.toast(
        x?.code === 'permission-denied'
          ? 'Couldn’t save. Check each field and try again.'
          : 'Couldn’t save. Check your connection and try again.',
        'bad',
      );
    }
    btn.disabled = false;
    btn.textContent = 'Save profile';
    saved = snap();
    paint();
    if (next && UB.isComplete(UB.me)) {
      UB.toast('Profile saved');
      note('Saved. Taking you back…', 'ok');
      return setTimeout(() => location.replace(next + '.html'), 600);
    }
    UB.toast('Profile saved');
    note('Saved', 'ok');
    msgTimer = setTimeout(() => note(''), 4000);
    // The reminder banner only exists on other pages, so there is nothing to clear here.
  };
})();
