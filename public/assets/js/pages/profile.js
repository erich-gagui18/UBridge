import { UB } from '../app.js';
(async () => {
  await UB.ready;
  const { $, esc } = UB, me = UB.me, role = me.role;
  const q = new URLSearchParams(location.search);
  const next = ['file-complaint', 'dashboard'].includes(q.get('next')) && !(role === 'staff' && q.get('next') === 'file-complaint') ? q.get('next') : '';
  const roleLbl = { student: 'Student', faculty: 'Faculty', staff: 'SAEP Staff' }[role];
  const input = (id, label, { req = true, ph = '', max = 120, mode = '', type = 'text', hint = '' } = {}) =>
    `<div class="field"><label${req ? ' class="req"' : ''} for="${id}">${esc(label)}</label><input id="${id}" type="${type}" maxlength="${max}"${mode ? ` inputmode="${mode}"` : ''} placeholder="${esc(ph)}" autocomplete="off">${hint ? `<p class="hint">${esc(hint)}</p>` : ''}<p class="err"></p></div>`;

  $('#email').value = me.email;
  $('#role').value = roleLbl;
  $('#av').textContent = me.name[0];
  $('#pRole').textContent = roleLbl;
  $('#sub').textContent = role === 'staff'
    ? 'Keep your office details current. They appear with the updates you make on cases.'
    : 'Fill this in once. Your complaint form uses these details, so you don’t type them again.';
  $('#detNote').textContent = role === 'staff' ? 'Fields marked * are required.' : 'Fields marked * are required before you can file a complaint. SAEP sees these details on the complaints you file.';

  const departments = role === 'staff' ? [] : await UB.loadAcademics();
  const parts = [input('name', 'Full name', { ph: 'Dela Cruz, Juan M.', hint: 'Shown on your complaints and used as your printed name.' })];
  if (role === 'student') parts.push(input('sid', 'Student no.', { max: 7, mode: 'numeric', ph: '2407880' }));
  if (role === 'faculty') parts.push(input('sid', 'Employee no.', { req: false, max: 20, ph: 'Optional' }));
  if (role !== 'staff') parts.push(UB.pickerHtml({ id: 'pDept', label: 'Department', placeholder: 'Search or choose your department…', hint: role === 'student' ? 'Choosing a course fills this in for you.' : '' }));
  if (role === 'student') parts.push(UB.pickerHtml({ id: 'pCourse', label: 'Course', placeholder: 'Search or choose your course…', hint: 'Choosing a department narrows this list.' }), input('section', 'Year & section', { req: false, max: 20, ph: 'e.g. 4B (optional)' }));
  if (role === 'faculty') parts.push(input('position', 'Position', { req: false, max: 80, ph: 'e.g. Instructor (optional)' }));
  if (role === 'staff') parts.push(input('position', 'Position / designation', { max: 80, ph: 'e.g. SAEP Coordinator' }));
  parts.push(input('contact', 'Contact no.', { max: 20, type: 'tel', ph: '09XX XXX XXXX' }));
  $('#cols').innerHTML = parts.join('');

  const pp = role === 'staff' ? null : UB.pairPicker({ $, departments, dept: 'pDept', course: role === 'student' ? 'pCourse' : null, onChange: () => paint() });
  const set = (id, v) => { const e = $('#' + id); if (e) e.value = v || ''; };
  ['name', 'sid', 'section', 'position', 'contact'].forEach((k) => set(k, me[k]));
  pp?.set({ dept: me.dept, course: me.course });

  const flag = (el, m) => {
    const p = el.closest('.field').querySelector('.err');
    p.textContent = m || '';
    el.setAttribute('aria-invalid', !!m);
    return m;
  };
  // Status pill + notice follow what is saved, not what is typed.
  const paint = () => {
    const miss = UB.missingFields(UB.me);
    $('#pName').textContent = UB.me.name;
    $('#av').textContent = UB.me.name[0];
    $('#state').textContent = miss.length ? 'Incomplete' : 'Complete';
    $('#state').className = 'pill' + (miss.length ? '' : ' ok');
    const n = $('#need');
    n.hidden = !miss.length;
    n.innerHTML = miss.length
      ? `<b>${q.get('need') ? 'Welcome to UBridge. ' : ''}Complete your profile to continue.</b> Still needed: ${esc(miss.join(', '))}.${next === 'file-complaint' ? ' You’ll go straight back to the complaint form after saving.' : ''}`
      : '';
  };
  paint();

  $('#f').onsubmit = async (e) => {
    e.preventDefault();
    const v = (id) => ($('#' + id)?.value || '').trim();
    let first = null;
    const bad = (id, m) => { if (flag($('#' + id), m) && !first) first = $('#' + id); };
    bad('name', v('name').length < 2 ? 'Enter your full name' : '');
    if (role === 'student') bad('sid', !/^\d{7}$/.test(v('sid')) ? 'Student no. is 7 digits, e.g. 2407880' : '');
    if (role === 'faculty') bad('sid', v('sid') && !/^[\w-]{3,20}$/.test(v('sid')) ? 'Use letters, numbers or hyphens only' : '');
    if (role === 'staff') bad('position', !v('position') ? 'Enter your position at the SAEP Office' : '');
    bad('contact', !UB.PHONE.test(v('contact')) ? 'Enter a contact number SAEP can reach, e.g. 0917 123 4567' : '');
    let academic = { dept: '', course: '' };
    if (pp) {
      academic = pp.value();
      const c = pp.check();
      if (c.dept) { flag($('#pDeptQ'), c.dept); first ||= $('#pDeptQ'); } else flag($('#pDeptQ'), '');
      if (role === 'student') { if (c.course) { flag($('#pCourseQ'), c.course); first ||= $('#pCourseQ'); } else flag($('#pCourseQ'), ''); }
    }
    if (first) { UB.toast('Please fix the highlighted fields', 'bad'); return first.focus(); }
    const values = { name: v('name'), contact: v('contact') };
    if (role === 'student') Object.assign(values, { sid: v('sid'), dept: academic.dept, course: academic.course, section: v('section') });
    if (role === 'faculty') Object.assign(values, { sid: v('sid'), dept: academic.dept, position: v('position') });
    if (role === 'staff') values.position = v('position');
    const btn = $('#save');
    btn.disabled = true;
    btn.textContent = 'Saving…';
    try {
      await UB.saveProfile(values);
    } catch (x) {
      btn.disabled = false;
      btn.textContent = 'Save profile';
      return UB.toast(x?.code === 'permission-denied' ? 'Couldn’t save. Check each field and try again.' : 'Couldn’t save. Check your connection and try again.', 'bad');
    }
    btn.disabled = false;
    btn.textContent = 'Save profile';
    paint();
    if (next && UB.isComplete(UB.me)) { UB.toast('Profile saved'); return setTimeout(() => location.replace(next + '.html'), 600); }
    UB.toast('Profile saved');
    // The reminder banner only exists on other pages, so there is nothing to clear here.
  };
})();
