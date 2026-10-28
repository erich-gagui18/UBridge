import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../public/${p}`, import.meta.url), 'utf8');
const layout = read('assets/js/lib/layout.js');
const css = read('assets/css/styles.css');
const profile = read('assets/js/pages/profile.js');
const html = read('pages/profile.html');

test('sidebar: brand links home, sign-out and close buttons, profile warning dot, labelled nav', () => {
  assert.match(layout, /<a class="brand" href="dashboard\.html"/);
  assert.match(layout, /id="sideOut"/);
  assert.match(layout, /id="sideX"/);
  assert.match(layout, /warn-dot/);
  assert.match(layout, /<nav class="nav" aria-labelledby="navLbl">/);
  assert.match(layout, /aria-current="page"/);
  assert.match(layout, /\$\('#menuBtn'\)\.setAttribute\('aria-expanded'/);
});

test('sidebar drawer on a phone: focus goes in, Tab stays inside, Escape and resize close it, focus returns', () => {
  assert.match(layout, /e\.key !== 'Tab'/);
  assert.match(layout, /\$\('#menuBtn'\)\.focus\(\)/);
  assert.match(layout, /addEventListener\('resize'/);
  assert.match(css, /body\.nav-open\{overflow:hidden\}body\.nav-open \.fab/);
});

test('sidebar css: one definition per rule, the close button is hidden above the phone breakpoint', () => {
  for (const sel of ['.side{', '.brand{', '.nav a{', '.me{', '.side-out{'])
    assert.equal(css.split('\n').filter((l) => l.startsWith(sel)).length, 1, sel);
  assert.match(css, /\.side \.side-x\{display:none/);
  assert.match(css, /\.side \.side-x\{display:inline-grid\}/);
});

test('profile page: ids the script needs, grouped sections, completion meter, save bar', () => {
  for (const id of ['pName', 'pRole', 'pEmail', 'av', 'state', 'need', 'groups', 'save', 'saveMsg', 'meterFill', 'progTxt'])
    assert.ok(html.includes(`id="${id}"`), id);
  assert.doesNotMatch(html, /class="step"/);
  assert.match(profile, /section\('Personal'/);
  assert.match(profile, /section\('Contact'/);
  assert.match(profile, /UB\.missingFields\(liveProfile\(\)\)/);
  assert.match(profile, /beforeunload/);
});

test('profile validation: one set of rules serves blur and Save, so they cannot disagree', () => {
  assert.match(profile, /const rules = \{/);
  assert.match(profile, /Object\.keys\(rules\)\.forEach/);
  assert.match(profile, /rules\[id\] && e\.target\.matches\('input'\)/);
});
