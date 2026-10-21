import { UB } from '../app.js';
import { answer, SCOPE, warmUp } from '../services/guide.js';
(async () => {
  await UB.ready;
  const { $, $$, esc } = UB;
  warmUp();
  const tabs = $$('#tabs button'),
    panels = ['ask', 'recent', 'saved', 'faq'];
  const show = (p) => {
    tabs.forEach((b) => b.setAttribute('aria-selected', b.dataset.p === p));
    panels.forEach((x) => ($('#' + x).hidden = x !== p));
    if (p !== 'ask' && p !== 'faq') list(p);
  };
  tabs.forEach((b) => (b.onclick = () => show(b.dataset.p)));

  function list(p) {
    const items = UB.load(p, []),
      el = $('#' + p);
    el.innerHTML = items.length
      ? `<div class="card panel">${items.map((x, i) => `<div class="row"><div><b>${esc(x.q || x)}</b>${x.text ? `<small class="muted">${esc(x.text)}${x.src ? ' · ' + esc(x.src) : ''}</small>` : ''}</div><button class="link" data-i="${i}">${p === 'recent' ? 'Ask again' : 'Remove'}</button></div>`).join('')}</div>`
      : `<div class="card empty"><b>${p === 'recent' ? 'No questions yet' : 'Nothing bookmarked'}</b>${p === 'recent' ? 'Your questions will show up here.' : 'Use “Bookmark” on an answer to keep it.'}</div>`;
    el.onclick = (e) => {
      const b = e.target.closest('[data-i]');
      if (!b) return;
      const i = +b.dataset.i;
      if (p === 'recent') {
        show('ask');
        ask(items[i]);
      } else {
        items.splice(i, 1);
        UB.save('saved', items);
        list('saved');
      }
    };
  }

  const sourcesHtml = (a) => {
    if (!a.sources.length) return '';
    const label = a.sources.map((s) => `${esc(s.section)}${s.title ? ' · ' + esc(s.title) : ''}`).join('; ');
    const text = a.sources
      .map(
        (s) =>
          `<details class="srctext"><summary>${esc(s.section)}${s.title ? ' · ' + esc(s.title) : ''}: handbook text</summary><p>${esc(s.text)}</p></details>`,
      )
      .join('');
    return `<div class="src"><span class="chip resolved">Source</span>${label}<button class="link" type="button">Bookmark</button></div>${text}`;
  };

  let busy = false,
    last = 0;
  async function ask(q) {
    q = q.trim();
    if (!q || busy) return;
    if (Date.now() - last < 3000) return UB.toast('Wait a moment before asking again.', 'bad'); // protects the Gemini quota
    busy = true;
    last = Date.now();
    $('#hero').hidden = $('#sugg').hidden = true;
    $('#thread').hidden = $('#f1').hidden = false;
    const th = $('#thread');
    th.insertAdjacentHTML(
      'beforeend',
      `<div class="msg me">${esc(q)}</div><div class="msg typing" id="ty" aria-label="Typing"><i></i><i></i><i></i></div>`,
    );
    UB.save('recent', [q, ...UB.load('recent', []).filter((x) => x !== q)].slice(0, 20));
    // The try/catch matters: without it one failed request left `busy` stuck on true and the guide stopped answering.
    let a;
    try {
      a = await answer(q);
    } catch {
      a = { text: 'Something went wrong while looking that up. Please try again.', sources: [], mode: 'none' };
    } finally {
      $('#ty')?.remove();
      busy = false;
    }
    const d = document.createElement('div');
    d.className = 'msg';
    d.innerHTML = `<p class="ans">${esc(a.text).replace(/\n/g, '<br>')}</p>${sourcesHtml(a)}<p class="hint">Not an official ruling. The SAEP Office makes the final decision.${a.retrieval === 'hybrid' ? ' Matched by meaning and keywords.' : ''}</p>`;
    const bm = d.querySelector('.src button');
    if (bm)
      bm.onclick = () => {
        UB.save('saved', [
          { q, text: a.text, src: a.sources.map((s) => s.section).join('; ') },
          ...UB.load('saved', []),
        ]);
        bm.textContent = 'Bookmarked';
        bm.disabled = true;
      };
    th.appendChild(d);
    d.scrollIntoView({ behavior: 'smooth', block: 'end' });
    $('#q1').focus();
  }
  $('#scope').textContent = `Scope: ${SCOPE} only`;
  $('#f0').onsubmit = (e) => {
    e.preventDefault();
    ask($('#q0').value);
  };
  $('#f1').onsubmit = (e) => {
    e.preventDefault();
    const i = $('#q1');
    ask(i.value);
    i.value = '';
  };
  $('#sugg').onclick = (e) => {
    const b = e.target.closest('[data-q]');
    if (b) ask(b.dataset.q);
  };
  $('#fq').oninput = (e) => {
    const q = e.target.value.trim().toLowerCase();
    $$('#faq details').forEach((d) => (d.hidden = !!q && !d.textContent.toLowerCase().includes(q)));
  };
  if (location.hash === '#faq') show('faq');
})();
