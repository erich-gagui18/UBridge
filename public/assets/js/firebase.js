import {initializeApp} from './sdk/app.js';
import {initializeAuth, browserSessionPersistence, browserPopupRedirectResolver} from './sdk/auth.js';
import {getFirestore} from './sdk/firestore.js';
import {getStorage} from './sdk/storage.js';
import {firebaseConfig, USE_STORAGE} from './firebase-config.js';
const app = initializeApp(firebaseConfig);
// Session persistence: the auth token is dropped when the tab closes (not kept in long-lived storage).
export const auth = initializeAuth(app, {persistence: browserSessionPersistence, popupRedirectResolver: browserPopupRedirectResolver});
export const db = getFirestore(app), storage = USE_STORAGE ? getStorage(app) : null;
export {USE_STORAGE};
