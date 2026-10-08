import {auth, db, storage, USE_STORAGE} from './firebase.js';
import {TYPES, KB, CONTACT} from './data.js';
import {onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, GoogleAuthProvider, signInWithPopup, signOut, sendEmailVerification} from './sdk/auth.js';
import {doc, getDoc, setDoc, collection, getDocs, query, where, runTransaction, updateDoc, serverTimestamp} from './sdk/firestore.js';
import {ref, uploadBytes, getDownloadURL} from './sdk/storage.js';
export const UB = (() => {
  let me = null;
  const DOMAIN = /^[^@\s]+@ub\.edu\.ph$/i;
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  // Per-user keys so drafts/history never leak between accounts on a shared computer.
  const K = k => k === 'theme' ? 'ub.theme' : `ub.${me?.uid || 'anon'}.${k}`;
  const load = (k, d) => { try { return JSON.parse(localStorage.getItem(K(k))) ?? d; } catch { return d; } };
  const save = (k, v) => localStorage.setItem(K(k), JSON.stringify(v));
  const drop = k => localStorage.removeItem(K(k));
  const P = {home:'M3 11l9-8 9 8v10H3z',plus:'M12 5v14M5 12h14',list:'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',book:'M4 5a2 2 0 012-2h5v17H6a2 2 0 00-2 2zM20 5a2 2 0 00-2-2h-5v17h5a2 2 0 012 2z',out:'M9 21H5V3h4M16 17l5-5-5-5M21 12H9',moon:'M21 13A9 9 0 1111 3a7 7 0 0010 10z',menu:'M3 6h18M3 12h18M3 18h18',check:'M5 13l4 4L19 7',mail:'M3 5h18v14H3zM3 5l9 8 9-8',up:'M12 19V5M5 12l7-7 7 7',help:'M9 9a3 3 0 115 2c0 2-3 2-3 4M12 18h.01'};
  const icon = n => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="${P[n]}"/></svg>`;
  const STATUS = {submitted:'Submitted',review:'In review',hearing:'For hearing',resolved:'Resolved'}, ORDER = Object.keys(STATUS);
  const chip = s => `<span class="chip ${s}">${STATUS[s]}</span>`;
  const fmt = d => new Date(d + 'T00:00').toLocaleDateString('en-PH', {year:'numeric', month:'short', day:'numeric'});
  const fmtTs = t => t?.toDate ? t.toDate().toLocaleString('en-PH', {dateStyle: 'medium', timeStyle: 'short'}) : '—';
  const skel = n => Array.from({length: n}, () => '<div class="sk-card" aria-hidden="true"><i class="sk"></i></div>').join('');
  const dflt = () => matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  const session = () => me, isStaff = () => me?.role === 'staff';


  // ---- Firebase data layer ----
  const profile = async (u, role = 'student', name) => {
    const r = doc(db, 'users', u.uid), snap = await getDoc(r);
    if (snap.exists()) return {uid: u.uid, ...snap.data()};
    const p = {name: name || u.displayName || u.email.split('@')[0], email: u.email, role, createdAt: serverTimestamp()};
    await setDoc(r, p); return {uid: u.uid, ...p};
  };
  const checkRole = async (p, role) => { if (role && p.role !== role) { await signOut(auth); const e = new Error('role'); e.code = 'ub/role'; e.role = p.role; throw e; } };
  const signIn = async (email, pw, role) => { const {user} = await signInWithEmailAndPassword(auth, email, pw); if (!user.emailVerified) { await signOut(auth); const e = new Error('unverified'); e.code = 'ub/unverified'; throw e; } await checkRole(await profile(user), role); };
  const signUp = async (name, email, pw, role) => { const {user} = await createUserWithEmailAndPassword(auth, email, pw); await updateProfile(user, {displayName: name}); await profile(user, role, name); await sendEmailVerification(user); await signOut(auth); return {verify: true}; };
  const google = async role => {
    const g = new GoogleAuthProvider(); g.setCustomParameters({hd: 'ub.edu.ph'});
    const {user} = await signInWithPopup(auth, g);
    if (!DOMAIN.test(user.email)) { await signOut(auth); const e = new Error('domain'); e.code = 'ub/domain'; throw e; }
    await checkRole(await profile(user), role);
  };
  const logout = async () => { await signOut(auth); Object.keys(localStorage).filter(k => k.startsWith('ub.') && k !== 'ub.theme' && k !== 'ub.privacy').forEach(k => localStorage.removeItem(k)); location.href = 'login.html'; };
  const list = async () => {
    const c = collection(db, 'complaints'), snap = await getDocs(isStaff() ? c : query(c, where('filedBy', '==', me.uid)));
    return snap.docs.map(d => ({id: d.id, ...d.data()})).sort((a, b) => b.filed.localeCompare(a.filed) || b.id.localeCompare(a.id));
  };
  const create = async (v, files) => {
    const year = new Date().getFullYear(), cr = doc(db, 'counters', String(year));
    const id = await runTransaction(db, async t => {
      const s = await t.get(cr), n = (s.exists() ? s.data().n : 0) + 1, id = `SAEP-${year}-${String(n).padStart(3, '0')}`;
      t.set(cr, {n});
      t.set(doc(db, 'complaints', id), {...v, filed: new Date().toISOString().slice(0, 10), status: 'submitted', filedBy: me.uid, filedByName: me.name, files: [], createdAt: serverTimestamp()});
      return id;
    });
    let uploadFailed = false;
    if (files.length) {
      const out = [];
      for (const f of files) {
        if (!USE_STORAGE) { out.push({name: f.name}); continue; }
        try { const path = `evidence/${me.uid}/${id}/${Date.now()}-${f.name.replace(/[^\w.-]/g, '_')}`; await uploadBytes(ref(storage, path), f, {contentType: f.type}); out.push({name: f.name, path}); }
        catch { uploadFailed = true; }
      }
      if (out.length) await updateDoc(doc(db, 'complaints', id), {files: out});
    }
    return {id, uploadFailed};
  };
  const setStatus = (id, status) => updateDoc(doc(db, 'complaints', id), {status, updatedAt: serverTimestamp()});
  const evidenceUrl = path => getDownloadURL(ref(storage, path));
  const authMsg = e => ({'auth/invalid-credential':'Email or password is incorrect.','auth/user-not-found':'Email or password is incorrect.','auth/wrong-password':'Email or password is incorrect.','auth/email-already-in-use':'An account with this email already exists. Sign in instead.','auth/weak-password':'Choose a password with at least 6 characters.','auth/too-many-requests':'Too many attempts. Wait a few minutes and try again.','auth/network-request-failed':'No connection. Check your internet and try again.','auth/popup-closed-by-user':'Google sign-in was closed before it finished.','ub/unverified':'Verify your UB email first. Check your inbox for the link, then sign in.','auth/invalid-email':'Enter a valid email address.','ub/domain':'Use your @ub.edu.ph Google account.','ub/role':`This account is registered as ${e.role === 'staff' ? 'SAEP Staff' : e.role}. Pick that role to continue.`}[e.code] || `Something went wrong. Try again. (${e.code || 'unknown'})`);

  function toast(msg, type = '') {
    let w = $('#toasts'); if (!w) { w = document.createElement('div'); w.id = 'toasts'; w.setAttribute('aria-live', 'polite'); document.body.appendChild(w); }
    const t = document.createElement('div'); t.className = 'toast ' + type; t.textContent = msg; w.appendChild(t); setTimeout(() => t.remove(), 3500);
  }
  function modal(html, label = 'Dialog', onClose) {
    const ov = document.createElement('div'), prev = document.activeElement; ov.className = 'overlay';
    ov.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="${esc(label)}" tabindex="-1">${html}</div>`;
    const close = () => { ov.remove(); document.removeEventListener('keydown', key); prev?.focus?.(); onClose?.(); };
    const key = e => { if (e.key === 'Escape' && ov === [...document.querySelectorAll('.overlay')].pop()) close(); };
    document.addEventListener('keydown', key);
    ov.addEventListener('click', e => { if (e.target === ov || e.target.closest('[data-close]')) close(); });
    document.body.appendChild(ov); ($('button,input,select,a', ov) || $('.modal', ov)).focus();
    return {el: ov, close};
  }
  const confirmDlg = (title, msg, okLabel = 'Confirm') => new Promise(res => { let ok = false;
    const m = modal(`<h2>${esc(title)}</h2><p class="muted">${esc(msg)}</p><div class="actions" style="margin-top:20px"><button class="btn" data-close>Cancel</button><button class="btn primary" id="cfOk">${esc(okLabel)}</button></div>`, title, () => res(ok));
    m.el.querySelector('#cfOk').onclick = () => { ok = true; m.close(); }; m.el.querySelector('#cfOk').focus(); });
  const copy = async text => { try { await navigator.clipboard.writeText(text); toast('Copied ' + text); } catch { toast('Couldn’t copy. Select the text and copy it manually.', 'bad'); } };
  function extras() {
    const b = document.body, mail = CONTACT.email;
    b.insertAdjacentHTML('afterbegin', '<a class="skip" href="#main">Skip to content</a><div id="prog" aria-hidden="true"><i></i></div>');
    b.insertAdjacentHTML('beforeend', `<button class="totop" id="totop" aria-label="Back to top" hidden>${icon('up')}</button><a class="fab" href="${mail ? 'mailto:' + esc(mail) + '?subject=UBridge%20inquiry' : 'ai-guide.html#faq'}" aria-label="${mail ? 'Email the SAEP Office' : 'Help and FAQ'}">${icon(mail ? 'mail' : 'help')}<span>${mail ? 'Contact SAEP' : 'Help'}</span></a>`);
    if (!localStorage.getItem('ub.privacy')) {
      b.insertAdjacentHTML('beforeend', '<div class="privacy" role="region" aria-label="Privacy notice"><p>UBridge saves your theme, drafts and recent questions on this device only, and uses no advertising or tracking cookies.</p><button class="btn primary" id="pvOk">Got it</button></div>');
      $('#pvOk').onclick = () => { localStorage.setItem('ub.privacy', '1'); $('.privacy').remove(); };
    }
    const bar = $('#prog i'), top = $('.top'), up = $('#totop');
    const onScroll = () => { const h = document.documentElement, max = h.scrollHeight - h.clientHeight; bar.style.width = (max > 0 ? scrollY / max * 100 : 0) + '%'; top.classList.toggle('scrolled', scrollY > 4); up.hidden = scrollY < 400; };
    addEventListener('scroll', onScroll, {passive: true}); onScroll();
    up.onclick = () => scrollTo({top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
    document.addEventListener('click', e => { const c = e.target.closest('[data-copy]'); if (c) copy(c.dataset.copy); });
    $('#main').tabIndex = -1;
  }
  function theme() { document.documentElement.dataset.theme = load('theme', dflt()); }
  function bindTheme(btn) {
    if (!btn) return; btn.innerHTML = icon('moon');
    btn.onclick = () => { save('theme', load('theme', dflt()) === 'dark' ? 'light' : 'dark'); theme(); };
  }
  function shell() {
    const s = me;
    const page = document.body.dataset.page, staff = isStaff();
    if (staff && page === 'file-complaint') return location.replace('dashboard.html');
    const nav = [['dashboard','Dashboard','home'], ...(staff ? [] : [['file-complaint','File a complaint','plus']]), ['my-complaints', staff ? 'All cases' : 'My complaints','list'], ['ai-guide','AI Guide','book']];
    const main = $('#main'), app = $('#app');
    const roleLbl = {student:'Student', faculty:'Faculty', staff:'SAEP Staff'}[s.role];
    app.className = 'shell';
    app.innerHTML = `<aside class="side" id="side" aria-label="Main navigation"><div class="brand"><span class="logo">UB</span><div>UBridge<small>SAEP Complaints</small></div></div>
      <nav class="nav">${nav.map(([p, l, i]) => `<a href="${p}.html" ${p === page ? 'aria-current="page"' : ''}>${icon(i)}${l}</a>`).join('')}</nav>
      <div class="me"><span class="avatar">${esc(s.name[0])}</span><div><b>${esc(s.name)}</b><small>${roleLbl}</small></div></div></aside>
      <div class="content"><header class="top"><div class="grow"><button class="icon-btn menu-btn" id="menuBtn" aria-label="Open menu" aria-controls="side">${icon('menu')}</button><span>University of Batangas – Lipa</span></div>
      <div style="display:flex;gap:8px"><button class="icon-btn" id="themeBtn" aria-label="Toggle dark mode"></button><button class="icon-btn" id="outBtn" aria-label="Sign out">${icon('out')}</button></div></header><div class="scrim" id="scrim"></div></div>`;
    $('.content').append(main);
    bindTheme($('#themeBtn')); $('#outBtn').onclick = async () => { if (await confirmDlg('Sign out?', 'You will need to sign in again to see your cases.', 'Sign out')) logout(); }; extras();
    const side = $('#side'), tog = o => { side.classList.toggle('open', o); $('#menuBtn').setAttribute('aria-expanded', o); };
    $('#menuBtn').onclick = () => tog(!side.classList.contains('open')); $('#scrim').onclick = () => tog(false);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') tog(false); }); $$('.nav a').forEach(a => a.addEventListener('click', () => tog(false)));
  }
  const ready = (async () => {
    const u = await new Promise(r => { const off = onAuthStateChanged(auth, x => { off(); r(x); }); });
    if (document.body.dataset.page === 'login') {
      if (u && u.emailVerified) { try { me = await profile(u); location.replace('dashboard.html'); } catch {} }
      return document.body.classList.add('ready');
    }
    if (!u || !u.emailVerified) { if (u) await signOut(auth); location.replace('login.html'); return new Promise(() => {}); }
    try { me = await profile(u); } catch { await signOut(auth); location.replace('login.html'); return new Promise(() => {}); }
    shell(); document.body.classList.add('ready');
  })();
  const api = {$, $$, esc, load, save, drop, icon, STATUS, ORDER, chip, fmt, session, isStaff, TYPES, KB, signIn, signUp, google, logout, list, create, setStatus, evidenceUrl, authMsg, toast, modal, bindTheme, ready, DOMAIN, confirm: confirmDlg, copy, fmtTs, skel, get me() { return me; }};
  theme();
  return api;
})();
