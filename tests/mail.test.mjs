import test from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { draft, check, mailto, addresses, KINDS, MAILTO_LIMIT } from '../public/assets/js/lib/mail.js';

const c = {
  id: 'SAEP-2026-007',
  student: 'Dela Cruz, Juan',
  sid: '2407880',
  program: 'BS Psychology (BSPsych)',
  rDept: 'College of Education, Arts and Sciences',
  rEmail: 'juan.delacruz@ub.edu.ph',
  type: 'Dress Code Violation',
  offense: 'First Degree',
  date: '2026-10-01',
  location: 'Room 204',
  desc: 'SECRET DESCRIPTION OF WHAT HAPPENED IN THE ROOM',
  filedByName: 'Complainant Name',
  hearingDate: '2026-10-20',
  conferenceMode: 'online',
  answerDue: '2026-10-05',
  interventions: ['reprimand', 'community'],
  resolution: 'Warning and community service.',
  decisionDate: '2026-10-21',
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
    const d = draft(k, { ...c, rejectReason: 'duplicate' }, me);
    assert.ok(!d.body.includes(c.desc), k);
    // The not-approved notice is written TO the complainant, so it is the one message that addresses them by name.
    if (k !== 'rejection') assert.ok(!d.body.includes(c.filedByName), k);
  }
});

test('respondent emails go to the respondent; the department notice starts with no address', () => {
  assert.equal(draft('notice', c, me).to, c.rEmail);
  assert.equal(draft('department', c, me).to, '');
});

test('the notice follows the policy: not less than 3 days, where to answer, counsel, general denial, due date', () => {
  const b = draft('notice', c, me).body;
  assert.match(b, /not less than three \(3\) days/);
  assert.match(b, /saep\.ublc@ub\.edu\.ph/);
  assert.match(b, /assisted by counsel/);
  assert.match(b, /general denial/);
  assert.match(b, /2026/);
});

test('the notice cannot be sent until staff say how the complaint copy is delivered', () => {
  assert.match(check(draft('notice', c, me)), /\[attached \/ included below\]/);
});

test('the follow-up warns that a general denial will be entered', () => {
  assert.match(draft('followup', c, me).body, /general denial/);
});

test('the schedule email states the two-missed-conferences rule', () => {
  assert.match(draft('schedule', c, me).body, /two \(2\) consecutive/);
});

test('the decision email lists the people who receive a copy and handles expulsion and suspension', () => {
  const b = draft('decision', c, me).body;
  assert.match(b, /Registrar’s Office, the VPSAS and the Office of the President/);
  assert.match(b, /five \(5\) days/);
  const exp = draft('decision', { ...c, interventions: ['expulsion'] }, me).body;
  assert.match(exp, /Commission on Higher Education/);
  assert.doesNotMatch(exp, /takes effect five/);
  const sus = draft('decision', { ...c, interventions: ['suspension'] }, me).body;
  assert.match(sus, /report daily to the SAEP Office/);
});

test('the case block shows the degree SAEP assessed, not only the one that was filed', () => {
  const b = draft('notice', { ...c, offense: 'Unclassified', assessedDegree: 'Second Degree' }, me).body;
  assert.match(b, /\(Second Degree\)/);
  assert.doesNotMatch(draft('notice', { ...c, offense: 'Unclassified' }, me).body, /\(Unclassified\)/);
});

test('the department notice says SAEP assessed it, and asks for the decision copy', () => {
  const b = draft('department', c, me).body;
  assert.match(b, /SAEP has assessed/);
  assert.match(b, /forward a copy of the decision to the College Discipline Board/);
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


test('the notice proposes the three-day deadline when none is saved, and names it', () => {
  const nd = { ...c, answerDue: '', noticeDate: '' };
  assert.match(draft('notice', nd, me, { today: '2026-10-10' }).body, /on or before 13 Oct|on or before .*2026/);
});

test('the notice can carry the complaint statement, never the complainant’s name', () => {
  const plain = draft('notice', c, me).body;
  assert.ok(!plain.includes('SECRET DESCRIPTION'));
  const inc = draft('notice', c, me, { include: true }).body;
  assert.ok(inc.includes('SECRET DESCRIPTION'));
  assert.ok(!inc.includes('Complainant Name'));
  // the witnesses line is still a bracket, so it cannot be sent unread
  assert.match(check(draft('notice', c, me, { include: true })), /\[attached \/ not applicable\]/);
});

test('parent or guardian notice and decision copy: policy wording, no address on file, copy needs the signed decision attached', () => {
  const p = draft('parents', c, me);
  assert.equal(p.to, '');
  assert.match(p.body, /below 18 years old/);
  assert.match(p.body, /counsel/);
  assert.ok(!p.body.includes('SECRET DESCRIPTION'));
  const k = draft('copy', c, me);
  assert.equal(k.to, '');
  assert.match(k.body, /Registrar/);
  assert.match(k.body, /VPSAS/);
  assert.match(k.body, /Office of the President/);
  assert.match(k.body, /five \(5\) days/);
  assert.match(check({ ...k, to: 'registrar@ub.edu.ph' }), /\[attach the signed decision\]/);
  assert.match(draft('copy', { ...c, interventions: ['expulsion'] }, me).body, /Commission on Higher Education/);
  assert.ok(KINDS.parents && KINDS.copy);
});

const rejCase = { ...c, filedByEmail: 'complainant@ub.edu.ph', status: 'rejected', rejectReason: 'insufficient', resolution: 'The description does not say who did what.' };

test('the not-approved notice goes to the complainant with the reason and the explanation, and never the respondent', () => {
  const d = draft('rejection', rejCase, me);
  assert.equal(d.to, 'complainant@ub.edu.ph');
  assert.match(d.subject, /not approved/);
  assert.match(d.body, /Dear Complainant One|Dear /);
  assert.match(d.body, /not enough information or evidence/);
  assert.match(d.body, /does not say who did what/);
  assert.match(d.body, /new complaint/);
  assert.ok(!d.body.includes(c.rEmail));
  assert.equal(check({ ...d, to: d.to }), ''); // nothing left in brackets once the reason and explanation are saved
});

test('without a saved reason or explanation the notice cannot be sent', () => {
  const d = draft('rejection', { ...rejCase, rejectReason: '', resolution: '' }, me);
  assert.match(check(d), /\[reason\]/);
});

test('each party gets its own closing notice: the respondent and the department are written separately, whatever the case holds', () => {
  // A case that was both noticed and forwarded needs both. The notice date no longer decides which one can be written.
  const both = { ...rejCase, noticeDate: '2026-10-02' };
  const toRespondent = draft('closure', both, me);
  assert.equal(toRespondent.to, c.rEmail);
  assert.match(toRespondent.body, /no action will be taken against you/);
  assert.match(toRespondent.body, /do not need to send an explanation/);
  const toDept = draft('closure-dept', both, me);
  assert.equal(toDept.to, '');
  assert.match(toDept.body, /Dean and Program Head/);
  assert.match(toDept.body, /do not hold a disciplinary conference/);
  assert.equal(draft('closure-dept', { ...rejCase, noticeDate: '' }, me).to, '');
  assert.equal(draft('closure', { ...rejCase, noticeDate: '' }, me).to, c.rEmail);
  assert.equal(check({ ...toRespondent }), '');
  assert.ok(!toRespondent.body.includes(c.filedByName) && !toDept.body.includes(c.filedByName), 'the complainant is never named');
});

test('both new kinds are listed for the email picker and match the Firestore rules', () => {
  assert.ok(KINDS.rejection && KINDS.closure && KINDS['closure-dept']);
  const rules = readFileSync('firestore.rules', 'utf8');
  for (const k of Object.keys(KINDS)) assert.ok(rules.includes(`'${k}'`), `${k} missing from firestore.rules`);
});
