# Chapter 3: replacement text for the real stack

Edit to match your voice and the adviser's comments. Keep claims limited to what the system really does.

## Technical architecture (replaces the PHP/MySQL/Material Design 3 description)

UBridge is a static web application served from Firebase Hosting. The browser runs plain HTML, CSS and JavaScript modules and talks directly to Firebase services; there is no application server of our own. The layers are:

1. **Presentation:** HTML pages and one JavaScript module per page, styled with a custom stylesheet that follows the university colours, supports a dark theme and meets keyboard and screen-reader basics (skip link, labelled controls, focus handling). The interface is our own design and is not an implementation of Material Design 3.
2. **Application logic:** JavaScript services in the browser (authentication, complaints, offense catalog, notifications, AI Guide retrieval).
3. **Data and security:** Firebase Authentication (email/password and Google, limited to @ub.edu.ph with verified email), Cloud Firestore for records, and Firestore Security Rules that enforce roles, ownership, validation and audit-trail integrity on the server side. Firebase App Check limits use of the backend to this site.
4. **AI service:** Firebase AI Logic calling a Gemini model. Retrieval runs in the browser over chunks of the UB College Student Discipline Policy (document SAEP M, Revision No. 4, approved March 25, 2026); only the retrieved chunks are sent to the model, which is instructed to answer only from them. The interface shows the section used. The offense catalog uses the manual's classification (First, Second and Third Degree offenses, 45 in total) and its interventions. For meaning-based retrieval the browser also queries a small search service written in Python with PyTorch, hosted outside Firebase (see `docs/decisions.md`, section 5). It holds only vector representations of the policy chunks and returns chunk identifiers; the policy text, the complaint records and the answer generation stay as described above. Its result is merged with the keyword ranking, and if it is unavailable the keyword ranking is used alone.

State clearly in the limitations that Cloud Storage and email notification depend on the Blaze plan; currently in-app notifications are used and evidence upload is switched off (see `docs/decisions.md`).

## Database design (replaces the ERD)

Use `docs/data-dictionary.md` as the data dictionary. Describe collections `users`, `offenses`, `complaints` (with subcollection `history`), `notifications` and `counters`. Explain the choices: Firestore is a document database, so related records are stored as documents and subcollections rather than joined tables; the case number counter is updated in a transaction; history entries are append-only.

## Real-time tracking

Case lists and notifications use Firestore `onSnapshot` listeners, so status changes appear without refreshing (this supports the Chapter 1 claim).

## Security evidence for ISO/IEC 25010 (Security)

Cite the automated tests in `tests/rules.test.mjs` (run with `npm run test:rules` and attach the output):

| Characteristic  | What the tests show                                                                                                                                                                                                                                                                                                                                                  |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Confidentiality | Only the filer and staff can read a complaint or its history; other students are denied; unverified or non-UB accounts are denied                                                                                                                                                                                                                                    |
| Integrity       | The filing date must equal the server's Philippine date (no backdating); evidence entries must point into the filer's own folder; category must match the offense catalog (First, Second or Third Degree from the College Discipline Board Manual); invalid, spoofed or extra fields are rejected; case numbers must match the counter; nobody can delete complaints |
| Non-repudiation | Every staff change needs an append-only history entry (what changed) and a staff-only audit entry (who changed it, with server time); neither can be edited or deleted. Moving a case back needs a written remark                                                                                                                                                    |
| Accountability  | `updatedBy`, `hCount` and the history trail identify who changed a case                                                                                                                                                                                                                                                                                              |
| Authenticity    | Roles cannot be self-assigned or changed from the browser; staff is set only in the console                                                                                                                                                                                                                                                                          |

Say plainly that rules tests cover the database layer. They do not replace a penetration test.

## UI chapter

Replace Material Design 3 screenshots with screenshots of the deployed pages: sign-in, file complaint (with privacy consent), My complaints / All cases (with history, hearing date, resolution), dashboard, AI Guide with cited section, notification bell.

## AI Guide retrieval: PyTorch component

**Design.** Each policy chunk and each question is converted to a vector by a multilingual sentence-embedding model (built on PyTorch with the sentence-transformers library). Chunks whose vectors are closest to the question's vector are retrieved. This is combined with the existing BM25 keyword ranking by reciprocal rank fusion (constant 60), so a chunk found by both methods ranks first. The merged top four chunks go to Gemini exactly as before. A similarity threshold, calibrated on a held-out development set, stops the semantic search from returning chunks for questions the policy does not cover. Optionally the embedding model is fine-tuned with a PyTorch training loop on question and chunk pairs generated from the 45-offense catalog and the policy headings (contrastive loss with in-batch negatives, fixed random seed, model chosen by the development split).

**Instrument.** `ml/eval/questions.jsonl`: 70 questions written by the proponents, 58 in English and 12 in Filipino or Taglish, 52 answerable from the policy and 18 not (six of the 18 are student-rights and records questions that sound like handbook questions but have no answer in the policy text), each answerable question labelled with the acceptable chunk identifiers. The set is split into development (tuning) and test (reporting).

**Measures.** hit@1 and hit@4 (a correct chunk is first, or among the first four), MRR@4, the share of answerable questions with no result, the share of unanswerable questions correctly rejected, and hit@4 by language.

| System                               | hit@1                                 | hit@4 | MRR@4 | No result | Rejected | hit@4 en | hit@4 tl |
| ------------------------------------ | ------------------------------------- | ----- | ----- | --------- | -------- | -------- | -------- |
| Keyword (BM25), test split           | 58.5%                                 | 68.3% | 0.628 | 24.4%     | 72.7%    | 82.4%    | 0.0%     |
| PyTorch embeddings, ready-made model | fill in from `ml/artifacts/report.md` |       |       |           |          |          |          |
| PyTorch embeddings, fine-tuned       |                                       |       |       |           |          |          |          |
| Hybrid (BM25 + embeddings)           |                                       |       |       |           |          |          |          |

**Limitations to state.** The test set is small and its labels were written by the same team that built the system; training pairs are generated from the same policy text, so fine-tuning results measure retrieval within this policy and not general language ability; the policy is UB document SAEP M, Revision No. 4; the service is hosted on a free tier that may sleep, in which case the guide uses keyword search only.
