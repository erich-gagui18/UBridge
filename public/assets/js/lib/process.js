// CDB Manual § 5.1 handling of a case: routing, notice to the respondent, conferences, decision and appeal.
// Every date is a Philippine calendar date (YYYY-MM-DD). The Firestore rules check the same limits.
import { esc } from './dom.js';
import { fmt, todayPH, addDays } from './dates.js';
export { addDays };

export const ANSWER_DAYS = 3; // § 5.1.2: the respondent gets not less than three (3) days to answer
export const DECISION_DAYS = 10; // § 5.1.6: the CDB decides within ten (10) days of the last conference
export const EFFECT_DAYS = 5; // § 5.1.6: effective and executory five (5) days after receipt unless appealed

// § 5.1.5 interventions that can be imposed.
export const INTERVENTIONS = [
  ['reprimand', 'Disciplinary reprimand'], ['censure', 'University censure'], ['probation', 'Disciplinary probation'],
  ['community', 'Community service'], ['suspension', 'Suspension'], ['exclusion', 'Exclusion'], ['expulsion', 'Expulsion'],
];
const IV = Object.fromEntries(INTERVENTIONS);
export const ROUTES = { department: 'Respondent’s department', cdb: 'SAEP / College Discipline Board' };
export const APPEALS = { filed: 'Appeal filed', upheld: 'Decision upheld', modified: 'Decision modified', reversed: 'Decision reversed' };
const ANSWERS = { '': 'Awaiting the respondent', received: 'Explanation received', 'general-denial': 'General denial entered' };
const MODES = { '': 'Not set', 'face-to-face': 'Face-to-face', online: 'Online' };

/** § 4.1 and § 5.1.1: first degree goes to the respondent's department, everything else to SAEP/CDB. */
export const routeFor = (offense) => (offense === 'First Degree' ? 'department' : 'cdb');
export const routeOf = (c) => c.route || routeFor(c.offense);

/** How many First Degree complaints this respondent has had up to and including this one (staff see all cases). The third goes to the CDB. */
export const commissionOf = (c, all) =>
  c.offense !== 'First Degree' ? 0
    : all.filter((x) => x.offense === 'First Degree' && x.sid === c.sid && (x.filed < c.filed || (x.filed === c.filed && x.id <= c.id))).length;

const row = (k, v) => `<dt>${k}</dt><dd>${v}</dd>`;

/** Read-only summary rows shown to the filer and to staff. */
export function processRows(c, { staff = false, commission = 0 } = {}) {
  const today = todayPH(), r = routeOf(c), out = [];
  out.push(row('Handled by', esc(ROUTES[r]) + (staff && commission >= 3 && r === 'department' ? ' <small class="muted">· third commission: belongs with the CDB (§ 4.1)</small>' : staff && commission > 1 ? ` <small class="muted">· commission #${commission} for this respondent</small>` : '')));
  if (c.noticeDate) {
    const late = c.answerDue && c.answerDue < today && !c.answer;
    out.push(row('Notice to respondent', `${fmt(c.noticeDate)}${c.answerDue ? ` <small class="muted">· answer due ${fmt(c.answerDue)}</small>` : ''}`));
    out.push(row('Respondent’s explanation', esc(late ? 'No answer by the deadline: general denial applies (§ 5.1.2)' : ANSWERS[c.answer || ''])));
  }
  if (c.parentsNotified) out.push(row('Parents / guardian', `Notified ${fmt(c.parentsNotified)}`));
  if (c.hearingDate) {
    const due = addDays(c.hearingDate, DECISION_DAYS);
    out.push(row('Disciplinary conference', `${fmt(c.hearingDate)}${c.conferenceMode ? ` · ${esc(MODES[c.conferenceMode])}` : ''}${c.status !== 'resolved' && c.hearingDate <= today ? ` <small class="muted">· decision due by ${fmt(due)}</small>` : ''}`));
  }
  if (c.decisionDate) {
    const eff = addDays(c.decisionDate, EFFECT_DAYS);
    out.push(row('Decision date', `${fmt(c.decisionDate)}${!c.appeal ? ` <small class="muted">· effective ${fmt(eff)} unless appealed to the University President</small>` : ''}`));
  }
  if ((c.interventions || []).length) out.push(row('Interventions', esc(c.interventions.map((k) => IV[k] || k).join('; '))));
  if (c.appeal) out.push(row('Appeal', `${esc(APPEALS[c.appeal])}${c.appealDate ? ` <small class="muted">· ${fmt(c.appealDate)}</small>` : ''}`));
  return out.join('');
}

const opts = (o, sel) => Object.entries(o).map(([k, v]) => `<option value="${esc(k)}" ${k === sel ? 'selected' : ''}>${esc(v)}</option>`).join('');

/** Staff form block (goes inside the "Update this case" box). */
export function processForm(c, { commission = 0 } = {}) {
  const r = routeOf(c), iv = c.interventions || [];
  return `<details class="proc" open><summary>Case handling (CDB § 5.1)</summary>
    <div class="field"><label for="pRoute">Handled by</label><select id="pRoute" ${r === 'cdb' ? 'disabled' : ''}>${opts(ROUTES, r)}</select><small class="muted">${r === 'cdb' ? 'Already with SAEP / the College Discipline Board.' : commission >= 3 ? 'This is the respondent’s third First Degree commission, so it should go to the CDB.' : 'First Degree offenses are handled by the respondent’s department. Escalate for a repeat or a serious case.'}</small></div>
    <div class="cols tight"><div class="field"><label for="pNotice">Notice sent</label><input id="pNotice" type="date" value="${esc(c.noticeDate || '')}"></div>
    <div class="field"><label for="pDue">Answer due</label><input id="pDue" type="date" value="${esc(c.answerDue || '')}" ${c.noticeDate ? `min="${esc(addDays(c.noticeDate, ANSWER_DAYS))}"` : ''}></div></div>
    <small class="muted">The respondent gets at least ${ANSWER_DAYS} days to answer. The due date fills in by itself when you set the notice date.</small>
    <div class="field"><label for="pAnswer">Respondent’s explanation</label><select id="pAnswer">${opts(ANSWERS, c.answer || '')}</select></div>
    <div class="field"><label for="pParents">Parents / guardian notified</label><input id="pParents" type="date" value="${esc(c.parentsNotified || '')}"><small class="muted">Required when the respondent is under 18 (§ 5.1.3). Older students only with their consent.</small></div>
    <div class="cols tight"><div class="field"><label for="pMode">Conference</label><select id="pMode">${opts(MODES, c.conferenceMode || '')}</select></div>
    <div class="field"><label for="pHeld">Conferences held</label><input id="pHeld" type="number" min="0" max="20" value="${Number(c.conferencesHeld) || 0}"></div></div>
    <small class="muted">The conference date is the hearing date above. Missing two consecutive conferences waives the respondent’s rights (§ 5.1.4).</small>
    <div id="pDec" ${c.status === 'resolved' ? '' : 'hidden'}>
      <div class="field"><label for="pDecDate" class="req">Decision date</label><input id="pDecDate" type="date" value="${esc(c.decisionDate || todayPH())}"></div>
      <fieldset class="ivs"><legend>Interventions imposed (§ 5.1.5)</legend>${INTERVENTIONS.map(([k, l]) => `<label><input type="checkbox" name="pIv" value="${k}" ${iv.includes(k) ? 'checked' : ''}> ${esc(l)}</label>`).join('')}</fieldset>
      <div class="cols tight"><div class="field"><label for="pAppeal">Appeal</label><select id="pAppeal">${opts({ '': 'None', ...APPEALS }, c.appeal || '')}</select></div>
      <div class="field"><label for="pAppealDate">Appeal date</label><input id="pAppealDate" type="date" value="${esc(c.appealDate || '')}"></div></div>
      <small class="muted">An appeal goes to the University President, in writing, within ${EFFECT_DAYS} days of receiving the decision (§ 5.1.6).</small>
    </div></details>`;
}

/** Read the form back. Returns {values} or {error}. */
export function readProcess(el, c, status) {
  const v = (s) => el.querySelector(s)?.value ?? '';
  const noticeDate = v('#pNotice'), answerDue = v('#pDue');
  const resolved = status === 'resolved';
  const values = {
    route: v('#pRoute') || routeOf(c), noticeDate, answerDue, answer: v('#pAnswer'), parentsNotified: v('#pParents'),
    conferenceMode: v('#pMode'), conferencesHeld: Math.max(0, Math.min(20, Number(v('#pHeld')) || 0)),
    decisionDate: resolved ? v('#pDecDate') : c.decisionDate || '',
    interventions: resolved ? [...el.querySelectorAll('[name=pIv]:checked')].map((x) => x.value) : c.interventions || [],
    appeal: resolved ? v('#pAppeal') : c.appeal || '', appealDate: resolved ? v('#pAppealDate') : c.appealDate || '',
  };
  if (answerDue && !noticeDate) return { error: 'Set the notice date before the answer due date.' };
  if (noticeDate && answerDue && answerDue < addDays(noticeDate, ANSWER_DAYS)) return { error: `The respondent must have at least ${ANSWER_DAYS} days to answer (due ${fmt(addDays(noticeDate, ANSWER_DAYS))} or later).` };
  if (resolved && !values.decisionDate) return { error: 'Enter the decision date.' };
  if (values.appeal && !values.appealDate) return { error: 'Enter the date the appeal was filed.' };
  if (values.appeal && !resolved) return { error: 'An appeal only applies after a decision (status Resolved).' };
  return { values };
}

/** Short plain-language list of what changed in handling, used for the history remark and the notification. */
export function describeChanges(c, n) {
  const out = [];
  if (n.route !== routeOf(c)) out.push('Escalated to SAEP / the College Discipline Board');
  if (n.noticeDate && (n.noticeDate !== (c.noticeDate || '') || n.answerDue !== (c.answerDue || ''))) out.push(`Notice sent to the respondent ${n.noticeDate}${n.answerDue ? `, answer due ${n.answerDue}` : ''}`);
  if (n.answer !== (c.answer || '') && n.answer) out.push(ANSWERS[n.answer]);
  if (n.parentsNotified && n.parentsNotified !== (c.parentsNotified || '')) out.push('Parents / guardian notified');
  if (n.conferenceMode !== (c.conferenceMode || '') && n.conferenceMode) out.push(`Conference set ${MODES[n.conferenceMode].toLowerCase()}`);
  if (n.decisionDate && n.decisionDate !== (c.decisionDate || '')) out.push(`Decision issued ${n.decisionDate}`);
  if (n.appeal !== (c.appeal || '') && n.appeal) out.push(APPEALS[n.appeal]);
  return out;
}

/** True when any handling field differs from what is saved. */
export const processChanged = (c, n) =>
  n.route !== routeOf(c) || n.noticeDate !== (c.noticeDate || '') || n.answerDue !== (c.answerDue || '') || n.answer !== (c.answer || '') ||
  n.parentsNotified !== (c.parentsNotified || '') || n.conferenceMode !== (c.conferenceMode || '') || n.conferencesHeld !== (Number(c.conferencesHeld) || 0) ||
  n.decisionDate !== (c.decisionDate || '') || n.appeal !== (c.appeal || '') || n.appealDate !== (c.appealDate || '') ||
  [...n.interventions].sort().join() !== [...(c.interventions || [])].sort().join();
