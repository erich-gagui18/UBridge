# Alignment with the College Student Discipline Policy

Source: UB document **SAEP M, Revision No. 4**, "7.0 College Student Discipline Policy" (revision date 03/17/2026, approved 03/25/2026), confirmed by the team as the current policy. It replaces the earlier Student Handbook Revision No. 7 manual as UBridge's source. The word-for-word text is `handbook/discipline-policy.txt` (checked against the PDF); the old text is in `handbook/archive/`.

"Process step N" means the numbered step N of the policy's PROCESS section.

## What changed against the earlier manual, and what UBridge does now
| Policy | Earlier manual | UBridge |
|---|---|---|
| Process 1: every complaint is filed to SAEP (saep.ubbc@ / saep.ublc@ub.edu.ph), SAEP **initially assesses the degree**; First Degree is forwarded to the respondent's department, Second and Third to the CDB | First Degree filed with the department | Anyone can file any offense. Staff record **SAEP assessment: degree** in the case form; Second/Third Degree moves the case to the CDB (enforced by the rules). Cases filed as "Others" show "Awaiting SAEP to assess" until assessed |
| First Degree: the CDB handles the **third commission** | same | Counted per respondent student number, using the assessed degree |
| First Degree Interventions note: the department documents its conference and forwards a copy of the decision to the CDB | not stated | Staff record the date the copy was received (`deptDecisionDate`) |
| Contacts: saep.ubbc@ub.edu.ph / saep.ublc@ub.edu.ph | cdb@ub.edu.ph | `CONTACT.email` = saep.ublc@ub.edu.ph; privacy page and notice emails use it. `cdb@ub.edu.ph` is no longer used |
| Offense wording: First no. 3 "physically or online"; no. 13 "anywhere in the campus"; elevation "as a higher degree offense"; offenses cover social media platforms | older wording | Catalog labels and sanction text updated; AI Guide text regenerated |
| Second Degree suspension: "1 - 3 days suspension or equivalent depending on the gravity of the offense and findings of discipline in-charge" | "1 - 3 days suspension..." | Catalog sanction text updated |
| Process 2: notice has a copy of the complaint with the statement of the complainant and witnesses, not less than 3 days, assistance of counsel, answer filed with the SAEP Office **or** emailed, **general denial** if no answer | email only, no denial wording | Notice and follow-up drafts rewritten. The notice has a `[attached / included below]` placeholder staff must resolve. Rules still enforce at least 3 days |
| Process 4: two missed conferences waive rights and the Board decides | same | Shown in the form hint and the schedule email |
| Process 6: copies of the decision go to the respondent, parent/guardian, **Registrar's Office, VPSAS**, Office of the President; effective in 5 days unless appealed (not for expulsion); President's decision immediately executory except expulsion | respondent, parent, President | Decision email and form hint list all recipients; expulsion shows the CHED approval note instead of an effectivity date |
| OFF-CAMPUS AND ONLINE OFFENSES: the University may act on an off-campus or online offense only if the victim is a member of the campus community, it happened at a sponsored event, the accused used their University status, it seriously impairs the University's objectives, or it tarnishes the school's good name | not modelled | The complaint form asks **where it happened**. Off campus or online needs at least one of the five grounds (word for word from the policy; enforced by the rules). Staff record a **jurisdiction review**: confirmed, or outside (which must close the case with a reason). The dialog, report and history show it |
| The policy applies offenses to the campus, online classes, social media and University activities, and reaches off-campus and online offenses only on the five grounds | not modelled | The offense dropdown follows the place the complainant picks: **on campus** lists all 45 offenses; **off campus or online** lists only the 24 that can happen away from the campus. The rules reject an offense that does not fit the place. **This split is our reading of the policy, not a list printed in it** (see below) |
| Process 5: suspension means reporting daily to the SAEP Office, readmission conditions in writing by the CDB; community service coordinated with the External Programs Coordinator | same | Added to the decision email when those interventions are chosen |

## Matches already in place
- 45 offenses: 19 First, 18 Second, 8 Third Degree, with the interventions for each degree.
- Statuses map to the flowchart: Submitted (filing), In review (SAEP assessment), For hearing (notice, parents, conference), Resolved (interventions, decision, appeal).
- 10-day decision deadline, 5-day effectivity and appeal date, parents notified when under 18, case history and audit trail.
- AI Guide answers only from the policy text and cites the part used.

## How the offenses were split by place
The policy never labels offenses on or off campus. The split in `offenses.json` (`venues`) uses one rule: an offense is **on campus only** when the policy ties it to the campus, the school's facilities or a class (for example smoking "inside the campus", brawl or gambling "inside the campus", littering "anywhere in the campus", uniform, canteen, vandalism of school property: 21 offenses). It is also listed for **off campus and online** when the policy says "online", "cyber", "social media", "in or off the campus", "inside the campus or outside", or the act is not place-bound (bullying, hazing, sexual harassment, assault of personnel, forgery, false reports, fraud, academic dishonesty: 24 offenses). Please have the SAEP Office confirm it; to change an entry, edit `venues` in `offenses.json` and press **Sync offense list**.

## Not modelled (decide with the adviser and SAEP)
- A login for departments: First Degree conferences held by departments happen outside UBridge.
- Off-campus and online jurisdiction is recorded and reviewed by SAEP, but UBridge cannot verify the grounds the complainant ticks. The policy's other two statements (the decision may proceed independently of prosecutors; the University may refer matters to the police) appear as notes only.
- Withholding and revocation of awards and privileges (Process step 7): recorded only in the resolution note.
- CDB voting (at least 2 members) and separate opinions: kept in the written decision, not in the system.
- The F-SAEP-07 form itself: its layout is not in the policy PDF, so the form fields follow what the team already mapped.
