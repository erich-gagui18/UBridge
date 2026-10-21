# Changelog

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
