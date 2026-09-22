import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, initializeFirestore, persistentLocalCache } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const requiredConfigKeys = {
  apiKey: "VITE_FIREBASE_API_KEY",
  authDomain: "VITE_FIREBASE_AUTH_DOMAIN",
  projectId: "VITE_FIREBASE_PROJECT_ID",
  storageBucket: "VITE_FIREBASE_STORAGE_BUCKET",
  messagingSenderId: "VITE_FIREBASE_MESSAGING_SENDER_ID",
  appId: "VITE_FIREBASE_APP_ID",
};

export const firebaseConfigMissingKeys = Object.entries(requiredConfigKeys)
  .filter(([configKey]) => !String(config[configKey] || "").trim())
  .map(([, envKey]) => envKey);

export const firebaseConfigComplete = firebaseConfigMissingKeys.length === 0;

let app = null;
let auth = null;
let db = null;
let storage = null;
let firebaseInitError = null;

if (firebaseConfigComplete) {
  try {
    app = initializeApp(config);
    auth = getAuth(app);
    try {
      // Firestore v12 recommends configuring IndexedDB persistence during
      // initialization instead of calling enableIndexedDbPersistence() after
      // the Firestore instance has been created.
      db = initializeFirestore(app, {
        localCache: persistentLocalCache(),
      });
    } catch (persistenceError) {
      // Keep Firestore fully usable when persistent IndexedDB storage is not
      // available (for example, an unsupported/private browser context).
      db = getFirestore(app);
      console.warn(
        "Firestore persistent cache unavailable; continuing with the default cache.",
        persistenceError,
      );
    }

    storage = getStorage(app);
  } catch (error) {
    firebaseInitError = error;
    app = null;
    auth = null;
    db = null;
    storage = null;
  }
}

export { app, auth, db, storage, firebaseInitError };

// firebaseReady means the client SDK was actually initialized, not merely that
// a partial environment configuration happened to be present.
export const firebaseReady = Boolean(app && auth && db);
