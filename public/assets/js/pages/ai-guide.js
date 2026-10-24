
import { UB } from '../app.js';
import { answer, SCOPE, warmUp } from '../services/guide.js';

(async () => {
  await UB.ready;

  const { $, $$, esc } = UB;
  warmUp();

  const tabs = $$('#tabs button');
  const panels = ['ask', 'recent', 'saved', 'faq'];

  const show = (panel) => {
    tabs.forEach((button) => {
      const active = button.dataset.p === panel;
      button.setAttribute('aria-selected', String(active));
      button.setAttribute('tabindex', active ? '0' : '-1');
    });

    panels.forEach((name) => {
      const element = $('#' + name);
      if (element) element.hidden = name !== panel;
    });

    if (panel !== 'ask' && panel !== 'faq') {
      list(panel);
    }
  };

  tabs.forEach((button) => {
    button.onclick = () => show(button.dataset.p);

    button.onkeydown = (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
        return;
      }

      event.preventDefault();

      let index = Array.from(tabs).indexOf(button);

      if (event.key === 'ArrowRight') {
        index = (index + 1) % tabs.length;
      }

      if (event.key === 'ArrowLeft') {
        index = (index - 1 + tabs.length) % tabs.length;
      }

      if (event.key === 'Home') index = 0;
      if (event.key === 'End') index = tabs.length - 1;

      tabs[index].focus();
      show(tabs[index].dataset.p);
    };
  });

  function list(panel) {
    const items = UB.load(panel, []);
    const element = $('#' + panel);

    element.innerHTML = items.length
      ? `<div class="card panel">${items.map((item, index) => `
          <div class="row">
            <div>
              <b>${esc(item.q || item)}</b>
              ${item.text ? `<small class="muted">${esc(item.text)}${item.src ? ' · ' + esc(item.src) : ''}</small>` : ''}
            </div>
            <button class="link" type="button" data-i="${index}">
              ${panel === 'recent' ? 'Ask again' : 'Remove'}
            </button>
          </div>`).join('')}</div>`
      : `<div class="card empty">
          <b>${panel === 'recent' ? 'No questions yet' : 'Nothing bookmarked'}</b>
          ${panel === 'recent'
            ? 'Your questions will show up here.'
            : 'Use “Bookmark” on an answer to keep it.'}
        </div>`;

    element.onclick = (event) => {
      const button = event.target.closest('[data-i]');
      if (!button) return;

      const index = Number(button.dataset.i);

      if (panel === 'recent') {
        show('ask');
        ask(items[index]);
      } else {
        items.splice(index, 1);
        UB.save('saved', items);
        list('saved');
      }
    };
  }

  const sourcesHtml = (result) => {
    if (!result.sources?.length) return '';

    const label = result.sources
      .map((source) =>
        `${esc(source.section)}${source.title ? ' · ' + esc(source.title) : ''}`
      )
      .join('; ');

    const details = result.sources
      .map((source) => `
        <details class="srctext">
          <summary>
            ${esc(source.section)}${source.title ? ' · ' + esc(source.title) : ''}: handbook text
          </summary>
          <p>${esc(source.text)}</p>
        </details>`)
      .join('');

    return `<div class="src">
      <span class="chip resolved">Source</span>
      <span>${label}</span>
      <button class="link" type="button">Bookmark</button>
    </div>${details}`;
  };

  let busy = false;
  let lastAskedAt = 0;

  async function ask(question) {
    const q = String(question || '').trim();

    if (!q || busy) return;

    if (Date.now() - lastAskedAt < 3000) {
      return UB.toast('Wait a moment before asking again.', 'bad');
    }

    busy = true;
    lastAskedAt = Date.now();

    $('#hero').hidden = true;
    $('#sugg-wrap').hidden = true;
    $('#thread').hidden = false;
    $('#thread').setAttribute('aria-busy', 'true');

    const thread = $('#thread');

    thread.insertAdjacentHTML(
      'beforeend',
      `<div class="msg me">${esc(q)}</div>
       <div class="msg typing" id="ty" aria-label="Looking up the policy">
         <i></i><i></i><i></i>
       </div>`
    );

    UB.save('recent', [
      q,
      ...UB.load('recent', []).filter((item) => (item.q || item) !== q)
    ].slice(0, 20));

    let result;

    try {
      result = await answer(q);
    } catch {
      result = {
        text: 'Something went wrong while looking that up. Please try again.',
        sources: [],
        mode: 'none'
      };
    } finally {
      $('#ty')?.remove();
      busy = false;
      thread.setAttribute('aria-busy', 'false');
    }

    const message = document.createElement('div');
    message.className = 'msg';

    message.innerHTML = `
      <p class="ans">${esc(
        result.text || 'No answer was returned. Please try again.'
      ).replace(/\n/g, '<br>')}</p>
      ${sourcesHtml(result)}
      <p class="hint">
        This is guidance, not an official ruling. The SAEP Office makes the final decision.${result.retrieval === 'hybrid' ? ' Matched by meaning and keywords.' : ''}
      </p>
    `;

    const bookmarkButton = message.querySelector('.src button');

    if (bookmarkButton) {
      bookmarkButton.onclick = () => {
        const existing = UB.load('saved', []);

        UB.save('saved', [
          {
            q,
            text: result.text,
            src: (result.sources || [])
              .map((source) => source.section)
              .join('; ')
          },
          ...existing.filter((item) => item.q !== q)
        ]);

        bookmarkButton.textContent = 'Bookmarked';
        bookmarkButton.disabled = true;
      };
    }

    thread.appendChild(message);

    message.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest'
    });

    $('#q1').focus();
  }

  $('#scope').textContent = `Direct reference: ${SCOPE} only`;

  $('#f1').onsubmit = (event) => {
    event.preventDefault();

    const input = $('#q1');
    const question = input.value.trim();

    if (!question || busy) return;

    ask(question);
    input.value = '';
  };

  $('#sugg').onclick = (event) => {
    const button = event.target.closest('[data-q]');
    if (button) ask(button.dataset.q);
  };

  $('#fq').oninput = (event) => {
    const query = event.target.value.trim().toLowerCase();

    $$('#faq details').forEach((detail) => {
      detail.hidden =
        Boolean(query) &&
        !detail.textContent.toLowerCase().includes(query);
    });
  };

  if (location.hash === '#faq') {
    show('faq');
  }
})();
