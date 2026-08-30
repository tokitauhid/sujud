import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import {
  onAuthStateChanged,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  signInWithCredential,
  User,
} from "firebase/auth";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";
import { auth } from "./firebaseConfig";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface FirebaseAuthContextType {
  user: User | null;
  isAuthLoading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------
const FirebaseAuthContext = createContext<FirebaseAuthContextType | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
export const FirebaseAuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Listen for auth state changes (persists across app restarts)
  useEffect(() => {
    if (!auth) {
      setIsAuthLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  /**
   * Triggers native Android Google Sign-In (no WebView popup).
   * Uses the Capacitor Firebase Authentication plugin which calls the
   * native Google Sign-In SDK, then passes the credential to Firebase Auth.
   */
  const signInWithGoogle = async (): Promise<void> => {
    if (!auth) throw new Error("Firebase Auth is not initialized. Check your configuration.");
    try {
      // 1. Trigger native Google Sign-In dialog
      // useCredentialManager: false falls back to the legacy Google Sign-In
      // intent which works reliably on all devices (Credential Manager has
      // issues on some OEMs like Xiaomi/MIUI where the bottom sheet fails
      // to render).
      const result = await FirebaseAuthentication.signInWithGoogle({
        useCredentialManager: false,
      });

      if (!result.credential?.idToken) {
        throw new Error("Google Sign-In did not return an ID token");
      }

      // 2. Exchange native credential for a Firebase Auth credential
      const credential = GoogleAuthProvider.credential(
        result.credential.idToken
      );

      // 3. Sign in to Firebase with the credential
      await signInWithCredential(auth, credential);
    } catch (error) {
      console.error("Google Sign-In failed:", JSON.stringify(error, null, 2), error);
      throw error;
    }
  };

  const signOut = async (): Promise<void> => {
    if (!auth) throw new Error("Firebase Auth is not initialized.");
    try {
      await FirebaseAuthentication.signOut();
      await firebaseSignOut(auth);
    } catch (error) {
      console.error("Sign-out failed:", error);
      throw error;
    }
  };

  return (
    <FirebaseAuthContext.Provider
      value={{ user, isAuthLoading, signInWithGoogle, signOut }}
    >
      {children}
    </FirebaseAuthContext.Provider>
  );
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export const useFirebaseAuth = (): FirebaseAuthContextType => {
  const context = useContext(FirebaseAuthContext);
  if (!context) {
    throw new Error(
      "useFirebaseAuth must be used within a FirebaseAuthProvider"
    );
  }
  return context;
};
