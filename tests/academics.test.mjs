import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { courseLabel } from '../public/assets/js/services/academics.js';

const { departments } = JSON.parse(readFileSync(new URL('../public/assets/js/data/academics.json', import.meta.url), 'utf8'));
const courses = departments.flatMap((d) => d.courses.map((c) => ({ ...c, dept: d.id })));

test('every department has a unique id, a name under 80 characters and at least one course', () => {
  assert.equal(new Set(departments.map((d) => d.id)).size, departments.length);
  for (const d of departments) {
    assert.ok(d.name.length >= 2 && d.name.length < 80, d.name);
    assert.ok(d.courses.length >= 1, d.id);
  }
});

test('every course has an id, a name and a code, and ids are unique within a department', () => {
  for (const d of departments) {
    assert.equal(new Set(d.courses.map((c) => c.id)).size, d.courses.length, d.id);
    for (const c of d.courses) assert.ok(c.id && c.name && c.code, `${d.id}/${c.id}`);
  }
});

test('saved course labels fit the 60 character limit in firestore.rules', () => {
  for (const c of courses) assert.ok(courseLabel(c).length <= 60, courseLabel(c));
});

test('every UBLC program in Student Handbook Revision No. 7 Section II is still selectable', () => {
  const codes = new Set(courses.map((c) => c.code));
  const rev7 = ['BSA', 'BSBA-FM', 'BSBA-MM', 'BSBA-HRDM', 'BSCrim', 'BSPsych', 'BSEd-Eng', 'BSEd-SS', 'BSLM', 'BSSW', 'BECEd', 'BSCpE', 'BSIE', 'BSArch', 'BSIHM', 'BSTM', 'BSEntrep', 'BSREM', 'BSIT', 'BMMA'];
  for (const code of rev7) assert.ok(codes.has(code), code);
});

test('course codes and saved labels are unique across all colleges', () => {
  assert.equal(new Set(courses.map((c) => c.code)).size, courses.length);
  assert.equal(new Set(courses.map((c) => courseLabel(c).toLowerCase())).size, courses.length);
});

// Student Handbook Revision No. 8 (21 January 2026): UB Lipa City Programs and College Offerings, in handbook order.
const rev8 = {
  'Graduate School': ['MAEd-EdAdmin', 'MAEd-Eng', 'MAEd-SS', 'MAEd-Fil', 'MBM-BA', 'MBM-HRM'],
  'College of Law': ['JD'],
  'College of Education, Arts and Sciences': ['BSLM', 'BSPsych', 'BSSW', 'BEEd', 'BECEd', 'BSEd-Eng', 'BSEd-SS', 'CTP'],
  'College of Criminal Justice Education': ['BSCrim', 'BSISM'],
  'College of Management and Tourism': ['BSAIS', 'BSA', 'BSBA-FM', 'BSBA-HRDM', 'BSBA-MM', 'BSTM', 'BSREM', 'BSEntrep', 'BSHM', 'BSIHM'],
  'College of Engineering and Architecture': ['BSID', 'BSArch', 'BSCpE', 'BSIE'],
  'College of Information Technology, Entertainment and Communication': ['BSEMC', 'BSIT', 'BSCS', 'BMMA'],
  'College of Health Sciences': ['BSN'],
};

test('the colleges are the Revision No. 8 colleges, in handbook order', () => {
  assert.deepEqual(departments.map((d) => d.name), Object.keys(rev8));
});

test('every Revision No. 8 program is listed under its own college', () => {
  for (const [name, codes] of Object.entries(rev8)) {
    const have = departments.find((d) => d.name === name).courses.map((c) => c.code);
    for (const code of codes) assert.ok(have.includes(code), `${name}: ${code}`);
  }
});

test('programs outside Revision No. 8 are only the ones we knowingly keep', () => {
  const handbook = new Set(Object.values(rev8).flat());
  const extra = courses.map((c) => c.code).filter((code) => !handbook.has(code));
  assert.deepEqual(extra, ['BSFS']); // BS Forensic Science: from UBLC news, not in the handbook. Confirm with the Registrar.
});
