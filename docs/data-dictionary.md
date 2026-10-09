# UBridge Firestore data dictionary

Cloud Firestore is a document database, so this replaces the ERD in Chapter 3. Types are Firestore types.

## users/{uid}
| Field | Type | Notes |
|---|---|---|
| name | string (1–120) | Display name |
| email | string | Must equal the Auth email; @ub.edu.ph only |
| role | string | `student`, `faculty` or `staff`. Clients can only create `student` or `faculty`; `staff` is set in the console. Immutable from clients |
| createdAt | timestamp | Server time |
| sid | string | Student no. (7 digits, required for students) or employee no. (optional, faculty). Editable in My profile |
| course | string (≤60) | Students: saved program label, e.g. `BS Information Technology (BSIT)` |
| section | string (≤20) | Students, optional: year and section, e.g. `4B` |
| dept | string (≤80) | Students and faculty: department (college) name |
| position | string (≤80) | Staff (required) and faculty (optional) |
| contact | string | Contact no., 7–20 digits/`+()-`/spaces. Required for every role |
| profileAt | timestamp | Server time of the last profile edit. The owner can change only name, sid, course, section, dept, position, contact and profileAt; email, role and createdAt stay immutable |

A complaint's complainant fields (`cSid`, `cCourse`, `cDept`, `cContact`, `filedByName`) must equal these profile values when it is filed, so a profile has to be complete first.

## offenses/{offenseId}  (catalog from the College Discipline Board Manual, Handbook Revision No. 7)
| Field | Type | Notes |
|---|---|---|
| type | string (2–80) | Offense name shown in the form |
| category | string | `First Degree`, `Second Degree` or `Third Degree` (CDB Manual sections 4.1, 4.3, 4.5). Complaints filed before this change may still hold `Minor`, `Major` or `Grave` in `offense`; they stay readable |
| sanction | string (≤1000) | Sanction text as written in the handbook |
| section | string (≤60) | Manual reference, e.g. `CDB Manual § 4.3.13`. Ids look like `cdb-4-3-13` |

Read by any signed-in UB user; written only by staff. Seeded from `public/assets/js/data/offenses.json`.

## complaints/{caseId}  (caseId like SAEP-2026-001)
| Field | Type | Notes |
|---|---|---|
| student, sid, program | string | Respondent name, student no. (7 digits) and course (F-SAEP-07) |
| rDept | string (≤80) | Respondent department (required) |
| rEmail, rContact | string | Respondent email and contact no.; both optional (empty string when unknown) |
| cSid, cCourse | string | Complainant student no. (7 digits) and course; required for students, may be empty for faculty |
| cDept, cContact | string | Complainant department (required) and contact no. (required, 7–20 digits/`+()-`/spaces) |
| signature | string (2–120) | Typed full name used as the complainant's e-signature (the form checks it matches the account name) |
| section | string | Legacy field on complaints filed before F-SAEP-07; no longer written |
| offenseId, type, offense | string | Catalog id, its type and category. Rules check they match the catalog. The "Others" choice uses `offenseId` `others`, type `Others (not listed)` and category `Unclassified` (no catalog entry) |
| offenseOther | string (3–100) | Only with Others: what the complainant says happened. Absent for catalog offenses |
| route | string | `department` for First Degree, `cdb` otherwise; set at filing, can only move from `department` to `cdb` |
| noticeDate, answerDue | string YYYY-MM-DD or '' | Notice to the respondent and answer deadline (at least 3 days after the notice) |
| answer | string | '' (awaiting), `received` or `general-denial` |
| parentsNotified | string YYYY-MM-DD or '' | Date parents or guardians were notified |
| conferenceMode, conferencesHeld | string, int (0–20) | '' / `face-to-face` / `online`; conferences held so far. The conference date is `hearingDate` |
| decisionDate | string YYYY-MM-DD or '' | Required when status is `resolved`; the written decision is `resolution` |
| interventions | list of string | Any of `reprimand`, `censure`, `probation`, `community`, `suspension`, `exclusion`, `expulsion` |
| appeal, appealDate | string | '' / `filed` / `upheld` / `modified` / `reversed` and its date; only when resolved |
| date | string YYYY-MM-DD | Incident date, not after `filed` |
| filed | string YYYY-MM-DD | Filing date in Philippine time. Rules require it to equal today's date on the server clock (UTC+8), so it cannot be backdated |
| location, desc | string | desc is 30–5000 characters |
| status | string | `submitted`, `review`, `hearing`, `resolved` |
| filedBy, filedByName, filedByRole, filedByEmail | string | Who filed it, shown to staff |
| privacyConsent, privacyVersion | bool, string | Consent given on the form and the notice version |
| hearingDate | string YYYY-MM-DD or "" | Required when status is `hearing` |
| resolution | string (≤2000) | Required (5+ characters) when status is `resolved` |
| hCount | number | Number of staff changes so far; links to the latest history entry |
| files | list | Evidence `{name, path}` (max 5). Rules require each path to be `evidence/<filer uid>/<caseId>/<file>`. Empty while Storage is off |
| createdAt, updatedAt | timestamp | Server time |
| updatedBy | string | uid of the last staff editor |

### complaints/{caseId}/history/{n}  (append-only, readable by the filer and staff)
| Field | Type | Notes |
|---|---|---|
| from, to | string | Status before and after |
| remark | string (≤500) | Optional, but 5+ characters are required when `to` is earlier in the workflow than `from` (reopening a case) |
| at | timestamp | Server time |

Holds no staff identity, so the filer can read it without learning who handled the case. Older entries written before this split may still carry `by` and `byName`.

### complaints/{caseId}/audit/{n}  (append-only, staff only)
| Field | Type | Notes |
|---|---|---|
| by, byName | string | Staff uid and name who made change `n` |
| at | timestamp | Server time |

The document id is the case's `hCount` at that change, the same id as the history entry. Rules require history and audit entries to be written together with the complaint update in one batch, and never allow edits or deletes.

### complaints/{caseId}/emails/{id}  (append-only, staff only)
| Field | Type | Notes |
|---|---|---|
| kind | string | `notice`, `followup`, `schedule`, `decision` or `department` |
| to, cc | string (≤300) | Addresses as the staff member typed them (`cc` may be empty) |
| subject | string (1–200) | Subject line |
| body | string (20–5000) | The message text that was prepared |
| by, byName | string | Staff uid and name who confirmed the email was sent |
| at | timestamp | Server time of the confirmation |

UBridge never sends mail. Staff open the draft in their own email app, send it there and then confirm in the dialog, which writes this record. It proves the staff member confirmed sending, not that the message was delivered.

## notifications/{id}
| Field | Type | Notes |
|---|---|---|
| uid | string | Recipient (the person who filed the case) |
| caseId, message | string | message ≤200 characters |
| read | bool | The recipient may only set this to true |
| createdAt | timestamp | Server time |

## counters/{year}
| Field | Type | Notes |
|---|---|---|
| n | number | Last case number of the year; +1 only, together with the complaint that uses it |
