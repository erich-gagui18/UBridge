// Pure retrieval code (no Firebase imports) so it can be unit-tested with plain Node.
const TOP_K = 4;

const STOP = new Set(
  `a an the and or of to in on at for is are was were be been being do does did can could should would will shall
   what which who whom how when where why my me i we you your it its this that these those with without about as by
   from if then than into there their they them not no any some also just please tell`.split(/\s+/),
);

// Whole-word tokens only. (The old matcher used String.includes, so 'id' matched "did" and "hidden".)
export const tokens = (s) =>
  (
    String(s)
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .match(/[a-z0-9]+/g) || []
  )
    .filter((w) => !STOP.has(w))
    .map((w) =>
      w.length <= 3
        ? w
        : w
            .replace(/sses$/, 'ss')
            .replace(/(?<!s)s$/, '')
            .slice(0, 6),
    );

export function buildIndex(chunks) {
  const docs = chunks.map((c) => ({ ...c, toks: tokens(`${c.section} ${c.title || ''} ${c.text}`) }));
  const df = new Map();
  docs.forEach((d) => new Set(d.toks).forEach((t) => df.set(t, (df.get(t) || 0) + 1)));
  const avg = docs.reduce((n, d) => n + d.toks.length, 0) / (docs.length || 1);
  return { docs, df, avg };
}

/** BM25 over the chunks. Returns up to TOP_K chunks that really share words with the question. */
export function search({ docs, df, avg }, question) {
  const q = [...new Set(tokens(question))];
  if (!docs.length || !q.length) return [];
  const N = docs.length,
    k1 = 1.4,
    b = 0.75;
  const scored = docs.map((d) => {
    const tf = new Map();
    d.toks.forEach((t) => tf.set(t, (tf.get(t) || 0) + 1));
    let s = 0,
      matched = 0;
    for (const t of q) {
      const f = tf.get(t);
      if (!f) continue;
      matched++;
      const idf = Math.log(1 + (N - (df.get(t) || 0) + 0.5) / ((df.get(t) || 0) + 0.5));
      s += (idf * f * (k1 + 1)) / (f + k1 * (1 - b + (b * d.toks.length) / avg));
    }
    return { d, s, matched };
  });
  const need = Math.max(1, Math.ceil(q.length * 0.34));
  const hits = scored.filter((x) => x.s > 0 && x.matched >= need).sort((a, c) => c.s - a.s);
  const top = hits[0]?.s || 0;
  return hits
    .filter((x) => x.s >= top * 0.35)
    .slice(0, TOP_K)
    .map((x) => x.d);
}

export const RRF_K = 60;

export function fuse(rankings, limit = TOP_K, k = RRF_K) {
  const scores = new Map();
  for (const ranking of rankings) ranking.forEach((id, i) => scores.set(id, (scores.get(id) || 0) + 1 / (k + i + 1)));
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);
}

export function mergeHits({ docs }, keywordDocs, semanticIds) {
  if (!semanticIds) return keywordDocs;
  const byId = new Map(docs.map((d) => [d.id, d]));
  return fuse([keywordDocs.map((d) => d.id), semanticIds])
    .map((id) => byId.get(id))
    .filter(Boolean);
}

export async function contentHash(chunks) {
  try {
    const body = chunks.map((c) => [c.id, c.title || '', c.text].join('\x1f')).join('\x1e');
    const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(body));
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return '';
  }
}
