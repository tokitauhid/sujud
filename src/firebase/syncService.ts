import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  writeBatch,
  serverTimestamp,
  onSnapshot,
  Unsubscribe,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebaseConfig";
import {
  DBResultDataObjType,
  LocationsDataObjType,
  userPreferencesType,
} from "../types/types";

// ---------------------------------------------------------------------------
// Firestore paths helper
// ---------------------------------------------------------------------------
const userDoc = (userId: string) => doc(db, "users", userId);
const prefsDoc = (userId: string) =>
  doc(db, "users", userId, "preferences", "data");
const locationsCol = (userId: string) =>
  collection(db, "users", userId, "locations");
const salahLogsCol = (userId: string) =>
  collection(db, "users", userId, "salahLogs");

// ---------------------------------------------------------------------------
// PUSH — Local SQLite → Firestore
// ---------------------------------------------------------------------------

/**
 * Push all preferences to Firestore as a single document.
 * Includes reasons (as comma-separated string for Firestore compatibility).
 */
export async function pushPreferencesToFirestore(
  userId: string,
  preferences: userPreferencesType
): Promise<void> {
  try {
    const prefsForFirestore = {
      ...preferences,
      // Store reasons as comma-separated string in Firestore
      reasons: Array.isArray(preferences.reasons)
        ? preferences.reasons.join(",")
        : preferences.reasons,
      updatedAt: serverTimestamp(),
    };

    await setDoc(prefsDoc(userId), prefsForFirestore, { merge: true });
  } catch (error) {
    console.error("Failed to push preferences to Firestore:", error);
  }
}

/**
 * Push a single preference key-value pair to Firestore.
 */
export async function pushSinglePreferenceToFirestore(
  userId: string,
  key: string,
  value: string | string[]
): Promise<void> {
  try {
    const firestoreValue =
      key === "reasons" && Array.isArray(value) ? value.join(",") : value;

    await setDoc(
      prefsDoc(userId),
      {
        [key]: firestoreValue,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    console.error(`Failed to push preference "${key}" to Firestore:`, error);
  }
}

/**
 * Push all salah log records to Firestore in batches.
 * Uses `date_salahName` as document ID for deduplication.
 */
export async function pushSalahDataToFirestore(
  userId: string,
  salahRecords: DBResultDataObjType[]
): Promise<void> {
  try {
    const colRef = salahLogsCol(userId);
    const BATCH_LIMIT = 450; // Firestore batch limit is 500, leave headroom

    for (let i = 0; i < salahRecords.length; i += BATCH_LIMIT) {
      const batch = writeBatch(db);
      const chunk = salahRecords.slice(i, i + BATCH_LIMIT);

      for (const record of chunk) {
        const docId = `${record.date}_${record.salahName}`;
        const docRef = doc(colRef, docId);
        batch.set(
          docRef,
          {
            date: record.date,
            salahName: record.salahName,
            salahStatus: record.salahStatus,
            reasons: record.reasons || "",
            notes: record.notes || "",
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }

      await batch.commit();
    }

    console.log(
      `Pushed ${salahRecords.length} salah records to Firestore`
    );
  } catch (error) {
    console.error("Failed to push salah data to Firestore:", error);
  }
}

/**
 * Push a single salah log entry to Firestore (called on individual prayer save).
 */
export async function pushSingleSalahLogToFirestore(
  userId: string,
  record: {
    date: string;
    salahName: string;
    salahStatus: string;
    reasons?: string;
    notes?: string;
  }
): Promise<void> {
  try {
    const docId = `${record.date}_${record.salahName}`;
    const docRef = doc(salahLogsCol(userId), docId);
    await setDoc(
      docRef,
      {
        ...record,
        reasons: record.reasons || "",
        notes: record.notes || "",
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    console.error("Failed to push salah log to Firestore:", error);
  }
}

/**
 * Push all locations to Firestore.
 */
export async function pushLocationsToFirestore(
  userId: string,
  locations: LocationsDataObjType[]
): Promise<void> {
  try {
    const batch = writeBatch(db);
    const colRef = locationsCol(userId);

    for (const loc of locations) {
      const docRef = doc(colRef, String(loc.id));
      batch.set(docRef, {
        locationName: loc.locationName,
        latitude: loc.latitude,
        longitude: loc.longitude,
        isSelected: loc.isSelected,
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();
  } catch (error) {
    console.error("Failed to push locations to Firestore:", error);
  }
}

// ---------------------------------------------------------------------------
// PULL — Firestore → Local SQLite (new device / first sign-in)
// ---------------------------------------------------------------------------

export interface CloudData {
  preferences: Record<string, string> | null;
  salahLogs: DBResultDataObjType[];
  locations: LocationsDataObjType[];
}

/**
 * Pull all data from Firestore for a given user.
 * Returns null for preferences if no cloud data exists.
 */
export async function pullFromFirestore(userId: string): Promise<CloudData> {
  const cloudData: CloudData = {
    preferences: null,
    salahLogs: [],
    locations: [],
  };

  try {
    // 1. Preferences
    const prefsSnap = await getDoc(prefsDoc(userId));
    if (prefsSnap.exists()) {
      const data = prefsSnap.data();
      // Remove Firestore metadata fields
      const { updatedAt, ...prefs } = data;
      cloudData.preferences = prefs as Record<string, string>;
    }

    // 2. Salah logs
    const logsSnap = await getDocs(salahLogsCol(userId));
    logsSnap.forEach((docSnap) => {
      const data = docSnap.data();
      cloudData.salahLogs.push({
        id: 0, // Will be assigned by SQLite auto-increment
        date: data.date,
        salahName: data.salahName,
        salahStatus: data.salahStatus,
        reasons: data.reasons || "",
        notes: data.notes || "",
      });
    });

    // 3. Locations
    const locsSnap = await getDocs(locationsCol(userId));
    locsSnap.forEach((docSnap) => {
      const data = docSnap.data();
      cloudData.locations.push({
        id: parseInt(docSnap.id, 10) || 0,
        locationName: data.locationName,
        latitude: data.latitude,
        longitude: data.longitude,
        isSelected: data.isSelected ?? 0,
      });
    });
  } catch (error) {
    console.error("Failed to pull data from Firestore:", error);
  }

  return cloudData;
}

/**
 * Check if a user already has cloud data (quick check).
 */
export async function hasCloudData(userId: string): Promise<boolean> {
  try {
    const prefsSnap = await getDoc(prefsDoc(userId));
    return prefsSnap.exists();
  } catch (error) {
    console.error("Failed to check cloud data:", error);
    return false;
  }
}

// ---------------------------------------------------------------------------
// FULL SYNC — Push everything from local DB to Firestore
// ---------------------------------------------------------------------------

/**
 * One-shot full sync: push all local data to Firestore.
 * Called on first sign-in when local data exists but cloud is empty,
 * or when user taps "Sync now".
 */
export async function fullSyncToFirestore(
  userId: string,
  preferences: userPreferencesType,
  salahRecords: DBResultDataObjType[],
  locations: LocationsDataObjType[]
): Promise<void> {
  await Promise.all([
    pushPreferencesToFirestore(userId, preferences),
    pushSalahDataToFirestore(userId, salahRecords),
    pushLocationsToFirestore(userId, locations),
  ]);

  // Mark sync timestamp on the user document
  await setDoc(
    userDoc(userId),
    { lastSyncedAt: serverTimestamp() },
    { merge: true }
  );
}

// ---------------------------------------------------------------------------
// REALTIME LISTENER — Firestore → UI (optional, for multi-device live sync)
// ---------------------------------------------------------------------------

/**
 * Subscribe to preference changes in real-time.
 * Returns an unsubscribe function.
 */
export function subscribeToPreferences(
  userId: string,
  callback: (prefs: Record<string, string>) => void
): Unsubscribe {
  return onSnapshot(prefsDoc(userId), (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      const { updatedAt, ...prefs } = data;
      callback(prefs as Record<string, string>);
    }
  });
}

// ---------------------------------------------------------------------------
// SYNC STATUS helpers
// ---------------------------------------------------------------------------

export type SyncStatus = "idle" | "syncing" | "synced" | "error";

/**
 * Get last sync timestamp for a user.
 */
export async function getLastSyncTimestamp(
  userId: string
): Promise<Date | null> {
  try {
    const snap = await getDoc(userDoc(userId));
    if (snap.exists()) {
      const data = snap.data();
      if (data.lastSyncedAt instanceof Timestamp) {
        return data.lastSyncedAt.toDate();
      }
    }
    return null;
  } catch (error) {
    console.error("Failed to get last sync timestamp:", error);
    return null;
  }
}
