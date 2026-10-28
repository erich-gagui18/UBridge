import { initializeApp } from './sdk/app.js';
import { initializeAuth, browserSessionPersistence, browserPopupRedirectResolver } from './sdk/auth.js';
import { initializeAppCheck, ReCaptchaV3Provider } from './sdk/app-check.js';
import { getFirestore } from './sdk/firestore.js';
import { getStorage } from './sdk/storage.js';
import { firebaseConfig, USE_STORAGE, RECAPTCHA_SITE_KEY } from './firebase-config.js';

export const app = initializeApp(firebaseConfig);

// App Check must start before any other Firebase service is used. It proves requests come from this site,
// which protects the Gemini quota and Firestore from scripted abuse. Skipped until a site key is configured.
export let appCheckOn = false;
if (RECAPTCHA_SITE_KEY) {
  if (['localhost', '127.0.0.1'].includes(location.hostname)) self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  initializeAppCheck(app, { provider: new ReCaptchaV3Provider(RECAPTCHA_SITE_KEY), isTokenAutoRefreshEnabled: true });
  appCheckOn = true;
}

// Session persistence: the auth token is dropped when the tab closes (not kept in long-lived storage).
export const auth = initializeAuth(app, {
  persistence: browserSessionPersistence,
  popupRedirectResolver: browserPopupRedirectResolver,
});
export const db = getFirestore(app);
export const storage = USE_STORAGE ? getStorage(app) : null;
export { USE_STORAGE };
