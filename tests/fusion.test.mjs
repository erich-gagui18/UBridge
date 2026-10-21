import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fuse, mergeHits, contentHash } from '../public/assets/js/services/retrieval.js';

const cases = JSON.parse(readFileSync(new URL('../ml/tests/fixtures/fusion_cases.json', import.meta.url), 'utf8'));

for (const c of cases) {
  test(`fuse: ${c.name}`, () => {
    assert.deepEqual(fuse(c.rankings, c.limit), c.expected);
  });
}

const docs = ['A', 'B', 'C', 'D'].map((id) => ({ id, text: id }));

test('mergeHits returns the keyword hits untouched when the semantic service did not answer', () => {
  const keyword = [docs[2], docs[0]];
  assert.equal(mergeHits({ docs }, keyword, null), keyword);
});

test('mergeHits lets semantic hits rescue a question with no keyword hits', () => {
  assert.deepEqual(mergeHits({ docs }, [], ['D', 'B']).map((d) => d.id), ['D', 'B']);
});

test('mergeHits combines both rankings and ignores unknown ids', () => {
  const merged = mergeHits({ docs }, [docs[0], docs[1]], ['B', 'Z', 'C']);
  assert.deepEqual(merged.map((d) => d.id), ['B', 'A', 'C']);
});

test('contentHash matches the Python fingerprint used by the search service', async () => {
  const fx = JSON.parse(readFileSync(new URL('../ml/tests/fixtures/hash_case.json', import.meta.url), 'utf8'));
  assert.equal(await contentHash(fx.chunks), fx.hash);
  assert.notEqual(await contentHash([{ ...fx.chunks[0], text: 'edited' }]), fx.hash);
});
