import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const { offenses } = JSON.parse(readFileSync('public/assets/js/data/offenses.json', 'utf8'));
const by = (id) => offenses.find((o) => o.id === id);
const off = (o) => o.venues.includes('offcampus');

test('every offense is listed for on campus, and venues are valid', () => {
  assert.equal(offenses.length, 45);
  for (const o of offenses) {
    assert.ok(Array.isArray(o.venues) && o.venues.length >= 1, o.id);
    assert.ok(o.venues.every((v) => v === 'campus' || v === 'offcampus'), o.id);
    assert.ok(o.venues.includes('campus'), `${o.id} must be available on campus`);
  }
});

test('offenses the policy ties to the campus are not listed for off campus', () => {
  // First Degree: smoking inside the campus, littering anywhere in the campus, canteen CLAYGO policy, uniform to class
  for (const id of ['cdb-4-1-5', 'cdb-4-1-13', 'cdb-4-1-15', 'cdb-4-1-4']) assert.equal(off(by(id)), false, id);
  // Second Degree: brawl, gambling and deadly weapons inside the campus, vandalism of school property
  for (const id of ['cdb-4-3-1', 'cdb-4-3-2', 'cdb-4-3-3', 'cdb-4-3-5']) assert.equal(off(by(id)), false, id);
  // Third Degree: attending classes or school activities under the influence
  assert.equal(off(by('cdb-4-5-3')), false);
});

test('offenses the policy says can happen online, off campus or anywhere are listed for off campus', () => {
  // First 3: posting "physically or online"; Second 4: "posted online"; 13: bullying "cyber"; 14: "inside the campus or outside"; 18: "social media"
  for (const id of ['cdb-4-1-3', 'cdb-4-3-4', 'cdb-4-3-13', 'cdb-4-3-14', 'cdb-4-3-18']) assert.equal(off(by(id)), true, id);
  // Third 4: assaulting personnel "whether in or off the campus"; 5: hazing; 6: sexual harassment
  for (const id of ['cdb-4-5-4', 'cdb-4-5-5', 'cdb-4-5-6']) assert.equal(off(by(id)), true, id);
});

test('the off-campus list is a proper, non-empty subset in every degree', () => {
  for (const d of ['First Degree', 'Second Degree', 'Third Degree']) {
    const all = offenses.filter((o) => o.category === d), some = all.filter(off);
    assert.ok(some.length > 0 && some.length < all.length, d);
  }
  assert.equal(offenses.filter(off).length, 24);
});
