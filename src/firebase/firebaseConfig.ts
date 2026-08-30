import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getFirestore, Firestore } from "firebase/firestore";
import { getAuth, Auth } from "firebase/auth";

// ---------------------------------------------------------------------------
// Firebase config — fill these in after creating your Firebase project.
// For dev:  create a "Sujud (Dev)" Firebase project,
//           register Android app with package name: com.sujud.app.dev
// For prod: register Android app with package name: com.sujud.app
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
let firebaseApp: FirebaseApp | undefined;

if (firebaseConfig.apiKey) {
  if (getApps().length === 0) {
    firebaseApp = initializeApp(firebaseConfig);
  } else {
    firebaseApp = getApps()[0];
  }
} else {
  console.warn("Firebase config is missing or incomplete (missing API key). Firebase will not be initialized.");
}

export const db: Firestore | null = firebaseApp ? getFirestore(firebaseApp) : null;
export const auth: Auth | null = firebaseApp ? getAuth(firebaseApp) : null;
export { firebaseApp };
