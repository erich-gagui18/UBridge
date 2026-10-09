#!/usr/bin/env node
// Turn plain-text exports of handbook text into public/assets/js/data/handbook.json.
//
//   node scripts/chunk-handbook.mjs handbook/cdb-manual.txt
//
// The label comes from the file name: section-VII.txt -> "Section VII", cdb-manual.txt -> "CDB Manual".
// A line is treated as a heading when it matches --heading (default: two-level numbered lines such as "4.1 FIRST DEGREE OFFENSES"
// or lines written in ALL CAPS). Three-level numbers such as 4.1.1 are body text, not headings. Text under a heading is kept word for word (only whitespace is tidied) and split at paragraph breaks into chunks
// of about --max characters (default 900). Check the output against the printed handbook before you rely on it.
import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(name);
  if (i < 0) return dflt;
  return args.splice(i, 2)[1];
};
const OUT = opt('--out', 'public/assets/js/data/handbook.json');
const MAX = Number(opt('--max', 900));
const VERSION = opt('--version', 'cdb-rev7-2023');
const HEADING = new RegExp(opt('--heading', '^\\s*(?:\\d+\\.\\d+\\s+\\S.{2,100}|[A-Z][A-Z0-9 ,&/()\\-]{5,100})\\s*$'));
const files = args;
if (!files.length) {
  console.error('Usage: node scripts/chunk-handbook.mjs <cdb-manual.txt | section-VII.txt> [...] [--out file] [--max 900] [--heading regex] [--version label]');
  process.exit(1);
}

const chunks = [];
for (const file of files) {
  const stem = basename(file).replace(/\.[^.]+$/, '');
  const m = stem.match(/^section[-_ ]?([ivxlc]+)$/i);
  // section-VII.txt -> "Section VII"; any other name (cdb-manual.txt) -> words capitalised, short words upper-case ("CDB Manual").
  const label = m
    ? `Section ${m[1].toUpperCase()}`
    : stem.split(/[-_ ]+/).filter(Boolean).map((w) => (w.length <= 3 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1))).join(' ');
  if (!label) throw new Error(`Cannot read a label from the file name: ${file}`);
  const roman = m ? m[1].toUpperCase() : label.split(' ')[0].toUpperCase();
  const section = label;
  let title = '', buf = [], seq = 0;
  const flush = () => {
    const paras = buf.join('\n').split(/\n\s*\n/).map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean);
    let cur = '';
    const push = () => {
      if (!cur) return;
      chunks.push({ id: `${roman}-${String(++seq).padStart(2, '0')}`, section, title, text: cur });
      cur = '';
    };
    for (const p of paras) {
      if (cur && cur.length + p.length > MAX) push();
      cur = cur ? `${cur}\n${p}` : p;
    }
    push();
    buf = [];
  };
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (HEADING.test(line) && line.trim().length < 110) {
      flush();
      title = line.trim();
    } else buf.push(line);
  }
  flush();
}
writeFileSync(OUT, JSON.stringify({ version: VERSION, chunks }, null, 2) + '\n');
console.log(`Wrote ${chunks.length} chunks to ${OUT}`);
if (!chunks.length) console.warn('No chunks were produced. Check the input files and the --heading pattern.');
