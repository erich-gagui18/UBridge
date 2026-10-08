# Usability testing kit (SUS + task tests)

I can't recruit or run sessions for you. This kit is ready to use.

## Who
Aim for at least 5 students and 3 SAEP staff (SUS results are still reportable with small samples, but say so). Use the deployed site and a test account, never real cases.

## Tasks
Students: 1) sign up and verify, 2) file a complaint with the consent box, 3) find the status of your case, 4) ask the AI Guide what sanction applies to an offense and say which section the answer came from, 5) find your notification.
Staff: 1) find a case by name, 2) change status to For hearing with a date, 3) resolve a case with a note, 4) check who changed a case and when, 5) export the report.

Record for each task: completed unaided (yes/no), time, errors, comments.

## SUS (10 items, 1 = strongly disagree to 5 = strongly agree)
1. I think that I would like to use this system frequently.
2. I found the system unnecessarily complex.
3. I thought the system was easy to use.
4. I think that I would need the support of a technical person to be able to use this system.
5. I found the various functions in this system were well integrated.
6. I thought there was too much inconsistency in this system.
7. I would imagine that most people would learn to use this system very quickly.
8. I found the system very cumbersome to use.
9. I felt very confident using the system.
10. I needed to learn a lot of things before I could get going with this system.

Scoring per respondent: odd items score = answer − 1; even items score = 5 − answer; add the ten scores and multiply by 2.5 (result 0–100). Average across respondents. `node docs/sus.mjs 4,2,4,1,4,2,5,1,4,2 ...` (one comma-separated row per respondent) prints each score and the mean.

Also get consent from participants and keep their data anonymous.
