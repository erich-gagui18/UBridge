// Browser side of the Gmail draft feature: Google sign-in for the draft-only scope, then the Gmail API (lib/gmail.js).
// The access token lives only in this page's memory (about an hour) and is never written to Firestore or local storage.
import { GMAIL_CLIENT_ID } from '../firebase-config.js';
import { DOMAIN } from './auth.js';
import { GMAIL_SCOPE, createGmailApi, gmailError, draftUrl } from '../lib/gmail.js';

/** False until GMAIL_CLIENT_ID is set in firebase-config.js; the page then keeps using the email app link only. */
export const enabled = Boolean(GMAIL_CLIENT_ID);

const GIS = 'https://accounts.google.com/gsi/client';
let loading = null;
let token = null;
let expiresAt = 0;
let hint = '';

const ready = () => Boolean(window.google?.accounts?.oauth2);

function loadGis() {
  if (ready()) return Promise.resolve();
  loading ||= new Promise((resolve, reject) => {
    const fail = () => {
      loading = null;
      reject(gmailError('gmail/load'));
    };
    const s = document.createElement('script');
    s.src = GIS;
    s.async = true;
    s.onload = () => (ready() ? resolve() : fail());
    s.onerror = fail;
    document.head.appendChild(s);
    setTimeout(() => !ready() && fail(), 10000);
  });
  return loading;
}

/** Load Google's sign-in library ahead of time so the pop-up opens straight from the button click. */
export const preload = () => {
  if (enabled) loadGis().catch(() => {});
};

const closed = { popup_closed: 'gmail/closed', popup_failed_to_open: 'gmail/blocked' };

function requestToken() {
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: GMAIL_CLIENT_ID,
      scope: GMAIL_SCOPE,
      hint: hint || undefined,
      callback: (r) => {
        if (r.error) return reject(gmailError(r.error === 'access_denied' ? 'gmail/denied' : `gmail/${r.error}`));
        // Google lets people untick individual permissions on the consent screen.
        if (!window.google.accounts.oauth2.hasGrantedAllScopes(r, GMAIL_SCOPE)) return reject(gmailError('gmail/scope'));
        resolve(r);
      },
      error_callback: (e) => reject(gmailError(closed[e?.type] || `gmail/${e?.type || 'unknown'}`)),
    });
    client.requestAccessToken();
  });
}

async function getToken(force) {
  if (!enabled) throw gmailError('gmail/off');
  if (!force && token && Date.now() < expiresAt - 60000) return token;
  await loadGis();
  const r = await requestToken();
  token = r.access_token;
  expiresAt = Date.now() + Number(r.expires_in || 3600) * 1000;
  return token;
}

const api = createGmailApi({ fetch: (...a) => fetch(...a), getToken });

/**
 * Save the draft in the staff member's own Gmail (or replace the one saved earlier in this dialog).
 * @param {{to,cc,subject,body}} d
 * @param {string} [existingId] draftId from an earlier call
 * @param {string} [email] the staff member's UB address, used only to preselect the Google account
 * @returns {{draftId:string, messageId:string, url:string, account:string}}
 */
export async function saveDraft(d, existingId, email = '') {
  hint = email;
  const { emailAddress } = await api.profile();
  if (!DOMAIN.test(emailAddress || '')) {
    token = null;
    expiresAt = 0;
    throw gmailError('gmail/account');
  }
  const r = await api.saveDraft(d, existingId);
  return { ...r, account: emailAddress, url: draftUrl(r.messageId, emailAddress) };
}
