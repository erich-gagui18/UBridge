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
- Confirmation that the First/Second/Third Degree list in the College Discipline Board Manual (Handbook Revision No. 7, 2023) is still the current one. Revision No. 8 (2026) does not reprint the manual. The list is already in `public/assets/js/data/offenses.json` and `handbook/cdb-manual.txt`.
- Confirmation from the Registrar's Office that `public/assets/js/data/academics.json` (now Student Handbook Revision No. 8, January 2026) is still current, and whether BS Forensic Science (BSFS) is offered. It is not in Revision No. 8.
- SAEP Office email (`CONTACT.email` is set to the Lipa address from Revision No. 8; confirm it), retention period, and DPO contact for `pages/privacy.html`.

## 4. First Degree offenses and routing
CDB Manual § 5.1.1 says First Degree offenses are filed with the respondent's department; only Second Degree, Third Degree and the third commission of a First Degree offense go to the SAEP Office. Today the form accepts all 45 offenses and shows a notice when a First Degree offense is chosen.

| Option | What it means |
|---|---|
| **Keep the notice** (current) | Students can still file; SAEP decides where it belongs. Least friction |
| **Hide First Degree** | The dropdown lists only Second and Third Degree plus "Three commissions of First Degree offenses". Matches § 5.1.1.2 exactly, but department-level cases are not tracked in UBridge |
| **Route to departments** | Needs a department role and new rules. Out of scope for the capstone unless the adviser asks |
