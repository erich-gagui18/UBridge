// Handling of a case under the College Student Discipline Policy (UB document SAEP M, Revision No. 4, approved 25 March 2026), section PROCESS:
// SAEP assessment and routing, notice to the respondent, conferences, decision and appeal.
// "Process step N" below means the numbered step N of that PROCESS section (1 Filing, 2 Notice, 3 Parents, 4 Conference, 5 Interventions, 6 Decision).
// Every date is a Philippine calendar date (YYYY-MM-DD). The Firestore rules check the same limits.
import { esc } from './dom.js';
import { fmt, todayPH, addDays } from './dates.js';
export { addDays };

export const ANSWER_DAYS = 3; // Process step 2: the respondent gets not less than three (3) days to answer
export const DECISION_DAYS = 10; // Process step 6: the CDB decides within ten (10) days of the last conference
export const EFFECT_DAYS = 5; // Process step 6: effective and executory five (5) days after receipt unless appealed (not for expulsion)

// Process step 5: interventions that can be imposed.
export const INTERVENTIONS = [
  ['reprimand', 'Disciplinary reprimand'],
  ['censure', 'University censure'],
  ['probation', 'Disciplinary probation'],
  ['community', 'Community service'],
  ['suspension', 'Suspension'],
  ['exclusion', 'Exclusion'],
  ['expulsion', 'Expulsion'],
];
const IV = Object.fromEntries(INTERVENTIONS);
export const ROUTES = { department: 'Respondent’s department', cdb: 'SAEP / College Discipline Board' };
export const APPEALS = {
  filed: 'Appeal filed',
  upheld: 'Decision upheld',
  modified: 'Decision modified',
  reversed: 'Decision reversed',
};
const ANSWERS = {
  '': 'Awaiting the respondent',
  received: 'Explanation received',
  'general-denial': 'General denial entered',
};
const MODES = { '': 'Not set', 'face-to-face': 'Face-to-face', online: 'Online' };

export const DEGREES = ['First Degree', 'Second Degree', 'Third Degree'];

/**
 * OFF-CAMPUS AND ONLINE OFFENSES (policy): the University may exercise jurisdiction over an offense committed off-campus
 * and online only when at least one of these five grounds applies. The wording is the policy's.
 */
export const GROUNDS = [
  { id: 'victim', label: 'The victim of such offense is a member of the campus community (student, faculty or staff)' },
  { id: 'event', label: 'The offense occurred at a college or university sponsored-event' },
  {
    id: 'status',
    label:
      'The accused student used his or her status as a member of the University community to assist in the commission of the offense',
  },
  { id: 'objectives', label: 'The offense seriously impairs the pursuit of the University’s objectives' },
  { id: 'name', label: 'The offense tarnishes the good name of the school' },
];
export const VENUE_LABEL = {
  campus: 'On campus, in an online class or social media platform of the University, or at a University activity',
  offcampus: 'Off campus or online, outside University activities',
};
export const venueOf = (c) => c.venue || 'campus';
export const JUR_REVIEW = {
  '': 'Pending SAEP review',
  confirmed: 'Within jurisdiction (confirmed by SAEP)',
  declined: 'Outside the University’s jurisdiction',
};

/**
 * Process step 1: SAEP initially assesses the degree of the offense. Until SAEP records an assessment, the degree is the
 * one that follows from the offense the complainant picked ('Unclassified' when they chose "Others").
 */
export const degreeOf = (c) => c.assessedDegree || c.offense;

/** Process step 1: First Degree goes to the respondent's department (forwarded by SAEP), everything else to the CDB. */
export const routeFor = (degree) => (degree === 'First Degree' ? 'department' : 'cdb');
export const routeOf = (c) => c.route || routeFor(degreeOf(c));

/** How many First Degree complaints this respondent has had up to and including this one (staff see all cases). The CDB handles the third. */
export const commissionOf = (c, all) =>
  degreeOf(c) !== 'First Degree'
    ? 0
    : all.filter(
        (x) =>
          degreeOf(x) === 'First Degree' &&
          x.sid === c.sid &&
          (x.filed < c.filed || (x.filed === c.filed && x.id <= c.id)),
      ).length;

const row = (k, v) => `<dt>${k}</dt><dd>${v}</dd>`;

/** Read-only summary rows shown to the filer and to staff. */
export function processRows(c, { staff = false, commission = 0 } = {}) {
  const today = todayPH(),
    r = routeOf(c),
    out = [];
  if (venueOf(c) === 'offcampus') {
    const g = (c.jurisdiction || []).map((id) => GROUNDS.find((x) => x.id === id)?.label).filter(Boolean);
    out.push(
      row(
        'Place of offense',
        `Off campus or online${g.length ? `<ul class="grounds">${g.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}`,
      ),
    );
    out.push(row('Jurisdiction', `${esc(JUR_REVIEW[c.jurisdictionReview || ''])}`));
  }
  if (c.assessedDegree)
    out.push(
      row(
        'SAEP assessment',
        `${esc(c.assessedDegree)}${c.assessedDegree !== c.offense ? ` <small class="muted">· filed as ${esc(c.offense === 'Unclassified' ? 'Others (unclassified)' : c.offense)}</small>` : ''}`,
      ),
    );
  else if (c.offense === 'Unclassified')
    out.push(row('SAEP assessment', 'Awaiting SAEP to assess the degree of the offense'));
  out.push(
    row(
      'Handled by',
      esc(ROUTES[r]) +
        (staff && commission >= 3 && r === 'department'
          ? ' <small class="muted">· third commission: belongs with the CDB (First Degree Offenses)</small>'
          : staff && commission > 1
            ? ` <small class="muted">· commission #${commission} for this respondent</small>`
            : ''),
    ),
  );
  if (c.noticeDate) {
    const late = c.answerDue && c.answerDue < today && !c.answer;
    out.push(
      row(
        'Notice to respondent',
        `${fmt(c.noticeDate)}${c.answerDue ? ` <small class="muted">· answer due ${fmt(c.answerDue)}</small>` : ''}`,
      ),
    );
    out.push(
      row(
        'Respondent’s explanation',
        esc(late ? 'No answer by the deadline: general denial applies (Process step 2)' : ANSWERS[c.answer || '']),
      ),
    );
  }
  if (c.parentsNotified) out.push(row('Parents / guardian', `Notified ${fmt(c.parentsNotified)}`));
  if (r === 'department' && c.deptDecisionDate)
    out.push(row('Department’s decision', `Copy received by the CDB ${fmt(c.deptDecisionDate)}`));
  if (c.hearingDate) {
    const due = addDays(c.hearingDate, DECISION_DAYS);
    out.push(
      row(
        'Disciplinary conference',
        `${fmt(c.hearingDate)}${c.conferenceMode ? ` · ${esc(MODES[c.conferenceMode])}` : ''}${c.status !== 'resolved' && c.hearingDate <= today ? ` <small class="muted">· decision due by ${fmt(due)}</small>` : ''}`,
      ),
    );
  }
  if (c.decisionDate) {
    const eff = addDays(c.decisionDate, EFFECT_DAYS);
    const exp = (c.interventions || []).includes('expulsion');
    out.push(
      row(
        'Decision date',
        `${fmt(c.decisionDate)}${exp ? ' <small class="muted">· expulsion may not be imposed without the approval of the Commission on Higher Education</small>' : !c.appeal ? ` <small class="muted">· effective ${fmt(eff)} unless appealed to the University President</small>` : ''}`,
      ),
    );
  }
  if ((c.interventions || []).length)
    out.push(row('Interventions', esc(c.interventions.map((k) => IV[k] || k).join('; '))));
  if (c.appeal)
    out.push(
      row(
        'Appeal',
        `${esc(APPEALS[c.appeal])}${c.appealDate ? ` <small class="muted">· ${fmt(c.appealDate)}</small>` : ''}`,
      ),
    );
  return out.join('');
}

const opts = (o, sel) =>
  Object.entries(o)
    .map(([k, v]) => `<option value="${esc(k)}" ${k === sel ? 'selected' : ''}>${esc(v)}</option>`)
    .join('');

/** Staff form block (goes inside the "Update this case" box). */
export function processForm(c, { commission = 0 } = {}) {
  const r = routeOf(c),
    iv = c.interventions || [];
  const filed = c.offense === 'Unclassified' ? 'Others (unclassified)' : c.offense;
  return `<details class="proc" open><summary>Case handling (College Student Discipline Policy)</summary>
    <div class="field"><label for="pAssess">SAEP assessment: degree of the offense</label><select id="pAssess"><option value="" ${c.assessedDegree ? '' : 'selected'}>Not assessed yet (filed as ${esc(filed)})</option>${DEGREES.map((d) => `<option value="${esc(d)}" ${d === c.assessedDegree ? 'selected' : ''}>${esc(d)}</option>`).join('')}</select><small class="muted">SAEP initially assesses the degree of every complaint (Process step 1). First Degree goes to the respondent’s department; Second and Third Degree go to the College Discipline Board, so choosing either moves the case to the CDB.</small></div>
    ${
      venueOf(c) === 'offcampus'
        ? `<div class="field"><label for="pJur">Off-campus / online jurisdiction</label><select id="pJur">${Object.entries(
            JUR_REVIEW,
          )
            .map(
              ([k, t]) =>
                `<option value="${k}" ${k === (c.jurisdictionReview || '') ? 'selected' : ''}>${esc(t)}</option>`,
            )
            .join(
              '',
            )}</select><small class="muted">The University may act on an offense committed off campus or online only when one of the grounds the complainant gave applies (policy, Off-Campus and Online Offenses). If none does, choose “Outside”, set the status to Resolved and explain in the decision note. The University’s decision may proceed independently of public prosecutors and it may refer the matter to the police.</small></div>`
        : ''
    }
    <div class="field"><label for="pRoute">Handled by</label><select id="pRoute" ${r === 'cdb' ? 'disabled' : ''}>${opts(ROUTES, r)}</select><small class="muted">${r === 'cdb' ? 'Already with SAEP / the College Discipline Board.' : commission >= 3 ? 'This is the respondent’s third First Degree commission, so it should go to the CDB.' : 'First Degree offenses are handled by the respondent’s department. Escalate for a repeat or a serious case.'}</small></div>
    <div class="cols tight"><div class="field"><label for="pNotice">Notice sent</label><input id="pNotice" type="date" value="${esc(c.noticeDate || '')}"></div>
    <div class="field"><label for="pDue">Answer due</label><input id="pDue" type="date" value="${esc(c.answerDue || '')}" ${c.noticeDate ? `min="${esc(addDays(c.noticeDate, ANSWER_DAYS))}"` : ''}></div></div>
    <small class="muted">The respondent gets at least ${ANSWER_DAYS} days to answer. The due date fills in by itself when you set the notice date.</small>
    <div class="field"><label for="pAnswer">Respondent’s explanation</label><select id="pAnswer">${opts(ANSWERS, c.answer || '')}</select></div>
    <div class="field"><label for="pParents">Parents / guardian notified</label><input id="pParents" type="date" value="${esc(c.parentsNotified || '')}"><small class="muted">Required when the respondent is under 18 (Process step 3). Older students only with their consent.</small></div>
    ${r === 'department' ? `<div class="field"><label for="pDept">Department’s decision received by the CDB</label><input id="pDept" type="date" value="${esc(c.deptDecisionDate || '')}"><small class="muted">The department documents its conference and forwards a copy of its decision to the College Discipline Board (First Degree Interventions).</small></div>` : ''}
    <div class="cols tight"><div class="field"><label for="pMode">Conference</label><select id="pMode">${opts(MODES, c.conferenceMode || '')}</select></div>
    <div class="field"><label for="pHeld">Conferences held</label><input id="pHeld" type="number" min="0" max="20" value="${Number(c.conferencesHeld) || 0}"></div></div>
    <small class="muted">The conference date is the hearing date above. Missing two consecutive conferences waives the respondent’s rights, and the Board then decides (Process step 4).</small>
    <div id="pDec" ${c.status === 'resolved' ? '' : 'hidden'}>
      <div class="field"><label for="pDecDate" class="req">Decision date</label><input id="pDecDate" type="date" value="${esc(c.decisionDate || todayPH())}"><small class="muted">Decide within ${DECISION_DAYS} days of the last conference. The written decision is furnished to the respondent, the parent or guardian, the Registrar’s Office, the VPSAS and the Office of the President (Process step 6).</small></div>
      <fieldset class="ivs"><legend>Interventions imposed (Process step 5)</legend>${INTERVENTIONS.map(([k, l]) => `<label><input type="checkbox" name="pIv" value="${k}" ${iv.includes(k) ? 'checked' : ''}> ${esc(l)}</label>`).join('')}</fieldset>
      <div class="cols tight"><div class="field"><label for="pAppeal">Appeal</label><select id="pAppeal">${opts({ '': 'None', ...APPEALS }, c.appeal || '')}</select></div>
      <div class="field"><label for="pAppealDate">Appeal date</label><input id="pAppealDate" type="date" value="${esc(c.appealDate || '')}"></div></div>
      <small class="muted">An appeal goes to the University President, in writing, within ${EFFECT_DAYS} days of receiving the decision (Process step 6). Expulsion also needs the approval of the Commission on Higher Education.</small>
    </div></details>`;
}

/** Read the form back. Returns {values} or {error}. */
export function readProcess(el, c, status) {
  const v = (s) => el.querySelector(s)?.value ?? '';
  const noticeDate = v('#pNotice'),
    answerDue = v('#pDue');
  const resolved = status === 'resolved';
  const values = {
    jurisdictionReview: el.querySelector('#pJur') ? v('#pJur') : c.jurisdictionReview || '',
    assessedDegree: v('#pAssess') || c.assessedDegree || '',
    deptDecisionDate: el.querySelector('#pDept') ? v('#pDept') : c.deptDecisionDate || '',
    route: v('#pRoute') || routeOf(c),
    noticeDate,
    answerDue,
    answer: v('#pAnswer'),
    parentsNotified: v('#pParents'),
    conferenceMode: v('#pMode'),
    conferencesHeld: Math.max(0, Math.min(20, Number(v('#pHeld')) || 0)),
    decisionDate: resolved ? v('#pDecDate') : c.decisionDate || '',
    interventions: resolved
      ? [...el.querySelectorAll('[name=pIv]:checked')].map((x) => x.value)
      : c.interventions || [],
    appeal: resolved ? v('#pAppeal') : c.appeal || '',
    appealDate: resolved ? v('#pAppealDate') : c.appealDate || '',
  };
  // Second and Third Degree offenses are handled by the College Discipline Board (Process step 1).
  if (values.assessedDegree && values.assessedDegree !== 'First Degree') values.route = 'cdb';
  if (values.jurisdictionReview === 'declined' && !resolved)
    return {
      error:
        'A complaint outside the University’s jurisdiction is closed: set the status to Resolved and explain why in the decision note.',
    };
  if (answerDue && !noticeDate) return { error: 'Set the notice date before the answer due date.' };
  if (noticeDate && answerDue && answerDue < addDays(noticeDate, ANSWER_DAYS))
    return {
      error: `The respondent must have at least ${ANSWER_DAYS} days to answer (due ${fmt(addDays(noticeDate, ANSWER_DAYS))} or later).`,
    };
  if (resolved && !values.decisionDate) return { error: 'Enter the decision date.' };
  if (values.appeal && !values.appealDate) return { error: 'Enter the date the appeal was filed.' };
  if (values.appeal && !resolved) return { error: 'An appeal only applies after a decision (status Resolved).' };
  return { values };
}

/** Short plain-language list of what changed in handling, used for the history remark and the notification. */
export function describeChanges(c, n) {
  const out = [];
  if ((n.jurisdictionReview || '') !== (c.jurisdictionReview || ''))
    out.push(
      n.jurisdictionReview === 'declined'
        ? 'SAEP found the offense outside the University’s jurisdiction'
        : n.jurisdictionReview === 'confirmed'
          ? 'SAEP confirmed the University’s jurisdiction'
          : 'Jurisdiction review reset',
    );
  if (n.assessedDegree && n.assessedDegree !== (c.assessedDegree || ''))
    out.push(`SAEP assessed the offense as ${n.assessedDegree}`);
  if (n.route !== routeOf(c)) out.push('Escalated to SAEP / the College Discipline Board');
  if (n.deptDecisionDate && n.deptDecisionDate !== (c.deptDecisionDate || ''))
    out.push('Department’s decision received by the CDB');
  if (n.noticeDate && (n.noticeDate !== (c.noticeDate || '') || n.answerDue !== (c.answerDue || '')))
    out.push(`Notice sent to the respondent ${n.noticeDate}${n.answerDue ? `, answer due ${n.answerDue}` : ''}`);
  if (n.answer !== (c.answer || '') && n.answer) out.push(ANSWERS[n.answer]);
  if (n.parentsNotified && n.parentsNotified !== (c.parentsNotified || '')) out.push('Parents / guardian notified');
  if (n.conferenceMode !== (c.conferenceMode || '') && n.conferenceMode)
    out.push(`Conference set ${MODES[n.conferenceMode].toLowerCase()}`);
  if (n.decisionDate && n.decisionDate !== (c.decisionDate || '')) out.push(`Decision issued ${n.decisionDate}`);
  if (n.appeal !== (c.appeal || '') && n.appeal) out.push(APPEALS[n.appeal]);
  return out;
}

/** True when any handling field differs from what is saved. */
export const processChanged = (c, n) =>
  (n.jurisdictionReview || '') !== (c.jurisdictionReview || '') ||
  n.assessedDegree !== (c.assessedDegree || '') ||
  n.deptDecisionDate !== (c.deptDecisionDate || '') ||
  n.route !== routeOf(c) ||
  n.noticeDate !== (c.noticeDate || '') ||
  n.answerDue !== (c.answerDue || '') ||
  n.answer !== (c.answer || '') ||
  n.parentsNotified !== (c.parentsNotified || '') ||
  n.conferenceMode !== (c.conferenceMode || '') ||
  n.conferencesHeld !== (Number(c.conferencesHeld) || 0) ||
  n.decisionDate !== (c.decisionDate || '') ||
  n.appeal !== (c.appeal || '') ||
  n.appealDate !== (c.appealDate || '') ||
  [...n.interventions].sort().join() !== [...(c.interventions || [])].sort().join();

/* ---------------------------------------------------------------------------------------------------------------
 * Case flow: what to do next, what a status change needs, and what sending an email changes in the case.
 * All pure (no DOM, no Firebase) so they are tested with plain Node. They only read the case; the Firestore rules
 * still decide what may be saved.
 * ------------------------------------------------------------------------------------------------------------- */
const STATUS_ORDER = ['submitted', 'review', 'hearing', 'resolved'];
const sentKinds = (emails) => new Set((emails || []).map((e) => e.kind));

/**
 * The next step for a case, following the policy's PROCESS section.
 * @param {object} c the case
 * @param {{today?:string, commission?:number, emails?:Array<{kind:string}>}} [o] emails = what staff already sent (kinds only matter)
 * @returns {{level:'todo'|'wait'|'warn'|'done', title:string, detail:string, kind:string, reminders:string[]}}
 *   kind is the email worth writing now ('' when none).
 */
export function nextStep(c, { today = todayPH(), commission = 0, emails = [] } = {}) {
  const sent = sentKinds(emails),
    r = routeOf(c),
    deg = degreeOf(c),
    reminders = [];
  const out = (level, title, detail, kind = '') => ({ level, title, detail, kind, reminders });

  if (c.status === 'resolved') {
    if (c.jurisdictionReview === 'declined')
      return out('done', 'Closed: outside the University’s jurisdiction', 'No further steps for this case.');
    if (c.appeal === 'filed')
      return out(
        'wait',
        'Appeal pending with the University President',
        'When the President decides, record Decision upheld, modified or reversed (Process step 6).',
      );
    if (c.appeal) return out('done', 'Appeal decided', 'No further steps for this case.');
    if (!sent.has('decision'))
      return out(
        'todo',
        'Send the decision to the respondent',
        'The decision is in writing and discusses the facts and the rules applied (Process step 6).',
        'decision',
      );
    if (!sent.has('copy'))
      return out(
        'todo',
        'Furnish copies of the decision',
        'The Registrar’s Office, the VPSAS and the Office of the President each get a copy, and so does the parent or guardian of the respondent (Process step 6).',
        'copy',
      );
    const exp = (c.interventions || []).includes('expulsion');
    return out(
      'done',
      'Decision sent and copies furnished',
      exp
        ? 'Expulsion may not be imposed without the approval of the Commission on Higher Education.'
        : c.decisionDate
          ? `The decision takes effect on ${fmt(addDays(c.decisionDate, EFFECT_DAYS))} unless an appeal is filed with the University President.`
          : 'Watch for an appeal to the University President.',
    );
  }

  if (!c.parentsNotified) reminders.push('If the respondent is under 18, notify the parent or guardian (Process step 3).');

  // Process step 1: SAEP assessment and, for off-campus or online offenses, the jurisdiction review.
  if (deg === 'Unclassified' && !c.assessedDegree)
    return out(
      'todo',
      'Assess the degree of the offense',
      'The complainant chose “Others”. Record the degree under Case handling: First Degree goes to the respondent’s department, Second and Third Degree to the CDB (Process step 1).',
    );
  if (venueOf(c) === 'offcampus' && !c.jurisdictionReview)
    return out(
      'todo',
      'Review the University’s jurisdiction',
      'The offense happened off campus or online. Check the grounds the complainant gave, then confirm or decline jurisdiction under Case handling.',
    );
  if (c.jurisdictionReview === 'declined')
    return out('todo', 'Close the case', 'Set the status to Resolved and explain in the decision note.');

  if (r === 'department') {
    if (commission >= 3)
      return out(
        'warn',
        'Escalate to the CDB: third First Degree commission',
        'The College Discipline Board handles the third commission of a First Degree offense. Change “Handled by” to SAEP / the College Discipline Board.',
      );
    if (!c.noticeDate && !sent.has('department'))
      return out(
        'todo',
        'Forward the complaint to the department',
        'SAEP forwards First Degree offenses to the respondent’s department. The department notifies the respondent, holds the conference and documents it (Process step 1).',
        'department',
      );
    if (!c.deptDecisionDate)
      return out(
        'wait',
        'Waiting for the department’s decision',
        'The department sends a copy of its decision to the CDB. Record the date it arrives under Case handling.',
      );
    return out('todo', 'Resolve the case', 'Set the status to Resolved and enter the decision date and note.');
  }

  // Route: SAEP / College Discipline Board.
  if (!c.noticeDate)
    return out(
      'todo',
      'Send the notice of complaint',
      'The respondent is notified in writing, with a copy of the complaint and not less than three (3) days to answer (Process step 2). Writing the email fills in the notice date and the answer due date for you.',
      'notice',
    );
  if (!c.answer) {
    if (c.answerDue && c.answerDue >= today)
      return out(
        'wait',
        `Waiting for the respondent’s explanation (due ${fmt(c.answerDue)})`,
        'When it arrives, record “Explanation received” under Case handling.',
      );
    return out(
      'todo',
      'No explanation by the deadline: enter a general denial',
      'The answer period has ended. Under Process step 2 a general denial is entered in the respondent’s favor. Record it under Case handling, then schedule the conference. A reminder email is optional.',
      sent.has('followup') ? '' : 'followup',
    );
  }
  const onHearing = c.status === 'hearing' && c.hearingDate;
  if (!onHearing)
    return out(
      'todo',
      'Schedule the disciplinary conference',
      'Set the status to “For hearing” and choose the date and mode (Process step 4). Then email the schedule to the respondent.',
    );
  if (!sent.has('schedule'))
    return out('todo', 'Email the conference schedule', 'The respondent has not been told the date yet.', 'schedule');
  if (c.hearingDate > today)
    return out(
      'wait',
      `Disciplinary conference on ${fmt(c.hearingDate)}`,
      'A respondent who misses two consecutive conferences waives the right to attend, and the Board decides (Process step 4).',
    );
  const due = addDays(c.hearingDate, DECISION_DAYS);
  if (today > due)
    return out(
      'warn',
      `Decision overdue (was due ${fmt(due)})`,
      'The CDB decides within ten (10) days of the last conference (Process step 6). Set the status to Resolved, then enter the decision date, interventions and note.',
    );
  return out(
    'todo',
    'Record the decision',
    `The conference date has passed. The CDB decides by ${fmt(due)} (Process step 6). Set the status to Resolved and enter the decision date, interventions and note.`,
  );
}

/** Email worth writing now for this case (used to preselect the message). */
export function suggestedKind(c, o = {}) {
  const k = nextStep(c, o).kind;
  if (k) return k;
  return c.status === 'resolved' ? 'decision' : c.status === 'hearing' ? 'schedule' : routeOf(c) === 'department' ? 'department' : 'notice';
}

/**
 * Check a status change before it is saved.
 * errors  = the change would break the process, so it is not saved.
 * warnings = allowed, but the person must confirm (shown in the confirmation).
 * @param {object} c the saved case
 * @param {object} v values read from the form (readProcess().values)
 * @param {{status:string, hearingDate:string}} change
 */
export function checkMove(c, v, { status, hearingDate }, today = todayPH()) {
  const errors = [],
    warnings = [];
  const declined = v.jurisdictionReview === 'declined';
  const deg = v.assessedDegree || degreeOf(c);
  const route = v.route || routeOf(c);
  const late = status === 'hearing' || status === 'resolved';
  const closing = status === 'resolved' && !declined;

  if (late && !declined && deg === 'Unclassified')
    errors.push('Assess the degree of the offense first (Case handling, Process step 1).');
  if (late && !declined && venueOf(c) === 'offcampus' && !v.jurisdictionReview)
    errors.push('Review the University’s jurisdiction first (Case handling). This offense happened off campus or online.');
  if (status === 'hearing' && !v.noticeDate)
    errors.push('Send the notice to the respondent before the conference (Process step 2). Set the notice date under Case handling.');
  if (status === 'hearing' && !v.answer && v.answerDue && hearingDate && hearingDate < v.answerDue)
    errors.push(
      `The conference cannot be before the answer deadline (${fmt(v.answerDue)}) unless the respondent’s explanation has been received.`,
    );
  if (status === 'resolved' && v.decisionDate && hearingDate && v.decisionDate < hearingDate)
    errors.push('The decision date cannot be before the conference date.');

  if (closing && route === 'cdb' && !hearingDate && !v.conferencesHeld)
    warnings.push('No disciplinary conference is recorded. The policy requires one before the decision (Process step 4).');
  if (closing && route === 'cdb' && !v.noticeDate)
    warnings.push('No notice to the respondent is recorded (Process step 2).');
  if (closing && route === 'department' && !v.deptDecisionDate)
    warnings.push('The department’s decision copy has not been recorded (First Degree Interventions).');
  if (closing && v.decisionDate && hearingDate && v.decisionDate > addDays(hearingDate, DECISION_DAYS))
    warnings.push(`The decision is more than ${DECISION_DAYS} days after the last conference (Process step 6).`);
  if (closing && !(v.interventions || []).length)
    warnings.push('No intervention is selected. That is fine only if the respondent was found not responsible, and the note should say so.');
  if (v.answer === 'general-denial' && !c.answer && v.answerDue && today <= v.answerDue)
    warnings.push(`The answer period has not ended yet (due ${fmt(v.answerDue)}). A general denial is entered only when the respondent does not answer in time.`);
  const jump = STATUS_ORDER.indexOf(status) - STATUS_ORDER.indexOf(c.status);
  if (jump > 1 && !declined) warnings.push('This skips a stage of the process.');
  return { errors, warnings };
}

/**
 * What sending an email changes in the case, so staff do not enter it twice.
 * @returns {{status:string, process:object, notes:string[], label:string}|null}
 */
export function effectOfEmail(kind, c, today = todayPH()) {
  const process = {},
    notes = [],
    bits = [];
  let status = c.status;
  if (kind === 'notice' && !c.noticeDate) {
    process.noticeDate = today;
    process.answerDue = addDays(today, ANSWER_DAYS);
    notes.push(`Notice sent to the respondent ${today}, answer due ${process.answerDue}`);
    bits.push(`set the notice date to ${fmt(today)} and the answer due date to ${fmt(process.answerDue)}`);
  }
  if (kind === 'parents' && !c.parentsNotified) {
    process.parentsNotified = today;
    notes.push('Parents / guardian notified');
    bits.push(`record the parent or guardian as notified on ${fmt(today)}`);
  }
  if ((kind === 'notice' || kind === 'department') && c.status === 'submitted') {
    status = 'review';
    bits.push(`move the case to ${STATUS_LABEL.review}`);
    if (kind === 'department') notes.push('Complaint forwarded to the respondent’s department');
  }
  if (!bits.length) return null;
  return { status, process, notes, label: bits.join(', ').replace(/, ([^,]*)$/, ' and $1') };
}
const STATUS_LABEL = { review: 'In review' };
