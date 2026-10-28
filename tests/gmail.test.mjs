import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GMAIL_SCOPE,
  b64url,
  encodeHeader,
  mime,
  draftBody,
  draftUrl,
  createGmailApi,
  gmailMsg,
} from '../public/assets/js/lib/gmail.js';
import { draft, KINDS } from '../public/assets/js/lib/mail.js';

// Decode what Gmail would receive: base64url -> message -> headers + body.
const unpack = (raw) => {
  const text = Buffer.from(raw.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  const [head, body] = text.split('\r\n\r\n');
  const headers = head.replace(/\r\n /g, ' ').split('\r\n');
  const get = (n) => headers.find((h) => h.startsWith(`${n}: `))?.slice(n.length + 2);
  return { text, headers, get, body: Buffer.from(body.replace(/\r\n/g, ''), 'base64').toString('utf8') };
};
// RFC 2047 decode: whitespace between two adjacent encoded words is ignored, every other space is kept.
const decodeWords = (v) =>
  v
    .replace(/(\?=)\s+(=\?UTF-8\?B\?)/g, '$1$2')
    .replace(/=\?UTF-8\?B\?([^?]+)\?=/g, (_, b) => Buffer.from(b, 'base64').toString('utf8'));

const d = {
  to: 'juan@ub.edu.ph',
  cc: 'saep@ub.edu.ph',
  subject: 'Notice of complaint, case SAEP-2026-007',
  body: 'Dear Juan,\n\nThe SAEP Office has received a complaint.\n\nUniversity of Batangas – Lipa',
};

test('the scope is the draft-only compose scope', () => {
  assert.equal(GMAIL_SCOPE, 'https://www.googleapis.com/auth/gmail.compose');
});

test('base64url never uses + / or = padding', () => {
  const bytes = Uint8Array.from([251, 255, 254, 250, 62, 63, 0, 1, 2]);
  const out = b64url(bytes);
  assert.ok(!/[+/=]/.test(out), out);
  assert.equal(Buffer.from(out.replace(/-/g, '+').replace(/_/g, '/'), 'base64').compare(Buffer.from(bytes)), 0);
});

test('an ASCII subject is left alone, a non-ASCII one becomes RFC 2047 words that decode back', () => {
  assert.equal(encodeHeader('Reminder, case 7'), 'Reminder, case 7');
  const s = 'Conference summary – “decision” for Dela Cruz’s case';
  const e = encodeHeader(s);
  assert.ok(/^[\x20-\x7e\r\n]*$/.test(e), 'header must be plain ASCII');
  assert.equal(decodeWords(e), s);
});

test('a long non-ASCII subject is split into encoded words of 75 characters or fewer', () => {
  const s = 'Pagdinig – ' + 'Ñandú “ito” '.repeat(14);
  const e = encodeHeader(s);
  for (const w of e.split(/\r\n /)) assert.ok(w.length <= 75, `${w.length}: ${w}`);
  assert.equal(decodeWords(e), s.trim());
});

test('line breaks typed into the subject cannot add headers', () => {
  const m = unpack(draftBody({ ...d, subject: 'Hello\r\nBcc: secret@example.com' }).message.raw);
  assert.ok(!m.headers.some((h) => h.startsWith('Bcc:')));
  assert.equal(m.get('Subject'), 'Hello Bcc: secret@example.com');
});

test('the message has To, Cc, Subject, UTF-8 base64 body and CRLF breaks', () => {
  const m = unpack(draftBody(d).message.raw);
  assert.equal(m.get('To'), 'juan@ub.edu.ph');
  assert.equal(m.get('Cc'), 'saep@ub.edu.ph');
  assert.equal(m.get('Subject'), d.subject);
  assert.equal(m.get('MIME-Version'), '1.0');
  assert.equal(m.get('Content-Type'), 'text/plain; charset="UTF-8"');
  assert.equal(m.get('Content-Transfer-Encoding'), 'base64');
  assert.equal(m.body, d.body.replace(/\n/g, '\r\n'));
  assert.ok(!/[^\r]\n/.test(m.text), 'every line break is CRLF');
});

test('an empty Cc adds no Cc header and several addresses are joined cleanly', () => {
  const m = unpack(draftBody({ ...d, cc: '', to: 'a@ub.edu.ph; b@ub.edu.ph,c@ub.edu.ph' }).message.raw);
  assert.ok(!m.headers.some((h) => h.startsWith('Cc:')));
  assert.equal(m.get('To'), 'a@ub.edu.ph, b@ub.edu.ph, c@ub.edu.ph');
});

test('every real UBridge draft survives the round trip, curly quotes and dashes included', () => {
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
    hearingDate: '2026-10-20',
    conferenceMode: 'online',
    answerDue: '2026-10-05',
    interventions: ['reprimand', 'community'],
    resolution: 'Warning and community service.',
    decisionDate: '2026-10-21',
  };
  const me = { name: 'Staff One', position: 'SAEP Coordinator' };
  for (const k of Object.keys(KINDS)) {
    const x = { ...draft(k, c, me, { cc: 'saep@ub.edu.ph' }), to: 'juan@ub.edu.ph' };
    const m = unpack(draftBody(x).message.raw);
    assert.equal(decodeWords(m.get('Subject')), x.subject, k);
    assert.equal(m.body, x.body.replace(/\n/g, '\r\n'), k);
  }
});

test('the Gmail link uses the account and opens the draft when the message id is known', () => {
  assert.equal(
    draftUrl('19abc', 'staff@ub.edu.ph'),
    'https://mail.google.com/mail/?authuser=staff%40ub.edu.ph#drafts?compose=19abc',
  );
  assert.equal(draftUrl('', ''), 'https://mail.google.com/mail/#drafts');
});

// ---- API client with a fake fetch ----
const reply = (status, json) => ({ ok: status >= 200 && status < 300, status, json: async () => json });
function fake(responses) {
  const calls = [];
  const tokens = [];
  const api = createGmailApi({
    fetch: async (url, init) => {
      calls.push({ url, ...init });
      const r = responses.shift();
      if (r instanceof Error) throw r;
      return r;
    },
    getToken: async (force) => {
      tokens.push(force);
      return force ? 'fresh' : 'tok';
    },
  });
  return { api, calls, tokens };
}

test('saveDraft creates a draft with a bearer token and the raw message', async () => {
  const { api, calls } = fake([reply(200, { id: 'r1', message: { id: 'm1' } })]);
  const out = await api.saveDraft(d);
  assert.deepEqual(out, { draftId: 'r1', messageId: 'm1' });
  assert.equal(calls[0].url, 'https://gmail.googleapis.com/gmail/v1/users/me/drafts');
  assert.equal(calls[0].method, 'POST');
  assert.equal(calls[0].headers.Authorization, 'Bearer tok');
  assert.equal(JSON.parse(calls[0].body).message.raw, draftBody(d).message.raw);
});

test('saveDraft with an earlier draft id replaces it (PUT) so no duplicate is left in Gmail', async () => {
  const { api, calls } = fake([reply(200, { id: 'r1', message: { id: 'm2' } })]);
  const out = await api.saveDraft(d, 'r1');
  assert.deepEqual(out, { draftId: 'r1', messageId: 'm2' });
  assert.equal(calls[0].method, 'PUT');
  assert.equal(calls[0].url, 'https://gmail.googleapis.com/gmail/v1/users/me/drafts/r1');
});

test('if the earlier draft was deleted or sent, a new one is created', async () => {
  const { api, calls } = fake([reply(404, { error: { status: 'NOT_FOUND' } }), reply(200, { id: 'r9', message: { id: 'm9' } })]);
  const out = await api.saveDraft(d, 'r1');
  assert.equal(out.draftId, 'r9');
  assert.deepEqual(calls.map((c) => c.method), ['PUT', 'POST']);
});

test('an expired token (401) is replaced once and the call is retried', async () => {
  const { api, calls, tokens } = fake([reply(401, {}), reply(200, { id: 'r1', message: { id: 'm1' } })]);
  await api.saveDraft(d);
  assert.deepEqual(tokens, [false, true]);
  assert.equal(calls[1].headers.Authorization, 'Bearer fresh');
});

test('a second 401 gives up instead of looping', async () => {
  const { api, calls } = fake([reply(401, {}), reply(401, {})]);
  await assert.rejects(() => api.saveDraft(d), (e) => e.code === 'gmail/http-401');
  assert.equal(calls.length, 2);
});

test('errors map to stable codes with plain messages', async () => {
  const cases = [
    [reply(403, { error: { status: 'PERMISSION_DENIED', message: 'Gmail API has not been used in project 1 (SERVICE_DISABLED)', errors: [{ reason: 'accessNotConfigured' }] } }), 'gmail/api'],
    [reply(403, { error: { status: 'PERMISSION_DENIED', message: 'Request had insufficient authentication scopes.' } }), 'gmail/scope'],
    [reply(429, { error: { status: 'RESOURCE_EXHAUSTED' } }), 'gmail/quota'],
    [reply(500, {}), 'gmail/http-500'],
    [new TypeError('Failed to fetch'), 'gmail/network'],
  ];
  for (const [r, code] of cases) {
    const { api } = fake([r]);
    await assert.rejects(() => api.saveDraft(d), (e) => e.code === code, code);
  }
  for (const code of ['gmail/api', 'gmail/scope', 'gmail/quota', 'gmail/network', 'gmail/blocked', 'gmail/closed', 'gmail/load', 'gmail/denied', 'gmail/account', 'gmail/off']) {
    assert.ok(gmailMsg({ code }).length > 20, code);
  }
  assert.ok(gmailMsg({ code: 'gmail/http-500' }).includes('gmail/http-500'));
});

test('an error from the sign-in step (for example a blocked pop-up) passes through unchanged', async () => {
  const api = createGmailApi({
    fetch: async () => assert.fail('must not call the API without a token'),
    getToken: async () => {
      throw Object.assign(new Error('x'), { code: 'gmail/blocked' });
    },
  });
  await assert.rejects(() => api.saveDraft(d), (e) => e.code === 'gmail/blocked');
});

test('profile reads the signed-in address', async () => {
  const { api, calls } = fake([reply(200, { emailAddress: 'staff@ub.edu.ph' })]);
  assert.equal((await api.profile()).emailAddress, 'staff@ub.edu.ph');
  assert.equal(calls[0].url, 'https://gmail.googleapis.com/gmail/v1/users/me/profile');
  assert.equal(calls[0].method, 'GET');
});

test('mime ends the body with CRLF and never contains a bare LF', () => {
  assert.ok(mime(d).endsWith('\r\n'));
  assert.ok(!/[^\r]\n/.test(mime(d)));
});


test('draftExists: true while the draft is in Drafts, false once Gmail no longer has it, and it throws on other errors', async () => {
  const a = fake([reply(200, { id: 'r1' })]);
  assert.equal(await a.api.draftExists('r1'), true);
  assert.match(a.calls[0].url, /\/drafts\/r1\?format=minimal$/);
  assert.equal(a.calls[0].method, 'GET');
  assert.equal(await fake([reply(404, { error: { status: 'NOT_FOUND' } })]).api.draftExists('r1'), false);
  await assert.rejects(fake([reply(429, { error: { status: 'RESOURCE_EXHAUSTED' } })]).api.draftExists('r1'), { code: 'gmail/quota' });
});
