import test from 'node:test';
import assert from 'node:assert/strict';
import { createDenseClient } from '../public/assets/js/services/dense.js';

const EXPECT = { version: 'v1', hash: 'h1' };
const ok = (body) => async () => ({ ok: true, json: async () => body });
const client = (over = {}) =>
  createDenseClient({ url: 'https://example.hf.space/', getToken: async () => 'tok', timeoutMs: 50, ...over });

test('disabled without an https url, and never calls fetch', async () => {
  let called = false;
  const c = createDenseClient({
    url: '',
    getToken: async () => 'tok',
    fetchImpl: async () => {
      called = true;
    },
  });
  assert.equal(c.enabled, false);
  assert.equal(await c.search('q', EXPECT), null);
  assert.equal(await c.warm(), false);
  assert.equal(called, false);
  assert.equal(createDenseClient({ url: 'http://insecure.example' }).enabled, false);
});

test('sends the question with the bearer token and returns chunk ids', async () => {
  let seen;
  const fetchImpl = async (url, init) => {
    seen = { url, init };
    return {
      ok: true,
      json: async () => ({
        handbookVersion: 'v1',
        handbookHash: 'h1',
        hits: [
          { id: 'CDB-21', score: 0.9 },
          { id: 'CDB-25', score: 0.8 },
        ],
      }),
    };
  };
  const ids = await client({ fetchImpl }).search('what is vandalism', EXPECT);
  assert.deepEqual(ids, ['CDB-21', 'CDB-25']);
  assert.equal(seen.url, 'https://example.hf.space/search');
  assert.equal(seen.init.headers.Authorization, 'Bearer tok');
  assert.deepEqual(JSON.parse(seen.init.body), { question: 'what is vandalism' });
});

test('ignores results built from a different handbook version or content', async () => {
  const c = client({ fetchImpl: ok({ handbookVersion: 'old', handbookHash: 'h1', hits: [{ id: 'CDB-01' }] }) });
  assert.equal(await c.search('q', EXPECT), null);
  const edited = client({
    fetchImpl: ok({ handbookVersion: 'v1', handbookHash: 'changed', hits: [{ id: 'CDB-01' }] }),
  });
  assert.equal(await edited.search('q', EXPECT), null);
  assert.equal(await edited.search('q', { version: 'v1' }), null);
});

test('returns null on HTTP errors, bad bodies, missing token and network failures', async () => {
  assert.equal(await client({ fetchImpl: async () => ({ ok: false }) }).search('q', EXPECT), null);
  assert.equal(
    await client({ fetchImpl: ok({ handbookVersion: 'v1', handbookHash: 'h1' }) }).search('q', EXPECT),
    null,
  );
  assert.equal(await client({ getToken: async () => null, fetchImpl: ok({}) }).search('q', EXPECT), null);
  assert.equal(
    await client({
      getToken: async () => {
        throw new Error('x');
      },
      fetchImpl: ok({}),
    }).search('q', EXPECT),
    null,
  );
  assert.equal(
    await client({
      fetchImpl: async () => {
        throw new Error('offline');
      },
    }).search('q', EXPECT),
    null,
  );
});

test('gives up after the timeout so the keyword search is never held up', async () => {
  const started = Date.now();
  const hang = () => new Promise(() => {});
  assert.equal(await client({ fetchImpl: hang }).search('q', EXPECT), null);
  assert.ok(Date.now() - started < 1000);
});

test('warm reports whether the service answered', async () => {
  assert.equal(await client({ fetchImpl: ok({}) }).warm(), true);
  assert.equal(
    await client({
      fetchImpl: async () => {
        throw new Error('x');
      },
    }).warm(),
    false,
  );
});
