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
    try {
      // 1. Trigger native Google Sign-In dialog
      const result = await FirebaseAuthentication.signInWithGoogle();

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
      console.error("Google Sign-In failed:", error);
      throw error;
    }
  };

  const signOut = async (): Promise<void> => {
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
