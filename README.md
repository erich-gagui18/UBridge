# UBridge on Firebase (Hosting + Auth + Firestore)

SAEP online complaint management system for UB-Lipa. Plain HTML/CSS/ES-module JavaScript, no build step.

## One-time setup
1. Firebase console: create a project, add a Web app, paste its config into `public/assets/js/firebase-config.js`.
2. Build > Authentication: enable Email/Password and Google.
3. Build > Firestore Database: create it in production mode.
4. Evidence uploads need Cloud Storage (Blaze plan). While `USE_STORAGE = false` the form says plainly that files are not stored. See `docs/decisions.md`.
5. Put your project ID in `.firebaserc`.

## Deploy
    npm i -g firebase-tools
    firebase login
    firebase deploy --only hosting,firestore:rules

Pushing to `main` also deploys Hosting through the GitHub workflow. **Rules are not deployed by that workflow**, so run `firebase deploy --only firestore:rules` yourself whenever `firestore.rules` changes.

## First deploy after the workflow update (do these in order)
1. `firebase deploy --only firestore:rules`
2. Make a SAEP staff account (below), sign in as staff, open **All cases**, and press **Sync offense list**. Students can't file until the `offenses` collection exists.
3. `public/assets/js/data/offenses.json` now holds the 45 offenses of the College Discipline Board Manual (Student Handbook Revision No. 7, First/Second/Third Degree). Confirm with the SAEP Office that the list is still current (see `docs/cdb-alignment.md`), then press **Sync offense list**. Sync also removes catalog entries that are no longer in the file, such as the old placeholders.
4. `handbook.json` is already generated from the manual; run `npm run chunk` again only if `handbook/cdb-manual.txt` changes (see "AI Guide").

## Make a SAEP Staff account
Sign up as a student, then in Firestore open `users/<uid>` and change `role` to `staff`. Staff can't be self-assigned; the rules only allow student or faculty at sign-up.

## Leftovers
- `CONTACT.email` in `public/assets/js/data.js` is set to the UB Lipa SAEP address listed in Handbook Revision No. 8. Confirm it with the SAEP Office. CDB complaint forms are emailed to `cdb@ub.edu.ph` (CDB Manual § 5.1.1.2).
- Once the first push succeeds, ask your teammates to clone the repo so there is more than one copy.

## AI Guide (RAG over the College Discipline Board Manual)
1. The source text is `handbook/cdb-manual.txt`, copied word for word from the manual in Student Handbook Revision No. 7 (pages 1 to 15 of the manual). The file name sets the label shown to users ("CDB Manual"). Other files named `section-VII.txt` style are labelled "Section VII".
2. `npm run chunk` writes `public/assets/js/data/handbook.json` (41 chunks). Open it and compare a few chunks with the printed manual.
3. Firebase console > Build > AI Logic: enable it with the **Gemini Developer API** (the no-cost tier works on Spark). Check the model name in `GEMINI_MODEL` (firebase-config.js) against the console.
4. App Check: create a reCAPTCHA v3 site key, register it under App Check > Apps > Web, paste the **site** key into `RECAPTCHA_SITE_KEY`, redeploy. Watch App Check metrics for a few days, then press **Enforce** for Firestore and AI Logic. Add the `localhost` debug token shown in the console if you test locally.

The guide retrieves the best-matching chunks in the browser, sends only those to Gemini with an "answer only from this context" instruction, and shows the cited section from the chunk data. If Gemini is unavailable it shows the closest handbook text instead.

## Courses and departments
`public/assets/js/data/academics.json` feeds the course and department pickers on the profile page and the respondent section of the complaint form. It lists the eight UBLC colleges and 37 programs from Student Handbook Revision No. 8 (issue date 21 January 2026): Graduate School, College of Law, College of Education, Arts and Sciences, College of Criminal Justice Education, College of Management and Tourism, College of Engineering and Architecture, College of Information Technology, Entertainment and Communication, and College of Health Sciences. Names of the colleges and course labels that were already in the list are unchanged, so saved profiles and complaints still match. BS Forensic Science (BSFS) is not in Revision No. 8; it is kept from the earlier list and should be confirmed with the Registrar's Office (delete its line if it is not offered). Profiles that saved a course no longer in the list open under \"Others (not listed)\" with the saved text intact, and the person can re-pick the course. Redeploy Hosting after editing the file.

## Emails to respondents (staff)
Open a case as SAEP staff and use the **Email** box: pick a message (notice, follow-up, conference schedule, conference summary and decision, or notice to the Dean and Program Head), press **Write email**, edit the draft, then **Open in my email app**. UBridge does not send anything itself. After you send it from your own email app, press **Yes, I sent it** and the case keeps a record (to, subject, text, who, when) in `complaints/{id}/emails`. Parts in [brackets] must be filled in before the draft can be opened. The Cc line starts with `CONTACT.email` from `data.js` so the office keeps a copy. The drafts leave out the complainant's name and the complaint description on purpose. **Deploy the rules** (`firebase deploy --only firestore:rules`) because this adds the `emails` subcollection.

## Notifications
Staff changes create a document in `notifications/` for the person who filed the case; the bell in the header shows them live. Email would need Cloud Functions or the Trigger Email extension (both Blaze).

## Tests and formatting
    npm install
    npm test            # AI Guide keyword matching and the course/department list (plain Node)
    npm run test:rules  # Firestore rules, in the Emulator Suite (needs Java)
    npm run format      # Prettier (run once before committing; run format:check in review)

## Code layout (`public/assets/js/`)
    app.js            entry point used by pages: UB.* facade, auth state, page shell
    firebase.js       Firebase init, App Check
    firebase-config.js, data.js    configuration and constants
    lib/              dom, dates (Philippine time), local storage, UI (toast/modal), layout (sidebar, bell)
    services/         auth, complaints, notifications, offenses, guide (Gemini), retrieval (pure, tested)
    pages/            one script per page
    data/             offenses.json (catalog seed), handbook.json (AI chunks), academics.json (UBLC colleges and programs)

## Data model
See `docs/data-dictionary.md`.
