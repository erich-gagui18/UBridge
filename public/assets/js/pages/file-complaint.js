import {UB} from '../app.js';
(async () => {
  await UB.ready;
  const {$, esc} = UB, f = $('#f'), F = ['student','sid','program','section','type','date','location','desc'];
  let files = [];
  UB.TYPES.forEach(t => $('#type').insertAdjacentHTML('beforeend', `<option>${esc(t)}</option>`));
  $('#date').max = new Date().toISOString().slice(0, 10);
  const err = (el, m) => { const p = el.closest('.field').querySelector('.err'); p.textContent = m; el.setAttribute('aria-invalid', !!m); return m; };
  const rules = {student: v => !v && 'Enter the student’s full name', sid: v => !/^\d{7}$/.test(v) && 'Student ID is 7 digits, e.g. 2407880', program: v => !v && 'Enter the program, e.g. BSIT', section: v => !v && 'Enter the year and section, e.g. 3-A',
    type: v => !v && 'Select the type of offense', date: v => !v ? 'Choose the date it happened' : (v > $('#date').max && 'The date can’t be in the future'), location: v => !v && 'Enter where it happened', desc: v => v.length < 30 && 'Add at least 30 characters so SAEP can review it'};
  const data = () => ({...Object.fromEntries(F.map(k => [k, $('#' + k).value.trim()])), offense: f.offense.value || ''});
  const store = () => UB.save('draft', data());
  const d = UB.load('draft', null);
  if (d) { F.forEach(k => $('#' + k).value = d[k] || ''); if (d.offense) f.offense.value = d.offense; UB.toast('Draft restored'); }
  const count = () => { const n = $('#desc').value.trim().length; $('#cnt').textContent = n < 30 ? `${n} / 30 minimum` : `${n} characters`; };
  count(); let t; f.addEventListener('input', () => { count(); clearTimeout(t); t = setTimeout(store, 600); });
  F.forEach(k => $('#' + k).addEventListener('blur', e => { if (e.target.value) err(e.target, rules[k](e.target.value.trim()) || ''); }));
  const renderFiles = () => $('#files').innerHTML = files.map((x, i) => `<li><span>${esc(x.name)} <small class="muted">${(x.size / 1048576).toFixed(1)} MB</small></span><button type="button" class="link" data-i="${i}" aria-label="Remove ${esc(x.name)}">Remove</button></li>`).join('');
  // Validate by extension, size AND file signature (magic bytes), then re-type the file from what it really is.
  const SIG = {'image/png': [0x89,0x50,0x4E,0x47], 'image/jpeg': [0xFF,0xD8,0xFF], 'application/pdf': [0x25,0x50,0x44,0x46]};
  const sniff = async x => { const b = new Uint8Array(await x.slice(0, 4).arrayBuffer()); return Object.keys(SIG).find(m => SIG[m].every((v, i) => b[i] === v)); };
  const add = async list => { for (const x of [...list]) {
    if (!/\.(png|jpe?g|pdf)$/i.test(x.name)) { UB.toast(`${x.name}: only PNG, JPG or PDF`, 'bad'); continue; }
    if (x.size === 0 || x.size > 10485760) { UB.toast(`${x.name} must be under 10 MB`, 'bad'); continue; }
    if (x.name.length > 120) { UB.toast(`${x.name}: file name is too long`, 'bad'); continue; }
    if (files.length >= 5) { UB.toast('You can attach up to 5 files', 'bad'); continue; }
    const t = await sniff(x); if (!t) { UB.toast(`${x.name} isn’t a real PNG, JPG or PDF`, 'bad'); continue; }
    files.push(new File([x], x.name, {type: t})); } renderFiles(); };
  $('#file').onchange = e => { add(e.target.files); e.target.value = ''; };
  $('#files').onclick = e => { const b = e.target.closest('[data-i]'); if (b) { files.splice(b.dataset.i, 1); renderFiles(); } };
  const drop = $('#drop'); ['dragover', 'dragenter'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', e => add(e.dataTransfer.files));
  $('#draft').onclick = () => { store(); UB.toast('Draft saved on this device'); };
  f.onsubmit = async e => {
    e.preventDefault(); let first = null;
    F.forEach(k => { const el = $('#' + k); if (err(el, rules[k](el.value.trim()) || '') && !first) first = el; });
    $('#eOff').textContent = f.offense.value ? '' : 'Choose a category'; if (!f.offense.value && !first) first = $('#o1');
    if (first) { UB.toast('Please fix the highlighted fields', 'bad'); return first.focus(); }
    if (!await UB.confirm('Submit this complaint?', 'It goes straight to the SAEP Office and can’t be edited from your account afterwards.', 'Submit')) return;
    const btn = f.querySelector('.btn.primary'); btn.disabled = true; btn.textContent = 'Submitting…';
    let c; try { c = await UB.create(data(), files); } catch { btn.disabled = false; btn.textContent = 'Submit complaint'; return UB.toast('Couldn’t submit. Check your connection and try again.', 'bad'); }
    UB.drop('draft'); if (c.uploadFailed) UB.toast('Submitted, but some evidence didn’t upload. Tell SAEP or re-send it.', 'bad');
    UB.modal(`<div class="done-msg"><div class="ok">${UB.icon('check')}</div><h2>Complaint submitted</h2><p class="muted">SAEP will review it. Your case number is</p><p><b style="font-size:20px">${esc(c.id)}</b> <button class="link" type="button" data-copy="${esc(c.id)}">Copy</button></p>
      <div class="actions"><a class="btn" href="dashboard.html">Back home</a><a class="btn primary" href="my-complaints.html?case=${encodeURIComponent(c.id)}">Track this case</a></div></div>`, 'Complaint submitted');
  };
})();
