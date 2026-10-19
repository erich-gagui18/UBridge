import {UB} from '../app.js';
const {$, $$} = UB; let role = 'student', up = false;
UB.bindTheme($('#themeBtn'));
$$('.roles button').forEach(b => b.onclick = () => { role = b.dataset.role; $$('.roles button').forEach(x => x.setAttribute('aria-pressed', x === b)); });
$('#showPw').onclick = e => { const p = $('#pw'), show = p.type === 'password'; p.type = show ? 'text' : 'password'; e.target.textContent = show ? 'Hide' : 'Show'; };
$('#signup').onclick = e => {
  e.preventDefault(); up = !up; $('#nameF').hidden = !up; $('#staffTab').hidden = up;
  if (up && role === 'staff') $('[data-role=student]').click();
  $('#ttl').textContent = up ? 'Create your account' : 'Welcome back'; $('#go').textContent = up ? 'Create account' : 'Sign in';
  $('#swTxt').textContent = up ? 'Already have an account?' : 'No account yet?'; e.target.textContent = up ? 'Sign in' : 'Sign up'; $('#pw').autocomplete = up ? 'new-password' : 'current-password'; $('#eForm').textContent = '';
  document.querySelector('.auth-wrap')?.classList.toggle('is-signup', up);
};
const flag = (id, msg, inp) => { $('#' + id).textContent = msg; inp.setAttribute('aria-invalid', !!msg); return !msg; };
const busy = on => { $('#go').disabled = $('#google').disabled = on; $('#go').textContent = on ? 'Please wait…' : up ? 'Create account' : 'Sign in'; };
const run = async fn => { const ef = $('#eForm'); ef.textContent = ''; ef.style.color = ''; $('#resend').hidden = true; busy(true); try { const r = await fn(); if (r?.verify) { ef.style.color = 'var(--resolved)'; ef.textContent = 'Account created. We sent a verification link to your UB email. Verify it, then sign in.'; $('#resend').hidden = false; return busy(false); } location.href = 'dashboard.html'; } catch (x) { $('#eForm').textContent = UB.authMsg(x); $('#resend').hidden = x.code !== 'ub/unverified'; busy(false); } };
const roleName = { student: 'Student', faculty: 'Faculty' };
$('#google').onclick = () => run(() => UB.google(role, (r, mail) => UB.confirm('Create a new account?', `${mail} has no UBridge account yet. Create a ${roleName[r] || r} account? Your role can’t be changed afterwards.`, 'Create account')));
$('#resend').onclick = async () => {
  const ef = $('#eForm'), em = $('#email').value.trim().toLowerCase(), pw = $('#pw').value;
  if (!UB.DOMAIN.test(em) || !pw) { ef.style.color = ''; return (ef.textContent = 'Enter your UB email and password above, then resend.'); }
  $('#resend').disabled = true;
  try { await UB.resendVerification(em, pw); ef.style.color = 'var(--resolved)'; ef.textContent = 'Verification email sent. Check your UB inbox (and spam), then sign in.'; }
  catch (x) { ef.style.color = ''; ef.textContent = UB.authMsg(x); }
  $('#resend').disabled = false;
};
$('#f').onsubmit = e => {
  e.preventDefault(); const em = $('#email'), pw = $('#pw'), nm = $('#name'), v = em.value.trim().toLowerCase();
  const n = !up || flag('eName', nm.value.trim().length < 2 ? 'Enter your full name' : '', nm);
  const a = flag('eEmail', !UB.DOMAIN.test(v) ? 'Use your UB email, e.g. name@ub.edu.ph' : '', em);
  const b = flag('ePw', (up ? pw.value.length < 8 : !pw.value) ? (up ? 'Password must be at least 8 characters' : 'Enter your password') : '', pw);
  if (!n || !a || !b) return (!n ? nm : !a ? em : pw).focus();
  run(() => up ? UB.signUp(nm.value.trim(), v, pw.value, role) : UB.signIn(v, pw.value, role));
};
