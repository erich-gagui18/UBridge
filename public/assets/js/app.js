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
import { combobox } from './lib/combobox.js';
import { openViewer } from './lib/viewer.js';
import { shrink, toDataUrl, MAX_INLINE } from './lib/image.js';
import { countUp, stagger } from './lib/motion.js';
import { progress } from './lib/progress.js';
import { shell, applyTheme, bindTheme } from './lib/layout.js';
import * as authSvc from './services/auth.js';
import * as cases from './services/complaints.js';
import * as proc from './lib/process.js';
import * as profileSvc from './services/profile.js';
import { loadAcademics } from './services/academics.js';
import { pickerHtml, pairPicker } from './lib/picker.js';
import { loadOffenses, syncOffenses, degClass, DEGREES, OTHER_OFFENSE } from './services/offenses.js';

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
    const page = document.body.dataset.page;
    // Profile gate: the complaint form needs a complete profile, and everyone is nudged to the profile page once per sign-in.
    if (!profileSvc.isComplete(me) && page !== 'profile') {
      const nudged = sessionStorage.getItem('ub.nudged');
      if (page === 'file-complaint' || (page === 'dashboard' && !nudged)) {
        sessionStorage.setItem('ub.nudged', '1');
        location.replace(`profile.html?need=1${page === 'file-complaint' ? '&next=file-complaint' : ''}`);
        return new Promise(() => {});
      }
    }
    shell({ me, local, isStaff, logout, missing: profileSvc.missingFields(me) });
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
    loadEvidence: cases.loadEvidence,
    combobox, openViewer, shrink, toDataUrl, MAX_INLINE, countUp, stagger, progress,
    loadOffenses, syncOffenses, degClass, DEGREES, OTHER_OFFENSE, offenseLabel: cases.offenseLabel,
    // profile + course/department pickers
    isComplete: profileSvc.isComplete, missingFields: profileSvc.missingFields, PHONE: profileSvc.PHONE,
    saveProfile: async (v) => { me = await profileSvc.saveProfile(me, v); return me; },
    loadAcademics, pickerHtml, pairPicker,
    proc,
  };
})();
