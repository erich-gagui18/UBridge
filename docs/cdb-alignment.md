# CDB Manual alignment (Student Handbook Revision No. 7)

Source: UB Student Handbook, Revision No. 7 (issue date April 11, 2023), College Discipline Board Manual (handbook pages 134 to 154 of the PDF; manual pages 1 to 15).

## What the system now follows
| Manual | UBridge |
|---|---|
| § 4.1, 4.3, 4.5: First (19), Second (18), Third (8) Degree offenses | `public/assets/js/data/offenses.json`, 45 entries, ids `cdb-<section>`; category names are the degrees; dropdown grouped by degree |
| § 4.2, 4.4, 4.6: interventions per degree | `sanction` field per offense, text copied from the manual (vandalism adds the restoration payment of § 4.4.3) |
| § 5.1.1: complaint form F-SAEP-07; Second/Third Degree and third commission of First Degree go to SAEP or `cdb@ub.edu.ph` | Form footer; a notice appears when a First Degree offense is selected |
| § 5.1.2 to 5.1.6: notice, explanation (not less than 3 days), conference, decision within 10 days | Status pipeline Submitted, In review, For hearing, Resolved with hearing date and resolution note |
| § 3.4.8 to 3.4.10: Data Privacy Act, consent by filling the form | Consent checkbox and wording, privacy notice, Firestore rules |
| Whole manual | `handbook/cdb-manual.txt` (verbatim) chunked into `handbook.json` for the AI Guide |

## Case handling added in v3 (staff record it in the case dialog)
| Manual | UBridge |
|---|---|
| § 5.1.1.1 and 5.1.1.2: First Degree with the respondent's department; Second, Third Degree and third commission of a First Degree with SAEP/CDB | `route` (`department` or `cdb`) is set when the complaint is filed from its degree and checked by the rules. Staff can escalate to `cdb`, never back. The case dialog shows the respondent's First Degree commission count, so a third commission is flagged |
| § 5.1.2: written notice, at least 3 days to answer, general denial if no answer | `noticeDate`, `answerDue` (rules require at least 3 days after the notice), `answer`. After the due date with no answer the case shows that a general denial applies |
| § 5.1.3: notice to parents or guardians | `parentsNotified` date |
| § 5.1.4: disciplinary conference, face-to-face or online | Hearing date, `conferenceMode`, `conferencesHeld` |
| § 5.1.6: decision within 10 days of the last conference, effective 5 days after receipt unless appealed | `decisionDate` (required to resolve), `interventions` (the 7 of § 5.1.5), written decision in the resolution note. The dialog shows the 10-day decision due date and the 5-day effective date |
| § 5.1.6: appeal to the University President | `appeal` (filed, upheld, modified, reversed) and `appealDate`, only after a decision |

Each change goes through the existing batch: history entry (with an automatic plain-language remark), staff-only audit entry and an in-app notification to the filer.

## Still not modelled (mention in the limitations)
- Respondent login or an upload of the respondent's explanation (staff only record that it was received).
- A department-head role. First Degree cases are still filed to SAEP, which records the department's handling.
- Automatic computation of the parent-notice requirement from the respondent's age (staff decide).
- Two consecutive missed conferences waiving the respondent's rights (staff keep the count and decide).

## Verify before real use
1. Revision No. 8 (2026) lists "Student Discipline" under SAEP and a College Discipline Board Committee but does not reprint the manual. Ask the SAEP Office whether the degree classification and the offense list are unchanged.
2. Compare `handbook/cdb-manual.txt` with the printed manual once. Source typos (for example "guild of the offender") are kept on purpose.
3. Offense names in the dropdown are short labels written for UBridge; the manual's own wording is in the AI Guide text and the `section` reference.
