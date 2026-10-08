import { db } from '../firebase.js';
import { collection, getDocs, doc, writeBatch } from '../sdk/firestore.js';

const RANK = { Minor: 0, Major: 1, Grave: 2 };

/** Offense catalog from Firestore (offenses/{id}): type, category, sanction, section. */
export async function loadOffenses() {
  const snap = await getDocs(collection(db, 'offenses'));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => RANK[a.category] - RANK[b.category] || a.type.localeCompare(b.type));
}

/** Staff action: publish data/offenses.json to Firestore. Returns {count, provisional}. */
export async function syncOffenses() {
  const res = await fetch(new URL('../data/offenses.json', import.meta.url));
  if (!res.ok) throw new Error('offenses.json not found');
  const { offenses } = await res.json();
  const b = writeBatch(db);
  offenses.forEach((o) =>
    b.set(doc(db, 'offenses', o.id), {
      type: o.type,
      category: o.category,
      sanction: o.sanction || '',
      section: o.section || '',
    }),
  );
  await b.commit();
  return { count: offenses.length, provisional: offenses.filter((o) => o.provisional).length };
}
