import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { PRIVACY_VERSION, TERMS_VERSION } from '../public/assets/js/data.js';

const read = (p) => readFileSync(new URL(`../public/${p}`, import.meta.url), 'utf8');
const exists = (p) => existsSync(new URL(`../public/${p}`, import.meta.url));

const privacy = read('pages/privacy.html');
const terms = read('pages/terms.html');
const login = read('pages/login.html');
const loginJs = read('assets/js/pages/login.js');
const layout = read('assets/js/lib/layout.js');
const complaint = read('pages/file-complaint.html');

// An <a> tag for the page, with the attributes people rely on: it must open in a new tab so a half-filled form survives.
const newTabLink = (html, page) => new RegExp(`<a href="${page}" target="_blank" rel="noopener">`).test(html);

test('the version printed on each legal page matches the constant the app stores or checks', () => {
  assert.ok(privacy.includes(`Version ${PRIVACY_VERSION}</p>`), `privacy.html must say Version ${PRIVACY_VERSION}`);
  assert.ok(terms.includes(`Version ${TERMS_VERSION}</p>`), `terms.html must say Version ${TERMS_VERSION}`);
});

test('the pages Google and the app link to exist, and the legal pages link to each other', () => {
  ['pages/privacy.html', 'pages/terms.html', 'pages/login.html'].forEach((p) => assert.ok(exists(p), p));
  assert.ok(privacy.includes('href="terms.html"'));
  assert.ok(terms.includes('href="privacy.html"'));
  [privacy, terms].forEach((h) => assert.ok(h.includes('href="login.html"'), 'a way back into the app'));
});

test('both legal pages load legal.js (theme) and it does not import app.js, so signed-out visitors are not redirected', () => {
  [privacy, terms].forEach((h) => assert.ok(h.includes('src="../assets/js/pages/legal.js"')));
  assert.ok(exists('assets/js/pages/legal.js'));
  assert.doesNotMatch(read('assets/js/pages/legal.js'), /^\s*import\b/m);
});

test('the "hide until ready" rule only gates app pages, so the public legal pages are not blank', () => {
  // Pages that no script marks .ready must not be hidden by the stylesheet (this once left both legal pages empty).
  const css = read('assets/css/styles.css');
  assert.match(css, /body\[data-page\]:not\(\.ready\):not\(\.auth\) main\s*\{\s*visibility:\s*hidden/);
  assert.doesNotMatch(css, /(^|\n)body:not\(\.ready\):not\(\.auth\) main/);
  [privacy, terms].forEach((h) => assert.doesNotMatch(h, /data-page=/));
});

test('sign-up needs the agreement checkbox, and the sign-in footer links open in a new tab', () => {
  assert.match(login, /id="agreeF" hidden/);
  assert.match(login, /<input type="checkbox" id="agree"/);
  assert.ok(newTabLink(login, 'terms.html') && newTabLink(login, 'privacy.html'));
  // the checkbox is only shown and required while signing up
  assert.match(loginJs, /\$\('#agreeF'\)\.hidden = !up/);
  assert.match(loginJs, /const g = !up \|\| flag\('eAgree'/);
  assert.match(loginJs, /!g\)/);
});

test('signed-in pages link both documents from the sidebar, in a new tab', () => {
  assert.ok(newTabLink(layout, 'privacy.html') && newTabLink(layout, 'terms.html'));
});

test('the complaint consent names both documents', () => {
  assert.ok(newTabLink(complaint, 'privacy.html') && newTabLink(complaint, 'terms.html'));
});
