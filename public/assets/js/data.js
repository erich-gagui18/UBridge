// SAEP Office email (UB Lipa) for the floating 'Contact SAEP' button; it falls back to the FAQ when empty.
// Source: UB College Student Discipline Policy (SAEP M, Revision No. 4, approved 03/25/2026), Process step 1: complaints are filed to SAEP at saep.ubbc@ub.edu.ph (Batangas City) or saep.ublc@ub.edu.ph (Lipa City).
export const CONTACT = { email: 'saep.ublc@ub.edu.ph' };

// Bump this when the text of pages/privacy.html changes in a way users must re-accept.
export const PRIVACY_VERSION = '2026-10g';

// Version printed on pages/terms.html. Keep the two in step (tests/legal.test.mjs checks it).
export const TERMS_VERSION = '2026-10';

// 'rejected' (Not approved) is an intake outcome, not a stage of the process: it is never part of ORDER (the four-step progress bar).
export const STATUS = {
  submitted: 'Submitted',
  review: 'In review',
  hearing: 'For hearing',
  resolved: 'Resolved',
  rejected: 'Not approved',
};
export const ORDER = ['submitted', 'review', 'hearing', 'resolved'];
