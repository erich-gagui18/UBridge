// Firestore security rules tests. Run with:  npm run test:rules   (starts the Firestore emulator; needs Java)
import { readFileSync } from 'node:fs';
import { before, beforeEach, after, describe, it } from 'node:test';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, writeBatch, collection, getDocs, query, where, serverTimestamp } from 'firebase/firestore';

// The rules take "today" from the server clock in Philippine time (UTC+8), so the tests must too.
const phDate = (d = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const TODAY = phDate();
const YEAR = Number(TODAY.slice(0, 4));
const ID = (n, y = YEAR) => `SAEP-${y}-${String(n).padStart(3, '0')}`;
const UB = (u) => ({ email: `${u}@ub.edu.ph`, email_verified: true });

let env;
before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'ubridge-rules-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});
after(() => env.cleanup());

// Seed users + catalog with rules disabled, then test as each person.
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users/stu1'), { name: 'Stu One', email: 'stu1@ub.edu.ph', role: 'student', sid: '2407881', course: 'BS Information Technology (BSIT)', dept: 'College of Information Technology, Entertainment and Communication', contact: '09171234567' });
    await setDoc(doc(db, 'users/stu2'), { name: 'Stu Two', email: 'stu2@ub.edu.ph', role: 'student' });
    await setDoc(doc(db, 'users/fac1'), { name: 'Fac One', email: 'fac1@ub.edu.ph', role: 'faculty', sid: '', dept: 'College of Management and Tourism', contact: '09171234567' });
    await setDoc(doc(db, 'users/bare1'), { name: 'Bare One', email: 'bare1@ub.edu.ph', role: 'student' }); // profile never filled in
    await setDoc(doc(db, 'users/staff1'), { name: 'Staff One', email: 'staff1@ub.edu.ph', role: 'staff' });
    await setDoc(doc(db, 'offenses/dress-code-violation'), { type: 'Dress Code Violation', category: 'First Degree', sanction: '', section: 'CDB Manual § 4.1.4' });
  });
});

const as = (uid, claims = UB(uid)) => env.authenticatedContext(uid, claims).firestore();
const complaint = (over = {}) => ({
  student: 'Dela Cruz, Juan', sid: '2407880', program: 'BS Psychology (BSPsych)', rDept: 'College of Education, Arts and Sciences', rEmail: '', rContact: '',
  cSid: '2407881', cCourse: 'BS Information Technology (BSIT)', cDept: 'College of Information Technology, Entertainment and Communication', cContact: '09171234567', signature: 'Stu One', signatureImg: 'data:image/jpeg;base64,/9j/4AAQ',
  offenseId: 'dress-code-violation', offense: 'First Degree', type: 'Dress Code Violation',
  date: TODAY, filed: TODAY, location: 'Room 204', desc: 'Student was not wearing the prescribed uniform inside the room.',
  route: 'department', status: 'submitted', filedBy: 'stu1', filedByName: 'Stu One', filedByRole: 'student', filedByEmail: 'stu1@ub.edu.ph',
  privacyConsent: true, privacyVersion: '2026-10', hCount: 0, files: [], createdAt: serverTimestamp(), ...over,
});
// Same two writes the app makes: bump the counter and create the complaint in one batch.
const file = (db, n, over = {}, first = n === 1) => {
  const b = writeBatch(db);
  const c = doc(db, 'counters', String(YEAR));
  first ? b.set(c, { n }) : b.update(c, { n });
  b.set(doc(db, 'complaints', ID(n)), complaint(over));
  return b.commit();
};
// Staff edit = update + history entry (what changed) + audit entry (who changed it), one batch.
const staffEdit = (db, n, changes, { history = true, audit = true, to = changes.status, from = 'submitted', remark = '', hCount = 1 } = {}) => {
  const b = writeBatch(db);
  b.update(doc(db, 'complaints', ID(n)), { hearingDate: '', resolution: '', ...changes, updatedAt: serverTimestamp(), updatedBy: 'staff1', hCount });
  if (history) b.set(doc(db, 'complaints', ID(n), 'history', String(hCount)), { from, to, remark, at: serverTimestamp() });
  if (audit) b.set(doc(db, 'complaints', ID(n), 'audit', String(hCount)), { by: 'staff1', byName: 'Staff One', at: serverTimestamp() });
  return b.commit();
};
const seedCase = () => env.withSecurityRulesDisabled((ctx) => file(ctx.firestore(), 1));

describe('authentication', () => {
  it('rejects unverified email', async () => assertFails(file(as('stu1', { ...UB('stu1'), email_verified: false }), 1)));
  it('rejects non-UB email', async () => assertFails(file(as('stu1', { email: 'stu1@gmail.com', email_verified: true }), 1)));
  it('rejects signed-out users', async () => assertFails(getDoc(env.unauthenticatedContext().firestore().doc('offenses/dress-code-violation'))));
});

describe('creating complaints (integrity)', () => {
  it('accepts a valid complaint', async () => assertSucceeds(file(as('stu1'), 1)));
  it('lets faculty file too', async () => assertSucceeds(file(as('fac1'), 1, { filedBy: 'fac1', filedByRole: 'faculty', filedByName: 'Fac One', filedByEmail: 'fac1@ub.edu.ph', cSid: '', cCourse: '', cDept: 'College of Management and Tourism', signature: 'Fac One' })));
  it('rejects a category that does not match the catalog', async () => assertFails(file(as('stu1'), 1, { offense: 'Third Degree' })));
  it('rejects an offense that is not in the catalog', async () => assertFails(file(as('stu1'), 1, { offenseId: 'made-up', type: 'Made up' })));
  it('rejects a missing privacy consent', async () => assertFails(file(as('stu1'), 1, { privacyConsent: false })));
  it('rejects a spoofed filer', async () => assertFails(file(as('stu1'), 1, { filedBy: 'stu2' })));
  it('rejects a spoofed role', async () => assertFails(file(as('stu1'), 1, { filedByRole: 'faculty' })));
  it('rejects a status other than submitted', async () => assertFails(file(as('stu1'), 1, { status: 'resolved' })));
  it('rejects an incident date after the filing date', async () => assertFails(file(as('stu1'), 1, { date: '2999-01-01' })));
  it('lets faculty leave the student number and course empty', async () => assertSucceeds(file(as('fac1'), 1, { filedBy: 'fac1', filedByRole: 'faculty', filedByName: 'Fac One', filedByEmail: 'fac1@ub.edu.ph', cSid: '', cCourse: '', cDept: 'College of Management and Tourism', signature: 'Fac One', signatureImg: 'data:image/jpeg;base64,/9j/4AAQ' })));
  it('rejects a student complainant without a valid student number', async () => assertFails(file(as('stu1'), 1, { cSid: '' })));
  it('rejects complainant details that differ from the saved profile', async () => {
    await assertFails(file(as('stu1'), 1, { cContact: '09999999999' }));
    await assertFails(file(as('stu1'), 1, { cDept: 'Some Other College' }));
  });
  it('rejects filing when the profile was never completed', async () => assertFails(file(as('bare1'), 1, { filedBy: 'bare1', filedByName: 'Bare One', filedByEmail: 'bare1@ub.edu.ph', cSid: '', cCourse: '', cDept: '', cContact: '' })));
  it('rejects a name that differs from the profile', async () => assertFails(file(as('stu1'), 1, { filedByName: 'Someone Else' })));
  it('accepts the Others offense with a description and no category', async () => assertSucceeds(file(as('stu1'), 1, { offenseId: 'others', type: 'Others (not listed)', offense: 'Unclassified', route: 'cdb', offenseOther: 'Leaving a pet unattended on campus' })));
  it('rejects Others without a description', async () => assertFails(file(as('stu1'), 1, { offenseId: 'others', type: 'Others (not listed)', offense: 'Unclassified', route: 'cdb' })));
  it('rejects Others with a degree category', async () => assertFails(file(as('stu1'), 1, { offenseId: 'others', type: 'Others (not listed)', offense: 'First Degree', offenseOther: 'Something not listed' })));
  it('rejects an offenseOther text on a catalog offense', async () => assertFails(file(as('stu1'), 1, { offenseOther: 'extra' })));
  it('rejects Unclassified on a catalog offense', async () => assertFails(file(as('stu1'), 1, { offense: 'Unclassified', route: 'cdb' })));
  it('routes First Degree to the department and rejects any other route', async () => {
    await assertFails(file(as('stu1'), 1, { route: 'cdb' }));
    await assertFails(file(as('stu1'), 1, { route: 'somewhere' }));
  });
  it('routes Second and Third Degree complaints to the CDB', async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'offenses/vandalism'), { type: 'Vandalism', category: 'Second Degree', sanction: '', section: 'CDB Manual § 4.3.5' }));
    await assertSucceeds(file(as('stu1'), 1, { offenseId: 'vandalism', type: 'Vandalism', offense: 'Second Degree', route: 'cdb' }));
  });
  it('rejects a Second Degree complaint routed to a department', async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'offenses/vandalism'), { type: 'Vandalism', category: 'Second Degree', sanction: '', section: 'CDB Manual § 4.3.5' }));
    await assertFails(file(as('stu1'), 1, { offenseId: 'vandalism', type: 'Vandalism', offense: 'Second Degree', route: 'department' }));
  });
  it('rejects a missing complainant department', async () => assertFails(file(as('stu1'), 1, { cDept: '' })));
  it('rejects a missing or invalid complainant contact number', async () => {
    await assertFails(file(as('stu1'), 1, { cContact: '' }));
    await assertFails(file(as('stu1'), 1, { cContact: 'call me maybe' }));
  });
  it('rejects a missing respondent department', async () => assertFails(file(as('stu1'), 1, { rDept: '' })));
  it('accepts a respondent email and contact number', async () => {
    await assertSucceeds(file(as('stu1'), 1, { rEmail: 'juan@ub.edu.ph', rContact: '0917 765 4321' }));
  });
  it('rejects a malformed respondent email', async () => assertFails(file(as('stu1'), 1, { rEmail: 'not-an-email' })));
  it('rejects a missing signature', async () => assertFails(file(as('stu1'), 1, { signature: '' })));
  it('rejects the old section field', async () => assertFails(file(as('stu1'), 1, { section: '3-A' })));
  it('rejects a backdated filing date', async () => assertFails(file(as('stu1'), 1, { date: '2020-01-01', filed: '2020-01-02' })));
  it('rejects a case number from another year', async () => {
    const db = as('stu1');
    const b = writeBatch(db);
    b.set(doc(db, 'counters', String(YEAR - 1)), { n: 1 });
    b.set(doc(db, 'complaints', ID(1, YEAR - 1)), complaint());
    await assertFails(b.commit());
  });
  it('rejects a short description', async () => assertFails(file(as('stu1'), 1, { desc: 'too short' })));
  it('rejects extra fields', async () => assertFails(file(as('stu1'), 1, { isAdmin: true })));
  it('rejects a case number that does not match the counter', async () => {
    const db = as('stu1');
    const b = writeBatch(db);
    b.set(doc(db, 'counters', String(YEAR)), { n: 1 });
    b.set(doc(db, 'complaints', ID(7)), complaint());
    await assertFails(b.commit());
  });
  it('rejects bumping the counter without a complaint', async () => assertFails(setDoc(doc(as('stu1'), 'counters', String(YEAR)), { n: 1 })));
});

describe('reading complaints (confidentiality)', () => {
  beforeEach(seedCase);
  it('owner can read', async () => assertSucceeds(getDoc(doc(as('stu1'), 'complaints', ID(1)))));
  it('another student cannot read', async () => assertFails(getDoc(doc(as('stu2'), 'complaints', ID(1)))));
  it('staff can read', async () => assertSucceeds(getDoc(doc(as('staff1'), 'complaints', ID(1)))));
  it('owner can list their own, but not everyone’s', async () => {
    await assertSucceeds(getDocs(query(collection(as('stu1'), 'complaints'), where('filedBy', '==', 'stu1'))));
    await assertFails(getDocs(collection(as('stu1'), 'complaints')));
  });
  it('nobody can delete', async () => {
    await assertFails(deleteDoc(doc(as('staff1'), 'complaints', ID(1))));
    await assertFails(deleteDoc(doc(as('stu1'), 'complaints', ID(1))));
  });
});

describe('updating cases (accountability and non-repudiation)', () => {
  beforeEach(seedCase);
  it('a student cannot change the status', async () => assertFails(updateDoc(doc(as('stu1'), 'complaints', ID(1)), { status: 'resolved' })));
  it('staff can change status with a history entry', async () => assertSucceeds(staffEdit(as('staff1'), 1, { status: 'review' })));
  it('staff cannot change status without a history entry', async () => assertFails(staffEdit(as('staff1'), 1, { status: 'review' }, { history: false })));
  it('hCount must go up by exactly one', async () => assertFails(staffEdit(as('staff1'), 1, { status: 'review' }, { hCount: 5 })));
  it('a hearing needs a hearing date', async () => assertFails(staffEdit(as('staff1'), 1, { status: 'hearing' })));
  it('a hearing with a date is accepted', async () => assertSucceeds(staffEdit(as('staff1'), 1, { status: 'hearing', hearingDate: '2026-11-20' })));
  it('resolving needs a resolution note', async () => assertFails(staffEdit(as('staff1'), 1, { status: 'resolved' })));
  it('resolving needs a decision date', async () => assertFails(staffEdit(as('staff1'), 1, { status: 'resolved', resolution: 'Warning issued and recorded.' })));
  it('resolving with a note and decision date is accepted', async () => assertSucceeds(staffEdit(as('staff1'), 1, { status: 'resolved', resolution: 'Warning issued and recorded.', decisionDate: TODAY, interventions: ['reprimand'] })));
  it('staff cannot edit the description', async () => assertFails(updateDoc(doc(as('staff1'), 'complaints', ID(1)), { desc: 'rewritten by staff '.repeat(3) })));
  it('history entries cannot be edited or deleted', async () => {
    await staffEdit(as('staff1'), 1, { status: 'review' });
    await assertFails(updateDoc(doc(as('staff1'), 'complaints', ID(1), 'history', '1'), { remark: 'edited' }));
    await assertFails(deleteDoc(doc(as('staff1'), 'complaints', ID(1), 'history', '1')));
  });
  it('the filer can read the history, another student cannot', async () => {
    await staffEdit(as('staff1'), 1, { status: 'review' });
    await assertSucceeds(getDoc(doc(as('stu1'), 'complaints', ID(1), 'history', '1')));
    await assertFails(getDoc(doc(as('stu2'), 'complaints', ID(1), 'history', '1')));
  });
  it('a student cannot write history', async () => assertFails(setDoc(doc(as('stu1'), 'complaints', ID(1), 'history', '1'), { from: 'submitted', to: 'review', remark: '', at: serverTimestamp() })));
  it('a history entry needs its audit entry', async () => assertFails(staffEdit(as('staff1'), 1, { status: 'review' }, { audit: false })));
  it('a history entry cannot carry staff identity', async () => {
    const db = as('staff1');
    const b = writeBatch(db);
    b.update(doc(db, 'complaints', ID(1)), { status: 'review', hearingDate: '', resolution: '', updatedAt: serverTimestamp(), updatedBy: 'staff1', hCount: 1 });
    b.set(doc(db, 'complaints', ID(1), 'history', '1'), { by: 'staff1', byName: 'Staff One', from: 'submitted', to: 'review', remark: '', at: serverTimestamp() });
    b.set(doc(db, 'complaints', ID(1), 'audit', '1'), { by: 'staff1', byName: 'Staff One', at: serverTimestamp() });
    await assertFails(b.commit());
  });
  it('the audit entry must name the staff member who wrote it', async () => {
    const db = as('staff1');
    const b = writeBatch(db);
    b.update(doc(db, 'complaints', ID(1)), { status: 'review', hearingDate: '', resolution: '', updatedAt: serverTimestamp(), updatedBy: 'staff1', hCount: 1 });
    b.set(doc(db, 'complaints', ID(1), 'history', '1'), { from: 'submitted', to: 'review', remark: '', at: serverTimestamp() });
    b.set(doc(db, 'complaints', ID(1), 'audit', '1'), { by: 'someone-else', byName: 'Staff One', at: serverTimestamp() });
    await assertFails(b.commit());
  });
  it('only staff can read the audit entries; the filer cannot', async () => {
    await staffEdit(as('staff1'), 1, { status: 'review' });
    await assertSucceeds(getDoc(doc(as('staff1'), 'complaints', ID(1), 'audit', '1')));
    await assertFails(getDoc(doc(as('stu1'), 'complaints', ID(1), 'audit', '1')));
  });
  it('audit entries cannot be edited or deleted', async () => {
    await staffEdit(as('staff1'), 1, { status: 'review' });
    await assertFails(updateDoc(doc(as('staff1'), 'complaints', ID(1), 'audit', '1'), { byName: 'edited' }));
    await assertFails(deleteDoc(doc(as('staff1'), 'complaints', ID(1), 'audit', '1')));
  });
  it('moving a case back needs a remark', async () => {
    await staffEdit(as('staff1'), 1, { status: 'review' });
    await assertFails(staffEdit(as('staff1'), 1, { status: 'submitted' }, { from: 'review', hCount: 2 }));
    await assertSucceeds(staffEdit(as('staff1'), 1, { status: 'submitted' }, { from: 'review', hCount: 2, remark: 'Opened by mistake' }));
  });
});

describe('case handling (CDB Manual 5.1)', () => {
  beforeEach(seedCase);
  const ST = (changes) => staffEdit(as('staff1'), 1, changes, { to: changes.status || 'submitted' });
  it('accepts a notice with a three-day answer period', async () => assertSucceeds(ST({ noticeDate: '2026-10-10', answerDue: '2026-10-13', answer: '', parentsNotified: '', conferenceMode: '', conferencesHeld: 0 })));
  it('accepts a longer answer period', async () => assertSucceeds(ST({ noticeDate: '2026-10-10', answerDue: '2026-10-20' })));
  it('rejects an answer period shorter than three days', async () => assertFails(ST({ noticeDate: '2026-10-10', answerDue: '2026-10-12' })));
  it('rejects an answer due date without a notice date', async () => assertFails(ST({ noticeDate: '', answerDue: '2026-10-13' })));
  it('rejects a malformed date', async () => assertFails(ST({ noticeDate: '10/10/2026' })));
  it('lets staff escalate to the CDB', async () => assertSucceeds(ST({ route: 'cdb' })));
  it('rejects an unknown route', async () => assertFails(ST({ route: 'dean' })));
  it('rejects an unknown intervention or answer value', async () => {
    await assertFails(ST({ status: 'resolved', resolution: 'Decision recorded.', decisionDate: TODAY, interventions: ['fine'] }));
    await assertFails(ST({ answer: 'maybe' }));
  });
  it('accepts a conference mode and count', async () => assertSucceeds(ST({ conferenceMode: 'online', conferencesHeld: 2 })));
  it('rejects more than 20 conferences', async () => assertFails(ST({ conferencesHeld: 21 })));
  it('only allows an appeal after a decision', async () => {
    await assertFails(ST({ appeal: 'filed', appealDate: TODAY }));
    await assertFails(ST({ status: 'resolved', resolution: 'Decision recorded.', decisionDate: TODAY, appeal: 'filed' })); // no appeal date
    await assertSucceeds(ST({ status: 'resolved', resolution: 'Decision recorded.', decisionDate: TODAY, interventions: ['censure'], appeal: 'filed', appealDate: TODAY }));
  });
  it('students cannot change handling fields', async () => assertFails(updateDoc(doc(as('stu1'), 'complaints', ID(1)), { route: 'cdb' })));
  it('a case that was already with the CDB cannot go back to the department', async () => {
    await env.withSecurityRulesDisabled((ctx) => updateDoc(doc(ctx.firestore(), 'complaints', ID(1)), { route: 'cdb' }));
    await assertFails(ST({ route: 'department' }));
  });
});

describe('evidence entries (filer attaching files)', () => {
  beforeEach(seedCase);
  const entry = (over = {}) => ({ name: 'photo.png', path: `evidence/stu1/${ID(1)}/1-photo.png`, ...over });
  const attach = (db, files) => updateDoc(doc(db, 'complaints', ID(1)), { files });
  it('the filer can attach a well-formed entry', async () => assertSucceeds(attach(as('stu1'), [entry()])));
  it('rejects a path in someone else’s folder', async () => assertFails(attach(as('stu1'), [entry({ path: `evidence/stu2/${ID(1)}/1-photo.png` })])));
  it('rejects a path for a different case', async () => assertFails(attach(as('stu1'), [entry({ path: `evidence/stu1/${ID(2)}/1-photo.png` })])));
  it('rejects extra keys in an entry', async () => assertFails(attach(as('stu1'), [entry({ url: 'https://example.com' })])));
  it('rejects more than five entries', async () => assertFails(attach(as('stu1'), Array.from({ length: 6 }, (_, i) => entry({ path: `evidence/stu1/${ID(1)}/${i}-photo.png` })))));
  it('another student cannot attach files', async () => assertFails(attach(as('stu2'), [entry()])));
});

describe('notifications', () => {
  beforeEach(seedCase);
  const note = (over = {}) => ({ uid: 'stu1', caseId: ID(1), message: `${ID(1)} is now In review.`, read: false, createdAt: serverTimestamp(), ...over });
  it('staff can notify the filer', async () => assertSucceeds(setDoc(doc(as('staff1'), 'notifications', 'n1'), note())));
  it('staff cannot notify someone who did not file the case', async () => assertFails(setDoc(doc(as('staff1'), 'notifications', 'n1'), note({ uid: 'stu2' }))));
  it('a student cannot create notifications', async () => assertFails(setDoc(doc(as('stu1'), 'notifications', 'n1'), note())));
  it('the recipient can read and mark read', async () => {
    await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'notifications/n1'), { ...note(), createdAt: new Date() }));
    await assertSucceeds(getDoc(doc(as('stu1'), 'notifications', 'n1')));
    await assertSucceeds(updateDoc(doc(as('stu1'), 'notifications', 'n1'), { read: true }));
  });
  it('the recipient cannot change the message', async () => {
    await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'notifications/n1'), { ...note(), createdAt: new Date() }));
    await assertFails(updateDoc(doc(as('stu1'), 'notifications', 'n1'), { message: 'changed' }));
  });
  it('another user cannot read it', async () => {
    await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'notifications/n1'), { ...note(), createdAt: new Date() }));
    await assertFails(getDoc(doc(as('stu2'), 'notifications', 'n1')));
  });
});

describe('accounts and roles (authenticity)', () => {
  const profile = (role) => ({ name: 'New User', email: 'new1@ub.edu.ph', role, createdAt: serverTimestamp() });
  it('lets someone create a student profile', async () => assertSucceeds(setDoc(doc(as('new1'), 'users', 'new1'), profile('student'))));
  it('lets someone create a faculty profile', async () => assertSucceeds(setDoc(doc(as('new1'), 'users', 'new1'), profile('faculty'))));
  it('blocks self-assigning staff', async () => assertFails(setDoc(doc(as('new1'), 'users', 'new1'), profile('staff'))));
  it('blocks creating a profile for someone else', async () => assertFails(setDoc(doc(as('new1'), 'users', 'stu2'), profile('student'))));
  it('blocks changing a role afterwards', async () => assertFails(updateDoc(doc(as('stu1'), 'users', 'stu1'), { role: 'staff' })));
  it('lets a student update their own profile details', async () => assertSucceeds(updateDoc(doc(as('stu1'), 'users', 'stu1'), { name: 'Stu One', sid: '2407881', course: 'BS Psychology (BSPsych)', dept: 'College of Education, Arts and Sciences', section: '4B', contact: '0917 123 4567', profileAt: serverTimestamp() })));
  it('lets faculty and staff update their own profile details', async () => {
    await assertSucceeds(updateDoc(doc(as('fac1'), 'users', 'fac1'), { dept: 'College of Management and Tourism', position: 'Instructor', contact: '09171234567', profileAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(as('staff1'), 'users', 'staff1'), { position: 'SAEP Coordinator', contact: '09171234567', profileAt: serverTimestamp() }));
  });
  it('blocks editing someone else’s profile', async () => assertFails(updateDoc(doc(as('stu1'), 'users', 'stu2'), { contact: '09171234567', profileAt: serverTimestamp() })));
  it('blocks changing email or createdAt from a profile edit', async () => {
    await assertFails(updateDoc(doc(as('stu1'), 'users', 'stu1'), { email: 'other@ub.edu.ph', profileAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(as('stu1'), 'users', 'stu1'), { createdAt: serverTimestamp(), profileAt: serverTimestamp() }));
  });
  it('rejects an invalid student number, contact number or unknown field', async () => {
    await assertFails(updateDoc(doc(as('stu1'), 'users', 'stu1'), { sid: '12345', profileAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(as('stu1'), 'users', 'stu1'), { contact: 'call me', profileAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(as('stu1'), 'users', 'stu1'), { admin: true, profileAt: serverTimestamp() }));
  });
  it('rejects a profile edit from an unverified email', async () => assertFails(updateDoc(doc(as('stu1', { ...UB('stu1'), email_verified: false }), 'users', 'stu1'), { contact: '09171234567', profileAt: serverTimestamp() })));
  it('students cannot read other profiles; staff can', async () => {
    await assertFails(getDoc(doc(as('stu1'), 'users', 'stu2')));
    await assertSucceeds(getDoc(doc(as('staff1'), 'users', 'stu2')));
  });
});

describe('offense catalog', () => {
  const entry = { type: 'Vandalism', category: 'Second Degree', sanction: '', section: 'CDB Manual § 4.3.5' };
  it('everyone signed in can read it', async () => assertSucceeds(getDoc(doc(as('stu1'), 'offenses', 'dress-code-violation'))));
  it('students cannot change it', async () => assertFails(setDoc(doc(as('stu1'), 'offenses', 'vandalism'), entry)));
  it('staff can add an entry', async () => assertSucceeds(setDoc(doc(as('staff1'), 'offenses', 'vandalism'), entry)));
  it('staff cannot add an invalid category', async () => assertFails(setDoc(doc(as('staff1'), 'offenses', 'vandalism'), { ...entry, category: 'Major' })));
});

describe('emails staff sent about a case (record keeping)', () => {
  beforeEach(seedCase);
  const mailDoc = (over = {}) => ({ kind: 'notice', to: 'resp@ub.edu.ph', cc: '', subject: 'Notice of complaint', body: 'Dear respondent, this is a notice about your case.', by: 'staff1', byName: 'Staff One', at: serverTimestamp(), ...over });
  const mailRef = (db) => doc(db, 'complaints', ID(1), 'emails', 'e1');
  it('staff can record a sent email', async () => assertSucceeds(setDoc(mailRef(as('staff1')), mailDoc())));
  it('staff can read the record', async () => {
    await assertSucceeds(setDoc(mailRef(as('staff1')), mailDoc()));
    await assertSucceeds(getDoc(mailRef(as('staff1'))));
  });
  it('the filer cannot read the record', async () => {
    await assertSucceeds(setDoc(mailRef(as('staff1')), mailDoc()));
    await assertFails(getDoc(mailRef(as('stu1'))));
  });
  it('a student cannot write a record', async () => assertFails(setDoc(mailRef(as('stu1')), mailDoc({ by: 'stu1' }))));
  it('the record must name the staff member who made it', async () => assertFails(setDoc(mailRef(as('staff1')), mailDoc({ by: 'stu1' }))));
  it('rejects an unknown kind', async () => assertFails(setDoc(mailRef(as('staff1')), mailDoc({ kind: 'spam' }))));
  it('rejects extra fields', async () => assertFails(setDoc(mailRef(as('staff1')), mailDoc({ attachment: 'x' }))));
  it('rejects a too-short body or a missing address', async () => {
    await assertFails(setDoc(mailRef(as('staff1')), mailDoc({ body: 'hi' })));
    await assertFails(setDoc(mailRef(as('staff1')), mailDoc({ to: '' })));
  });
  it('rejects a backdated time', async () => assertFails(setDoc(mailRef(as('staff1')), mailDoc({ at: new Date('2020-01-01') }))));
  it('records cannot be edited or deleted', async () => {
    await assertSucceeds(setDoc(mailRef(as('staff1')), mailDoc()));
    await assertFails(updateDoc(mailRef(as('staff1')), { body: 'changed after the fact, so this must fail' }));
    await assertFails(deleteDoc(mailRef(as('staff1'))));
  });
});
