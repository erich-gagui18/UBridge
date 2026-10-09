# Changelog

## v5 (9 October 2026)

### Changed
- `public/assets/js/data/academics.json`: now follows Student Handbook Revision No. 8 (issue date 21 January 2026), UB Lipa City Programs and College Offerings. Eight colleges and 37 programs, in handbook order.
  - Added Graduate School (MAEd majors in Educational Administration, English, Social Studies and Filipino; MBM majors in Business Administration and Human Resource Management), College of Law (Juris Doctor) and College of Health Sciences (BS Nursing).
  - Added BS Accounting Information System (CMT), Bachelor of Elementary Education and Certificate in Teaching Program (CEAS), and BS Entertainment and Multimedia Computing and BS Computer Science (CITEC).
  - Existing college names, program names and codes are unchanged, so saved profiles and complaints still match.
  - BS Forensic Science (BSFS) is not in Revision No. 8. It is kept from v4 and flagged in the file's note; confirm with the Registrar's Office.
  - `provisional` is now `false`.
- `README.md`, `docs/decisions.md`: updated the course and department section and the open confirmation items.

### Tests
- `tests/academics.test.mjs`: added checks that codes and saved labels are unique, that the colleges match Revision No. 8 in order, that every Revision No. 8 program sits under its own college, and that BSFS is the only program outside the handbook. All 14 tests pass with `npm test`.

### Notes
- No change to `firestore.rules`, so no rules deploy is needed. Redeploy Hosting only (push to `main`).
- Graduate School and College of Law students and faculty can now pick their own college. Student numbers are still validated as 7 digits.

## v4 (9 October 2026)

### Changed
- `public/assets/js/data/academics.json`: replaced the provisional list with the five current UBLC colleges and 24 programs.
  - Added College of Criminal Justice Education (BS Criminology, BS Forensic Science, BS Industrial Security Management) and College of Engineering and Architecture (BS Architecture, BS Computer Engineering, BS Industrial Engineering, BS Interior Design).
  - Added Bachelor of Multimedia Arts to the College of Information Technology, Entertainment and Communication.
  - College of Management and Tourism now lists BS Accountancy, BSBA majors in Financial Management, HR Development Management and Marketing Management, BS Entrepreneurship, BS Hospitality Management, BS International Hospitality Management, BS Real Estate Management and BS Tourism Management. The generic BSBA entry was split into its three majors.
  - College of Education, Arts and Sciences is unchanged (six programs). Department names and ids for CEAS, CITEC and CMT are unchanged, so saved profiles and complaints still match.
- `package.json`: `npm test` also runs `tests/academics.test.mjs`.
- `README.md` and `docs/decisions.md`: documented the course and department list and what to confirm with the Registrar's Office.

### Added
- `tests/academics.test.mjs`: checks unique ids, department names under 80 characters, saved course labels under 60 characters (the `firestore.rules` limits), every Revision No. 7 UBLC program is still selectable, and the department list.

### Notes
- Profiles that saved "BS Business Administration (BSBA)" now open that course under "Others (not listed)" with the text kept. The person can re-pick the major.
- No change to `firestore.rules`, so no rules deploy is needed. Redeploy Hosting only.
- Sources: Student Handbook Revision No. 7 Section II (UBLC Colleges and Program Offerings); ub.edu.ph/ublc college pages; UBLC news of 7 September 2026 for the two new CCJE programs. Revision No. 8 was not available.
