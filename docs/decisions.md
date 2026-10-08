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
- Real offense list, categories and sanctions from Section VII (`public/assets/js/data/offenses.json`; entries are marked provisional).
- Text of Sections VII and IX (`handbook/`), then `npm run chunk`.
- SAEP Office email (`CONTACT.email`), retention period, and DPO contact for `pages/privacy.html`.
