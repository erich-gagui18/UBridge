# Changelog

## v14 (28 October 2026)

The sidebar menu and the My profile page are tidied. No change to the rules, the data or what a saved profile contains.

### Changed: sidebar
- **The profile reminder is visible.** A gold dot on "My profile" and "Profile incomplete" under your name, instead of small text that wrapped. Both clear as soon as the profile is saved.
- **Sign out is in the menu** as well as the top bar (it asks first, as before). The brand links to the dashboard. A "Menu" label names the navigation for screen readers.
- **Phone drawer:** a close (X) button, focus moves into the menu when it opens and back to the menu button when it closes, Tab stays inside it, Escape or tapping outside closes it, the page behind does not scroll, and the help button no longer sits on top of it.
- Tidier spacing, visible keyboard focus, long names are cut off with an ellipsis, and the menu scrolls on short screens so the footer is never clipped. The duplicate `.brand` rules in `styles.css` are merged.

### Changed: My profile
- **A real identity card:** large avatar, name, role and status pills, email, and a completion meter ("3 of 5 required details", what is still needed) that fills as you type.
- **Grouped sections** (Personal, School or Office, Contact) instead of two cards numbered 1 and 2 with the identity block squeezed into the first.
- **Mistakes show next to the field** when you leave it, using the same rules as Save, so they cannot disagree. Save still stops at the first problem and focuses it.
- **A save bar** with "Unsaved changes" and a "Saved" confirmation, and the browser asks before you close the page with unsaved edits. The "Complete your profile" notice now has space under it.

### Tests
- `tests/shell-ui.test.mjs` (5 tests; `npm test` runs 111): sidebar markup and drawer behaviour, one definition per sidebar rule, the profile page ids, and that blur and Save share one set of rules.

### Notes
- Hosting only (push to `main`). Checked in a browser with Firebase stubbed: 26 checks (desktop, staff, phone drawer, keyboard, validation, meter, save). Not run: saving to real Firestore.

## v13 (28 October 2026)

The case view (My complaints / All cases) is reorganised so a case can be read, updated and followed up without hunting. No change to the rules, the data or what Save does.

### Changed
- **One clear header.** "← All cases" at the top (it used to be a Close button at the bottom), the case number with Copy, the offense, Filed / Incident / Updated dates, and the status and degree chips.
- **"Next step" is a real banner above the tabs** (it was unstyled text inside two tabs). Coloured by what it needs (next step, waiting, needs attention, done), with the email button for the step and "Open Update Case".
- **Case Details & History** is four cards (Complaint, Case handling, Respondent, Complainant) beside a sticky History card, instead of one 18-row list. On a phone the cards stack. A history entry that did not change the status now reads "Update · In review" instead of "In review → In review".
- **Update Case** is grouped into Status and note, Assessment and routing, Notice and answer, Conference, and Decision and appeal. **Save changes** sits in a bar at the bottom of this tab only (it used to float over every tab and hide the Respondent's explanation row), with an "Unsaved changes" note. Going back with unsaved edits asks first.
- **Email Drafts** shows the message picker (suggested one marked) next to the list of recorded emails, newest first, with a count on the tab. The compose dialog puts To and Cc side by side.
- Tabs are proper tabs (arrow keys, Home and End, screen-reader roles). The page no longer widens on a phone.
- `styles.css`: three layered override blocks for the case page replaced by one block ("Case page") at the end of the file.

### Tests
- `tests/case-ui.test.mjs` (3 tests; `npm test` runs 106): one definition per case-page rule, every update-form field id kept, Save only on the Update tab, next step above the tabs, discard confirmation.

### Notes
- Nothing to deploy except Hosting (push to `main`).
- Checked in a browser with Firebase stubbed: 23 checks (tabs, keyboard, unsaved note, all form ids, discard prompt, compose layout, filer view, no sideways scroll on a phone). Not run: saving to real Firestore.

## v12 (28 October 2026)

Brings the public pages in line with Google's home page requirements for the OAuth branding check ([help page](https://support.google.com/cloud/answer/13807376)).

### Changed
- **`public/index.html` is now a real home page** instead of a redirect to the login page. Google requires the home page to be a static URL that does not redirect, is visible without signing in, describes the app, explains why it asks for Google data, and links to the privacy policy. It covers what UBridge does, who can use it, how Google sign-in and the optional Gmail drafts use Google data, and links to the Privacy Notice, Terms of Use and sign-in. The Search Console verification tag stays on this page.
- **Home page URL for the consent screen is now `https://ubridge-76eee.web.app/`** (README step updated). The sign-in page stays at `pages/login.html`.
- **`pages/privacy.html` (version `2026-10g`, `PRIVACY_VERSION` bumped):** new "Google user data" section (what Google gives UBridge, exactly how the `gmail.compose` permission is used, what is kept, the Google API Services User Data Policy Limited Use statement, how to remove access). The "Case records" line now mentions the staff-only record of emails SAEP staff say they sent, which was stored but not disclosed.
- `legal.js` also serves the home page (theme). Home page styles are in `styles.css`.

### Case flow follow-ups (v11)
- **The sent email and the case update are one commit.** Confirming "Yes, I sent it" used to write the email record first and the case change second, so a dropped connection could leave an email on record with no notice date. `recordEmailAndUpdate` (in `services/complaints.js`) writes the email, the case change, its history and audit entries and the notification in one batch; if it fails nothing is saved and the person can try again.
- **The Gmail check is now disclosed.** `draftExists` asks Gmail whether UBridge's own draft is still in Drafts (it never reads a message). The home page, Privacy Notice and README said the mailbox is never read, so they now say exactly this.
- A draft that is no longer in Drafts is not proof of sending (it may have been deleted), so it is not treated as proof: only the person's own "Yes, I sent it" records the email.

### Tests
- `tests/legal.test.mjs` (9 tests; `npm test` runs 103): the home page has no redirect, is not an app page, keeps the verification tag, links the policies and the Google data section, and the privacy notice carries the Google data disclosure.

### Notes
- No change to `firestore.rules` since v11; deploy `firebase deploy --only hosting,firestore:rules` once for v11's `parents` and `copy` email kinds (push to `main` deploys Hosting only).
- The privacy wording about Gmail is written from what the code does today (it reads the account's email address and creates or replaces drafts; nothing else). Have the DPO review it, and update it if the Gmail feature changes.
- Google also requires the home page to be on a domain you own and have verified. That is a console step (Search Console) and, if Google will not accept `web.app`, a University-owned domain.

## v11 (27 October 2026)

Update Case and Email Drafts now work as one flow that follows the policy's PROCESS section, instead of two separate forms.

### Changed
- **Update Case and the emails are connected.** Confirming "Yes, I sent it" now also updates the case: the notice records the notice date, a three-day answer deadline (the draft already names it) and moves a Submitted case to In review; the parent notice records the date; the department notice moves a Submitted case to In review. The confirmation screen says what will be recorded before you confirm. Before this, staff entered the same facts twice, and a notice written before the dates were saved went out without a deadline.
- **Save keeps the dialog open.** It used to close, so staff had to reopen the case to write the email. The box and the Email tab now refresh with the saved case.
- **Unsaved edits cannot go into an email.** Writing an email while Update Case has unsaved changes asks you to save first.
- **Update Case checks the process before saving** (`checkMove` in `lib/process.js`). Refused: a conference without a notice date; a conference before the answer deadline when no explanation has arrived; a decision date before the conference; "Others" cases not yet assessed, or off-campus cases without a jurisdiction review, going to hearing or resolved. Warned (shown in the confirmation, staff may continue): resolving without a conference, notice or intervention; a decision more than 10 days after the last conference; a general denial entered before the deadline; skipping a stage.
- **The suggested email follows the case**, not only its status: a First Degree case starts with the notice to the Dean and Program Head, and a resolved case with the decision, then the copies.
- **Yes, I sent it checks Gmail.** If the draft is still in Drafts, the person is asked before it is recorded as sent (`draftExists`, works with the draft-only scope).

### Added
- **Next step box** (`nextStep` in `lib/process.js`) at the top of Update Case and Email: what the policy needs now (assess, review jurisdiction, notice, wait for the answer or enter the general denial, schedule, conference, decision, copies, appeal), with a button for the matching email and a reminder about the parent or guardian (Process step 3).
- **Two emails the policy requires:** notice to the parent or guardian (Process step 3) and the copy of the decision to the Registrar's Office, the VPSAS and the Office of the President (Process step 6). New `kind` values `parents` and `copy`.
- **Optional complaint statement in the notice** (Process step 2 says the notice carries a copy of the complaint): a tick box in the compose dialog, off by default. The complainant's name is never added. The witnesses line stays a [bracket] until staff settle it.
- `docs/case-flow.md`: the end-to-end flow, which statuses mean what, and what is still not modelled.
- Tests: 12 new (process flow, move checks, email effects, new email kinds, `draftExists`) in `npm test`, which now runs 99; one new rules test. A browser run with Firebase and Google stubbed checked 29 points of the flow end to end.

### Notes
- **Deploy the rules too:** `firebase deploy --only hosting,firestore:rules`. The emails rule accepts the two new kinds.
- Not run where this was prepared: the real Google sign-in and Gmail calls, `npm run test:rules` (needs the emulator), `npm run format`.
- No new fields on the complaint, so older cases work unchanged.

## v10 (26 October 2026)

The Privacy Notice and Terms of Use links now work and are part of the app, not just pages that exist.

### Fixed
- **The Privacy Notice and the Terms of Use opened as blank pages.** `styles.css` hid `<main>` on every page without `.ready`, and only app pages ever get that class, so both legal pages were invisible to everyone (including Google's branding check). The rule is now `body[data-page]:not(.ready):not(.auth) main`, so only signed-in app pages are gated.
- `pages/privacy.html` said version `2026-10c` while `PRIVACY_VERSION` (saved on every complaint) was `2026-10e`; the page now says `2026-10e`.
- Legal links were the browser's default blue (hard to read in dark mode); they now use the app's maroon, gold in dark mode.

### Added
- **Sign-up asks for agreement.** An "I agree to the Terms of Use and have read the Privacy Notice" box on the sign-up form (not on sign-in); the account is not created until it is ticked. A new Google account gets the same notice in its confirmation dialog.
- **Links inside the app:** Privacy Notice and Terms of Use at the bottom of the sidebar on every signed-in page, and the complaint consent now names both documents.
- All of these open in a new tab, so a half-filled sign-up or complaint form is not lost.
- `pages/legal.js`: the legal pages follow the light or dark theme chosen in the app. It does not import `app.js`, so signed-out visitors are not redirected to sign-in.
- `TERMS_VERSION` in `data.js`, and `tests/legal.test.mjs` (7 tests, in `npm test`, which now runs 87): the version on each page matches its constant, the legal pages are not hidden, the links exist and open in a new tab, and sign-up requires the box.

### Notes
- No change to `firestore.rules`; redeploy Hosting only (push to `main`).
- Agreement at sign-up is enforced in the browser and is not stored on the account (the `users` rules accept only `name`, `email`, `role`, `createdAt`). The accepted privacy version is still saved with each complaint. Storing it per account would need a rules change.
- Checked in a real browser with the Firebase libraries stubbed (23 checks: sign-up blocked and allowed, sidebar links, dark theme, back link, mobile width). Real sign-in was not exercised.

## v9 (26 October 2026)

SAEP staff can save an email as a draft in their own Gmail from the **Email Drafts** box. Off until `GMAIL_CLIENT_ID` is set; the email-app link keeps working either way.

### Added
- `lib/gmail.js` (pure): RFC 2822 message builder (UTF-8 body in base64, RFC 2047 subject, CRLF, header-injection safe) and a Gmail API client with injectable `fetch` and token: create draft, replace the earlier draft instead of duplicating, retry once on an expired token, plain error codes.
- `services/gmail.js`: Google Identity Services token flow for the single scope `gmail.compose`, token kept in memory only, account must end in `@ub.edu.ph`.
- `tests/gmail.test.mjs` (18 tests, in `npm test`, which now runs 80, all passing). Includes a round trip of all five real UBridge drafts.
- `pages/terms.html`: Terms of Use (draft for the SAEP Office to review), for the Google Auth Platform branding. Linked from the login page footer and the privacy page; the login page also links the Privacy Notice now.
- README "Gmail drafts (optional)" with the Google Cloud setup and a troubleshooting table; `docs/decisions.md` section 6.

### Changed
- `pages/my-complaints.js`: compose dialog has **Create Gmail draft** (primary when enabled) next to **Open in my email app** and **Copy text**; after saving it shows **Open draft in Gmail**, then the same "Did you send it?" confirmation and log as before.
- `app.js`: `UB.gmail`. `firebase-config.js`: `GMAIL_CLIENT_ID` (empty).
- `firebase.json` CSP: `script-src https://accounts.google.com/gsi/client`, `style-src https://accounts.google.com/gsi/style`, `connect-src https://accounts.google.com/gsi/` (the Gmail API itself is already covered by `https://*.googleapis.com`).
- `pages/privacy.html`: lists Gmail as a recipient for staff who use the button. `lib/mail.js` header comment.

### Notes
- No change to `firestore.rules`; redeploy Hosting only.
- Needs Google Cloud setup first (README). `gmail.compose` is a restricted scope: use an Internal app, or External in Testing with named staff; do not publish.
- Not run where this was prepared: the real Google sign-in and Gmail calls (they need your client ID), `npm run format`, `npm run test:rules`.

## v8 (21 October 2026)

Adds the optional PyTorch semantic search for the AI Guide (prepared as a separate "v7" branch) on top of the deployed v7 (College Student Discipline Policy). The app works exactly as before until `SEARCH_SERVICE_URL` is set.

### Added

- **PyTorch semantic search for the AI Guide** (optional).
  - `ml/app/`: FastAPI search service. Verifies the Firebase ID token (verified `@ub.edu.ph` accounts only), CORS limited to the Hosting origins, 20 requests per user per minute, returns only chunk ids and scores, never logs questions. `/health` for warm-up.
  - `ml/build_index.py`, `ml/evaluate.py`, `ml/make_pairs.py`, `ml/train.py`: index building with a calibrated rejection threshold, BM25 vs PyTorch vs hybrid evaluation, training-pair generation, and a plain PyTorch fine-tuning loop (in-batch negatives, seeded, dev-split model selection).
  - `ml/eval/questions.jsonl`: 70 labelled questions (58 English, 12 Filipino/Taglish; `dev` and `test` splits), re-labelled for the policy text (see Changed). Drafted for the team to review.
  - `ml/colab/UBridge_AI_Guide_PyTorch.ipynb`: smoke test, baseline, model comparison, fine-tuning, index build and download on Google Colab.
  - `ml/Dockerfile`, `ml/README.md`: packaging for a Hugging Face Space (Docker) or Cloud Run.
  - `public/assets/js/services/dense.js`: search client with a 4 second timeout, version and content-fingerprint check, and warm-up. `retrieval.js` gains `fuse` (reciprocal rank fusion), `mergeHits` and `contentHash`.
  - `.github/workflows/ml-keepwarm.yml`: pings the service every six hours when the repository variable `SEARCH_SERVICE_URL` is set.
  - `scripts/bm25-baseline.mjs` and `npm run ml:baseline`.
- Tests: `tests/fusion.test.mjs` and `tests/dense.test.mjs` (in `npm test`, which now runs 62 tests, all passing); `ml/tests/` (`npm run ml:test`).

### Changed

- `guide.js`: runs keyword and semantic search in parallel and merges them; the Gemini answer step is unchanged. Results carry `retrieval: 'hybrid' | 'keyword'`. The policy scope text, prompt and fallback wording from v7 are kept.
- `pages/ai-guide.js`: wakes the service when the page opens; shows "Matched by meaning and keywords." when both searches ran.
- `firebase-config.js`: new `SEARCH_SERVICE_URL` (empty by default). `firebase.json`: CSP `connect-src` allows `https://*.hf.space` and `https://*.run.app`; tighten to your exact address once it is final.
- **ML code and evaluation set re-pointed from the Revision No. 7 manual (`CDB-nn`, 41 chunks) to the policy (`CSDP-nn`, 34 chunks):**
  - `ml/make_pairs.py` now reads the policy's offense labels ("First Degree Offenses, no. 4") and finds the offense and intervention chunks by their titles, so a re-chunk cannot leave stale chunk ids. All 45 offenses map to a chunk (303 training pairs).
  - `ml/eval/questions.jsonl`: every `gold` id was re-assigned by reading the policy chunks. Six in-scope questions about topics the policy text does not contain (confidentiality of case information, release of transcripts, joining student organizations, academic standing, general student duties, general student rights) are now `out_of_scope` hard negatives. One question was reworded to match the policy ("What are the purposes and objectives of the discipline policy?"). Question ids, languages and splits are unchanged. All labels are still the team's to review.
  - `ml/artifacts/bm25_results.json` and `report.md` regenerated on the policy: keyword search, test split, hit@4 68.3% overall, 82.4% English, 0.0% Filipino/Taglish, MRR@4 0.628, 72.7% of out-of-scope questions rejected.
  - `ml/tests/test_helpers.py`: pair-generation test updated to the policy format, plus a test for the title-based interventions lookup.
- `package.json` (`ml:baseline`, `ml:test`, new tests in `npm test`), `.gitignore`, `.prettierignore`, `README.md`, `docs/decisions.md` (section 5), `docs/chapter3-update.md`.
- `pages/privacy.html`: lists the optional search service as a recipient of the AI Guide question (wording is conditional on the service being switched on; have the DPO confirm it before enabling).
- `README.md` said the handbook had 41 chunks; `handbook.json` has 34. Corrected.
- `docs/chapter3-update.md`: removed a stray "(Revision No. 7, 2023)" left in the AI service paragraph.

### Notes

- No change to `firestore.rules`. Redeploy Hosting only.
- No semantic index exists yet. Run the Colab notebook, commit `index.npz`, `config.json` and `report.md` into `ml/artifacts/`, host the service, then set `SEARCH_SERVICE_URL`. Until then the guide uses keyword search only.
- Not run where this version was prepared: the PyTorch code (`train.py`, the real encoder, service start-up with a model) and the FastAPI service tests, because PyTorch, FastAPI and pytest were not installed and there was no network. Run `ml/tests/test_train_smoke.py` first (the notebook does).

## v7 (21 October 2026)

### Changed

- **Source is now the UB College Student Discipline Policy** (document SAEP M, Revision No. 4, revised 03/17/2026, approved 03/25/2026). The earlier Revision No. 7 manual text moved to `handbook/archive/`.
  - `data/offenses.json`: 45 offenses re-checked against the policy; item wording, section labels ("First Degree Offenses, no. 4") and interventions updated. Ids are unchanged so existing complaints still match. Press **Sync offense list** after deploying.
  - `data/handbook.json`: regenerated from `handbook/discipline-policy.txt` (`npm run chunk`); AI Guide scope, prompts and page text now name the policy.
  - Contacts: `saep.ublc@ub.edu.ph` replaces `cdb@ub.edu.ph` everywhere.
  - Email drafts follow the policy: counsel, answer to the SAEP Office or by email, general denial, two missed conferences, decision copies to the Registrar's Office and VPSAS, expulsion needs CHED approval, suspension and community service conditions.
  - References such as "CDB Manual § 5.1.x" became "Process step N".
- Process: the third First Degree commission is counted using the assessed degree.

### Added

- **SAEP assessment** (Process step 1): staff record the degree of the offense; Second and Third Degree move the case to the CDB. New fields `assessedDegree` and `deptDecisionDate` (rules, UI, report, data dictionary).
- **Off-campus and online offenses** (policy section of that name): the complaint form asks where it happened; an off-campus or online offense needs at least one of the policy's five grounds, shown to staff, who record a jurisdiction review (confirmed, or outside, which closes the case). New fields `venue`, `jurisdiction`, `jurisdictionReview`; the staff report gets a "Place" column.
- The filing form asks the place **once**: a two-way toggle (on campus or a University activity / off campus or online) sets the context, and the single location box changes its hint and placeholder to match (room or building, or place or platform). The five jurisdiction grounds appear only for off campus.
- **The offense list follows the place.** On campus shows all 45 offenses; off campus or online shows the 24 that can happen away from the campus (new `venues` field in the catalog, rules and tests). Changing the place clears a pick that no longer fits and says so. The split is our reading of the policy; see `docs/cdb-alignment.md`. Press **Sync offense list** after deploying.
- `tests/process.test.mjs` (11 tests), new mail tests, and 14 new rules tests.

### Notes

- Deploy Firestore rules with Hosting: `firebase deploy --only hosting,firestore:rules`, then press **Sync offense list**.
- Rules tests need the Firebase emulator (`npm run test:rules`) and were not run in this build.
- See `docs/cdb-alignment.md` for the clause-by-clause comparison and what is still not modelled.

## v6 (9 October 2026)

### Added

- **Email drafts for SAEP staff** in the case dialog: notice to the respondent, follow-up when no explanation arrives, conference schedule, conference summary and decision, and notice to the Dean and Program Head. Staff edit the draft, open it in their own email app and send it themselves. After sending, staff confirm and the case records the email.
  - `public/assets/js/lib/mail.js`: templates, validation (address check, no unfinished [brackets], length limits) and the mailto link. Long drafts open without the body and the body is copied instead.
  - `complaints/{id}/emails` subcollection, append-only and staff only (`firestore.rules`).
  - `services/complaints.js`: `logEmail`, `watchEmails`; `app.js` exposes them with `UB.mail`.
- Tests: `tests/mail.test.mjs` (10 tests, in `npm test`) and 10 new cases in `tests/rules.test.mjs`.

### Notes

- **Deploy the Firestore rules** as well as Hosting (`firebase deploy --only hosting,firestore:rules`). The workflow does not deploy rules.
- UBridge cannot tell whether the message was delivered, only that the staff member confirmed sending it.
- The rules tests were written but not run in this build (they need the Firebase emulator). Run `npm run test:rules` before deploying.

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
