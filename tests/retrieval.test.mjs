import test from 'node:test';
import assert from 'node:assert/strict';
import { tokens, buildIndex, search } from '../public/assets/js/services/retrieval.js';

// Synthetic chunks for testing the matcher only. They are NOT handbook text.
const index = buildIndex([
  { id: 'T-1', section: 'Test A', title: 'Identification', text: 'Students must wear the school ID card at all times inside the campus.' },
  { id: 'T-2', section: 'Test B', title: 'Offense categories', text: 'Offenses are grouped as minor, major or grave offenses.' },
  { id: 'T-3', section: 'Test C', title: 'Notices', text: 'The notice was hidden and nobody did anything about it.' },
]);

test('whole-word matching: "id" does not match "did" or "hidden"', () => {
  const ids = search(index, 'id').map((d) => d.id);
  assert.deepEqual(ids, ['T-1']);
});

test('plural and singular match', () => {
  assert.equal(search(index, 'what is an offense category')[0].id, 'T-2');
  assert.equal(search(index, 'offenses')[0].id, 'T-2');
});

test('unrelated question returns nothing', () => {
  assert.deepEqual(search(index, 'how do I cook adobo'), []);
});

test('stop words alone return nothing', () => {
  assert.deepEqual(tokens('what is the'), []);
  assert.deepEqual(search(index, 'what is the'), []);
});

// The shipped handbook.json is the UB College Student Discipline Policy (SAEP M, Revision No. 4); make sure the guide can find the degrees.
import { readFileSync } from 'node:fs';
test('shipped handbook finds plagiarism under Third Degree offenses', () => {
  const { chunks } = JSON.parse(readFileSync(new URL('../public/assets/js/data/handbook.json', import.meta.url), 'utf8'));
  const hits = search(buildIndex(chunks), 'What is the penalty for plagiarism?');
  assert.ok(hits.some((h) => h.title.includes('THIRD DEGREE OFFENSES')));
});
test('shipped handbook finds the appeal rule', () => {
  const { chunks } = JSON.parse(readFileSync(new URL('../public/assets/js/data/handbook.json', import.meta.url), 'utf8'));
  const hits = search(buildIndex(chunks), 'Can I appeal the decision?');
  assert.ok(hits.some((h) => /appeal/i.test(h.text)));
});
