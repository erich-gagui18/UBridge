import { UB } from '../app.js';
(async () => {
  await UB.ready;
  const { $, esc } = UB,
    f = $('#f');
  const F = ['student', 'sid', 'rEmail', 'rContact', 'type', 'offenseOther', 'date', 'location', 'desc', 'signature'];
  let files = [],
    offenses = [],
    timer;

  // Evidence: only offered when Cloud Storage is on. Otherwise say plainly that nothing would be stored.
  // Complainant: name and email come from the signed-in account and cannot be edited here.
  const me = UB.me,
    student = me.role === 'student';
  $('#cName').value = me.name;
  $('#cEmail').value = me.email;
  $('#filedDate').value = UB.todayPH();
  // Complainant details are the saved profile (the form is only reachable once it is complete). Faculty have no course.
  $('#cSid').value = me.sid || '';
  $('#cCourse').value = me.course || '';
  $('#cDept').value = me.dept || '';
  $('#cContact').value = me.contact || '';
  if (!student) {
    $('#cSidL').textContent = 'Employee no.';
    ['cSid', 'cCourse'].forEach((k) => {
      if (!$('#' + k).value) $('#' + k).closest('.field').hidden = true;
    });
  }
  const norm = (x) => x.replace(/\s+/g, ' ').trim().toLowerCase();
  const PHONE = /^[0-9+() -]{7,20}$/;

  const evidenceOn = true; // inline (Firestore) while Cloud Storage is off, Storage when it is on
  $('#evLimit').textContent = UB.USE_STORAGE
    ? 'Images are shrunk automatically; PDFs up to 10 MB each.'
    : 'Photos are shrunk automatically. PDFs must be under 700 KB each (compress larger ones, or bring them to the SAEP Office).';

  // Respondent: department and course are linked pickers (pick one and the other follows).
  $('#mDept').outerHTML = UB.pickerHtml({
    id: 'rDept',
    label: 'Department',
    placeholder: 'Search or choose the department…',
  });
  $('#mCourse').outerHTML = UB.pickerHtml({
    id: 'program',
    label: 'Course',
    placeholder: 'Search or choose the course…',
  });
  const pp = UB.pairPicker({
    $,
    departments: await UB.loadAcademics(),
    dept: 'rDept',
    course: 'program',
    onChange: () => {
      clearTimeout(timer);
      timer = setTimeout(store, 600);
    },
  });

  // Offense types come from the handbook catalog (Firestore offenses/{id}); the category follows the type.
  try {
    offenses = await UB.loadOffenses();
  } catch {
    offenses = [];
  }
  // Searchable list (type to filter, arrow keys + Enter to pick), grouped by degree.
  // The list follows the place chosen below: on campus shows every offense; off campus or online shows only the
  // offenses that can happen away from the campus (offenses.json `venues`). "Others" is always available.
  const itemsFor = (v) => [
    ...offenses
      .filter((o) => UB.venuesOf(o).includes(v))
      .map((o) => ({ id: o.id, label: o.type, group: o.category, hint: o.section })),
    { id: UB.OTHER_OFFENSE.id, label: 'Others', group: 'Not in the list', hint: 'Describe it yourself' },
  ];
  const cb = UB.combobox({
    input: $('#typeQ'),
    hidden: $('#type'),
    list: $('#typeList'),
    items: itemsFor('campus'),
  });
  if (!offenses.length) $('#noCatalog').hidden = false;
  const chosen = () =>
    $('#type').value === UB.OTHER_OFFENSE.id ? UB.OTHER_OFFENSE : offenses.find((o) => o.id === $('#type').value);
  const showOffense = () => {
    const o = chosen();
    $('#offInfo').hidden = !o;
    $('#otherOffField').hidden = o?.id !== UB.OTHER_OFFENSE.id;
    if (!o) return;
    if (o.id === UB.OTHER_OFFENSE.id) {
      $('#offInfo').innerHTML =
        '<b>Category: <span class="chip">To be classified by SAEP</span></b><p class="hint">Describe the offense below. Check the list first, since most behaviors are already covered. <a href="ai-guide.html">Ask the AI Guide</a> if you are unsure.</p>';
      return;
    }
    $('#offInfo').innerHTML =
      `<b>Category: <span class="chip ${UB.degClass(o.category)}">${esc(o.category)}</span></b>${o.section ? ` <small class="muted">${esc(o.section)}</small>` : ''}${o.sanction ? `<p class="hint">Interventions in the discipline policy: ${esc(o.sanction)}</p>` : ''}${o.category === 'First Degree' ? '<p class="notice">SAEP assesses every complaint first. First Degree offenses are forwarded to the respondent’s department, and the College Discipline Board handles the third commission of a First Degree offense. Second and Third Degree offenses are handled by the College Discipline Board.</p>' : ''}<p class="hint">SAEP reviews the category during assessment. Not sure? <a href="ai-guide.html">Ask the AI Guide</a>.</p>`;
  };
  $('#type').addEventListener('change', showOffense);

  const today = UB.todayPH(); // Philippine date, not the UTC date
  $('#date').max = today;
  const flag = (id, m) => err($('#' + id), m || '');
  const err = (el, m) => {
    const p = el.closest('.field').querySelector('.err');
    p.textContent = m;
    el.setAttribute('aria-invalid', !!m);
    return m;
  };
  const rules = {
    student: (v) => !v && 'Enter the respondent’s full name',
    sid: (v) => !/^\d{7}$/.test(v) && 'Student no. is 7 digits, e.g. 2407880',
    rEmail: (v) => v !== '' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) && 'Enter a valid email address or leave it blank',
    rContact: (v) => v !== '' && !PHONE.test(v) && 'Enter a valid contact number or leave it blank',
    type: (v) => !v && 'Select the type of offense',
    offenseOther: (v) =>
      $('#type').value === UB.OTHER_OFFENSE.id && v.length < 3 && 'Describe the offense in a few words',
    date: (v) => (!v ? 'Choose the date it happened' : v > today && 'The date can’t be in the future'),
    location: (v) => !v && PLACE[venue()].err,
    desc: (v) => v.length < 30 && 'Add at least 30 characters so SAEP can review it',
    signature: (v) =>
      !v
        ? 'Type your full name to sign'
        : norm(v) !== norm(me.name) && 'Type your name exactly as shown under Complainant',
  };
  const data = () => ({ ...Object.fromEntries(F.map((k) => [k, $('#' + k).value.trim()])), resp: pp.value() });
  const venue = () => document.querySelector('[name=venue]:checked')?.value || 'campus';
  const grounds = () => [...document.querySelectorAll('[name=ground]:checked')].map((x) => x.value);
  // One question, not two: the toggle sets the context and the single location box adapts to it.
  const PLACE = {
    campus: {
      aria: 'Room or building',
      ph: 'Room 204, A Building',
      hint: 'The room, building or University activity, including online classes and University social media.',
      err: 'Enter the room, building or activity',
    },
    offcampus: {
      aria: 'Place or platform',
      ph: 'e.g. Facebook group chat, a mall, a street',
      hint: 'Name the place or the online platform where it happened.',
      err: 'Enter the place or platform',
    },
  };
  const showVenue = () => {
    const v = venue(),
      t = PLACE[v];
    $('#jurBox').hidden = v !== 'offcampus';
    $('#eJur').textContent = '';
    $('#location').placeholder = t.ph;
    $('#location').setAttribute('aria-label', t.aria);
    $('#locHint').textContent = t.hint;
    refreshOffenses();
  };
  // Re-filter the offense list for the chosen place. A pick that no longer fits is cleared, and the person is told why.
  function refreshOffenses() {
    const v = venue(),
      list = itemsFor(v),
      n = list.length - 1;
    cb.setItems(list);
    $('#typeHint').textContent = offenses.length
      ? `Showing the ${n} offense${n === 1 ? '' : 's'} that can happen ${v === 'campus' ? 'on campus or at a University activity' : 'off campus or online'}. Type a word to filter.`
      : 'Type a word such as “bullying” or “smoking” to filter the list.';
    const id = $('#type').value;
    if (id && !list.some((x) => x.id === id)) {
      cb.set('');
      $('#typeQ').value = '';
      showOffense();
      UB.toast('Your offense isn’t listed for off campus or online, so the choice was cleared. Pick again.', 'bad');
    }
  }
  document.querySelectorAll('[name=venue]').forEach((r) =>
    r.addEventListener('change', () => {
      showVenue();
      if ($('#location').getAttribute('aria-invalid') === 'true') $('#location').removeAttribute('aria-invalid');
    }),
  );
  showVenue();
  const store = () => UB.save('draft', { ...data(), venue: venue(), grounds: grounds() });
  const d = UB.load('draft', null);
  if (d?.venue === 'offcampus') {
    document.querySelector('[name=venue][value=offcampus]').checked = true;
    (d.grounds || []).forEach((g) => {
      const b = document.querySelector(`[name=ground][value=${g}]`);
      if (b) b.checked = true;
    });
    showVenue();
  }
  if (d) {
    F.forEach((k) => ($('#' + k).value = d[k] || ''));
    pp.set(d.resp || { dept: d.rDept, course: d.program }); // older drafts kept them as plain text
    cb.set(d.type); // empty if the saved type is no longer in the catalog
    showOffense();
    UB.toast('Draft restored');
  }
  const count = () => {
    const n = $('#desc').value.trim().length;
    $('#cnt').textContent = n < 30 ? `${n} / 30 minimum` : `${n} characters`;
  };
  count();
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
  const SIG = {
    'image/png': [0x89, 0x50, 0x4e, 0x47],
    'image/jpeg': [0xff, 0xd8, 0xff],
    'application/pdf': [0x25, 0x50, 0x44, 0x46],
  };
  const sniff = async (x) => {
    const b = new Uint8Array(await x.slice(0, 4).arrayBuffer());
    return Object.keys(SIG).find((m) => SIG[m].every((v, i) => b[i] === v));
  };
  const INLINE = !UB.USE_STORAGE,
    isImg = (t) => t === 'image/png' || t === 'image/jpeg';
  const add = async (list) => {
    for (const x of [...list]) {
      if (!/\.(png|jpe?g|pdf)$/i.test(x.name)) {
        UB.toast(`${x.name}: only PNG, JPG or PDF`, 'bad');
        continue;
      }
      if (x.size === 0 || x.size > 10485760) {
        UB.toast(`${x.name} must be under 10 MB`, 'bad');
        continue;
      }
      if (x.name.length > 120) {
        UB.toast(`${x.name}: file name is too long`, 'bad');
        continue;
      }
      if (files.length >= 5) {
        UB.toast('You can attach up to 5 files', 'bad');
        continue;
      }
      const t = await sniff(x);
      if (!t) {
        UB.toast(`${x.name} isn’t a real PNG, JPG or PDF`, 'bad');
        continue;
      }
      if (t === 'application/pdf') {
        if (INLINE && x.size > UB.MAX_INLINE) {
          UB.toast(`${x.name} is over 700 KB. Compress it or bring it to the SAEP Office.`, 'bad');
          continue;
        }
        files.push(new File([x], x.name, { type: t }));
      } else {
        try {
          // photos are shrunk so they fit; the name keeps its meaning but ends in .jpg
          const b = await UB.shrink(x, { maxDim: 1600, maxBytes: INLINE ? UB.MAX_INLINE : 1572864 });
          files.push(new File([b], x.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }));
        } catch {
          UB.toast(`Couldn’t read ${x.name}. Try another photo.`, 'bad');
        }
      }
    }
    renderFiles();
  };
  // Signature: an image of the complainant's signature, shrunk to a small JPEG and stored with the complaint.
  let sigImg = '';
  const setSig = async (x) => {
    if (!x) return;
    const t = await sniff(x);
    if (!/\.(png|jpe?g)$/i.test(x.name) || !isImg(t))
      return UB.toast('Upload your signature as a PNG or JPG image', 'bad');
    try {
      sigImg = await UB.toDataUrl(await UB.shrink(x, { maxDim: 700, maxBytes: 90000 }));
      $('#sigPrev').src = sigImg;
      $('#sigPrev').hidden = false;
      $('#sigPrompt').hidden = true;
      $('#sigClear').hidden = false;
      $('#eSig').textContent = '';
    } catch {
      UB.toast('Couldn’t read that image. Try a clearer photo.', 'bad');
    }
  };
  $('#sigFile').onchange = (e) => {
    setSig(e.target.files[0]);
    e.target.value = '';
  };
  $('#sigClear').onclick = () => {
    sigImg = '';
    $('#sigPrev').hidden = true;
    $('#sigPrompt').hidden = false;
    $('#sigClear').hidden = true;
  };
  ['dragover', 'drop'].forEach((ev) =>
    $('#sigDrop').addEventListener(ev, (e) => {
      e.preventDefault();
      if (ev === 'drop') setSig(e.dataTransfer.files[0]);
    }),
  );
  [
    ['#drop', '#file'],
    ['#sigDrop', '#sigFile'],
  ].forEach(([a, b]) =>
    $(a).addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        $(b).click();
      }
    }),
  );
  if (evidenceOn) {
    $('#file').onchange = (e) => {
      add(e.target.files);
      e.target.value = '';
    };
    $('#files').onclick = (e) => {
      const b = e.target.closest('[data-i]');
      if (b) {
        files.splice(b.dataset.i, 1);
        renderFiles();
      }
    };
    const drop = $('#drop');
    ['dragover', 'dragenter'].forEach((ev) =>
      drop.addEventListener(ev, (e) => {
        e.preventDefault();
        drop.classList.add('over');
      }),
    );
    ['dragleave', 'drop'].forEach((ev) =>
      drop.addEventListener(ev, (e) => {
        e.preventDefault();
        drop.classList.remove('over');
      }),
    );
    drop.addEventListener('drop', (e) => add(e.dataTransfer.files));
  }
  $('#draft').onclick = () => {
    store();
    UB.toast('Draft saved on this device');
  };

  f.onsubmit = async (e) => {
    e.preventDefault();
    let first = null;
    F.forEach((k) => {
      const el = $('#' + k);
      if (err(el, rules[k](el.value.trim()) || '') && !first) first = el;
    });
    const pc = pp.check();
    [
      ['rDeptQ', pc.dept],
      ['programQ', pc.course],
    ].forEach(([id, m]) => {
      flag(id, m);
      if (m && !first) first = $('#' + id);
    });
    $('#eSig').textContent = sigImg ? '' : 'Upload your signature to submit';
    if (!sigImg && !first) first = $('#sigDrop');
    const needGround = venue() === 'offcampus' && !grounds().length;
    $('#eJur').textContent = needGround
      ? 'Tick at least one reason the University can act on an off-campus or online offense'
      : '';
    if (needGround && !first) first = document.querySelector('[name=ground]');
    const consent = $('#consent');
    $('#eConsent').textContent = consent.checked
      ? ''
      : 'You must agree to the privacy notice and terms of use to submit';
    if (!consent.checked && !first) first = consent;
    if (!UB.isComplete(me)) return location.replace('profile.html?need=1&next=file-complaint');
    if (first) {
      UB.toast('Please fix the highlighted fields', 'bad');
      return (first.id === 'type' ? $('#typeQ') : first).focus();
    }
    const o = chosen();
    const note = '';
    if (
      !(await UB.confirm(
        'Submit this complaint?',
        `It goes straight to the SAEP Office and can’t be edited from your account afterwards.${note}`,
        'Submit',
      ))
    )
      return;
    const btn = f.querySelector('.btn.primary');
    btn.disabled = true;
    btn.textContent = 'Submitting…';
    let c;
    try {
      const { type: _t, resp, offenseOther, ...rest } = data(); // the offense type comes from the catalog (or Others)
      const other = o.id === UB.OTHER_OFFENSE.id;
      c = await UB.create(
        {
          ...rest,
          program: resp.course,
          rDept: resp.dept, // respondent, from the linked pickers
          cSid: me.sid || '',
          cCourse: me.course || '',
          cDept: me.dept || '',
          cContact: me.contact || '', // complainant, from the profile
          venue: venue(),
          jurisdiction: venue() === 'offcampus' ? grounds() : [],
          offenseId: o.id,
          type: o.type,
          offense: o.category,
          ...(other ? { offenseOther } : {}),
          signatureImg: sigImg,
        },
        files,
      );
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
      <div class="actions"><a class="btn" href="dashboard.html">Back home</a><a class="btn primary" href="my-complaints.html?case=${encodeURIComponent(c.id)}">Track this case</a></div></div>`,
      'Complaint submitted',
    );
  };
})();
