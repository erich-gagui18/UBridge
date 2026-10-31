// Email drafts for SAEP staff. UBridge never sends mail: it fills in a draft, the staff member edits and confirms it,
// and it opens in that person's own email app (mailto:) or is saved as a draft in their own Gmail (lib/gmail.js).
// Staff then confirm they sent it and UBridge records it.
// Pure functions (no Firebase imports) so they can be tested with plain Node.
import { fmt, todayPH, addDays } from './dates.js';
import { CONTACT } from '../data.js';
import { ANSWER_DAYS, REJECT_REASONS } from './process.js';

export const KINDS = {
  notice: 'Notice to the respondent',
  followup: 'Follow-up: no explanation yet',
  schedule: 'Conference schedule',
  decision: 'Conference summary and decision',
  department: 'Notice to the Dean and Program Head',
  parents: 'Notice to the parent or guardian',
  copy: 'Copy of the decision (Registrar, VPSAS, President)',
  rejection: 'Notice to the complainant: complaint not approved',
  closure: 'Notice to the respondent: complaint closed',
  'closure-dept': 'Notice to the Dean and Program Head: complaint closed',
};
/** Suggested draft for each case status. */
// Used only when nothing better is known; lib/process.js suggestedKind() looks at the whole case.
export const KIND_FOR_STATUS = {
  submitted: 'notice',
  review: 'notice',
  hearing: 'schedule',
  resolved: 'decision',
  rejected: 'rejection',
};

// Link length that email apps handle reliably. Longer drafts open without the body and the body is copied instead.
export const MAILTO_LIMIT = 1900;
// Same limits as firestore.rules (complaints/{id}/emails).
export const LIMITS = { to: 300, cc: 300, subject: 200, body: 5000 };

const IV = {
  reprimand: 'Disciplinary reprimand',
  censure: 'University censure',
  probation: 'Disciplinary probation',
  community: 'Community service',
  suspension: 'Suspension',
  exclusion: 'Exclusion',
  expulsion: 'Expulsion',
};
const MODES = { 'face-to-face': 'Face-to-face', online: 'Online' };

const offenseName = (c) => (c.offenseOther ? `${c.type}: ${c.offenseOther}` : c.type);
const sign = (me) =>
  `${me?.name || 'SAEP Office'}\n${me?.position || 'SAEP Office'}\nSAEP Office, University of Batangas – Lipa`;
// The degree is the one SAEP assessed (policy, Process step 1); until then, the one that follows from the filed offense.
const degreeLabel = (c) => c.assessedDegree || (c.offense && c.offense !== 'Unclassified' ? c.offense : '');
const caseBlock = (c) =>
  [
    `Case no.: ${c.id}`,
    `Offense: ${offenseName(c)}${degreeLabel(c) ? ` (${degreeLabel(c)})` : ''}`,
    `Date of incident: ${fmt(c.date)}`,
    `Place: ${c.location}`,
  ].join('\n');
const CONFIDENTIAL = 'This matter is confidential. Please do not share this message.';

/**
 * Build a draft. The complainant's name and the complaint description are left out unless `include` is true
 * (notice only: the policy says the notice carries a copy of the complaint; the complainant's name is still never added).
 * `today` only fixes the date used to propose the answer deadline (tests).
 * @returns {{kind, to, cc, subject, body}}
 */
export function draft(kind, c, me, { cc = '', include = false, today = todayPH() } = {}) {
  // No address is on file for the department, the parent or guardian, or the offices that get the decision copy: staff type them.
  // Not approved: the complainant is told at their UB account address. Each party that was told about the complaint gets its
  // own closing notice: 'closure' for the respondent and 'closure-dept' for the department (a case can need both).
  const to =
    kind === 'rejection'
      ? c.filedByEmail || ''
      : ['department', 'closure-dept', 'parents', 'copy'].includes(kind)
        ? ''
        : c.rEmail || '';
  const hi =
    kind === 'rejection'
      ? `Dear ${c.filedByName || 'Complainant'},`
      : kind === 'department' || kind === 'closure-dept'
        ? `Dear Dean and Program Head, ${c.rDept || ''}`.trim() + ','
        : kind === 'parents'
          ? 'Dear Parent or Guardian,'
          : kind === 'copy'
            ? 'Dear Registrar’s Office, Vice President for Student Affairs and Services (VPSAS) and Office of the President,'
            : `Dear ${c.student},`;
  // The notice proposes the three-day answer deadline when none is saved yet; sending the email records it (lib/process.js effectOfEmail).
  const due = c.answerDue || (kind === 'notice' && !c.noticeDate ? addDays(today, ANSWER_DAYS) : '');
  let subject, body;

  if (kind === 'notice') {
    subject = `Notice of complaint, case ${c.id}`;
    body = `${hi}

The SAEP Office has received a complaint that names you as the respondent and has accepted it for review.

${caseBlock(c)}

${include ? `A copy of the complaint is included below.\n\nStatement of the complainant:\n${c.desc}\n\nThe statements of any witnesses are [attached / not applicable].` : 'A copy of the complaint, with the statement of the complainant and of any witnesses, is [attached / included below].'}

You have not less than three (3) days to answer${due ? ` (on or before ${fmt(due)})` : ''}. Please send your written explanation to the SAEP Office or email it to ${CONTACT.email}. If we do not receive it in that time, an entry of general denial will be entered in your favor.

You may be assisted by counsel if you wish. If you are below 18 years old, your parent or guardian will also be notified.

${CONFIDENTIAL}

${sign(me)}`;
  } else if (kind === 'followup') {
    subject = `Reminder: explanation needed, case ${c.id}`;
    body = `${hi}

We have not yet received your written explanation for the complaint below${c.answerDue ? `, which was due on ${fmt(c.answerDue)}` : ''}.

${caseBlock(c)}

Please send it to the SAEP Office or reply to this email as soon as possible. If it is not received, an entry of general denial will be entered in your favor. If you cannot respond, tell us the reason, or contact the SAEP Office.

${CONFIDENTIAL}

${sign(me)}`;
  } else if (kind === 'schedule') {
    const when = c.hearingDate ? fmt(c.hearingDate) : '[date]';
    const mode = MODES[c.conferenceMode] || '[face-to-face or online]';
    subject = `Disciplinary conference schedule, case ${c.id}`;
    body = `${hi}

Your disciplinary conference with the College Discipline Board is scheduled as follows.

${caseBlock(c)}

Date: ${when}
Time: [time]
Mode: ${mode}
Venue or meeting link: [venue or link]

Please confirm that you received this message by replying to this email. If you cannot attend, tell us as early as possible. Failure to attend two (2) consecutive disciplinary conferences means waiving your rights, and the Board will automatically render a decision.

${CONFIDENTIAL}

${sign(me)}`;
  } else if (kind === 'decision') {
    const ivs = (c.interventions || []).map((k) => IV[k] || k);
    const docs = [
      'Narrative report',
      'Reflection',
      ...(ivs.includes('Community service') ? ['Attendance record for the community service'] : []),
      'Photos (optional)',
    ];
    subject = `Conference summary and decision, case ${c.id}`;
    body = `${hi}

This is a summary of the disciplinary conference and the decision on the complaint below.

${caseBlock(c)}
${c.hearingDate ? `Conference date: ${fmt(c.hearingDate)}\n` : ''}
What was discussed:
[summary of what was discussed at the conference]

Decision: ${c.resolution || '[decision]'}${c.decisionDate ? `\nDecision date: ${fmt(c.decisionDate)}` : ''}
Interventions: ${ivs.length ? ivs.join('; ') : '[interventions]'}

${ivs.includes('Expulsion') ? 'Expulsion may not be imposed without the approval of the Commission on Higher Education.' : 'The decision takes effect five (5) days after you receive it, unless you appeal in writing to the University President, stating your grounds, within that time.'}
${ivs.includes('Suspension') ? '\nDuring a suspension you must report daily to the SAEP Office. Conditions for readmission will be stated in writing by the CDB.\n' : ''}${ivs.includes('Community service') ? '\nCommunity service is coordinated with the External Programs Coordinator.\n' : ''}
A copy of the decision is also furnished to your parent or guardian, the Registrar’s Office, the VPSAS and the Office of the President.

Documents you need to submit for these interventions:
${docs.map((d) => `- ${d}`).join('\n')}
Send them to: [Drive folder link or email address]

${CONFIDENTIAL}

${sign(me)}`;
  } else if (kind === 'department') {
    subject = `First Degree complaint for your information, case ${c.id}`;
    body = `${hi}

SAEP has assessed a complaint against a student of your college as a First Degree offense. Under the College Student Discipline Policy, SAEP forwards First Degree offenses to the respondent's department.

Respondent: ${c.student} (${c.sid}), ${c.program}
${caseBlock(c)}

Please document the disciplinary conference your department holds and forward a copy of the decision to the College Discipline Board. The College Discipline Board handles the third commission of any First Degree offense. Please coordinate with the SAEP Office on the next steps.

${CONFIDENTIAL}

${sign(me)}`;
  } else if (kind === 'parents') {
    subject = `Notice of complaint against your ward, case ${c.id}`;
    body = `${hi}

The SAEP Office of the University of Batangas – Lipa has received a complaint against ${c.student}, your ward${c.rDept ? `, a student of ${c.rDept}` : ''}. Under the College Student Discipline Policy, the parents or guardians of a respondent who is below 18 years old are notified of the complaint.

${caseBlock(c)}

${c.answerDue ? `Your ward has until ${fmt(c.answerDue)} to give a written explanation to the SAEP Office. ` : 'Your ward will be asked for a written explanation. '}Your ward may be assisted by counsel if he or she wishes. A disciplinary conference will be scheduled and you will be told the date.

Please contact the SAEP Office if you have questions.

${CONFIDENTIAL}

${sign(me)}`;
  } else if (kind === 'copy') {
    const ivs = (c.interventions || []).map((k) => IV[k] || k);
    subject = `Copy of the decision, case ${c.id}`;
    body = `${hi}

Under the College Student Discipline Policy, a copy of the written decision of the College Discipline Board is furnished to you.

Respondent: ${c.student} (${c.sid}), ${c.program}
${caseBlock(c)}
${c.hearingDate ? `Conference date: ${fmt(c.hearingDate)}\n` : ''}Decision: ${c.resolution || '[decision]'}${c.decisionDate ? `\nDecision date: ${fmt(c.decisionDate)}` : ''}
Interventions: ${ivs.length ? ivs.join('; ') : '[interventions]'}

${ivs.includes('Expulsion') ? 'Expulsion may not be imposed without the approval of the Commission on Higher Education.' : 'The decision is effective and executory five (5) days after the respondent receives it, unless an appeal is filed in writing with the University President.'}

The signed written decision is attached: [attach the signed decision].

${CONFIDENTIAL}

${sign(me)}`;
  } else if (kind === 'rejection') {
    subject = `Your complaint was not approved, case ${c.id}`;
    body = `${hi}

The SAEP Office has reviewed your complaint and has decided not to take it forward. No action will be taken against the respondent on this complaint.

${caseBlock(c)}

Reason: ${REJECT_REASONS[c.rejectReason] || '[reason]'}
${c.resolution || '[explanation for the complainant]'}

If you have more information or evidence, you may file a new complaint in UBridge, or visit the SAEP Office and bring it with you. You may also write to ${CONTACT.email}.

${CONFIDENTIAL}

${sign(me)}`;
  } else if (kind === 'closure') {
    subject = `Complaint closed, case ${c.id}`;
    body = `${hi}

The SAEP Office has closed the complaint that named you as the respondent. It was not approved for further action, so no disciplinary conference will be held and no action will be taken against you on this complaint. You do not need to send an explanation.

${caseBlock(c)}

Please contact the SAEP Office if you have questions.

${CONFIDENTIAL}

${sign(me)}`;
  } else if (kind === 'closure-dept') {
    subject = `Complaint closed, case ${c.id}`;
    body = `${hi}

The SAEP Office has closed the complaint it forwarded to your department. It was not approved for further action, so please do not hold a disciplinary conference or take any action on it.

Respondent: ${c.student} (${c.sid}), ${c.program}
${caseBlock(c)}

Please contact the SAEP Office if you have questions.

${CONFIDENTIAL}

${sign(me)}`;
  } else throw new Error(`Unknown email kind: ${kind}`);

  return { kind, to, cc, subject, body };
}

const EMAIL = /^[^@\s,;]+@[^@\s,;]+\.[^@\s,;]+$/;
/** Split "a@x.com, b@y.com; c@z.com" into a clean list. */
export const addresses = (s) =>
  String(s || '')
    .split(/[;,]/)
    .map((x) => x.trim())
    .filter(Boolean);

/** A message for the first problem found, or '' when the draft can be sent. */
export function check(d) {
  const to = addresses(d.to),
    cc = addresses(d.cc);
  if (!to.length) return 'Add at least one address in To.';
  const bad = [...to, ...cc].find((x) => !EMAIL.test(x));
  if (bad) return `“${bad}” is not a valid email address.`;
  if (d.to.length > LIMITS.to || d.cc.length > LIMITS.cc) return 'Too many addresses. Shorten the To or Cc line.';
  if (!d.subject.trim()) return 'Add a subject.';
  if (d.subject.length > LIMITS.subject) return `The subject is too long (limit ${LIMITS.subject} characters).`;
  if (d.body.trim().length < 20) return 'The message is too short.';
  if (d.body.length > LIMITS.body) return `The message is too long (limit ${LIMITS.body} characters).`;
  const hole = d.body.match(/\[[^\]\n]+\]/);
  if (hole) return `Replace ${hole[0]} with the real details before sending.`;
  return '';
}

/** mailto: link for a draft. */
export function mailto(d) {
  const crlf = (s) => s.replace(/\r?\n/g, '\r\n');
  const q = [
    d.cc && `cc=${addresses(d.cc).join(',')}`,
    `subject=${encodeURIComponent(d.subject)}`,
    d.body && `body=${encodeURIComponent(crlf(d.body))}`,
  ].filter(Boolean);
  return `mailto:${addresses(d.to).join(',')}?${q.join('&')}`;
}
