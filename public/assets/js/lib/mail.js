// Email drafts for SAEP staff. UBridge never sends mail: it fills in a draft, the staff member edits and confirms it,
// and it opens in that person's own email app (mailto:). Staff then confirm they sent it and UBridge records it.
// Pure functions (no Firebase imports) so they can be tested with plain Node.
import { fmt } from './dates.js';

export const KINDS = {
  notice: 'Notice to the respondent',
  followup: 'Follow-up: no explanation yet',
  schedule: 'Conference schedule',
  decision: 'Conference summary and decision',
  department: 'Notice to the Dean and Program Head',
};
/** Suggested draft for each case status. */
export const KIND_FOR_STATUS = { submitted: 'notice', review: 'notice', hearing: 'schedule', resolved: 'decision' };

// Link length that email apps handle reliably. Longer drafts open without the body and the body is copied instead.
export const MAILTO_LIMIT = 1900;
// Same limits as firestore.rules (complaints/{id}/emails).
export const LIMITS = { to: 300, cc: 300, subject: 200, body: 5000 };

const IV = {
  reprimand: 'Disciplinary reprimand', censure: 'University censure', probation: 'Disciplinary probation',
  community: 'Community service', suspension: 'Suspension', exclusion: 'Exclusion', expulsion: 'Expulsion',
};
const MODES = { 'face-to-face': 'Face-to-face', online: 'Online' };

const offenseName = (c) => (c.offenseOther ? `${c.type}: ${c.offenseOther}` : c.type);
const sign = (me) => `${me?.name || 'SAEP Office'}\n${me?.position || 'SAEP Office'}\nSAEP Office, University of Batangas – Lipa`;
const caseBlock = (c) =>
  [`Case no.: ${c.id}`, `Offense: ${offenseName(c)}${c.offense && c.offense !== 'Unclassified' ? ` (${c.offense})` : ''}`, `Date of incident: ${fmt(c.date)}`, `Place: ${c.location}`].join('\n');
const CONFIDENTIAL = 'This matter is confidential. Please do not share this message.';

/**
 * Build a draft. The complainant's name and the complaint description are left out on purpose;
 * staff can add them if the office decides the respondent should receive them.
 * @returns {{kind, to, cc, subject, body}}
 */
export function draft(kind, c, me, { cc = '' } = {}) {
  const to = kind === 'department' ? '' : c.rEmail || '';
  const hi = kind === 'department' ? `Dear Dean and Program Head, ${c.rDept || ''}`.trim() + ',' : `Dear ${c.student},`;
  let subject, body;

  if (kind === 'notice') {
    subject = `Notice of complaint, case ${c.id}`;
    body = `${hi}

The SAEP Office has received a complaint that names you as the respondent and has accepted it for review.

${caseBlock(c)}

Please send your written explanation by replying to this email within 72 hours of receiving it${c.answerDue ? ` (on or before ${fmt(c.answerDue)})` : ''}. Replies are accepted by email only. If we do not receive your explanation in that time, the SAEP Office will contact you again.

${CONFIDENTIAL}

${sign(me)}`;
  } else if (kind === 'followup') {
    subject = `Reminder: explanation needed, case ${c.id}`;
    body = `${hi}

We have not yet received your written explanation for the complaint below${c.answerDue ? `, which was due on ${fmt(c.answerDue)}` : ''}.

${caseBlock(c)}

Please reply to this email as soon as possible. If you cannot respond, tell us the reason, or contact the SAEP Office.

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

Please confirm that you received this message by replying to this email. If you cannot attend, tell us as early as possible.

${CONFIDENTIAL}

${sign(me)}`;
  } else if (kind === 'decision') {
    const ivs = (c.interventions || []).map((k) => IV[k] || k);
    const docs = ['Narrative report', 'Reflection', ...(ivs.includes('Community service') ? ['Attendance record for the community service'] : []), 'Photos (optional)'];
    subject = `Conference summary and decision, case ${c.id}`;
    body = `${hi}

This is a summary of the disciplinary conference and the decision on the complaint below.

${caseBlock(c)}
${c.hearingDate ? `Conference date: ${fmt(c.hearingDate)}\n` : ''}
What was discussed:
[summary of what was discussed at the conference]

Decision: ${c.resolution || '[decision]'}${c.decisionDate ? `\nDecision date: ${fmt(c.decisionDate)}` : ''}
Interventions: ${ivs.length ? ivs.join('; ') : '[interventions]'}

The decision takes effect five (5) days after you receive it, unless you appeal in writing to the University President within that time.

Documents you need to submit for these interventions:
${docs.map((d) => `- ${d}`).join('\n')}
Send them to: [Drive folder link or email address]

${CONFIDENTIAL}

${sign(me)}`;
  } else if (kind === 'department') {
    subject = `First Degree complaint for your information, case ${c.id}`;
    body = `${hi}

A First Degree complaint has been filed against a student of your college. Under the College Discipline Board Manual, First Degree offenses are handled first by the respondent's department, so the SAEP Office is informing you.

Respondent: ${c.student} (${c.sid}), ${c.program}
${caseBlock(c)}

Please coordinate with the SAEP Office on the next steps.

${CONFIDENTIAL}

${sign(me)}`;
  } else throw new Error(`Unknown email kind: ${kind}`);

  return { kind, to, cc, subject, body };
}

const EMAIL = /^[^@\s,;]+@[^@\s,;]+\.[^@\s,;]+$/;
/** Split "a@x.com, b@y.com; c@z.com" into a clean list. */
export const addresses = (s) => String(s || '').split(/[;,]/).map((x) => x.trim()).filter(Boolean);

/** A message for the first problem found, or '' when the draft can be sent. */
export function check(d) {
  const to = addresses(d.to), cc = addresses(d.cc);
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
  const q = [d.cc && `cc=${addresses(d.cc).join(',')}`, `subject=${encodeURIComponent(d.subject)}`, d.body && `body=${encodeURIComponent(crlf(d.body))}`].filter(Boolean);
  return `mailto:${addresses(d.to).join(',')}?${q.join('&')}`;
}
