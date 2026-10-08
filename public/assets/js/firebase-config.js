// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
export const firebaseConfig = {
  apiKey: "AIzaSyCY1R-_MA_0LchXxc_zOlmsdoFo4oiaArU",
  authDomain: "ubridge-76eee.firebaseapp.com",
  projectId: "ubridge-76eee",
  storageBucket: "ubridge-76eee.firebasestorage.app",
  messagingSenderId: "386534021400",
  appId: "1:386534021400:web:62a1ebb0bdd75701a7a66d",
  measurementId: "G-2S6FPLTENV"
};

// Cloud Storage needs the Blaze plan. Set false to save only file names (no upload) on the free Spark plan.
export const USE_STORAGE = false;

// App Check (reCAPTCHA v3). Create a site key at https://www.google.com/recaptcha/admin (type: v3, domain: ubridge-76eee.web.app),
// register it in Firebase console > App Check > Apps > Web, then paste the SITE key here. Empty = App Check is skipped.
export const RECAPTCHA_SITE_KEY = '';

// Gemini model used by the AI Guide through Firebase AI Logic. Check the model list in Firebase console > AI Logic
// and change it here if this one has been retired.
export const GEMINI_MODEL = 'gemini-2.5-flash';
