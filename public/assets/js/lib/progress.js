import { STATUS, ORDER } from '../data.js';
import { esc } from './dom.js';
/** Status progress bar. times: {status: 'when it was reached'} (optional, comes from the case history). */
export function progress(status, times = {}) {
  // Not approved ends the case at intake, so it gets its own two-step bar instead of a bar that looks unfinished.
  if (status === 'rejected')
    return `<div class="steps two stopped" role="progressbar" aria-valuemin="1" aria-valuemax="2" aria-valuenow="2" aria-valuetext="Step 2 of 2: ${STATUS.rejected}, the case was closed at intake" style="--w:100%">
    <div class="pg-track"><i class="pg-fill"></i></div>
    <ol><li class="done"><span class="dot">✓</span><b>${STATUS.submitted}</b>${times.submitted ? `<small>${esc(times.submitted)}</small>` : ''}</li><li class="stop"><span class="dot">✕</span><b>${STATUS.rejected}</b>${times.rejected ? `<small>${esc(times.rejected)}</small>` : ''}</li></ol></div>`;
  const i = Math.max(0, ORDER.indexOf(status)),
    last = ORDER.length - 1,
    fin = status === 'resolved';
  return `<div class="steps" role="progressbar" aria-valuemin="1" aria-valuemax="${ORDER.length}" aria-valuenow="${i + 1}" aria-valuetext="Step ${i + 1} of ${ORDER.length}: ${STATUS[status]}" style="--w:${(i / last) * 100}%">
    <div class="pg-track"><i class="pg-fill"></i></div>
    <ol>${ORDER.map((s, k) => `<li class="${k < i ? 'done' : k === i ? (fin ? 'fin' : 'now') : ''}"><span class="dot">${k < i || (fin && k === i) ? '✓' : k + 1}</span><b>${STATUS[s]}</b>${times[s] ? `<small>${esc(times[s])}</small>` : ''}</li>`).join('')}</ol></div>`;
}
