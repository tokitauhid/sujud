import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getFirestore, Firestore } from "firebase/firestore";
import { getAuth, Auth } from "firebase/auth";

// ---------------------------------------------------------------------------
// Firebase config — fill these in after creating your Firebase project.
// For dev:  create a "My Salah App (Dev)" Firebase project,
//           register Android app with package name: com.mysalahapp.app.dev
// For prod: register Android app with package name: com.mysalahapp.app
//
// Add VITE_FIREBASE_* keys to your .env file (never commit .env to git).
// ---------------------------------------------------------------------------
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? "",
};

// Prevent re-initialising on Vite hot-reload
let firebaseApp: FirebaseApp;
if (getApps().length === 0) {
  firebaseApp = initializeApp(firebaseConfig);
} else {
  firebaseApp = getApps()[0];
}

export const db: Firestore = getFirestore(firebaseApp);
export const auth: Auth = getAuth(firebaseApp);
export { firebaseApp };
