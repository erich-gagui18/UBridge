// SAEP Office email (UB Lipa) for the floating 'Contact SAEP' button; it falls back to the FAQ when empty.
// Source: Student Handbook Revision No. 8 (2026), SAEP contacts. Confirm with the SAEP Office. CDB complaint forms go to cdb@ub.edu.ph (CDB Manual § 5.1.1.2).
export const CONTACT = { email: 'saep.ublc@ub.edu.ph' };

// Bump this when the text of pages/privacy.html changes in a way users must re-accept.
export const PRIVACY_VERSION = '2026-10d';

export const STATUS = { submitted: 'Submitted', review: 'In review', hearing: 'For hearing', resolved: 'Resolved' };
export const ORDER = Object.keys(STATUS);
