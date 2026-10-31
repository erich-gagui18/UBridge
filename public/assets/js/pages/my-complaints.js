import { UB } from '../app.js';
(async () => {
  await UB.ready;
  const { $, esc } = UB,
    staff = UB.isStaff();
  $('#t').textContent = staff ? 'All cases' : 'My complaints';
  $('#s').textContent = staff
    ? 'Review and update every complaint filed with SAEP.'
    : 'Track the status of every report you’ve filed.';
  $('#cta').innerHTML = staff
    ? '<button class="btn" id="sync">Sync offense list</button>'
    : '<a class="btn primary" href="file-complaint.html">New complaint</a>';
  $('#head').innerHTML =
    `<tr><th>Case no.</th><th>Student</th>${staff ? '<th>Filed by</th>' : ''}<th>Offense</th><th>Filed</th><th>Status</th><th></th></tr>`;
  $('#stats').innerHTML = UB.skel(4);
  $('#rows').innerHTML = `<tr><td colspan="${staff ? 7 : 6}">${UB.skel(3)}</td></tr>`;
  Object.keys(UB.STATUS).forEach((s) =>
    $('#st').insertAdjacentHTML('beforeend', `<option value="${s}">${UB.STATUS[s]}</option>`),
  );

  let data = [],
    offenses = {},
    loaded = false;
  let cur = null; // the open case dialog: {id, m, dirty, history, audit, stopHistory, stopAudit}
  UB.loadOffenses()
    .then((l) => {
      offenses = Object.fromEntries(l.map((o) => [o.id, o]));
    })
    .catch(() => {});

  const stats = () => {
    const n = (s) => data.filter((c) => c.status === s).length;
    // Cases that were not approved never reach a decision, so they are left out of the resolution rate.
    const open = data.length - n('rejected');
    const p = open ? Math.round((n('resolved') / open) * 100) : 0;
    $('#stats').innerHTML = [
      [data.length, 'Total filed', ''],
      [n('submitted') + n('review'), 'Submitted / in review', 'Needs follow-up'],
      [n('hearing'), 'For hearing', 'Scheduled'],
      [n('resolved'), 'Resolved', `${p}% resolution${n('rejected') ? ` · ${n('rejected')} not approved` : ''}`],
    ]
      .map(([v, a, s]) => `<div class="card stat"><b>${v}</b><span>${a}</span>${s ? `<small>${s}</small>` : ''}</div>`)
      .join('');
  };
  const render = () => {
    const q = $('#q').value.trim().toLowerCase(),
      st = $('#st').value;
    const rows = data.filter(
      (c) =>
        (!st || c.status === st) &&
        (!q ||
          [c.id, c.student, c.sid, c.type, c.offenseOther, c.program, c.filedByName].some((x) =>
            String(x ?? '')
              .toLowerCase()
              .includes(q),
          )),
    );
    $('#rows').innerHTML = rows
      .map(
        (c) =>
          `<tr><td>${esc(c.id)}</td><td><b>${esc(c.student)}</b><small>${esc(c.sid)} · ${esc([c.program, c.section].filter(Boolean).join(' '))}</small></td>${staff ? `<td>${esc(c.filedByName)}<small>${esc(c.filedByRole || '')}</small></td>` : ''}<td><span class="chip ${UB.degClass(UB.proc.degreeOf(c))}">${esc(UB.proc.degreeOf(c) === 'Unclassified' ? 'To be assessed' : UB.proc.degreeOf(c))}</span></td><td>${UB.fmt(c.filed)}</td><td>${UB.chip(c.status)}</td><td><button class="link" data-id="${esc(c.id)}">View</button></td></tr>`,
      )
      .join('');
    $('#none').hidden = !loaded || rows.length > 0;
    stats();
  };

  const evidence = (c) => {
    if (!c.files?.length) return 'No evidence attached';
    let k = -1;
    return `<ul class="ev">${c.files.map((x) => (x.path ? `<li><button class="link ev-btn" type="button" data-ev="${++k}" title="View ${esc(x.name)}">${/\.pdf$/i.test(x.name) ? 'PDF' : 'IMG'} · ${esc(x.name)}</button></li>` : `<li>${esc(x.name)} <small class="muted">(name only, file not stored)</small></li>`)).join('')}</ul>`;
  };
  // The progress bar and the history are drawn from the same case + history data in one pass, so they can't disagree.
  const reached = (c, hist) =>
    Object.fromEntries([['submitted', UB.fmtTs(c.createdAt)], ...hist.map((h) => [h.to, UB.fmtTs(h.at)])]);
  const timeline = (c, hist) => {
    const who = (h) => (staff ? esc(cur?.audit?.[h.id] || h.byName || 'SAEP Staff') : 'SAEP Staff');
    const lag = hist.length < (c.hCount || 0); // the case already changed but its history entry hasn't arrived yet
    const items = [
      `<li><b>Filed</b><small>${esc(c.filedByName)} · ${UB.fmtTs(c.createdAt)}</small></li>`,
      ...hist.map(
        (h, k) =>
          `<li class="${k === hist.length - 1 && !lag ? 'latest' : ''}"><b>${h.from === h.to ? `Update <span class="muted">· ${UB.STATUS[h.to]}</span>` : `${UB.STATUS[h.from]} → ${UB.STATUS[h.to]}`}</b><small>${who(h)} · ${UB.fmtTs(h.at)}</small>${h.remark ? `<p>${esc(h.remark)}</p>` : ''}</li>`,
      ),
      ...(lag ? ['<li class="sync"><b>Updating…</b><small>Fetching the latest history</small></li>'] : []),
    ];
    return `<ol class="hist" aria-label="Status history" aria-live="polite">${items.join('')}</ol>`;
  };
  // Email drafts (staff only). UBridge does not send mail: staff edit the draft, save it to their own Gmail (or open it in their
  // email app), send it themselves and confirm they sent it.
  const emailLogHtml = () => {
    const l = [...(cur?.emails || [])].reverse(); // newest first
    return l.length
      ? `<ul class="mails">${l.map((m) => `<li><details><summary><span class="mk">${esc(UB.mail.KINDS[m.kind] || m.kind)}</span><small class="muted">To ${esc(m.to)}<br>${esc(m.byName || 'SAEP Staff')} · ${UB.fmtTs(m.at)}</small></summary><p><b>Subject:</b> ${esc(m.subject)}</p><pre class="mailbody">${esc(m.body)}</pre></details></li>`).join('')}</ul>`
      : '<p class="muted">No email recorded for this case yet. Once you send one and confirm it here, it is listed with its text.</p>';
  };
  // What nextStep() and suggestedKind() need: the emails recorded, and when the case was last marked Not approved.
  const nextOpts = (c) => ({
    commission: UB.proc.commissionOf(c, data),
    emails: cur?.emails || [],
    rejectedAt: UB.proc.latestRejectionAt(cur?.history || []),
  });
  // "What now?" banner (staff), shown above the tabs so it is visible everywhere. Built from the case and the emails
  // already recorded, following the policy's PROCESS section.
  const nextHtml = (c) => {
    const n = UB.proc.nextStep(c, nextOpts(c));
    const tag = { todo: 'Next step', wait: 'Waiting', warn: 'Needs attention', done: 'Done' }[n.level];
    const act = [
      n.kind
        ? `<button type="button" class="btn primary ns-mail" data-kind="${esc(n.kind)}">Write: ${esc(UB.mail.KINDS[n.kind])}</button>`
        : '',
      n.level !== 'done' ? '<button type="button" class="btn" data-goto="update">Open Update Case</button>' : '',
    ].join('');
    return `<div class="nextstep ${n.level}" role="status"><span class="ns-tag">${tag}</span><b>${esc(n.title)}</b><p>${esc(n.detail)}</p>${
      act ? `<div class="ns-actions">${act}</div>` : ''
    }${n.reminders.length ? `<ul class="ns-rem">${n.reminders.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}</div>`;
  };
  const paintNext = () => {
    const c = cur && data.find((x) => x.id === cur.id);
    if (c) cur.m.el.querySelectorAll('.nextbox').forEach((b) => (b.innerHTML = nextHtml(c)));
  };
  const paintEmails = () => {
    const box = cur?.m.el.querySelector('#emailLog');
    if (box) box.innerHTML = emailLogHtml();
    const n = cur?.m.el.querySelector('#emailCount');
    if (n) n.textContent = (cur.emails || []).length ? `(${cur.emails.length})` : '';
    const tabN = cur?.m.el.querySelector('[data-tab="email"] .n');
    if (tabN) tabN.textContent = (cur.emails || []).length || '';
    paintNext();
  };
  const mailboxHtml = (c) => {
    const sug = UB.proc.suggestedKind(c, nextOpts(c));
    return `<div class="mail-grid">
      <section class="card cc"><h3>Write an email</h3>
        <p class="muted">${UB.gmail.enabled ? 'Pick a message and edit it. Then save it as a draft in your Gmail, or open it in your email app, and send it yourself.' : 'Pick a message and edit it. Then open it in your email app and send it yourself.'} UBridge never sends mail. It keeps a record once you confirm that you sent it.</p>
        <div class="field"><label for="mk">Message</label><select id="mk" data-nodirty>${Object.entries(UB.mail.KINDS)
          .map(
            ([k, l]) =>
              `<option value="${k}" ${k === sug ? 'selected' : ''}>${esc(l)}${k === sug ? ' (suggested)' : ''}</option>`,
          )
          .join(
            '',
          )}</select>${c.rEmail ? `<small class="muted">Respondent: ${esc(c.rEmail)}</small>` : '<small class="muted">No respondent email is on file. You can type one in the next step.</small>'}</div>
        <button type="button" class="btn primary" id="mkBtn">Write email</button>
      </section>
      <section class="card cc"><h3>Emails recorded <span class="muted" id="emailCount">${(cur?.emails || []).length ? `(${cur.emails.length})` : ''}</span></h3><div id="emailLog">${emailLogHtml()}</div></section>
    </div>`;
  };

  // The compose dialog: edit, then open in the email app, then confirm it was sent.
  const compose = (c, kind) => {
    let include = false; // notice only: put the complaint statement in the message
    const make = () => UB.mail.draft(kind, c, UB.me, { cc: UB.CONTACT.email || '', include });
    const d = make();
    let made = d.body; // the last text UBridge generated, to tell whether staff changed it
    // What confirming will also do to the case (notice date, answer due date, status), shown so staff are not surprised.
    const fxNote = () => {
      const f = UB.proc.effectOfEmail(kind, data.find((x) => x.id === c.id) || c);
      return f ? `<p class="notice">When you confirm, UBridge will also ${esc(f.label)}.</p>` : '';
    };
    const gm = UB.gmail.enabled;
    let gmailDraft = null; // the Gmail draft made in this dialog, replaced (not duplicated) if the text is changed and saved again
    UB.gmail.preload(); // load Google's sign-in now so its window opens straight from the button click
    const field = (id, label, v, tag = 'input') =>
      `<div class="field"><label for="${id}">${label}</label>${tag === 'textarea' ? `<textarea id="${id}" rows="14" maxlength="${UB.mail.LIMITS.body}">${esc(v)}</textarea>` : `<input id="${id}" value="${esc(v)}" autocomplete="off">`}</div>`;
    const editHtml =
      () => `<h2>${esc(UB.mail.KINDS[kind])}</h2><p class="muted">${esc(c.id)}. Check the text, change anything you need and replace the [bracketed] parts. Nothing is sent from here.</p>
      <div class="cols">${field('mTo', 'To', d.to)}${field('mCc', 'Cc', d.cc)}</div>${field('mSubj', 'Subject', d.subject)}${
        kind === 'notice'
          ? `<label class="chk"><input type="checkbox" id="mInc" ${include ? 'checked' : ''}> Put the complaint statement in the message (Process step 2). The complainant’s name is never added. Keep the message under ${UB.mail.LIMITS.body} characters.</label>`
          : ''
      }${field('mBody', 'Message', d.body, 'textarea')}
      ${['department', 'closure-dept', 'parents', 'copy'].includes(kind) ? '<p class="muted">No address is on file for this recipient. Type it in To.</p>' : ''}
      <p class="err" id="mErr" role="alert"></p>
      <div class="actions"><button class="btn" data-close>Cancel</button><button class="btn" id="mCopy" type="button">Copy text</button><button class="btn${gm ? '' : ' primary'}" id="mOpen" type="button">Open in my email app</button>${gm ? '<button class="btn primary" id="mGmail" type="button">Create Gmail draft</button>' : ''}</div>`;
    const m = UB.modal(editHtml(), UB.mail.KINDS[kind]);
    m.el.querySelector('.modal').classList.add('wide', 'compose');
    let sent = null;
    const read = () => ({
      kind,
      to: m.el.querySelector('#mTo').value.trim(),
      cc: m.el.querySelector('#mCc').value.trim(),
      subject: m.el.querySelector('#mSubj').value.trim(),
      body: m.el.querySelector('#mBody').value.trim(),
    });
    m.el.addEventListener('click', async (e) => {
      if (e.target.closest('#mCopy')) {
        const x = read();
        try {
          await navigator.clipboard.writeText(`To: ${x.to}\nCc: ${x.cc}\nSubject: ${x.subject}\n\n${x.body}`);
          UB.toast('Email text copied');
        } catch {
          UB.toast('Couldn’t copy. Select the text and copy it manually.', 'bad');
        }
      } else if (e.target.closest('#mGmail')) {
        const x = read(),
          err = UB.mail.check(x);
        m.el.querySelector('#mErr').textContent = err;
        if (err) return;
        const b = e.target.closest('#mGmail');
        b.disabled = true;
        b.textContent = 'Saving draft…';
        try {
          gmailDraft = await UB.gmail.saveDraft(x, gmailDraft?.draftId, UB.me?.email);
          sent = x;
          m.set(`<h2>Your Gmail draft is ready</h2><p class="muted">It is saved in the Drafts folder of ${esc(gmailDraft.account)}. Open it, check it and send it from Gmail. Then come back and confirm so the case keeps a record.</p>${fxNote()}
          <p class="err" id="mErr" role="alert"></p>
          <div class="actions"><a class="btn" href="${esc(gmailDraft.url)}" target="_blank" rel="noopener">Open draft in Gmail</a><button class="btn" id="mBack" type="button">Not yet, go back</button><button class="btn primary" id="mSent" type="button">Yes, I sent it</button></div>`);
        } catch (ex) {
          b.disabled = false;
          b.textContent = 'Create Gmail draft';
          m.el.querySelector('#mErr').textContent = UB.gmail.msg(ex);
        }
      } else if (e.target.closest('#mOpen')) {
        const x = read(),
          err = UB.mail.check(x);
        m.el.querySelector('#mErr').textContent = err;
        if (err) return;
        let url = UB.mail.mailto(x);
        if (url.length > UB.mail.MAILTO_LIMIT) {
          // too long for a link: open without the body and copy it instead
          try {
            await navigator.clipboard.writeText(x.body);
          } catch {
            /* the person can still copy it from the box */
          }
          url = UB.mail.mailto({ ...x, body: '' });
          UB.toast('The message is long, so it was copied. Paste it into the new email.');
        }
        sent = x;
        const a = document.createElement('a');
        a.href = url;
        a.click();
        m.set(`<h2>Did you send it?</h2><p class="muted">Your email app should have opened with the message. Send it from there, then come back and confirm so the case keeps a record.</p>${fxNote()}
          <p class="err" id="mErr" role="alert"></p>
          <div class="actions"><button class="btn" id="mBack" type="button">Not yet, go back</button><button class="btn primary" id="mSent" type="button">Yes, I sent it</button></div>`);
      } else if (e.target.closest('#mBack')) {
        m.set(editHtml());
        const set = (id, v) => {
          m.el.querySelector(id).value = v;
        };
        set('#mTo', sent.to);
        set('#mCc', sent.cc);
        set('#mSubj', sent.subject);
        set('#mBody', sent.body);
      } else if (e.target.closest('#mSent')) {
        const b = e.target.closest('#mSent');
        b.disabled = true;
        // A Gmail draft disappears from Drafts once it is sent. If it is still there, say so before recording it as sent.
        if (gmailDraft?.draftId) {
          let still = false;
          try {
            still = await UB.gmail.draftExists(gmailDraft.draftId);
          } catch {
            /* Gmail could not be reached: skip the check, the person confirms by hand */
          }
          if (
            still &&
            !(await UB.confirm(
              'Draft not sent yet?',
              'The draft is still in the Drafts folder of your Gmail, so it looks unsent. Record it as sent anyway?',
              'Record anyway',
            ))
          ) {
            b.disabled = false;
            return;
          }
        }
        // The email record and what it means for the case (notice date, answer due, status) go in one commit, so
        // staff do not enter it a second time under Update Case and the two can never disagree.
        const fresh = data.find((x) => x.id === c.id) || c;
        const fx = UB.proc.effectOfEmail(kind, fresh);
        try {
          if (fx)
            await UB.recordEmailAndUpdate(fresh, sent, {
              status: fx.status,
              hearingDate: fresh.hearingDate || '',
              resolution: fresh.resolution || '',
              remark: '',
              process: fx.process,
              notes: fx.notes,
            });
          else await UB.logEmail(c.id, sent);
        } catch {
          b.disabled = false;
          m.el.querySelector('#mErr').textContent =
            'Couldn’t record the email. Nothing was saved. Check your connection and try again.';
          return;
        }
        UB.toast(fx ? 'Email recorded and the case updated' : 'Email recorded');
        m.close();
      }
    });
    // Switching the option rebuilds the text. If staff already changed it, ask first so their edits are not lost.
    m.el.addEventListener('change', async (e) => {
      if (e.target.id !== 'mInc') return;
      const box = m.el.querySelector('#mBody');
      const turnOn = e.target.checked;
      if (
        box.value.trim() !== made.trim() &&
        !(await UB.confirm(
          'Replace your changes?',
          'The message text will be rebuilt and your edits to it will be lost.',
          'Replace',
        ))
      ) {
        e.target.checked = !turnOn;
        return;
      }
      include = turnOn;
      const nd = make();
      made = nd.body;
      box.value = nd.body;
    });
  };

  /* Case page: header, next step, tabs (details and history, update, email). Field ids are read by save() and lib/process.js. */
  const TABS = [
    ['details', 'Case Details & History'],
    ['update', 'Update Case'],
    ['email', 'Email Drafts'],
  ];
  const kv = (k, v) => (v ? `<dt>${k}</dt><dd>${v}</dd>` : '');
  const ccard = (title, body, cls = '') =>
    body ? `<section class="card cc ${cls}"><h3>${title}</h3><dl class="kv">${body}</dl></section>` : '';

  // Not approved only exists at intake (Submitted or In review); a not-approved case can only be reopened to those two.
  const statusChoices = (c) =>
    Object.keys(UB.STATUS).filter((s) =>
      s === 'rejected'
        ? ['submitted', 'review', 'rejected'].includes(c.status)
        : c.status === 'rejected'
          ? ['submitted', 'review'].includes(s)
          : true,
    );
  const updateHtml = (c) => `<div class="uform${c.status === 'rejected' ? ' is-rejecting' : ''}">
    <section class="card cc fsec"><h3>Status and note</h3>
      <div class="field"><label for="ns">Status</label>
        <select id="ns">${statusChoices(c)
          .map((s) => `<option value="${s}" ${s === c.status ? 'selected' : ''}>${UB.STATUS[s]}</option>`)
          .join(
            '',
          )}</select>${c.status === 'submitted' || c.status === 'review' ? '<small class="muted">Choose Not approved if SAEP will not take this complaint forward.</small>' : ''}</div>
      ${UB.proc.rejectFields(c)}
      <div class="field" id="hdF" ${c.status === 'hearing' ? '' : 'hidden'}><label for="hd" class="req">Hearing date</label><input id="hd" type="date" value="${esc(c.hearingDate || '')}"></div>
      <div class="field" id="rsF" ${c.status === 'resolved' ? '' : 'hidden'}><label for="rs" class="req">Resolution note</label><textarea id="rs" maxlength="2000">${esc(c.resolution || '')}</textarea></div>
      <div class="field"><label for="rm">Remark for the history</label><input id="rm" maxlength="500" placeholder="e.g. Both parties notified" aria-describedby="rmHint">
        <small class="muted" id="rmHint">Optional. Required (5+ characters) when moving a case back to an earlier status.</small></div>
    </section>
    ${UB.proc.processForm(c, { commission: UB.proc.commissionOf(c, data) })}
    <div class="savebar"><button class="btn primary" id="sv" type="button">Save changes</button><span class="dirty" id="dirtyMsg" ${cur?.dirty ? '' : 'hidden'}>Unsaved changes</span><span class="muted savehint">The filer is notified in the app when you save.</span></div>
  </div>`;

  const detailsHtml = (c, hist) => {
    const o = offenses[c.offenseId];
    const deg = UB.proc.degreeOf(c);
    const complaint =
      kv('Offense', esc(UB.offenseLabel(c))) +
      kv(
        'Category',
        `${esc(deg === 'Unclassified' ? 'Unclassified (SAEP to assess)' : deg)}${c.assessedDegree && c.assessedDegree !== c.offense ? ` <small class="muted">· filed as ${esc(c.offense === 'Unclassified' ? 'Others' : c.offense)}</small>` : ''}${o?.section ? ` <small class="muted">${esc(o.section)}</small>` : ''}`,
      ) +
      kv('Handbook sanction', o?.sanction ? esc(o.sanction) : '') +
      kv('Incident', `${UB.fmt(c.date)}${c.location ? ` · ${esc(c.location)}` : ''}`) +
      kv('Description', `<span class="desc">${esc(c.desc)}</span>`) +
      kv('Evidence', evidence(c)) +
      (c.signatureImg
        ? kv(
            'Signature',
            `<img class="sigimg" alt="Complainant signature" src="${esc(c.signatureImg)}">${c.signature ? `<small class="muted" style="display:block">${esc(c.signature)}</small>` : ''}`,
          )
        : c.signature && staff
          ? kv('E-signature', esc(c.signature))
          : '');
    const handling =
      UB.proc.processRows(c, { staff, commission: UB.proc.commissionOf(c, data) }) +
      kv(c.status === 'rejected' ? 'Why it was not approved' : 'Decision', c.resolution ? esc(c.resolution) : '');
    const respondent =
      kv('Student', `${esc(c.student)} <small class="muted">${esc(c.sid)}</small>`) +
      kv('Course', esc([c.program, c.section].filter(Boolean).join(' '))) +
      kv('Department', c.rDept ? esc(c.rDept) : '') +
      kv('Contact', [c.rEmail, c.rContact].filter(Boolean).map(esc).join(' · '));
    const complainant = staff
      ? kv(
          'Filed by',
          `${esc(c.filedByName)} · ${esc(c.filedByRole || '')}${c.filedByEmail ? ` · ${esc(c.filedByEmail)}` : ''}`,
        ) + kv('Details', [c.cSid, c.cCourse, c.cDept, c.cContact].filter(Boolean).map(esc).join(' · '))
      : '';
    return `<div class="case-grid">
      <div class="case-main">
        ${ccard('Complaint', complaint)}
        ${ccard('Case handling', handling, 'handling')}
        ${ccard('Respondent', respondent)}
        ${ccard('Complainant', complainant)}
      </div>
      <aside class="case-side"><section class="card cc"><h3>History</h3>${timeline(c, hist)}</section></aside>
    </div>`;
  };

  const modalHtml = (c) => {
    const hist = cur?.history || [],
      tab = staff ? cur?.tab || 'details' : 'details';
    const tabs = staff
      ? `<div class="tabs-bar" role="tablist" aria-label="Case sections">${TABS.map(
          ([k, l]) =>
            `<button type="button" class="tab-btn ${k === tab ? 'active' : ''}" role="tab" id="tb-${k}" aria-controls="tab-${k}" aria-selected="${k === tab}" tabindex="${k === tab ? 0 : -1}" data-tab="${k}">${l}${k === 'email' ? `<span class="n">${(cur?.emails || []).length || ''}</span>` : ''}</button>`,
        ).join('')}</div>`
      : '';
    const panel = (k, html) =>
      `<div class="tab-content ${k === tab ? 'active' : ''}" role="tabpanel" id="tab-${k}" aria-labelledby="tb-${k}" ${k === tab ? '' : 'hidden'}>${html}</div>`;
    return `<div class="case-top"><button class="back" type="button" data-close>&larr; ${staff ? 'All cases' : 'My complaints'}</button><span class="live"><i></i>Live</span></div>
    <header class="case-head">
      <div>
        <h2>${esc(c.id)} <button class="link" type="button" data-copy="${esc(c.id)}">Copy</button></h2>
        <p class="muted">${esc(UB.offenseLabel(c))}</p>
        <p class="facts"><span>Filed <b>${UB.fmt(c.filed)}</b></span><span>Incident <b>${UB.fmt(c.date)}</b></span><span>Updated <b>${UB.fmtTs(c.updatedAt || c.createdAt)}</b></span></p>
      </div>
      <div class="case-chips">${UB.chip(c.status)}<span class="chip ${UB.degClass(UB.proc.degreeOf(c))}">${esc(UB.proc.degreeOf(c) === 'Unclassified' ? 'To be assessed' : UB.proc.degreeOf(c))}</span></div>
    </header>
    <div class="card case-progress">${UB.progress(c.status, reached(c, hist))}</div>
    ${staff ? `<div class="nextbox">${nextHtml(c)}</div>` : ''}
    ${tabs}
    ${panel('details', detailsHtml(c, hist))}
    ${staff ? panel('update', updateHtml(c)) + panel('email', mailboxHtml(c)) : ''}`;
  };

  const showTab = (name) => {
    const el = cur?.m.el;
    if (!el || !el.querySelector(`#tab-${name}`)) return;
    cur.tab = name;
    el.querySelectorAll('.tab-btn').forEach((t) => {
      const on = t.dataset.tab === name;
      t.classList.toggle('active', on);
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
    });
    el.querySelectorAll('.tab-content').forEach((p) => {
      const on = p.id === `tab-${name}`;
      p.classList.toggle('active', on);
      p.hidden = !on;
    });
  };
  document.addEventListener('click', (e) => {
    const t = e.target.closest('.tab-btn[data-tab]') || e.target.closest('[data-goto]');
    if (!t || !cur) return;
    showTab(t.dataset.tab || t.dataset.goto);
    if (t.dataset.goto) $('#caseView .tabs-bar')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  });
  document.addEventListener('keydown', (e) => {
    const t = e.target.closest?.('.tab-btn');
    if (!t || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    const all = [...t.parentElement.children],
      i = all.indexOf(t);
    const next =
      all[
        e.key === 'Home'
          ? 0
          : e.key === 'End'
            ? all.length - 1
            : (i + (e.key === 'ArrowRight' ? 1 : -1) + all.length) % all.length
      ];
    e.preventDefault();
    next.focus();
    showTab(next.dataset.tab);
  });

  const listView = $('#listView');
  const caseView = $('#caseView');
  const setCaseQuery = (id) => {
    const u = new URL(location.href);
    if (id) u.searchParams.set('case', id);
    else u.searchParams.delete('case');
    history.replaceState(null, '', u);
  };
  const showCase = (html, label, onClose) => {
    listView.hidden = true;
    caseView.hidden = false;
    caseView.innerHTML = `<div class="modal wide case-inline" role="region" aria-label="${esc(label)}" tabindex="-1">${html}</div>`;
    caseView.querySelector('.case-inline').focus({ preventScroll: true });
    $('#main').scrollIntoView({ block: 'start' });
    return {
      el: caseView,
      close() {
        const id = cur?.id;
        caseView.innerHTML = '';
        caseView.hidden = true;
        listView.hidden = false;
        setCaseQuery('');
        onClose?.();
        $(`#rows [data-id="${CSS.escape(id || '')}"]`)?.focus();
      },
      set(html2) {
        const box = caseView.querySelector('.case-inline');
        if (box) box.innerHTML = html2;
      },
    };
  };

  const paintModal = () => {
    if (!cur?.m || cur.dirty) return;
    const c = data.find((x) => x.id === cur.id);
    if (!c) return cur.m.close();
    const y = scrollY;
    cur.m.set(modalHtml(c));
    scrollTo(0, y);
  };

  const save = async () => {
    const c = data.find((x) => x.id === cur.id),
      el = cur.m.el,
      v = (s) => el.querySelector(s)?.value ?? '';
    const status = v('#ns'),
      hearingDate = status === 'hearing' ? v('#hd') : c.hearingDate || '',
      resolution =
        status === 'resolved'
          ? v('#rs').trim()
          : status === 'rejected'
            ? v('#rj').trim()
            : c.status === 'rejected'
              ? '' // reopening: the old explanation no longer applies
              : c.resolution || '',
      remark = v('#rm').trim();
    const pr = UB.proc.readProcess(el, c, status);
    if (pr.error) return UB.toast(pr.error, 'bad');
    const notes = UB.proc.describeChanges(c, pr.values),
      pChanged = UB.proc.processChanged(c, pr.values);
    // The process must hold together before it is saved (notice before conference, assessment first, and so on).
    const mv = UB.proc.checkMove(c, pr.values, { status, hearingDate, resolution });
    if (mv.errors.length) return UB.toast(mv.errors[0], 'bad');
    if (status === 'hearing' && !hearingDate) return UB.toast('Choose the hearing date.', 'bad');
    if (status === 'resolved' && resolution.length < 5)
      return UB.toast('Add a resolution note (at least 5 characters).', 'bad');
    // Reopening or stepping back is allowed (mistakes happen) but must be explained in the history.
    if (UB.proc.rankOf(status) < UB.proc.rankOf(c.status) && remark.length < 5)
      return UB.toast('Add a remark (at least 5 characters) explaining why the case is moving back.', 'bad');
    if (
      status === c.status &&
      hearingDate === (c.hearingDate || '') &&
      resolution === (c.resolution || '') &&
      !pChanged &&
      !remark
    )
      return UB.toast('Nothing has changed');
    if (
      !(await UB.confirm(
        'Save changes?',
        `${c.id}: “${UB.STATUS[c.status]}” → “${UB.STATUS[status]}”. ${status === 'rejected' && c.status !== 'rejected' ? 'This closes the case at intake. The complainant is notified in the app, and you can email them the reason next.' : 'The filer will be notified in the app.'}${mv.warnings.length ? ` Check first: ${mv.warnings.join(' ')}` : ''}`,
        'Save',
      ))
    )
      return;
    try {
      await UB.updateCase(c, { status, hearingDate, resolution, remark, process: pr.values, notes });
      cur.dirty = false; // the dialog stays open and refreshes, so the next step and the Email tab use the saved case
      const d = caseView.querySelector('#dirtyMsg');
      if (d) d.hidden = true;
      // The live update can arrive while the form still counts as unsaved (and is then skipped), so repaint here as well.
      paintModal();
      UB.toast('Case updated');
    } catch (e) {
      UB.toast(
        e.code === 'permission-denied'
          ? 'The case changed while you were editing. Reopen it and try again.'
          : 'Couldn’t update the case. Try again.',
        'bad',
      );
    }
  };

  const open = (id) => {
    const c = data.find((x) => x.id === id);
    if (!c) return;
    if (cur?.id === id) return;
    if (cur) {
      cur.stopHistory?.();
      cur.stopAudit?.();
      cur.stopEmails?.();
      cur = null;
    }
    cur = {
      id,
      dirty: false,
      tab: 'details',
      history: [],
      audit: {},
      emails: [],
      seen: c.hCount || 0,
      status: c.status,
    };
    cur.m = showCase(modalHtml(c), 'Complaint ' + id, () => {
      cur.stopHistory?.();
      cur.stopAudit?.();
      cur.stopEmails?.();
      cur = null;
    });
    setCaseQuery(id);
    cur.stopHistory = UB.watchHistory(
      id,
      (h) => {
        if (!cur) return;
        cur.history = h;
        if (!cur.dirty) paintModal();
      },
      () => {},
    );
    // Only staff may read the audit entries; students never subscribe.
    if (staff)
      cur.stopAudit = UB.watchAudit(
        id,
        (a) => {
          if (!cur) return;
          cur.audit = a;
          if (!cur.dirty) paintModal();
        },
        () => {},
      );
    if (staff)
      cur.stopEmails = UB.watchEmails(
        id,
        (l) => {
          if (!cur) return;
          cur.emails = l;
          paintEmails();
        },
        () => {},
      );
  };

  // Back to the list. Unsaved edits are not thrown away silently.
  const leave = async () => {
    if (!cur) return;
    if (
      cur.dirty &&
      !(await UB.confirm('Discard your changes?', 'You have edits in Update Case that are not saved.', 'Discard'))
    )
      return;
    cur?.m.close();
  };
  caseView.addEventListener('input', (e) => {
    if (!cur || e.target.closest('[data-nodirty]')) return;
    cur.dirty = true;
    const d = caseView.querySelector('#dirtyMsg');
    if (d) d.hidden = false;
  });
  caseView.addEventListener('change', (e) => {
    if (e.target.id === 'pNotice' && e.target.value) {
      const due = caseView.querySelector('#pDue'),
        min = UB.proc.addDays(e.target.value, UB.proc.ANSWER_DAYS);
      if (due) {
        due.min = min;
        if (!due.value || due.value < min) due.value = min;
      }
    }
    if (e.target.id !== 'ns') return;
    const hdF = caseView.querySelector('#hdF'),
      rsF = caseView.querySelector('#rsF'),
      pDec = caseView.querySelector('#pDec');
    if (hdF) hdF.hidden = e.target.value !== 'hearing';
    if (rsF) rsF.hidden = e.target.value !== 'resolved';
    if (pDec) pDec.hidden = e.target.value !== 'resolved';
    // Not approved: show the reason and explanation, and hide the notice, conference and decision sections that no longer apply.
    const rejecting = e.target.value === 'rejected';
    const rjF = caseView.querySelector('#rjF');
    if (rjF) rjF.hidden = !rejecting;
    caseView.querySelector('.uform')?.classList.toggle('is-rejecting', rejecting);
  });
  caseView.addEventListener('click', async (e) => {
    if (e.target.closest('[data-close]')) return leave();
    if (e.target.closest('#sv')) return save();
    const start = (kind) => {
      const c = data.find((x) => x.id === cur?.id);
      if (!c) return;
      if (cur.dirty) return UB.toast('Save your changes under Update Case first, so the email uses them.', 'bad');
      compose(c, kind);
    };
    if (e.target.closest('#mkBtn')) return start(caseView.querySelector('#mk').value);
    const nb = e.target.closest('.ns-mail');
    if (nb) return start(nb.dataset.kind);
    const b = e.target.closest('[data-ev]');
    if (!b) return;
    const c = data.find((x) => x.id === cur?.id);
    if (!c) return;
    UB.openViewer(
      c.files.filter((x) => x.path),
      Number(b.dataset.ev),
      (f) => UB.loadEvidence(c, f),
    );
  });
  // Capture phase: a dialog (such as the email editor) removes itself on Escape in the bubble phase, and by then this
  // handler would no longer see it and would also leave the case. Checking first keeps Escape to the dialog.
  addEventListener(
    'keydown',
    (e) => {
      if (e.key !== 'Escape' || !cur || document.querySelector('.overlay')) return;
      leave();
    },
    true,
  );

  $('#q').oninput = render;
  $('#st').onchange = render;
  $('#rows').onclick = (e) => {
    const b = e.target.closest('[data-id]');
    if (b) open(b.dataset.id);
  };
  if (staff)
    $('#sync').onclick = async () => {
      if (
        !(await UB.confirm(
          'Publish the offense list?',
          'This writes data/offenses.json to Firestore so students can pick from it. Check that it matches the College Student Discipline Policy first. Entries no longer in the file are removed.',
          'Publish',
        ))
      )
        return;
      try {
        const r = await UB.syncOffenses();
        UB.toast(
          r.provisional
            ? `Published ${r.count} types, ${r.provisional} still marked provisional in offenses.json`
            : `Published ${r.count} offense types`,
          r.provisional ? 'bad' : '',
        );
        offenses = Object.fromEntries((await UB.loadOffenses()).map((o) => [o.id, o]));
      } catch {
        UB.toast('Couldn’t publish the offense list.', 'bad');
      }
    };

  const wanted = new URLSearchParams(location.search).get('case');
  let first = true;
  const stop = UB.watchCases(
    (l) => {
      data = l;
      loaded = true;
      render();
      if (first && wanted) open(wanted);
      first = false;
      if (cur) paintModal();
    },
    () => UB.toast('Couldn’t load complaints. Check your connection and refresh.', 'bad'),
  );
  addEventListener('pagehide', stop);
})();
