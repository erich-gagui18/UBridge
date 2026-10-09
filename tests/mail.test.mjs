import test from 'node:test';
import assert from 'node:assert/strict';
import { draft, check, mailto, addresses, KINDS, MAILTO_LIMIT } from '../public/assets/js/lib/mail.js';

const c = {
  id: 'SAEP-2026-007', student: 'Dela Cruz, Juan', sid: '2407880', program: 'BS Psychology (BSPsych)', rDept: 'College of Education, Arts and Sciences',
  rEmail: 'juan.delacruz@ub.edu.ph', type: 'Dress Code Violation', offense: 'First Degree', date: '2026-10-01', location: 'Room 204',
  desc: 'SECRET DESCRIPTION OF WHAT HAPPENED IN THE ROOM', filedByName: 'Complainant Name', hearingDate: '2026-10-20', conferenceMode: 'online',
  answerDue: '2026-10-05', interventions: ['reprimand', 'community'], resolution: 'Warning and community service.', decisionDate: '2026-10-21',
};
const me = { name: 'Staff One', position: 'SAEP Coordinator' };

test('every kind builds a draft with the case number and a signature', () => {
  for (const k of Object.keys(KINDS)) {
    const d = draft(k, c, me);
    assert.ok(d.subject.includes(c.id), k);
    assert.ok(d.body.includes(c.id), k);
    assert.ok(d.body.includes('SAEP Coordinator'), k);
  }
});

test('drafts never include the complainant name or the description', () => {
  for (const k of Object.keys(KINDS)) {
    const d = draft(k, c, me);
    assert.ok(!d.body.includes(c.desc), k);
    assert.ok(!d.body.includes(c.filedByName), k);
  }
});

test('respondent emails go to the respondent; the department notice starts with no address', () => {
  assert.equal(draft('notice', c, me).to, c.rEmail);
  assert.equal(draft('department', c, me).to, '');
});

test('the notice asks for an explanation within 72 hours by email and shows the due date', () => {
  const b = draft('notice', c, me).body;
  assert.match(b, /72 hours/);
  assert.match(b, /email only/);
  assert.match(b, /2026/);
});

test('the decision email lists interventions and the documents to submit', () => {
  const b = draft('decision', c, me).body;
  assert.match(b, /Community service/);
  assert.match(b, /Attendance record/);
  assert.match(b, /Narrative report/);
  const noCs = draft('decision', { ...c, interventions: ['reprimand'] }, me).body;
  assert.doesNotMatch(noCs, /Attendance record/);
});

test('check blocks a missing address, bad addresses, short text and unfinished [brackets]', () => {
  const ok = { to: 'a@ub.edu.ph', cc: '', subject: 'Subject', body: 'A complete message with enough text.' };
  assert.equal(check(ok), '');
  assert.match(check({ ...ok, to: '' }), /To/);
  assert.match(check({ ...ok, to: 'not-an-email' }), /not a valid/);
  assert.match(check({ ...ok, cc: 'a@ub.edu.ph, oops' }), /oops/);
  assert.match(check({ ...ok, subject: ' ' }), /subject/i);
  assert.match(check({ ...ok, body: 'short' }), /short/);
  assert.match(check({ ...ok, body: 'Time: [time] is still missing here' }), /\[time\]/);
});

test('a fresh schedule draft is not sendable until the bracketed parts are filled in', () => {
  const d = draft('schedule', c, me);
  assert.match(check(d), /\[/);
});

test('addresses accepts commas and semicolons', () => {
  assert.deepEqual(addresses('a@x.com, b@y.com; c@z.com'), ['a@x.com', 'b@y.com', 'c@z.com']);
});

test('mailto encodes the subject and body and keeps line breaks', () => {
  const u = mailto({ to: 'a@ub.edu.ph', cc: 'b@ub.edu.ph', subject: 'Hi & bye', body: 'Line 1\nLine 2' });
  assert.ok(u.startsWith('mailto:a@ub.edu.ph?'));
  assert.ok(u.includes('cc=b@ub.edu.ph'));
  assert.ok(u.includes('subject=Hi%20%26%20bye'));
  assert.ok(u.includes('Line%201%0D%0ALine%202'));
});

test('a normal draft fits in a link, a very long one does not', () => {
  const d = draft('notice', c, me);
  assert.ok(mailto({ ...d, cc: '' }).length < MAILTO_LIMIT);
  assert.ok(mailto({ ...d, body: 'x'.repeat(3000) }).length > MAILTO_LIMIT);
});
