import { db, storage, USE_STORAGE } from '../firebase.js';
import {
  doc,
  collection,
  query,
  where,
  onSnapshot,
  runTransaction,
  writeBatch,
  updateDoc,
  serverTimestamp,
} from '../sdk/firestore.js';
import { ref, uploadBytes, getDownloadURL } from '../sdk/storage.js';
import { todayPH, yearPH } from '../lib/dates.js';
import { PRIVACY_VERSION, STATUS } from '../data.js';

// Older complaints may lack a field; never let one odd document break the whole list.
const byNewest = (a, b) => String(b.filed || '').localeCompare(String(a.filed || '')) || b.id.localeCompare(a.id);

/**
 * Real-time list of cases. Students/faculty only receive their own; staff receive all.
 * Returns the unsubscribe function.
 */
export function watchCases(me, onData, onError) {
  const c = collection(db, 'complaints');
  const q = me.role === 'staff' ? c : query(c, where('filedBy', '==', me.uid));
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort(byNewest)),
    onError,
  );
}

/** Status history of one case, oldest first. */
export function watchHistory(caseId, onData, onError) {
  return onSnapshot(
    collection(db, 'complaints', caseId, 'history'),
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => Number(a.id) - Number(b.id))),
    onError,
  );
}

/** Who made each change, oldest first, as {id: byName}. Staff only (the rules deny everyone else). */
export function watchAudit(caseId, onData, onError) {
  return onSnapshot(
    collection(db, 'complaints', caseId, 'audit'),
    (snap) => onData(Object.fromEntries(snap.docs.map((d) => [d.id, d.data().byName || '']))),
    onError,
  );
}

/**
 * v: the F-SAEP-07 fields. Respondent: student, sid, program, rDept, rEmail, rContact. Complainant: cSid, cCourse,
 * cDept, cContact (name and email come from the account). Plus offenseId, type, offense, date, location, desc, signature.
 */
export async function createComplaint(me, v, files) {
  const year = yearPH();
  const cr = doc(db, 'counters', String(year));
  const id = await runTransaction(db, async (t) => {
    const s = await t.get(cr);
    const n = (s.exists() ? s.data().n : 0) + 1;
    const id = `SAEP-${year}-${String(n).padStart(3, '0')}`;
    t.set(cr, { n });
    t.set(doc(db, 'complaints', id), {
      ...v,
      filed: todayPH(),
      status: 'submitted',
      filedBy: me.uid,
      filedByName: me.name,
      filedByRole: me.role,
      filedByEmail: me.email,
      privacyConsent: true,
      privacyVersion: PRIVACY_VERSION,
      hCount: 0,
      files: [],
      createdAt: serverTimestamp(),
    });
    return id;
  });
  // Evidence is only stored when Cloud Storage is on. With it off nothing is uploaded and no file names are saved.
  let uploadFailed = false;
  if (USE_STORAGE && files.length) {
    const out = [];
    for (const f of files) {
      try {
        const path = `evidence/${me.uid}/${id}/${Date.now()}-${f.name.replace(/[^\w.-]/g, '_')}`;
        await uploadBytes(ref(storage, path), f, { contentType: f.type });
        out.push({ name: f.name, path });
      } catch {
        uploadFailed = true;
      }
    }
    if (out.length) await updateDoc(doc(db, 'complaints', id), { files: out });
  }
  return { id, uploadFailed };
}

/**
 * Staff update. One batch writes the case change, a history entry (what changed, visible to the filer),
 * an audit entry (who changed it, staff only) and an in-app notification, so they succeed or fail together
 * (the Firestore rules require them).
 */
export async function updateCase(me, c, { status, remark = '', hearingDate = '', resolution = '' }) {
  const n = (c.hCount || 0) + 1;
  const b = writeBatch(db);
  b.update(doc(db, 'complaints', c.id), {
    status,
    hearingDate,
    resolution,
    updatedAt: serverTimestamp(),
    updatedBy: me.uid,
    hCount: n,
  });
  b.set(doc(db, 'complaints', c.id, 'history', String(n)), {
    from: c.status,
    to: status,
    remark,
    at: serverTimestamp(),
  });
  b.set(doc(db, 'complaints', c.id, 'audit', String(n)), {
    by: me.uid,
    byName: me.name,
    at: serverTimestamp(),
  });
  const note =
    status === 'hearing' && hearingDate
      ? `${c.id} is now ${STATUS[status]}. Hearing date: ${hearingDate}.`
      : `${c.id} is now ${STATUS[status]}.`;
  b.set(doc(collection(db, 'notifications')), {
    uid: c.filedBy,
    caseId: c.id,
    message: note,
    read: false,
    createdAt: serverTimestamp(),
  });
  await b.commit();
}

export const evidenceUrl = (path) => getDownloadURL(ref(storage, path));
