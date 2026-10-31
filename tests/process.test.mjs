import test from 'node:test';
import assert from 'node:assert/strict';
import {
  degreeOf,
  routeFor,
  routeOf,
  commissionOf,
  readProcess,
  describeChanges,
  processChanged,
  processRows,
  nextStep,
  suggestedKind,
  checkMove,
  effectOfEmail,
  rankOf,
  latestRejectionAt,
  REJECT_REASONS,
  REJECT_FROM,
} from '../public/assets/js/lib/process.js';

// Minimal stand-in for the staff form: querySelector('#id') returns {value}, querySelectorAll returns the checked boxes.
const form = (vals, checked = []) => ({
  querySelector: (s) => (s === '#pDept' && !('#pDept' in vals) ? null : s in vals ? { value: vals[s] } : null),
  querySelectorAll: () => checked.map((value) => ({ value })),
});
const base = { id: 'SAEP-2026-001', sid: '2407880', filed: '2026-10-01', offense: 'First Degree', status: 'review' };

test('SAEP’s assessment overrides the degree that follows from the filed offense', () => {
  assert.equal(degreeOf(base), 'First Degree');
  assert.equal(degreeOf({ ...base, offense: 'Unclassified' }), 'Unclassified');
  assert.equal(degreeOf({ ...base, offense: 'Unclassified', assessedDegree: 'Second Degree' }), 'Second Degree');
});

test('routing: First Degree to the department, everything else to the CDB', () => {
  assert.equal(routeFor('First Degree'), 'department');
  assert.equal(routeFor('Second Degree'), 'cdb');
  assert.equal(routeFor('Third Degree'), 'cdb');
  assert.equal(routeFor('Unclassified'), 'cdb');
  assert.equal(routeOf({ ...base }), 'department');
  assert.equal(routeOf({ ...base, route: 'cdb' }), 'cdb');
});

test('the third First Degree commission is counted by the assessed degree', () => {
  const a = { ...base, id: 'A', filed: '2026-09-01' },
    b = { ...base, id: 'B', filed: '2026-09-15' },
    c = { ...base, id: 'C', filed: '2026-10-01' };
  assert.equal(commissionOf(c, [a, b, c]), 3);
  // a case SAEP assessed as Second Degree is not a First Degree commission
  assert.equal(commissionOf(c, [{ ...a, assessedDegree: 'Second Degree' }, b, c]), 2);
  assert.equal(commissionOf({ ...c, assessedDegree: 'Third Degree' }, [a, b, c]), 0);
});

test('assessing as Second or Third Degree moves the case to the CDB; First Degree leaves the route alone', () => {
  const f = form({ '#pAssess': 'Second Degree', '#pRoute': 'department', '#pAnswer': '', '#pHeld': '0' });
  const r = readProcess(f, base, 'review');
  assert.equal(r.values.assessedDegree, 'Second Degree');
  assert.equal(r.values.route, 'cdb');
  const r1 = readProcess(
    form({ '#pAssess': 'First Degree', '#pRoute': 'department', '#pAnswer': '', '#pHeld': '0' }),
    base,
    'review',
  );
  assert.equal(r1.values.route, 'department');
});

test('an earlier assessment is kept when the form is left on “not assessed”', () => {
  const c = { ...base, assessedDegree: 'Third Degree', route: 'cdb' };
  const r = readProcess(form({ '#pAssess': '', '#pRoute': 'cdb', '#pAnswer': '', '#pHeld': '0' }), c, 'review');
  assert.equal(r.values.assessedDegree, 'Third Degree');
});

test('the department’s decision date is only read for department cases and is tracked as a change', () => {
  const r = readProcess(
    form({ '#pAssess': '', '#pRoute': 'department', '#pAnswer': '', '#pHeld': '0', '#pDept': '2026-10-12' }),
    base,
    'review',
  );
  assert.equal(r.values.deptDecisionDate, '2026-10-12');
  assert.ok(processChanged(base, r.values));
  assert.ok(describeChanges(base, r.values).some((x) => /Department’s decision/.test(x)));
});

test('the notice needs at least 3 days to answer (policy, Process step 2)', () => {
  const f = form({
    '#pAssess': '',
    '#pRoute': 'cdb',
    '#pAnswer': '',
    '#pHeld': '0',
    '#pNotice': '2026-10-10',
    '#pDue': '2026-10-12',
  });
  assert.match(readProcess(f, { ...base, route: 'cdb' }, 'review').error, /at least 3 days/);
});

test('off-campus cases list the grounds and the review; on-campus cases show neither', () => {
  const off = { ...base, venue: 'offcampus', jurisdiction: ['victim', 'name'] };
  const rows = processRows(off);
  assert.match(rows, /Off campus or online/);
  assert.match(rows, /member of the campus community/);
  assert.match(rows, /good name of the school/);
  assert.match(rows, /Pending SAEP review/);
  assert.doesNotMatch(processRows(base), /Place of offense/);
});

test('declining jurisdiction requires the case to be resolved', () => {
  const off = { ...base, venue: 'offcampus', jurisdiction: ['event'], route: 'cdb' };
  const f = form({ '#pAssess': '', '#pRoute': 'cdb', '#pAnswer': '', '#pHeld': '0', '#pJur': 'declined' });
  assert.match(readProcess(f, off, 'review').error, /outside the University’s jurisdiction is closed/);
  const done = form({
    '#pAssess': '',
    '#pRoute': 'cdb',
    '#pAnswer': '',
    '#pHeld': '0',
    '#pJur': 'declined',
    '#pDecDate': '2026-10-21',
  });
  assert.equal(readProcess(done, off, 'resolved').values.jurisdictionReview, 'declined');
  assert.ok(
    describeChanges(off, {
      ...off,
      jurisdictionReview: 'declined',
      assessedDegree: '',
      route: 'cdb',
      deptDecisionDate: '',
    }).some((x) => /outside the University’s jurisdiction/.test(x)),
  );
});

test('describeChanges names the assessment in plain language', () => {
  const n = {
    assessedDegree: 'Second Degree',
    route: 'cdb',
    deptDecisionDate: '',
    noticeDate: '',
    answerDue: '',
    answer: '',
    parentsNotified: '',
    conferenceMode: '',
    decisionDate: '',
    appeal: '',
  };
  const notes = describeChanges({ ...base, offense: 'Unclassified' }, n);
  assert.ok(notes.some((x) => /assessed the offense as Second Degree/.test(x)));
});

test('the case rows show the assessment, and expulsion replaces the 5-day effectivity text', () => {
  assert.match(processRows({ ...base, offense: 'Unclassified' }), /Awaiting SAEP to assess/);
  assert.match(
    processRows({ ...base, offense: 'Unclassified', assessedDegree: 'Third Degree', route: 'cdb' }),
    /Third Degree/,
  );
  const rows = processRows({
    ...base,
    route: 'cdb',
    status: 'resolved',
    decisionDate: '2026-10-21',
    interventions: ['expulsion'],
  });
  assert.match(rows, /Commission on Higher Education/);
  assert.doesNotMatch(rows, /effective 2026/);
  assert.match(
    processRows({
      ...base,
      route: 'cdb',
      status: 'resolved',
      decisionDate: '2026-10-21',
      interventions: ['reprimand'],
    }),
    /effective/,
  );
});


// ---- Case flow: next step, move checks, and what an email changes -------------------------------------------------
const cdb = { ...base, offense: 'Second Degree', route: 'cdb', status: 'review', filed: '2026-10-01' };
const T = '2026-10-10';

test('next step follows the policy for a CDB case, from notice to decision', () => {
  assert.equal(nextStep({ ...cdb, status: 'submitted' }, { today: T }).kind, 'notice');
  // notice sent, waiting for the answer
  const waiting = nextStep({ ...cdb, noticeDate: '2026-10-08', answerDue: '2026-10-11' }, { today: T });
  assert.equal(waiting.level, 'wait');
  // deadline passed with no answer: general denial, reminder email offered
  const late = nextStep({ ...cdb, noticeDate: '2026-10-01', answerDue: '2026-10-04' }, { today: T });
  assert.match(late.title, /general denial/);
  assert.equal(late.kind, 'followup');
  // answered, no conference yet
  const ans = { ...cdb, noticeDate: '2026-10-01', answerDue: '2026-10-04', answer: 'received' };
  assert.match(nextStep(ans, { today: T }).title, /Schedule the disciplinary conference/);
  // conference set but the schedule email was not sent
  const hear = { ...ans, status: 'hearing', hearingDate: '2026-10-20' };
  assert.equal(nextStep(hear, { today: T }).kind, 'schedule');
  assert.equal(nextStep(hear, { today: T, emails: [{ kind: 'schedule' }] }).level, 'wait');
  // conference date reached: decision due in ten days, then overdue
  assert.match(nextStep({ ...hear, hearingDate: '2026-10-08' }, { today: T, emails: [{ kind: 'schedule' }] }).detail, /2026|18 Oct/);
  assert.equal(nextStep({ ...hear, hearingDate: '2026-09-20' }, { today: T, emails: [{ kind: 'schedule' }] }).level, 'warn');
});

test('next step: Others needs an assessment, off campus needs a jurisdiction review, declined closes', () => {
  assert.match(nextStep({ ...cdb, offense: 'Unclassified' }, { today: T }).title, /Assess the degree/);
  assert.match(nextStep({ ...cdb, venue: 'offcampus', jurisdiction: ['name'] }, { today: T }).title, /jurisdiction/);
  assert.match(nextStep({ ...cdb, venue: 'offcampus', jurisdictionReview: 'declined' }, { today: T }).title, /Close the case/);
  assert.equal(nextStep({ ...cdb, status: 'resolved', jurisdictionReview: 'declined' }, { today: T }).level, 'done');
});

test('next step: First Degree goes to the department; the third commission goes to the CDB', () => {
  const d = { ...base, route: 'department', status: 'submitted' };
  assert.equal(nextStep(d, { today: T }).kind, 'department');
  assert.match(nextStep({ ...d, noticeDate: '2026-10-02' }, { today: T }).title, /department’s decision/);
  assert.equal(nextStep(d, { today: T, commission: 3 }).level, 'warn');
  assert.equal(suggestedKind(d), 'department');
});

test('next step after the decision: decision email, then the copies, then done; appeals are tracked', () => {
  const r = { ...cdb, status: 'resolved', decisionDate: '2026-10-21', interventions: ['reprimand'] };
  assert.equal(nextStep(r, { today: T }).kind, 'decision');
  assert.equal(nextStep(r, { today: T, emails: [{ kind: 'decision' }] }).kind, 'copy');
  assert.equal(nextStep(r, { today: T, emails: [{ kind: 'decision' }, { kind: 'copy' }] }).level, 'done');
  assert.equal(nextStep({ ...r, appeal: 'filed' }, { today: T }).level, 'wait');
  assert.match(nextStep({ ...r, interventions: ['expulsion'] }, { today: T, emails: [{ kind: 'decision' }, { kind: 'copy' }] }).detail, /Commission on Higher Education/);
});

test('moves: no conference without a notice, none before the answer deadline, no decision before the conference', () => {
  const v = { assessedDegree: 'Second Degree', route: 'cdb', noticeDate: '', answerDue: '', answer: '', interventions: [] };
  assert.match(checkMove(cdb, v, { status: 'hearing', hearingDate: '2026-10-20' }, T).errors[0], /notice/);
  const v2 = { ...v, noticeDate: '2026-10-08', answerDue: '2026-10-11' };
  assert.match(checkMove(cdb, v2, { status: 'hearing', hearingDate: '2026-10-10' }, T).errors[0], /answer deadline/);
  assert.equal(checkMove(cdb, { ...v2, answer: 'received' }, { status: 'hearing', hearingDate: '2026-10-10' }, T).errors.length, 0);
  const v3 = { ...v2, answer: 'received', decisionDate: '2026-10-09', interventions: ['reprimand'] };
  assert.match(checkMove(cdb, v3, { status: 'resolved', hearingDate: '2026-10-12' }, T).errors[0], /before the conference/);
});

test('moves: Others and undecided off-campus cases cannot reach the hearing; declining may close them', () => {
  const v = { assessedDegree: '', route: 'cdb', noticeDate: '2026-10-01', answerDue: '', answer: 'received', interventions: [] };
  const oth = { ...cdb, offense: 'Unclassified' };
  assert.match(checkMove(oth, v, { status: 'hearing', hearingDate: '2026-10-20' }, T).errors[0], /Assess the degree/);
  const off = { ...cdb, venue: 'offcampus', jurisdiction: ['victim'] };
  const v2 = { ...v, assessedDegree: 'Second Degree', jurisdictionReview: '' };
  assert.match(checkMove(off, v2, { status: 'hearing', hearingDate: '2026-10-20' }, T).errors[0], /jurisdiction/);
  const closing = checkMove(off, { ...v2, jurisdictionReview: 'declined', decisionDate: '2026-10-10' }, { status: 'resolved', hearingDate: '' }, T);
  assert.equal(closing.errors.length, 0);
  assert.equal(closing.warnings.length, 0);
});

test('moves: resolving without a conference, a notice or an intervention, or late, only warns', () => {
  const v = { assessedDegree: 'Second Degree', route: 'cdb', noticeDate: '', answerDue: '', answer: '', decisionDate: '2026-11-30', interventions: [], conferencesHeld: 0 };
  const w = checkMove(cdb, v, { status: 'resolved', hearingDate: '' }, T);
  assert.equal(w.errors.length, 0);
  assert.ok(w.warnings.some((x) => /conference/.test(x)));
  assert.ok(w.warnings.some((x) => /notice/.test(x)));
  assert.ok(w.warnings.some((x) => /intervention/.test(x)));
  const late = checkMove(cdb, { ...v, noticeDate: '2026-10-01', interventions: ['reprimand'] }, { status: 'resolved', hearingDate: '2026-10-10' }, T);
  assert.ok(late.warnings.some((x) => /more than 10 days/.test(x)));
  const gd = checkMove(cdb, { ...v, answer: 'general-denial', answerDue: '2026-10-15', noticeDate: '2026-10-10' }, { status: 'review', hearingDate: '' }, T);
  assert.ok(gd.warnings.some((x) => /answer period has not ended/.test(x)));
});

test('sending the notice records the notice date, a three-day answer deadline and moves the case to In review', () => {
  const fx = effectOfEmail('notice', { ...cdb, status: 'submitted' }, '2026-10-10');
  assert.equal(fx.status, 'review');
  assert.equal(fx.process.noticeDate, '2026-10-10');
  assert.equal(fx.process.answerDue, '2026-10-13');
  assert.match(fx.label, /notice date/);
  // already recorded: nothing to change
  assert.equal(effectOfEmail('notice', { ...cdb, noticeDate: '2026-10-05', answerDue: '2026-10-08' }, T), null);
  assert.equal(effectOfEmail('parents', cdb, T).process.parentsNotified, T);
  assert.equal(effectOfEmail('parents', { ...cdb, parentsNotified: '2026-10-02' }, T), null);
  assert.equal(effectOfEmail('department', { ...base, status: 'submitted' }, T).status, 'review');
  assert.equal(effectOfEmail('copy', cdb, T), null);
});

/* ---- Not approved (UBridge intake outcome) ---------------------------------------------------------------------- */
const rej = { ...base, status: 'rejected', rejectReason: 'insufficient', resolution: 'The description does not say who did what.' };

test('Not approved counts as the end of the process, like Resolved', () => {
  assert.deepEqual(['submitted', 'review', 'hearing', 'resolved', 'rejected'].map(rankOf), [0, 1, 2, 3, 3]);
  assert.deepEqual(REJECT_FROM, ['submitted', 'review']);
  assert.ok(Object.keys(REJECT_REASONS).length >= 4);
});

test('Not approved needs a reason and an explanation of at least 10 characters', () => {
  const v = { jurisdictionReview: '', noticeDate: '', conferencesHeld: 0, decisionDate: '', rejectReason: '' };
  const none = checkMove(base, v, { status: 'rejected', hearingDate: '', resolution: '' });
  assert.equal(none.errors.length, 2);
  assert.match(none.errors.join(' '), /Choose why/);
  assert.match(none.errors.join(' '), /Explain to the complainant/);
  assert.equal(checkMove(base, { ...v, rejectReason: 'duplicate' }, { status: 'rejected', hearingDate: '', resolution: 'too short' }).errors.length, 1);
  const ok = checkMove(base, { ...v, rejectReason: 'duplicate' }, { status: 'rejected', hearingDate: '', resolution: 'Same as SAEP-2026-001.' });
  assert.deepEqual(ok.errors, []);
});

test('a case that reached a conference or a decision cannot be marked Not approved', () => {
  const v = { rejectReason: 'duplicate', conferencesHeld: 0, decisionDate: '' };
  const change = { status: 'rejected', hearingDate: '', resolution: 'Same as SAEP-2026-001.' };
  assert.match(checkMove({ ...base, status: 'hearing' }, v, change).errors[0], /conference or a decision/);
  assert.match(checkMove({ ...base, status: 'resolved' }, v, change).errors[0], /conference or a decision/);
  assert.match(checkMove(base, { ...v, conferencesHeld: 1 }, change).errors[0], /already been held/);
  assert.match(checkMove(base, { ...v, decisionDate: '2026-10-20' }, change).errors[0], /already been held/);
});

test('rejecting a case whose respondent was already notified warns that they must be told', () => {
  const v = { rejectReason: 'duplicate', conferencesHeld: 0, decisionDate: '' };
  const r = checkMove({ ...base, noticeDate: '2026-10-05' }, v, { status: 'rejected', hearingDate: '', resolution: 'Same as SAEP-2026-001.' });
  assert.deepEqual(r.errors, []);
  assert.match(r.warnings.join(' '), /closing email/);
});

test('a not-approved case can only be reopened to Submitted or In review', () => {
  const v = { rejectReason: '', conferencesHeld: 0, decisionDate: '' };
  assert.deepEqual(checkMove(rej, v, { status: 'review', hearingDate: '', resolution: '' }).errors, []);
  assert.deepEqual(checkMove(rej, v, { status: 'submitted', hearingDate: '', resolution: '' }).errors, []);
  assert.match(checkMove(rej, v, { status: 'hearing', hearingDate: '2026-11-01', resolution: '' }).errors.join(' '), /reopened/);
  assert.match(checkMove(rej, v, { status: 'resolved', hearingDate: '', resolution: '' }).errors.join(' '), /reopened/);
});

test('the form reads the reason only when the status is Not approved', () => {
  const f = form({ '#pReject': 'duplicate', '#pNotice': '', '#pDue': '', '#pAnswer': '', '#pParents': '', '#pMode': '', '#pHeld': '0' });
  assert.equal(readProcess(f, base, 'rejected').values.rejectReason, 'duplicate');
  assert.equal(readProcess(f, base, 'review').values.rejectReason, '');
});

test('the reason is tracked as a change and named in plain language', () => {
  const before = { ...base, status: 'review' };
  const after = { ...readProcess(form({ '#pReject': 'duplicate', '#pHeld': '0' }), before, 'rejected').values };
  assert.ok(processChanged(before, after));
  assert.match(describeChanges(before, after).join(' '), /Not approved: It duplicates another complaint/);
  const reopened = readProcess(form({ '#pHeld': '0' }), rej, 'review').values;
  assert.match(describeChanges(rej, reopened).join(' '), /Reopened after it was not approved/);
});

test('the case rows show the outcome and the reason', () => {
  const rows = processRows(rej, { staff: false });
  assert.match(rows, /Outcome/);
  assert.match(rows, /Not approved/);
  assert.match(rows, /not enough information or evidence/);
});

test('next step for a not-approved case: complainant first, then whoever was already told, then done', () => {
  let n = nextStep(rej);
  assert.equal(n.kind, 'rejection');
  n = nextStep(rej, { emails: [{ kind: 'rejection' }] });
  assert.equal(n.level, 'done'); // nobody on the respondent's side was told, so nobody else needs to hear
  n = nextStep({ ...rej, noticeDate: '2026-10-05' }, { emails: [{ kind: 'rejection' }] });
  assert.equal(n.kind, 'closure');
  assert.match(n.title, /respondent/);
  n = nextStep(rej, { emails: [{ kind: 'rejection' }, { kind: 'department' }] });
  assert.equal(n.kind, 'closure-dept');
  assert.match(n.title, /department/);
  n = nextStep({ ...rej, noticeDate: '2026-10-05' }, { emails: [{ kind: 'rejection' }, { kind: 'closure' }] });
  assert.equal(n.level, 'done');
  assert.equal(suggestedKind(rej, { emails: [{ kind: 'rejection' }] }), 'rejection');
});

test('a case that was both noticed and forwarded needs a closing notice for each party, respondent first', () => {
  const both = { ...rej, noticeDate: '2026-10-05' };
  let n = nextStep(both, { emails: [{ kind: 'notice' }, { kind: 'department' }, { kind: 'rejection' }] });
  assert.equal(n.kind, 'closure');
  assert.ok(n.reminders.some((x) => /department/.test(x)), 'the banner says the department is next');
  n = nextStep(both, { emails: [{ kind: 'notice' }, { kind: 'department' }, { kind: 'rejection' }, { kind: 'closure' }] });
  assert.equal(n.kind, 'closure-dept');
  n = nextStep(both, { emails: ['notice', 'department', 'rejection', 'closure', 'closure-dept'].map((kind) => ({ kind })) });
  assert.equal(n.level, 'done');
});

test('rejected, reopened and rejected again: the new rejection has to be told again', () => {
  const at = (t) => ({ toMillis: () => t });
  const hist = [
    { from: 'submitted', to: 'review', at: at(1000) },
    { from: 'review', to: 'rejected', at: at(2000) },
    { from: 'rejected', to: 'review', at: at(3000) },
    { from: 'review', to: 'rejected', at: at(4000) },
    { from: 'rejected', to: 'rejected', at: at(4500) }, // editing the reason is not a new rejection
  ];
  assert.equal(latestRejectionAt(hist), 4000);
  assert.equal(latestRejectionAt([{ from: 'submitted', to: 'review', at: at(1000) }]), undefined);
  const emails = [
    { kind: 'notice', at: at(1500) },
    { kind: 'rejection', at: at(2500) },
    { kind: 'closure', at: at(2600) },
  ];
  const again = { ...rej, noticeDate: '2026-10-05', rejectReason: 'duplicate' };
  // before the fix, the first rejection's emails made this look finished
  assert.equal(nextStep(again, { emails, rejectedAt: 4000 }).kind, 'rejection');
  assert.equal(nextStep(again, { emails: [...emails, { kind: 'rejection', at: at(4100) }], rejectedAt: 4000 }).kind, 'closure');
  assert.equal(nextStep(again, { emails: [...emails, { kind: 'rejection', at: at(4100) }, { kind: 'closure', at: at(4200) }], rejectedAt: 4000 }).level, 'done');
  // a case rejected once, with the time unknown, behaves as before
  assert.equal(nextStep(again, { emails: [{ kind: 'notice' }, { kind: 'rejection' }, { kind: 'closure' }] }).level, 'done');
});

test('a reopened case reminds staff to tell the people who were told it was closed', () => {
  const reopened = { ...base, status: 'review', noticeDate: '2026-10-05', answerDue: '2026-10-08' };
  const n = nextStep(reopened, { emails: [{ kind: 'notice' }, { kind: 'rejection' }, { kind: 'closure' }], rejectedAt: 4000 });
  assert.ok(n.reminders.some((x) => /closed as not approved earlier/.test(x)));
  assert.ok(!nextStep(reopened, { emails: [{ kind: 'notice' }], rejectedAt: 4000 }).reminders.some((x) => /closed as not approved/.test(x)));
});

test('reopening warns that the explanation is cleared', () => {
  const v = { assessedDegree: '', route: 'cdb', noticeDate: '', answerDue: '', answer: '', interventions: [], conferencesHeld: 0 };
  const w = checkMove(rej, v, { status: 'review', hearingDate: '', resolution: '' }).warnings;
  assert.ok(w.some((x) => /clears the explanation/.test(x)));
});

test('sending the rejection or closure email changes nothing in the case', () => {
  assert.equal(effectOfEmail('rejection', rej), null);
  assert.equal(effectOfEmail('closure', { ...rej, noticeDate: '2026-10-05' }), null);
  assert.equal(effectOfEmail('closure-dept', rej), null);
});
