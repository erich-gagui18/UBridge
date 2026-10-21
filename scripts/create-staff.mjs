#!/usr/bin/env node
// Create (or promote) a SAEP Staff account directly in Firebase Auth + Firestore, from your own computer.
//
//   npm i -D firebase-admin
//   node scripts/create-staff.mjs --key ./serviceAccountKey.json --email saep.demo@ub.edu.ph --name "SAEP Demo Staff"
//
// Options: --position "SAEP Coordinator"  --contact "0917 123 4567"  --password "<min 8 chars>" (random if left out)
// The service-account key (Firebase console > Project settings > Service accounts > Generate new private key)
// gives full admin access. Keep it outside the repo or named serviceAccount*.json (already in .gitignore). Never share it.
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const args = process.argv.slice(2);
const opt = (name, dflt = '') => {
  const i = args.indexOf(name);
  return i < 0 ? dflt : (args[i + 1] ?? dflt);
};
const email = opt('--email').trim().toLowerCase();
const name = opt('--name', 'SAEP Demo Staff').trim();
const position = opt('--position', 'SAEP Coordinator').trim();
const contact = opt('--contact', '0917 123 4567').trim();
const keyPath = opt('--key', process.env.GOOGLE_APPLICATION_CREDENTIALS || '');
const given = opt('--password');

const die = (m) => {
  console.error(m);
  process.exit(1);
};
if (!/^[^@\s]+@ub\.edu\.ph$/i.test(email))
  die('Use an @ub.edu.ph address (the Firestore rules refuse any other domain). Example: --email saep.demo@ub.edu.ph');
if (!keyPath)
  die('Give the service-account key: --key ./serviceAccountKey.json (or set GOOGLE_APPLICATION_CREDENTIALS).');
if (given && given.length < 8) die('The password must be at least 8 characters.');
if (!/^[0-9+() -]{7,20}$/.test(contact)) die('Contact number: 7 to 20 digits, spaces, + ( ) or -.');

const projectId = JSON.parse(readFileSync(new URL('../.firebaserc', import.meta.url), 'utf8')).projects.default;
initializeApp({ credential: cert(JSON.parse(readFileSync(keyPath, 'utf8'))), projectId });
const auth = getAuth(),
  db = getFirestore();

let password = given,
  created = false,
  user;
try {
  user = await auth.getUserByEmail(email);
  if (given) await auth.updateUser(user.uid, { password: given, emailVerified: true });
  else await auth.updateUser(user.uid, { emailVerified: true });
} catch (e) {
  if (e.code !== 'auth/user-not-found') throw e;
  password ||= randomBytes(12).toString('base64url');
  user = await auth.createUser({ email, password, displayName: name, emailVerified: true });
  created = true;
}

const ref = db.collection('users').doc(user.uid);
const snap = await ref.get();
await ref.set(
  {
    name,
    email,
    role: 'staff',
    position,
    contact,
    ...(snap.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
    profileAt: FieldValue.serverTimestamp(),
  },
  { merge: true },
);

console.log(
  `\nProject:  ${projectId}\nAccount:  ${email} (${created ? 'created' : 'already existed, promoted to staff'})\nRole:     staff\nUID:      ${user.uid}`,
);
if (created || given)
  console.log(`Password: ${password}\n(Shown once. Change it after the first sign-in and don't commit it anywhere.)`);
else console.log('Password: unchanged');
console.log(
  '\nSign in on the login page with the SAEP Staff tab. Then open All cases and press "Sync offense list" if you have not yet.',
);
