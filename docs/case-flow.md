# Case flow: from filing to decision

Source: College Student Discipline Policy (SAEP M, Revision No. 4), section PROCESS, steps 1 to 6. "Step N" below is that numbering.

## What each status means
| Status | Meaning | Policy steps |
|---|---|---|
| Submitted | SAEP has the complaint and has not started | 1 (filing) |
| In review | SAEP has assessed it, decided where it goes and is notifying the respondent (and the parent or guardian) | 1 to 3 |
| For hearing | A disciplinary conference is scheduled or being held | 4 |
| Resolved | The decision is made (or the case is closed as outside jurisdiction, or the appeal is tracked) | 5 and 6 |
| Not approved | SAEP decided not to take the complaint forward, before any conference or decision. A reason and a written explanation are recorded and the complainant is told | none: added by UBridge, see below |

## Not approved (UBridge intake outcome, for the SAEP Office to confirm)
The policy's PROCESS section has no step where SAEP declines a complaint, so this outcome is **not in the policy**. It was added so a complaint that cannot be acted on has a clear, recorded end instead of sitting in Submitted or being forced into Resolved.
- **When:** only from Submitted or In review, and only while no conference has been held and no decision recorded. After that the case is decided (Resolved), never rejected.
- **What staff record:** a reason (the case is not an offense under the policy, not enough information or evidence, respondent is not a covered student, duplicate, or belongs with another office) and an explanation of at least 10 characters that the complainant reads.
- **Emails:** the complainant is told (reason and explanation, and that they can file again with more information or visit the SAEP Office). Then each party that was told about the complaint gets its own closing notice, so nobody keeps waiting for a conference: the respondent (if a notice was sent) first, then the department (if it was forwarded the case). The two are separate email kinds (`closure` and `closure-dept`) because a First Degree case can need both. The parent or guardian can be added in Cc. A case that is rejected, reopened and rejected again is told again: only emails sent since the latest rejection count. When a closed case is reopened, the next-step box reminds staff to tell the people who were told it was closed.
- **Reopening:** a not-approved case can only go back to Submitted or In review, with a remark of at least 5 characters. The reason and explanation are cleared.
- **Off-campus cases** found outside the University's jurisdiction are still closed as Resolved (unchanged).

## The path, and what UBridge does at each point
| # | What the policy says | Where it is recorded | Email |
|---|---|---|---|
| 1 | SAEP assesses the degree. First Degree goes to the respondent's department, Second and Third Degree to the CDB. Off-campus or online: check a ground for jurisdiction | Case handling: assessment, Handled by, jurisdiction | Notice to the Dean and Program Head (First Degree) |
| 2 | Written notice with a copy of the complaint and not less than 3 days to answer. No answer means a general denial | Notice sent, Answer due, Respondent's explanation | Notice, then Follow-up |
| 3 | Parent or guardian of a respondent under 18 is notified (older students with their consent) | Parents / guardian notified | Notice to the parent or guardian |
| 4 | Conference, face-to-face or online. Missing two in a row waives the right to attend | Hearing date, mode, conferences held | Conference schedule |
| 5 | Interventions | Interventions (on Resolved) | in the decision email |
| 6 | Decision in writing within 10 days of the last conference, copies to the respondent, parent or guardian, Registrar, VPSAS and President. Effective 5 days after receipt unless appealed. Expulsion needs CHED approval | Decision date, note, appeal | Decision, then Copy of the decision |

Sending an email and recording it is one step: confirming "Yes, I sent it" writes the email record and, for the notice, the parent notice and the department notice, the matching case fields (the screen says which).

## What Update Case refuses and what it only warns about
Refused: Not approved without a reason or an explanation, or once a conference has been held; a conference without a notice date; a conference before the answer deadline when no explanation has arrived; a decision date before the conference; an unassessed "Others" case or an off-campus case without a jurisdiction review going to hearing or resolved.
Warned (the person confirms): resolving without a conference, notice or intervention; a decision later than 10 days after the conference; a general denial before the deadline; skipping a stage.
The Firestore rules still enforce the 3-day minimum, valid dates, the allowed fields and the history entry.

## Not modelled yet (say so in the limitations)
- Each conference separately. One hearing date and a count are kept, so "two consecutive conferences missed" is the staff member's call.
- The CDB members' votes and signatures (at least two members sign the decision). The decision email asks for the signed decision as an attachment.
- A "not responsible" outcome as its own value. Today it is a Resolved case with no intervention and a note that says so (the screen warns when no intervention is chosen).
- Witness statements and the parent or guardian's address. The notice has a bracket for witnesses, and the parent notice asks the staff member to type the address.
- Whether the respondent is under 18 (no date of birth is collected). The Next step box only reminds staff.
- Whether Gmail really delivered the message. UBridge can only see that the draft left Drafts.
