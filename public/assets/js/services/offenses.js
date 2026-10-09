import { db } from '../firebase.js';
import { collection, getDocs, doc, writeBatch } from '../sdk/firestore.js';

// Categories follow the College Discipline Board Manual (Revision No. 7): First, Second and Third Degree.
export const DEGREES = ['First Degree', 'Second Degree', 'Third Degree'];
/** The "Others" choice has no catalog entry or category: SAEP classifies it during assessment. */
export const OTHER_OFFENSE = { id: 'others', type: 'Others (not listed)', category: 'Unclassified', sanction: '', section: '' };
const RANK = Object.fromEntries(DEGREES.map((d, i) => [d, i]));
/** CSS class for a category chip (see styles.css .chip.deg1/.deg2/.deg3). Unknown or legacy categories get no colour class. */
export const degClass = (category) => ['deg1', 'deg2', 'deg3'][DEGREES.indexOf(category)] || '';

/** Offense catalog from Firestore (offenses/{id}): type, category, sanction, section. */
export async function loadOffenses() {
  const snap = await getDocs(collection(db, 'offenses'));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (RANK[a.category] ?? 9) - (RANK[b.category] ?? 9) || a.section.localeCompare(b.section, undefined, { numeric: true }) || a.type.localeCompare(b.type));
}

/** Staff action: publish data/offenses.json to Firestore and remove catalog entries that are no longer in it. Returns {count, provisional, removed}. */
export async function syncOffenses() {
  const res = await fetch(new URL('../data/offenses.json', import.meta.url));
  if (!res.ok) throw new Error('offenses.json not found');
  const { offenses } = await res.json();
  const keep = new Set(offenses.map((o) => o.id));
  const old = (await getDocs(collection(db, 'offenses'))).docs.map((d) => d.id).filter((id) => !keep.has(id));
  const b = writeBatch(db);
  old.forEach((id) => b.delete(doc(db, 'offenses', id)));
  offenses.forEach((o) =>
    b.set(doc(db, 'offenses', o.id), {
      type: o.type,
      category: o.category,
      sanction: o.sanction || '',
      section: o.section || '',
    }),
  );
  await b.commit();
  return { count: offenses.length, provisional: offenses.filter((o) => o.provisional).length, removed: old.length };
}
