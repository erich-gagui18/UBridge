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
