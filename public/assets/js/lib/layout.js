// Page shell (sidebar, header, floating buttons) and the notification bell.
import { $, $$, esc, icon } from './dom.js';
import { modal, confirmDlg, toast, copy } from './ui.js';
import { fmtTs } from './dates.js';
import { CONTACT } from '../data.js';
import { watchNotifications, markRead, markAllRead } from '../services/notifications.js';

const dflt = () => (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

export function applyTheme(local) {
  document.documentElement.dataset.theme = local.load('theme', dflt());
}
export function bindTheme(btn, local) {
  if (!btn) return;
  btn.innerHTML = icon('moon');
  btn.onclick = () => {
    local.save('theme', local.load('theme', dflt()) === 'dark' ? 'light' : 'dark');
    applyTheme(local);
  };
}

function extras() {
  const b = document.body;
  const mail = CONTACT.email;
  b.insertAdjacentHTML(
    'afterbegin',
    '<a class="skip" href="#main">Skip to content</a><div id="prog" aria-hidden="true"><i></i></div>',
  );
  b.insertAdjacentHTML(
    'beforeend',
    `<button class="totop" id="totop" aria-label="Back to top" hidden>${icon('up')}</button><a class="fab" href="${mail ? 'mailto:' + esc(mail) + '?subject=UBridge%20inquiry' : 'ai-guide.html#faq'}" aria-label="${mail ? 'Email the SAEP Office' : 'Help and FAQ'}">${icon(mail ? 'mail' : 'help')}<span>${mail ? 'Contact SAEP' : 'Help'}</span></a>`,
  );
  if (!localStorage.getItem('ub.privacy')) {
    b.insertAdjacentHTML(
      'beforeend',
      '<div class="privacy" role="region" aria-label="Privacy notice"><p>UBridge saves your theme, drafts and recent questions on this device only, and uses no advertising or tracking cookies. <a href="privacy.html">Read the privacy notice</a>.</p><button class="btn primary" id="pvOk">Got it</button></div>',
    );
    $('#pvOk').onclick = () => {
      localStorage.setItem('ub.privacy', '1');
      $('.privacy').remove();
    };
  }
  const bar = $('#prog i'),
    top = $('.top'),
    up = $('#totop');
  const onScroll = () => {
    const h = document.documentElement,
      max = h.scrollHeight - h.clientHeight;
    bar.style.width = (max > 0 ? (scrollY / max) * 100 : 0) + '%';
    top.classList.toggle('scrolled', scrollY > 4);
    up.hidden = scrollY < 400;
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  up.onclick = () =>
    scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  document.addEventListener('click', (e) => {
    const c = e.target.closest('[data-copy]');
    if (c) copy(c.dataset.copy);
  });
  $('#main').tabIndex = -1;
}

function bell(me) {
  let items = [];
  const btn = $('#bellBtn'),
    badge = $('#bellBadge');
  const paint = () => {
    const n = items.filter((x) => !x.read).length;
    badge.textContent = n > 9 ? '9+' : n;
    badge.hidden = !n;
    btn.setAttribute('aria-label', n ? `Notifications, ${n} unread` : 'Notifications');
  };
  watchNotifications(
    me.uid,
    (list) => {
      items = list;
      paint();
    },
    () => {},
  );
  btn.onclick = () => {
    const body = () =>
      items.length
        ? `<ul class="notifs">${items
            .slice(0, 30)
            .map(
              (n) =>
                `<li class="${n.read ? '' : 'unread'}"><a href="my-complaints.html?case=${encodeURIComponent(n.caseId)}" data-n="${esc(n.id)}">${esc(n.message)}<small class="muted">${fmtTs(n.createdAt)}</small></a></li>`,
            )
            .join('')}</ul>`
        : '<div class="empty"><b>No notifications</b>You’ll see case updates here.</div>';
    const m = modal(
      `<h2>Notifications</h2>${body()}<div class="actions" style="margin-top:16px"><button class="btn" id="readAll">Mark all read</button><button class="btn primary" data-close>Close</button></div>`,
      'Notifications',
    );
    m.el.querySelector('#readAll').onclick = async () => {
      try {
        await markAllRead(items);
      } catch {
        toast('Couldn’t update notifications.', 'bad');
      }
    };
    m.el.addEventListener('click', (e) => {
      const a = e.target.closest('[data-n]');
      if (a) markRead(a.dataset.n).catch(() => {});
    });
  };
}

export function shell({ me, local, isStaff, logout, missing = [] }) {
  const page = document.body.dataset.page,
    staff = isStaff();
  if (staff && page === 'file-complaint') return location.replace('dashboard.html');
  const nav = [
    ['dashboard', 'Dashboard', 'home'],
    ...(staff ? [] : [['file-complaint', 'File a complaint', 'plus']]),
    ['my-complaints', staff ? 'All cases' : 'My complaints', 'list'],
    ['ai-guide', 'AI Guide', 'book'],
    ['profile', 'My profile', 'user'],
  ];
  const main = $('#main'),
    app = $('#app');
  const roleLbl = { student: 'Student', faculty: 'Faculty', staff: 'SAEP Staff' }[me.role];
  app.className = 'shell';
  app.innerHTML = `<aside class="side" id="side" aria-label="Main navigation"><div class="brand"><span class="logo">UB</span><div>UBridge<small>SAEP Complaints</small></div></div>
      <nav class="nav">${nav.map(([p, l, i]) => `<a href="${p}.html" ${p === page ? 'aria-current="page"' : ''}>${icon(i)}${l}</a>`).join('')}</nav>
      <a class="me" href="profile.html" aria-label="Open my profile"><span class="avatar">${esc(me.name[0])}</span><div><b>${esc(me.name)}</b><small>${roleLbl}${missing.length ? ' · profile incomplete' : ''}</small></div></a>
      <div class="side-legal"><a href="privacy.html" target="_blank" rel="noopener">Privacy Notice</a><a href="terms.html" target="_blank" rel="noopener">Terms of Use</a></div></aside>
      <div class="content"><header class="top"><div class="grow"><button class="icon-btn menu-btn" id="menuBtn" aria-label="Open menu" aria-controls="side">${icon('menu')}</button><span>University of Batangas – Lipa</span></div>
      <div style="display:flex;gap:8px"><button class="icon-btn bell" id="bellBtn" aria-label="Notifications">${icon('bell')}<span class="badge" id="bellBadge" hidden>0</span></button><button class="icon-btn" id="themeBtn" aria-label="Toggle dark mode"></button><button class="icon-btn" id="outBtn" aria-label="Sign out">${icon('out')}</button></div></header><div class="scrim" id="scrim"></div></div>`;
  $('.content').append(main);
  // Reminder on every page until the profile is complete (the profile page has its own, richer notice).
  if (missing.length && page !== 'profile') {
    main.insertAdjacentHTML(
      'afterbegin',
      `<div class="profile-nudge" role="status"><div><b>Complete your profile</b><span>Still needed: ${esc(missing.join(', '))}. It fills in your complaint form for you${staff ? '' : ' and is required before you can file'}.</span></div><a class="btn primary" href="profile.html">Update profile</a></div>`,
    );
  }
  bindTheme($('#themeBtn'), local);
  $('#outBtn').onclick = async () => {
    if (await confirmDlg('Sign out?', 'You will need to sign in again to see your cases.', 'Sign out')) logout();
  };
  extras();
  bell(me);
  const side = $('#side');
  const tog = (o) => {
    side.classList.toggle('open', o);
    $('#menuBtn').setAttribute('aria-expanded', o);
  };
  $('#menuBtn').onclick = () => tog(!side.classList.contains('open'));
  $('#scrim').onclick = () => tog(false);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') tog(false);
  });
  $$('.nav a').forEach((a) => a.addEventListener('click', () => tog(false)));
}
