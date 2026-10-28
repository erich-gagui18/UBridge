import { auth, db } from '../firebase.js';
import { updateProfile } from '../sdk/auth.js';
import { doc, updateDoc, serverTimestamp } from '../sdk/firestore.js';

export const PHONE = /^[0-9+() -]{7,20}$/;

/** Fields each role must fill in before the profile counts as complete. */
const NEEDS = {
  student: ['name', 'sid', 'dept', 'course', 'contact'],
  faculty: ['name', 'dept', 'contact'],
  staff: ['name', 'position', 'contact'],
};
const LABEL = {
  name: 'full name',
  sid: 'student number',
  dept: 'department',
  course: 'course',
  contact: 'contact number',
  position: 'position',
};

const bad = (p, k) => {
  const v = String(p?.[k] ?? '').trim();
  if (!v) return true;
  if (k === 'sid' && p.role === 'student') return !/^\d{7}$/.test(v);
  if (k === 'contact') return !PHONE.test(v);
  return false;
};

/** Names of the required details that are missing or invalid, e.g. ['course', 'contact number']. */
export const missingFields = (p) => (NEEDS[p?.role] || []).filter((k) => bad(p, k)).map((k) => LABEL[k]);
export const isComplete = (p) => missingFields(p).length === 0;

/** Save the editable details. Email and role never change from the browser (the rules refuse it). */
export async function saveProfile(me, v) {
  const clean = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, String(x ?? '').trim()]));
  await updateDoc(doc(db, 'users', me.uid), { ...clean, profileAt: serverTimestamp() });
  if (clean.name && auth.currentUser && auth.currentUser.displayName !== clean.name) {
    try {
      await updateProfile(auth.currentUser, { displayName: clean.name });
    } catch {
      /* the profile document is the source of truth */
    }
  }
  return { ...me, ...clean };
}
