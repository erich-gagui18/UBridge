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
3. Before real use, replace the provisional entries in `public/assets/js/data/offenses.json` with the real list from handbook Section VII, set `"provisional": false`, redeploy Hosting and press **Sync offense list** again.
4. Generate the AI Guide's handbook text (see "AI Guide").

## Make a SAEP Staff account
Sign up as a student, then in Firestore open `users/<uid>` and change `role` to `staff`. Staff can't be self-assigned; the rules only allow student or faculty at sign-up.

## Leftovers
- Set `CONTACT.email` in `public/assets/js/data.js` once you have the SAEP Office email, then redeploy hosting. Until then the floating button opens the FAQ.
- Once the first push succeeds, ask your teammates to clone the repo so there is more than one copy.

## AI Guide (RAG over handbook Sections VII and IX)
1. Put plain-text copies of the sections in `handbook/section-VII.txt` and `handbook/section-IX.txt` (the file name sets the section label).
2. `npm run chunk` writes `public/assets/js/data/handbook.json`. Open it and compare a few chunks with the printed handbook.
3. Firebase console > Build > AI Logic: enable it with the **Gemini Developer API** (the no-cost tier works on Spark). Check the model name in `GEMINI_MODEL` (firebase-config.js) against the console.
4. App Check: create a reCAPTCHA v3 site key, register it under App Check > Apps > Web, paste the **site** key into `RECAPTCHA_SITE_KEY`, redeploy. Watch App Check metrics for a few days, then press **Enforce** for Firestore and AI Logic. Add the `localhost` debug token shown in the console if you test locally.

The guide retrieves the best-matching chunks in the browser, sends only those to Gemini with an "answer only from this context" instruction, and shows the cited section from the chunk data. If Gemini is unavailable it shows the closest handbook text instead.

## Notifications
Staff changes create a document in `notifications/` for the person who filed the case; the bell in the header shows them live. Email would need Cloud Functions or the Trigger Email extension (both Blaze).

## Tests and formatting
    npm install
    npm test            # AI Guide keyword matching (plain Node)
    npm run test:rules  # Firestore rules, in the Emulator Suite (needs Java)
    npm run format      # Prettier (run once before committing; run format:check in review)

## Code layout (`public/assets/js/`)
    app.js            entry point used by pages: UB.* facade, auth state, page shell
    firebase.js       Firebase init, App Check
    firebase-config.js, data.js    configuration and constants
    lib/              dom, dates (Philippine time), local storage, UI (toast/modal), layout (sidebar, bell)
    services/         auth, complaints, notifications, offenses, guide (Gemini), retrieval (pure, tested)
    pages/            one script per page
    data/             offenses.json (catalog seed), handbook.json (AI chunks)

## Data model
See `docs/data-dictionary.md`.
