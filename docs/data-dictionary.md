# UBridge Firestore data dictionary

Cloud Firestore is a document database, so this replaces the ERD in Chapter 3. Types are Firestore types.

## users/{uid}
| Field | Type | Notes |
|---|---|---|
| name | string (1–120) | Display name |
| email | string | Must equal the Auth email; @ub.edu.ph only |
| role | string | `student`, `faculty` or `staff`. Clients can only create `student` or `faculty`; `staff` is set in the console. Immutable from clients |
| createdAt | timestamp | Server time |

## offenses/{offenseId}  (catalog from handbook Section VII)
| Field | Type | Notes |
|---|---|---|
| type | string (2–80) | Offense name shown in the form |
| category | string | `Minor`, `Major` or `Grave` |
| sanction | string (≤1000) | Sanction text as written in the handbook |
| section | string (≤60) | Handbook reference |

Read by any signed-in UB user; written only by staff. Seeded from `public/assets/js/data/offenses.json`.

## complaints/{caseId}  (caseId like SAEP-2026-001)
| Field | Type | Notes |
|---|---|---|
| student, sid, program, section | string | Student involved (sid is 7 digits) |
| offenseId, type, offense | string | Catalog id, its type and category. Rules check they match the catalog |
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
