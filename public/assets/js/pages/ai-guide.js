import {UB} from '../app.js';
(async () => {
  await UB.ready;
  const {$, $$, esc} = UB;
  // Swap this for a fetch() to your RAG endpoint (restricted to Section VII + campus guidelines).
  const askGuide = q => new Promise(r => setTimeout(() => {
    const w = q.toLowerCase(), best = UB.KB.map(e => [e.k.filter(k => w.includes(k)).length, e]).sort((a, b) => b[0] - a[0])[0];
    r(best[0] ? best[1] : {text: 'I couldn’t find that in Section VII or the campus guidelines. Try rephrasing, or ask the SAEP office directly.', src: ''});
  }, 800));
  const tabs = $$('#tabs button'), panels = ['ask', 'recent', 'saved', 'faq'];
  const show = p => { tabs.forEach(b => b.setAttribute('aria-selected', b.dataset.p === p)); panels.forEach(x => $('#' + x).hidden = x !== p); if (p !== 'ask' && p !== 'faq') list(p); };
  tabs.forEach(b => b.onclick = () => show(b.dataset.p));
  function list(p) {
    const items = UB.load(p, []), el = $('#' + p);
    el.innerHTML = items.length ? `<div class="card panel">${items.map((x, i) => `<div class="row"><div><b>${esc(x.q || x)}</b>${x.text ? `<small class="muted">${esc(x.text)}</small>` : ''}</div><button class="link" data-i="${i}">${p === 'recent' ? 'Ask again' : 'Remove'}</button></div>`).join('')}</div>`
      : `<div class="card empty"><b>${p === 'recent' ? 'No questions yet' : 'Nothing bookmarked'}</b>${p === 'recent' ? 'Your questions will show up here.' : 'Use “Bookmark” on an answer to keep it.'}</div>`;
    el.onclick = e => { const b = e.target.closest('[data-i]'); if (!b) return; const i = +b.dataset.i;
      if (p === 'recent') { show('ask'); ask(items[i]); } else { items.splice(i, 1); UB.save('saved', items); list('saved'); } };
  }
  let busy = false;
  async function ask(q) {
    q = q.trim(); if (!q || busy) return; busy = true;
    $('#hero').hidden = $('#sugg').hidden = true; $('#thread').hidden = $('#f1').hidden = false;
    const th = $('#thread'); th.insertAdjacentHTML('beforeend', `<div class="msg me">${esc(q)}</div><div class="msg typing" id="ty" aria-label="Typing"><i></i><i></i><i></i></div>`);
    UB.save('recent', [q, ...UB.load('recent', []).filter(x => x !== q)].slice(0, 20));
    const a = await askGuide(q); $('#ty').remove();
    const d = document.createElement('div'); d.className = 'msg';
    d.innerHTML = `${esc(a.text)}${a.src ? `<div class="src"><span class="chip resolved">Source</span>${esc(a.src)}${a.sample ? ' · sample text, replace with handbook wording' : ''}<button class="link" type="button">Bookmark</button></div>` : ''}`;
    const bm = d.querySelector('button'); if (bm) bm.onclick = () => { UB.save('saved', [{q, text: a.text}, ...UB.load('saved', [])]); bm.textContent = 'Bookmarked'; bm.disabled = true; };
    th.appendChild(d); d.scrollIntoView({behavior: 'smooth', block: 'end'}); busy = false; $('#q1').focus();
  }
  $('#f0').onsubmit = e => { e.preventDefault(); ask($('#q0').value); };
  $('#f1').onsubmit = e => { e.preventDefault(); const i = $('#q1'); ask(i.value); i.value = ''; };
  $('#sugg').onclick = e => { const b = e.target.closest('[data-q]'); if (b) ask(b.dataset.q); };
  $('#fq').oninput = e => { const q = e.target.value.trim().toLowerCase(); $$('#faq details').forEach(d => d.hidden = !!q && !d.textContent.toLowerCase().includes(q)); };
  if (location.hash === '#faq') show('faq');
})();
