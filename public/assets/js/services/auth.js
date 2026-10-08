import { auth, db } from '../firebase.js';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  sendEmailVerification,
} from '../sdk/auth.js';
import { doc, getDoc, setDoc, serverTimestamp } from '../sdk/firestore.js';

export const DOMAIN = /^[^@\s]+@ub\.edu\.ph$/i;
// Roles anyone may pick at sign-up. Staff is granted by the office in the Firebase console, never from the browser.
const SELF_SERVE = ['student', 'faculty'];

const fail = (code, extra = {}) => Object.assign(new Error(code), { code, ...extra });

/** Read the profile document. Returns null when there is none (never creates one). */
export async function getProfile(u) {
  const snap = await getDoc(doc(db, 'users', u.uid));
  return snap.exists() ? { uid: u.uid, ...snap.data() } : null;
}

/** Create the profile for a brand-new account with the role the person actually chose. */
async function createProfile(u, role, name) {
  if (!SELF_SERVE.includes(role)) throw fail('ub/nostaff');
  const p = {
    name: name || u.displayName || u.email.split('@')[0],
    email: u.email,
    role,
    createdAt: serverTimestamp(),
  };
  await setDoc(doc(db, 'users', u.uid), p);
  return { uid: u.uid, ...p };
}

async function checkRole(p, role) {
  if (role && p.role !== role) {
    await signOut(auth);
    throw fail('ub/role', { role: p.role });
  }
}

export async function signIn(email, pw, role) {
  const { user } = await signInWithEmailAndPassword(auth, email, pw);
  if (!user.emailVerified) {
    await signOut(auth);
    throw fail('ub/unverified');
  }
  const p = await getProfile(user);
  if (!p) {
    await signOut(auth);
    throw fail('ub/noprofile');
  }
  await checkRole(p, role);
}

export async function signUp(name, email, pw, role) {
  if (!SELF_SERVE.includes(role)) throw fail('ub/nostaff');
  const { user } = await createUserWithEmailAndPassword(auth, email, pw);
  await updateProfile(user, { displayName: name });
  await createProfile(user, role, name);
  await sendEmailVerification(user);
  await signOut(auth);
  return { verify: true };
}

/**
 * Google sign-in / sign-up. The role the person picked is used when the account is new
 * (this was the "Faculty becomes Student" bug: the role was dropped and 'student' was always written).
 */
export async function google(role) {
  const g = new GoogleAuthProvider();
  g.setCustomParameters({ hd: 'ub.edu.ph' });
  const { user } = await signInWithPopup(auth, g);
  if (!DOMAIN.test(user.email)) {
    await signOut(auth);
    throw fail('ub/domain');
  }
  const existing = await getProfile(user);
  if (existing) return checkRole(existing, role);
  try {
    await createProfile(user, role);
  } catch (e) {
    await signOut(auth);
    throw e;
  }
}

export const signOutUser = () => signOut(auth);

const MESSAGES = {
  'auth/invalid-credential': 'Email or password is incorrect.',
  'auth/user-not-found': 'Email or password is incorrect.',
  'auth/wrong-password': 'Email or password is incorrect.',
  'auth/email-already-in-use': 'An account with this email already exists. Sign in instead.',
  'auth/weak-password': 'Choose a password with at least 6 characters.',
  'auth/too-many-requests': 'Too many attempts. Wait a few minutes and try again.',
  'auth/network-request-failed': 'No connection. Check your internet and try again.',
  'auth/popup-closed-by-user': 'Google sign-in was closed before it finished.',
  'ub/unverified': 'Verify your UB email first. Check your inbox for the link, then sign in.',
  'auth/invalid-email': 'Enter a valid email address.',
  'ub/domain': 'Use your @ub.edu.ph Google account.',
  'ub/nostaff': 'SAEP Staff accounts are assigned by the office. Choose Student or Faculty to create an account.',
  'ub/noprofile': 'This account has no profile yet. Sign up first.',
};
export const authMsg = (e) =>
  e.code === 'ub/role'
    ? `This account is registered as ${e.role === 'staff' ? 'SAEP Staff' : e.role}. Pick that role to continue.`
    : MESSAGES[e.code] || `Something went wrong. Try again. (${e.code || 'unknown'})`;
