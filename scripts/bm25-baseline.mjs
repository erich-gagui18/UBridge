import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { buildIndex, search } from '../public/assets/js/services/retrieval.js';

const root = new URL('../', import.meta.url);
const handbook = JSON.parse(readFileSync(new URL('public/assets/js/data/handbook.json', root), 'utf8'));
const questions = readFileSync(new URL('ml/eval/questions.jsonl', root), 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((line) => JSON.parse(line));

const index = buildIndex(handbook.chunks);
const results = Object.fromEntries(questions.map((q) => [q.id, search(index, q.q).map((d) => d.id)]));

mkdirSync(new URL('ml/artifacts/', root), { recursive: true });
writeFileSync(
  new URL('ml/artifacts/bm25_results.json', root),
  JSON.stringify({ system: 'bm25', handbookVersion: handbook.version, results }, null, 2) + '\n',
);
console.log(`BM25 baseline written for ${questions.length} questions (handbook ${handbook.version})`);
