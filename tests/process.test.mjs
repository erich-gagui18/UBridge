import test from 'node:test';
import assert from 'node:assert/strict';
import { degreeOf, routeFor, routeOf, commissionOf, readProcess, describeChanges, processChanged, processRows } from '../public/assets/js/lib/process.js';

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
  const a = { ...base, id: 'A', filed: '2026-09-01' }, b = { ...base, id: 'B', filed: '2026-09-15' }, c = { ...base, id: 'C', filed: '2026-10-01' };
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
  const r1 = readProcess(form({ '#pAssess': 'First Degree', '#pRoute': 'department', '#pAnswer': '', '#pHeld': '0' }), base, 'review');
  assert.equal(r1.values.route, 'department');
});

test('an earlier assessment is kept when the form is left on “not assessed”', () => {
  const c = { ...base, assessedDegree: 'Third Degree', route: 'cdb' };
  const r = readProcess(form({ '#pAssess': '', '#pRoute': 'cdb', '#pAnswer': '', '#pHeld': '0' }), c, 'review');
  assert.equal(r.values.assessedDegree, 'Third Degree');
});

test('the department’s decision date is only read for department cases and is tracked as a change', () => {
  const r = readProcess(form({ '#pAssess': '', '#pRoute': 'department', '#pAnswer': '', '#pHeld': '0', '#pDept': '2026-10-12' }), base, 'review');
  assert.equal(r.values.deptDecisionDate, '2026-10-12');
  assert.ok(processChanged(base, r.values));
  assert.ok(describeChanges(base, r.values).some((x) => /Department’s decision/.test(x)));
});

test('the notice needs at least 3 days to answer (policy, Process step 2)', () => {
  const f = form({ '#pAssess': '', '#pRoute': 'cdb', '#pAnswer': '', '#pHeld': '0', '#pNotice': '2026-10-10', '#pDue': '2026-10-12' });
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
  const done = form({ '#pAssess': '', '#pRoute': 'cdb', '#pAnswer': '', '#pHeld': '0', '#pJur': 'declined', '#pDecDate': '2026-10-21' });
  assert.equal(readProcess(done, off, 'resolved').values.jurisdictionReview, 'declined');
  assert.ok(describeChanges(off, { ...off, jurisdictionReview: 'declined', assessedDegree: '', route: 'cdb', deptDecisionDate: '' }).some((x) => /outside the University’s jurisdiction/.test(x)));
});

test('describeChanges names the assessment in plain language', () => {
  const n = { assessedDegree: 'Second Degree', route: 'cdb', deptDecisionDate: '', noticeDate: '', answerDue: '', answer: '', parentsNotified: '', conferenceMode: '', decisionDate: '', appeal: '' };
  const notes = describeChanges({ ...base, offense: 'Unclassified' }, n);
  assert.ok(notes.some((x) => /assessed the offense as Second Degree/.test(x)));
});

test('the case rows show the assessment, and expulsion replaces the 5-day effectivity text', () => {
  assert.match(processRows({ ...base, offense: 'Unclassified' }), /Awaiting SAEP to assess/);
  assert.match(processRows({ ...base, offense: 'Unclassified', assessedDegree: 'Third Degree', route: 'cdb' }), /Third Degree/);
  const rows = processRows({ ...base, route: 'cdb', status: 'resolved', decisionDate: '2026-10-21', interventions: ['expulsion'] });
  assert.match(rows, /Commission on Higher Education/);
  assert.doesNotMatch(rows, /effective 2026/);
  assert.match(processRows({ ...base, route: 'cdb', status: 'resolved', decisionDate: '2026-10-21', interventions: ['reprimand'] }), /effective/);
});
