// Gmail drafts for SAEP staff. UBridge never sends mail: it saves the staff member's edited message as a DRAFT in
// that person's own Gmail (Gmail API, users.drafts.create). They open it in Gmail, send it themselves, and confirm in UBridge.
// Pure functions plus an API client that takes `fetch` and `getToken` as arguments, so it can be tested with plain Node.
import { addresses } from './mail.js';

/** Only scope needed to create, replace and send drafts. It cannot read the mailbox beyond drafts. */
export const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.compose';
const API = 'https://gmail.googleapis.com/gmail/v1/users/me';

const enc = new TextEncoder();

const b64 = (bytes) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
/** base64url (RFC 4648 §5) without padding, as the Gmail API expects for `raw`. */
export const b64url = (bytes) => b64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const crlf = (s) => String(s).replace(/\r?\n/g, '\r\n');
// Header values must not contain line breaks (header injection), whatever the staff member typed.
const oneLine = (s) => String(s).replace(/[\r\n]+/g, ' ').trim();

/**
 * RFC 2047 encoding for a header that has non-ASCII text (the policy text uses “ ” ’ and – a lot).
 * Each encoded word stays under 75 characters, split on character boundaries, joined by a folded line.
 */
export function encodeHeader(value) {
  const s = oneLine(value);
  if (/^[\x20-\x7e]*$/.test(s)) return s;
  const words = [];
  let chunk = [];
  let size = 0;
  const flush = () => {
    if (chunk.length) words.push(`=?UTF-8?B?${b64(Uint8Array.from(chunk))}?=`);
    chunk = [];
    size = 0;
  };
  for (const ch of s) {
    const bytes = enc.encode(ch);
    if (size + bytes.length > 45) flush(); // 45 bytes -> 60 base64 characters + 12 of framing = 72
    chunk.push(...bytes);
    size += bytes.length;
  }
  flush();
  return words.join('\r\n ');
}

/** The RFC 2822 message for a draft ({to, cc, subject, body}), UTF-8, base64 body, CRLF line breaks. */
export function mime(d) {
  const to = addresses(d.to).join(', ');
  const cc = addresses(d.cc).join(', ');
  const body = b64(enc.encode(crlf(d.body)))
    .match(/.{1,76}/g)
    ?.join('\r\n') ?? '';
  return [
    `To: ${to}`,
    ...(cc ? [`Cc: ${cc}`] : []),
    `Subject: ${encodeHeader(d.subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    body,
    '',
  ].join('\r\n');
}

/** Request body for drafts.create / drafts.update. */
export const draftBody = (d) => ({ message: { raw: b64url(enc.encode(mime(d))) } });

/** Link that opens the draft in Gmail (falls back to the Drafts folder when the message id is missing). */
export function draftUrl(messageId, email) {
  const who = email ? `?authuser=${encodeURIComponent(email)}` : '';
  return `https://mail.google.com/mail/${who}#drafts${messageId ? `?compose=${encodeURIComponent(messageId)}` : ''}`;
}

/** An error with a stable `code` so the page can show a plain message. */
export const gmailError = (code, extra = {}) => Object.assign(new Error(code), { code, ...extra });

const MESSAGES = {
  'gmail/off': 'Gmail drafts are not set up for this site yet. Use “Open in my email app” instead.',
  'gmail/blocked': 'The Google sign-in window was blocked. Allow pop-ups for this site and try again.',
  'gmail/closed': 'The Google sign-in window was closed before it finished. Click Create Gmail draft to try again.',
  'gmail/denied': 'Gmail access was not allowed. Choose Allow when Google asks, then try again.',
  'gmail/scope': 'Google did not give permission to create drafts. Try again and keep the box for managing drafts ticked.',
  'gmail/account': 'Use your @ub.edu.ph Google account for Gmail drafts.',
  'gmail/api': 'The Gmail API is not turned on for this project. Ask the system owner to enable it in Google Cloud.',
  'gmail/quota': 'Gmail is busy. Wait a minute and try again.',
  'gmail/network': 'No connection. Check your internet and try again.',
  'gmail/load': 'Google sign-in could not load. Check your internet or ad blocker and try again.',
};
export const gmailMsg = (e) => MESSAGES[e?.code] || `Gmail couldn’t save the draft. Use “Open in my email app” instead. (${e?.code || 'unknown'})`;

/**
 * Gmail API client. `getToken(force)` returns an access token (force = ignore any cached one).
 * Creates a draft, or replaces the one made earlier so going back to edit never leaves a duplicate.
 */
export function createGmailApi({ fetch, getToken }) {
  async function call(method, path, body, force = false) {
    let res;
    try {
      res = await fetch(`${API}${path}`, {
        method,
        headers: { Authorization: `Bearer ${await getToken(force)}`, 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (e) {
      if (e?.code) throw e;
      throw gmailError('gmail/network');
    }
    if (res.status === 401 && !force) return call(method, path, body, true); // the token expired: ask for a fresh one once
    if (res.ok) return res.json();
    let info = {};
    try {
      info = (await res.json()).error || {};
    } catch {
      /* no JSON body */
    }
    const reason = info.errors?.[0]?.reason || info.status || '';
    if (res.status === 404) throw gmailError('gmail/gone', { status: 404 });
    if (res.status === 429 || /rateLimit|quota/i.test(reason)) throw gmailError('gmail/quota', { status: res.status });
    if (res.status === 403 && /accessNotConfigured|SERVICE_DISABLED/i.test(reason + (info.message || ''))) throw gmailError('gmail/api', { status: 403 });
    if (res.status === 403) throw gmailError('gmail/scope', { status: 403 });
    throw gmailError(`gmail/http-${res.status}`, { status: res.status, reason });
  }

  return {
    /** The signed-in Google account's address (needs only the compose scope). */
    profile: () => call('GET', '/profile'),
    /** @returns {{draftId:string, messageId:string}} */
    async saveDraft(d, existingId) {
      const body = draftBody(d);
      if (existingId) {
        try {
          const r = await call('PUT', `/drafts/${encodeURIComponent(existingId)}`, { id: existingId, ...body });
          return { draftId: r.id || existingId, messageId: r.message?.id || '' };
        } catch (e) {
          if (e.code !== 'gmail/gone') throw e; // the draft was deleted or already sent: make a new one
        }
      }
      const r = await call('POST', '/drafts', body);
      return { draftId: r.id, messageId: r.message?.id || '' };
    },
  };
}
