import { db } from '../firebase.js';
import { collection, query, where, onSnapshot, doc, updateDoc, writeBatch } from '../sdk/firestore.js';

const ms = (n) => n.createdAt?.toMillis?.() ?? Date.now();

/**
 * In-app notifications (free-plan substitute for email). Real-time, newest first.
 * Returns the unsubscribe function.
 */
export function watchNotifications(uid, onData, onError) {
  return onSnapshot(
    query(collection(db, 'notifications'), where('uid', '==', uid)),
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => ms(b) - ms(a))),
    onError,
  );
}

export const markRead = (id) => updateDoc(doc(db, 'notifications', id), { read: true });

export async function markAllRead(items) {
  const b = writeBatch(db);
  items.filter((n) => !n.read).forEach((n) => b.update(doc(db, 'notifications', n.id), { read: true }));
  await b.commit();
}
