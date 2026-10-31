import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { processForm } from '../public/assets/js/lib/process.js';

const read = (p) => readFileSync(new URL(`../public/${p}`, import.meta.url), 'utf8');
const css = read('assets/css/styles.css');
const page = read('assets/js/pages/my-complaints.js');

test('the case page styles live in one block: each tab and layout rule is defined once', () => {
  for (const sel of ['.tab-btn{', '.tabs-bar{', '.case-grid{', '.nextstep{', '.savebar{']) {
    assert.equal(
      css.split('\n').filter((l) => l.startsWith(sel)).length,
      1,
      `${sel} is defined once at the top level (phone tweaks inside @media are separate)`,
    );
  }
  assert.doesNotMatch(css, /\.staff-tab-container|\.modal-tabs|\.case-main dl/);
});

test('the update form keeps every field id that save() and readProcess() read', () => {
  const c = {
    status: 'resolved',
    offense: 'Second Degree',
    venue: 'offcampus',
    route: 'department',
    interventions: [],
  };
  const html = processForm(c);
  for (const id of [
    'pAssess',
    'pJur',
    'pRoute',
    'pNotice',
    'pDue',
    'pAnswer',
    'pParents',
    'pDept',
    'pMode',
    'pHeld',
    'pDec',
    'pDecDate',
    'pAppeal',
    'pAppealDate',
  ])
    assert.ok(html.includes(`id="${id}"`), id);
  assert.equal(
    (html.match(/<section/g) || []).length,
    (html.match(/<\/section>/g) || []).length,
    'sections are balanced',
  );
  assert.doesNotMatch(html, /<details/);
});

test('the case page: Save only on the Update tab, next step above the tabs, accessible tabs, leaving asks about unsaved edits', () => {
  assert.match(page, /role="tablist"/);
  assert.match(page, /aria-selected=/);
  assert.equal((page.match(/id="sv"/g) || []).length, 1);
  assert.ok(page.indexOf('id="sv"') < page.indexOf('const detailsHtml') === false || page.includes('const updateHtml'));
  assert.match(page, /updateHtml = \(c\) => `[\s\S]*id="sv"/);
  assert.match(page, /\$\{staff \? `<div class="nextbox">/);
  assert.match(page, /Discard your changes\?/);
  assert.doesNotMatch(page, /i change Jm|modal-tabs/);
});
