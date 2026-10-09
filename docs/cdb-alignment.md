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

## Not modelled (mention in the limitations)
- Written notice to the respondent and the three-day explanation window (§ 5.1.2).
- Notice to parents or guardians of respondents under 18 (§ 5.1.3).
- Appeal to the University President within five days (§ 5.1.6).
- Department-level handling of First Degree offenses (§ 5.1.1.1).

## Verify before real use
1. Revision No. 8 (2026) lists "Student Discipline" under SAEP and a College Discipline Board Committee but does not reprint the manual. Ask the SAEP Office whether the degree classification and the offense list are unchanged.
2. Compare `handbook/cdb-manual.txt` with the printed manual once. Source typos (for example "guild of the offender") are kept on purpose.
3. Offense names in the dropdown are short labels written for UBridge; the manual's own wording is in the AI Guide text and the `section` reference.
