// Entry point used by every page: `import {UB} from '../app.js'`.
// It wires auth state to the page shell and exposes the helpers pages need.
// The real code lives in lib/ (DOM, dates, UI, layout) and services/ (Firebase access).
import { auth, USE_STORAGE } from './firebase.js';
import { onAuthStateChanged } from './sdk/auth.js';
import { CONTACT, STATUS, ORDER, PRIVACY_VERSION } from './data.js';
import { $, $$, esc, icon, skel } from './lib/dom.js';
import { todayPH, fmt, fmtTs } from './lib/dates.js';
import { createLocal } from './lib/local.js';
import { toast, modal, confirmDlg, copy } from './lib/ui.js';
import { shell, applyTheme, bindTheme } from './lib/layout.js';
import * as authSvc from './services/auth.js';
import * as cases from './services/complaints.js';
import { loadOffenses, syncOffenses, degClass, DEGREES } from './services/offenses.js';

export const UB = (() => {
  let me = null;
  const local = createLocal(() => me?.uid);
  const isStaff = () => me?.role === 'staff';
  const chip = (s) => `<span class="chip ${s}">${STATUS[s]}</span>`;

  const logout = async () => {
    await authSvc.signOutUser();
    local.clearAllUserData();
    location.href = 'login.html';
  };

  const toLogin = async () => {
    await authSvc.signOutUser();
    location.replace('login.html');
    return new Promise(() => {});
  };

  const ready = (async () => {
    const u = await new Promise((r) => {
      const off = onAuthStateChanged(auth, (x) => {
        off();
        r(x);
      });
    });
    if (document.body.dataset.page === 'login') {
      if (u && u.emailVerified) {
        try {
          if (await authSvc.getProfile(u)) location.replace('dashboard.html');
        } catch {
          /* stay on the login page */
        }
      }
      return document.body.classList.add('ready');
    }
    if (!u || !u.emailVerified) return toLogin();
    try {
      me = await authSvc.getProfile(u);
    } catch {
      return toLogin();
    }
    if (!me) return toLogin(); // signed in but no profile document: never create one implicitly
    shell({ me, local, isStaff, logout });
    document.body.classList.add('ready');
  })();

  applyTheme(local);

  return {
    // dom / format
    $, $$, esc, icon, skel, fmt, fmtTs, todayPH, chip, STATUS, ORDER,
    // local storage (per user)
    load: local.load, save: local.save, drop: local.drop,
    // ui
    toast, modal, confirm: confirmDlg, copy, bindTheme: (btn) => bindTheme(btn, local),
    // session
    session: () => me, isStaff, ready, logout,
    get me() { return me; },
    // config flags
    CONTACT, PRIVACY_VERSION, USE_STORAGE,
    // auth
    DOMAIN: authSvc.DOMAIN, signIn: authSvc.signIn, signUp: authSvc.signUp, google: authSvc.google, resendVerification: authSvc.resendVerification, authMsg: authSvc.authMsg,
    // data
    watchCases: (onData, onError) => cases.watchCases(me, onData, onError),
    watchHistory: cases.watchHistory,
    watchAudit: cases.watchAudit,
    create: (v, files) => cases.createComplaint(me, v, files),
    updateCase: (c, change) => cases.updateCase(me, c, change),
    evidenceUrl: cases.evidenceUrl,
    loadOffenses, syncOffenses, degClass, DEGREES,
  };
})();
