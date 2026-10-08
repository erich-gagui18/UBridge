# UBridge on Firebase (Hosting + Auth + Firestore + Storage)

## One-time setup
1. Firebase console: create a project, add a Web app, paste its config into `assets/js/firebase-config.js`.
2. Build > Authentication: enable Email/Password and Google.
3. Build > Firestore Database: create it in production mode.
4. Build > Storage needs the Blaze plan. On the free Spark plan set `USE_STORAGE = false` in firebase-config.js: only file names are saved and nothing is uploaded.
5. Put your project ID in `.firebaserc`.

## Deploy
    npm i -g firebase-tools
    firebase login
    firebase deploy
Without Storage enabled: `firebase deploy --only hosting,firestore:rules`. If the CLI asks to grant a cross-service permission for the Storage rules, accept it.

## Make a SAEP Staff account
Sign up as a student, then in Firestore open `users/<uid>` and change `role` to `staff`. Staff can't be self-assigned; the rules only allow student or faculty at sign-up.

## Data model
users/{uid}      name, email, role (student | faculty | staff)
complaints/{id}  id like SAEP-2026-001: student, sid, program, section, offense, type, date (incident), location, desc, filed, status, filedBy, filedByName, files[{name,path}]
counters/{year}  n (last case number)
Storage          evidence/{uid}/{caseId}/{file}
