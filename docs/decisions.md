# Decisions for the team and the adviser

These change cost, security or scope, so they are not decided in code. Each shows what the code does today and what each option means.

## 1. Where evidence files are stored
Today: `USE_STORAGE = false`. The form says files are not stored and nothing is uploaded or recorded.

| Option | What it means | Watch out for |
|---|---|---|
| **Blaze + Cloud Storage** (already coded; set `USE_STORAGE = true` and deploy `storage.rules`) | Real files, per-file access rules (owner and staff only, 10 MB, PNG/JPG/PDF, verified UB email) | Needs a billing account. A budget alert only *notifies* you; it does not stop spending. Keep App Check on and the 5-file/10 MB limits |
| **Small compressed images in Firestore** | No billing change; evidence lives under the complaint, so the same rules protect it | A document is limited to about 1 MiB, base64 adds roughly a third, PDFs don't fit well. Needs new code (resize in the browser, `evidence` subcollection) and new rules |
| **Third-party host** (Drive, Cloudinary, etc.) | Free or cheap | Sensitive student evidence leaves your Firebase security rules and Google project. Needs the DPO's approval and a data-sharing arrangement. Weakest for the Data Privacy Act story |

Ask the adviser and the SAEP Office: how much evidence is typical, who may hold it, and how long it is kept.

## 2. Email notifications
Email needs Cloud Functions or the Trigger Email extension, both on Blaze. If the team stays on Spark, the in-app bell (already built) is the notification channel. If the team moves to Blaze for evidence anyway, email becomes possible; decide both together.

## 3. Content that only the SAEP Office can supply
- The offense list and process now follow the **College Student Discipline Policy, document SAEP M, Revision No. 4 (revised 03/17/2026, approved 03/25/2026)**, which the team confirmed as current. They are in `public/assets/js/data/offenses.json` and `handbook/discipline-policy.txt`. The earlier Revision No. 7 manual text is kept in `handbook/archive/` for reference only.
- Confirmation from the Registrar's Office that `public/assets/js/data/academics.json` (now Student Handbook Revision No. 8, January 2026) is still current, and whether BS Forensic Science (BSFS) is offered. It is not in Revision No. 8.
- SAEP Office email (`CONTACT.email` is `saep.ublc@ub.edu.ph`, the Lipa address printed in the policy), retention period, and DPO contact for `pages/privacy.html`.

## 4. First Degree offenses and routing (settled by the policy)
The earlier manual said First Degree offenses are filed with the respondent's department. The confirmed policy (Process step 1) says **every complaint is filed to SAEP**, SAEP **initially assesses the degree**, then forwards First Degree offenses to the respondent's department and keeps Second and Third Degree for the College Discipline Board. UBridge now matches this:

- Students and faculty can file any offense; the form tells them SAEP assesses it first.
- Staff record **SAEP assessment: degree of the offense** in the case-handling form. Choosing Second or Third Degree moves the case to the CDB, and the third First Degree commission by the same respondent also goes to the CDB.
- For department cases staff record when the department's decision copy reached the CDB (First Degree Interventions note).

Still not modelled: a department role. Department-level conferences are handled outside UBridge; staff track only the forwarding and the decision copy. Ask the adviser if the department should get its own login.
