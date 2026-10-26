# UBridge on Firebase (Hosting + Auth + Firestore)

SAEP online complaint management system for UB-Lipa. Plain HTML/CSS/ES-module JavaScript, no build step. The system itself runs entirely on Firebase. Only the optional AI Guide search service in `ml/` (PyTorch) runs elsewhere; see "PyTorch semantic search".

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
3. `public/assets/js/data/offenses.json` holds the 45 offenses of the UB College Student Discipline Policy (SAEP M, Revision No. 4, approved 03/25/2026: 19 First, 18 Second, 8 Third Degree) with their interventions (see `docs/cdb-alignment.md`). Press **Sync offense list** after deploying so the dropdown shows the updated wording and interventions. Sync also removes catalog entries that are no longer in the file.
4. `handbook.json` is already generated from the policy; run `npm run chunk` again only if `handbook/discipline-policy.txt` changes (see "AI Guide").

## Make a SAEP Staff account

Sign up as a student, then in Firestore open `users/<uid>` and change `role` to `staff`. Staff can't be self-assigned; the rules only allow student or faculty at sign-up.

## Leftovers

- `CONTACT.email` in `public/assets/js/data.js` is `saep.ublc@ub.edu.ph`, the Lipa SAEP address printed in the discipline policy (Process step 1; the Batangas City address is `saep.ubbc@ub.edu.ph`).
- Once the first push succeeds, ask your teammates to clone the repo so there is more than one copy.

## AI Guide (RAG over the College Student Discipline Policy)

1. The source text is `handbook/discipline-policy.txt`, copied word for word from the policy (UB document SAEP M, Revision No. 4, pages 1 to 14; checked against the PDF). `npm run chunk` passes the label shown to users ("College Student Discipline Policy") and the chunk id prefix (`CSDP`).
2. `npm run chunk` writes `public/assets/js/data/handbook.json` (34 chunks). Open it and compare a few chunks with the printed policy. If you use the PyTorch search service, rebuild its index after every `npm run chunk` (the app ignores a stale index, so search falls back to keywords until you do).
3. Firebase console > Build > AI Logic: enable it with the **Gemini Developer API** (the no-cost tier works on Spark). Check the model name in `GEMINI_MODEL` (firebase-config.js) against the console.
4. App Check: create a reCAPTCHA v3 site key, register it under App Check > Apps > Web, paste the **site** key into `RECAPTCHA_SITE_KEY`, redeploy. Watch App Check metrics for a few days, then press **Enforce** for Firestore and AI Logic. Add the `localhost` debug token shown in the console if you test locally.

The guide retrieves the best-matching chunks in the browser, sends only those to Gemini with an "answer only from this context" instruction, and shows the cited section from the chunk data. If Gemini is unavailable it shows the closest policy text instead.

## PyTorch semantic search (optional service)

**Why.** The keyword search only matches shared words. On the draft test set in `ml/eval/questions.jsonl` (70 questions, drafted for the team to review) it finds a correct chunk for 82% of English questions and for 0% of Filipino and Taglish questions, because the policy is English and no words overlap (`ml/artifacts/report.md`, test split). A PyTorch embedding model compares meaning instead of words.

**How it fits.** Everything stays on Firebase except one small Python service:

    AI Guide in the browser
      |-- keyword search (BM25, in the browser, as before)
      |-- question + Firebase login --> PyTorch search service (ml/, hosted outside Firebase)
      v
    both rankings merged (reciprocal rank fusion) -> top 4 chunks -> Gemini writes the answer (unchanged)

The service returns only chunk ids and scores, never policy text or answers. If it is off, asleep, slow (more than 4 seconds), or built from a different `handbook.json`, the guide silently uses keyword search only, exactly as before. When both searches ran, the answer shows "Matched by meaning and keywords."

**What is in `ml/`**

| Path                                   | What it is                                                                                                                                       |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `app/`                                 | The FastAPI service: checks the Firebase login, encodes the question with the model, returns the closest chunk ids                               |
| `eval/questions.jsonl`                 | 70 labelled questions: English and Filipino/Taglish, in scope and out of scope, split into `dev` (for tuning) and `test` (for the final numbers) |
| `evaluate.py`                          | Compares keyword, PyTorch and hybrid search and writes `artifacts/report.md`                                                                     |
| `make_pairs.py`, `train.py`            | Builds training pairs from the offense catalog and the policy headings and fine-tunes the embedding model with a plain PyTorch loop              |
| `build_index.py`                       | Encodes the 34 chunks and writes `artifacts/index.npz` and `artifacts/config.json` (model name, handbook fingerprint, rejection threshold)       |
| `colab/UBridge_AI_Guide_PyTorch.ipynb` | Runs all of the above on Google Colab, where the heavy work happens (a laptop without a GPU is not needed)                                       |
| `Dockerfile`, `README.md`              | Packaging for a Hugging Face Space (Docker) or Google Cloud Run                                                                                  |

**Setup, in order**

1. **Review the test set.** Open `ml/eval/questions.jsonl` and check every `gold` chunk id against `handbook.json` (the ids are `CSDP-nn`; six questions that the policy does not answer are marked `out_of_scope` on purpose, see `CHANGELOG.md`). A question can list several acceptable chunks. Add questions the way students really ask them. Keep the `dev` and `test` split: tune on `dev`, report `test`. After any change run `npm run ml:baseline` to refresh the keyword baseline.
2. **Run the Colab notebook.** Upload the project zip (or set `REPO_URL`), run the cells top to bottom. The smoke test in step 2 must pass first. Step 4 compares ready-made multilingual models, step 5 optionally fine-tunes one, step 6 builds the index. Download `ubridge-ml-artifacts.zip` and copy `index.npz`, `config.json` and `report.md` into `ml/artifacts/`. Commit them.
3. **Create the service.** On huggingface.co make a new Space (SDK: Docker, blank template). Clone it, copy the contents of `ml/` into it (skip `tests`, `eval`, `colab`, `models`), then `git add .`, `git commit`, `git push`. Wait until the Space says Running. Its address is `https://<username>-<space-name>.hf.space`; open `/health` and check that it reports the model and `chunks: 34`. If you fine-tuned a model, publish it to the Hugging Face Hub from the notebook (`HUB_ID`) so the Space can download it. Cloud Run also works with the same Dockerfile but needs a billing account.
4. **Point the app at it.** Set `SEARCH_SERVICE_URL` in `public/assets/js/firebase-config.js` to the Space address (https only; empty means keyword search only). The CSP in `firebase.json` already allows `https://*.hf.space` and `https://*.run.app`; replace those two with your exact address once it is final.
5. **Redeploy Hosting** (`firebase deploy --only hosting` or push to `main`).
6. **Check it.** Sign in, open the AI Guide and ask "Bawal ba manigarilyo sa loob ng campus?". Before the service, keyword search alone returned "couldn't find that"; now the answer should cite the First Degree offenses and show "Matched by meaning and keywords."

**Run it on your own computer (optional)**

    cd ml
    pip install -r requirements-dev.txt
    REQUIRE_AUTH=false uvicorn app.server:app --port 7860        (Windows PowerShell: $env:REQUIRE_AUTH="false"; uvicorn app.server:app --port 7860)
    curl -s localhost:7860/search -H "Content-Type: application/json" -d "{\"question\":\"Bawal ba manigarilyo?\"}"

The browser client only accepts https addresses, so use `curl` for local checks. The first start downloads the model.

**Service settings** (environment variables, all optional)

| Variable                | Default                                        | Meaning                                 |
| ----------------------- | ---------------------------------------------- | --------------------------------------- |
| `FIREBASE_PROJECT_ID`   | `ubridge-76eee`                                | Project whose login tokens are accepted |
| `ALLOWED_ORIGINS`       | the two Hosting addresses and `localhost:5005` | Browsers allowed to call the service    |
| `REQUIRE_AUTH`          | `true`                                         | Set `false` only for local tests        |
| `RATE_LIMIT_PER_MINUTE` | `20`                                           | Per signed-in user                      |
| `TOP_K`                 | `4`                                            | Chunks returned                         |

**Security and privacy.** Every search needs a Firebase ID token from a verified `@ub.edu.ph` account, the same rule as the app. Browsers from other sites are blocked by CORS. The service never logs question text, never stores anything, and never sees complaint records: only the question typed into the AI Guide is sent. The policy text stays in the browser; the service holds only vectors.

**Free hosting limits.** Free Hugging Face Spaces go to sleep when unused and then take a while to wake, so the first question after a quiet period can use keyword search only. Opening the AI Guide wakes the service early. `.github/workflows/ml-keepwarm.yml` also pings `/health` every six hours when you add a repository variable named `SEARCH_SERVICE_URL` (GitHub > Settings > Secrets and variables > Actions > Variables). Check Hugging Face's current free-tier limits before the defense and wake the service a few minutes ahead.

**Evaluation for the paper.** `python evaluate.py --models <model names>` (or the notebook) reports, per system, hit@1, hit@4, MRR@4, the share of in-scope questions that got no result, the share of out-of-scope questions correctly rejected, and hit@4 by language. The rejection threshold is calibrated on `dev` and the numbers are reported on `test`. State the limits plainly: the test set is small (41 in-scope questions), the gold labels were written by the team, training pairs are generated from the same policy text, and the policy is UB document SAEP M, Revision No. 4.

**When `handbook.json` changes** (new revision of the policy, edited text): run `npm run chunk`, then `python build_index.py` (or the notebook) and commit the new `index.npz` and `config.json`, then redeploy the Space. Until then the app notices the mismatch and uses keyword search only.

## Courses and departments

`public/assets/js/data/academics.json` feeds the course and department pickers on the profile page and the respondent section of the complaint form. It lists the eight UBLC colleges and 37 programs from Student Handbook Revision No. 8 (issue date 21 January 2026): Graduate School, College of Law, College of Education, Arts and Sciences, College of Criminal Justice Education, College of Management and Tourism, College of Engineering and Architecture, College of Information Technology, Entertainment and Communication, and College of Health Sciences. Names of the colleges and course labels that were already in the list are unchanged, so saved profiles and complaints still match. BS Forensic Science (BSFS) is not in Revision No. 8; it is kept from the earlier list and should be confirmed with the Registrar's Office (delete its line if it is not offered). Profiles that saved a course no longer in the list open under \"Others (not listed)\" with the saved text intact, and the person can re-pick the course. Redeploy Hosting after editing the file.

## Emails to respondents (staff)

Open a case as SAEP staff and use the **Email** box: pick a message (notice, follow-up, conference schedule, conference summary and decision, or notice to the Dean and Program Head), press **Write email**, edit the draft, then **Create Gmail draft** (once Gmail is set up, see below) or **Open in my email app**. UBridge does not send anything itself. After you send it yourself, press **Yes, I sent it** and the case keeps a record (to, subject, text, who, when) in `complaints/{id}/emails`. Parts in [brackets] must be filled in before the draft can be opened. The Cc line starts with `CONTACT.email` from `data.js` so the office keeps a copy. The drafts leave out the complainant's name and the complaint description on purpose. **Deploy the rules** (`firebase deploy --only firestore:rules`) because this adds the `emails` subcollection.

## Gmail drafts (optional)

With a Google OAuth client ID set, the compose dialog gets a **Create Gmail draft** button. It saves the edited message as a draft in the staff member's own `@ub.edu.ph` Gmail (Gmail API `users.drafts.create`). The staff member opens it from the dialog's **Open draft in Gmail** link, checks it, sends it from Gmail and then presses **Yes, I sent it**, so the case record works exactly as before. If the text is changed and saved again, the same draft is replaced, not duplicated. Without a client ID the button is hidden and **Open in my email app** is used.

- **Permission asked:** `gmail.compose` only (create and replace drafts, send drafts). Google lists it as a *restricted* scope. UBridge never reads the mailbox, never sends by itself, and keeps the access token only in page memory (about an hour).
- **Why not the lighter `gmail.send`:** it can only send, not save a draft for the staff member to review first.
- **Account check:** the draft is only created if the Google account that signed in ends in `@ub.edu.ph`.

**Setup (once, by the project owner)**

1. Google Cloud Console, project `ubridge-76eee` (the Firebase project): APIs & Services > Library > enable **Gmail API**.
2. Google Auth Platform > Audience. Pick **Internal** if the project belongs to the University's Google Workspace organization (no verification, only people in that organization can sign in). Otherwise pick **External** and keep the publishing status on **Testing**, then add every SAEP staff `@ub.edu.ph` address under **Test users** (up to 100; Google shows an "unverified app" screen, press Advanced > Continue, and asks again about every 7 days). Do not press Publish: a restricted scope in production needs Google's security review.
3. Google Auth Platform > Data access > add the scope `https://www.googleapis.com/auth/gmail.compose`.
4. Google Auth Platform > Clients > Create client > **Web application**. Authorized JavaScript origins: `https://ubridge-76eee.web.app`, `https://ubridge-76eee.firebaseapp.com` and, for local tests, `http://localhost:5005`. No redirect URI and no client secret are needed.
5. Paste the client ID into `GMAIL_CLIENT_ID` in `public/assets/js/firebase-config.js` (a client ID is public; never commit a client secret), commit and push to `main`.
6. Test as a staff member: open a case > Email > Write email > **Create Gmail draft** > Allow > open the draft.

| Problem | Likely cause |
|---|---|
| `Error 400: origin_mismatch` | The site address is missing from Authorized JavaScript origins (step 4) |
| `access_denied` or "has not completed the verification process" | The account is not a Test user (step 2), or press Advanced > Continue |
| `org_internal` | The account is outside the Workspace organization that owns the project |
| "Access blocked" by an administrator | The Workspace admin has to allow the app (Admin console > Security > API controls) |
| Message says the Gmail API is not turned on | Step 1 |
| Nothing opens | The browser blocked the Google pop-up; allow pop-ups for the site |

## Notifications

Staff changes create a document in `notifications/` for the person who filed the case; the bell in the header shows them live. Email would need Cloud Functions or the Trigger Email extension (both Blaze).

## Tests and formatting

    npm install
    npm test            # AI Guide keyword matching, hybrid merge, search client, mail drafts, Gmail draft builder and client, case process, offense list, course/department list (plain Node)
    npm run ml:baseline # re-run the keyword baseline over ml/eval/questions.jsonl
    npm run ml:test     # Python tests for the search service (pip install -r ml/requirements-dev.txt first)
    npm run test:rules  # Firestore rules, in the Emulator Suite (needs Java)
    npm run format      # Prettier (run once before committing; run format:check in review)

## Code layout (`public/assets/js/`)

    app.js            entry point used by pages: UB.* facade, auth state, page shell
    firebase.js       Firebase init, App Check
    firebase-config.js, data.js    configuration and constants
    lib/              dom, dates (Philippine time), local storage, UI (toast/modal), layout (sidebar, bell), mail (drafts), gmail (MIME + Gmail API client, pure)
    services/         auth, complaints, notifications, offenses, gmail (Google sign-in for drafts), guide (Gemini), retrieval (pure, tested), dense (PyTorch search client)
    pages/            one script per page
    data/             offenses.json (catalog seed), handbook.json (AI chunks), academics.json (UBLC colleges and programs)

Outside `public/`: `ml/` is the PyTorch search service, training code and evaluation set (Python, not deployed to Hosting); `scripts/` holds the chunker and the keyword baseline.

## Data model

See `docs/data-dictionary.md`.
