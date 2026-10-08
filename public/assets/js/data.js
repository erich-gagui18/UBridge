// Set the SAEP Office email to enable the floating 'Contact SAEP' button (falls back to the FAQ when empty).
export const CONTACT = { email: '' };

// Bump this when the text of pages/privacy.html changes in a way users must re-accept.
export const PRIVACY_VERSION = '2026-10b';

export const STATUS = { submitted: 'Submitted', review: 'In review', hearing: 'For hearing', resolved: 'Resolved' };
export const ORDER = Object.keys(STATUS);
