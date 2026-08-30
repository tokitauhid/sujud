import React from "react";
import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  writeBatch,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebaseConfig";
import {
  DBResultDataObjType,
  LocationsDataObjType,
} from "../types/types";
import { SQLiteDBConnection } from "@capacitor-community/sqlite";
import { toggleDBConnection } from "../utils/dbUtils";

const userDoc = (userId: string) => doc(db, "users", userId);
const prefsDoc = (userId: string) =>
  doc(db, "users", userId, "preferences", "data");
const locationsCol = (userId: string) =>
  collection(db, "users", userId, "locations");
const salahLogsCol = (userId: string) =>
  collection(db, "users", userId, "salahLogs");

export let isSyncing = false;

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

export type SyncStatus = "idle" | "syncing" | "synced" | "error";

export interface CloudData {
  preferences: Record<string, { value: string; updatedAt: number }> | null;
  salahLogs: DBResultDataObjType[];
  locations: LocationsDataObjType[];
}

/**
 * Helper to normalize Firestore Timestamp objects to milliseconds (integer)
 * safely handling legacy numerical values or missing fields.
 */
function normalizeTimestamp(val: any): number {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  if (val.toMillis && typeof val.toMillis === 'function') return val.toMillis();
  if (val.seconds) return val.seconds * 1000;
  return 0;
}

// ---------------------------------------------------------------------------
// BIDIRECTIONAL SYNC
// ---------------------------------------------------------------------------

export async function performBidirectionalSync(
  userId: string,
  dbConnection: React.MutableRefObject<SQLiteDBConnection | undefined>
): Promise<void> {
  if (isSyncing) {
    console.log("Sync already in progress. Skipping.");
    return;
  }
  isSyncing = true;

  try {
    if (!dbConnection.current) {
      throw new Error("Database connection not available");
    }

    await toggleDBConnection(dbConnection, "open");

    // 1. Fetch Local Data
    const localPrefsResult = await dbConnection.current.query(
      `SELECT * FROM userPreferencesTable`
    );
    const localSalahResult = await dbConnection.current.query(
      `SELECT * FROM salahDataTable`
    );
    const localLocationsResult = await dbConnection.current.query(
      `SELECT * FROM userLocationsTable`
    );

    const localPrefs = localPrefsResult.values || [];
    const localSalahs = (localSalahResult.values as DBResultDataObjType[]) || [];
    const localLocations = (localLocationsResult.values as LocationsDataObjType[]) || [];

    // 2. Fetch Cloud Data
    const cloudData: CloudData = {
      preferences: null,
      salahLogs: [],
      locations: [],
    };

    const prefsSnap = await getDoc(prefsDoc(userId));
    if (prefsSnap.exists()) {
      const data = prefsSnap.data();
      const normalizedPrefs: Record<string, { value: string; updatedAt: number }> = {};
      for (const [k, v] of Object.entries(data)) {
        if (k === "updatedAt") continue; // Metadata field at root
        if (typeof v === "object" && v !== null && "value" in v) {
          normalizedPrefs[k] = { 
            value: (v as any).value, 
            updatedAt: normalizeTimestamp((v as any).updatedAt) 
          };
        } else {
          // Legacy string preferences or array
          let strVal = String(v);
          if (Array.isArray(v)) strVal = v.join(",");
          normalizedPrefs[k] = { value: strVal, updatedAt: 0 };
        }
      }
      cloudData.preferences = normalizedPrefs;
    }

    const logsSnap = await getDocs(salahLogsCol(userId));
    logsSnap.forEach((docSnap) => {
      const data = docSnap.data();
      cloudData.salahLogs.push({
        ...data,
        createdAt: normalizeTimestamp(data.createdAt),
        updatedAt: normalizeTimestamp(data.updatedAt),
      } as DBResultDataObjType);
    });

    const locsSnap = await getDocs(locationsCol(userId));
    locsSnap.forEach((docSnap) => {
      const data = docSnap.data();
      cloudData.locations.push({
        ...data,
        createdAt: normalizeTimestamp(data.createdAt),
        updatedAt: normalizeTimestamp(data.updatedAt),
      } as LocationsDataObjType);
    });

    // 3. Merge Preferences
    const mergedPrefsToLocal = [];
    const mergedPrefsToCloud: Record<string, { value: string; updatedAt: number }> = {};
    
    const localPrefsMap = new Map<string, { value: string; updatedAt: number }>();
    for (const p of localPrefs) {
      localPrefsMap.set(p.preferenceName, {
        value: p.preferenceValue,
        updatedAt: p.updatedAt || 0,
      });
    }

    const allPrefKeys = new Set([...localPrefsMap.keys(), ...(cloudData.preferences ? Object.keys(cloudData.preferences) : [])]);
    allPrefKeys.delete("updatedAt"); 

    for (const key of allPrefKeys) {
      const local = localPrefsMap.get(key);
      const cloud = cloudData.preferences?.[key];

      let cloudVal = cloud;
      // Handle legacy string preferences structure if any
      if (cloud && typeof cloud === 'string') {
        cloudVal = { value: cloud, updatedAt: 0 };
      } else if (cloud && Array.isArray(cloud)) {
        cloudVal = { value: (cloud as string[]).join(","), updatedAt: 0 };
      }

      if (local && cloudVal) {
        if (local.updatedAt >= cloudVal.updatedAt) {
          mergedPrefsToCloud[key] = local;
        } else {
          mergedPrefsToCloud[key] = cloudVal;
          mergedPrefsToLocal.push({ key, val: cloudVal.value, updated: cloudVal.updatedAt });
        }
      } else if (local) {
        mergedPrefsToCloud[key] = local;
      } else if (cloudVal) {
        mergedPrefsToCloud[key] = cloudVal;
        mergedPrefsToLocal.push({ key, val: cloudVal.value, updated: cloudVal.updatedAt });
      }
    }

    // 4. Merge Salah Logs
    const localSalahMap = new Map(localSalahs.map((l) => [`${l.date}_${l.salahName}`, l]));
    const cloudSalahMap = new Map(cloudData.salahLogs.map((l) => [`${l.date}_${l.salahName}`, l]));
    const allSalahKeys = new Set([...localSalahMap.keys(), ...cloudSalahMap.keys()]);

    const salahToLocal = [];
    const salahToCloud = [];

    for (const key of allSalahKeys) {
      const local = localSalahMap.get(key);
      const cloud = cloudSalahMap.get(key);

      if (local && cloud) {
        if ((local.updatedAt || 0) >= (cloud.updatedAt || 0)) {
          salahToCloud.push(local);
        } else {
          salahToLocal.push(cloud);
        }
      } else if (local) {
        salahToCloud.push(local);
      } else if (cloud) {
        salahToLocal.push(cloud);
      }
    }

    // 5. Merge Locations
    const localLocMap = new Map(localLocations.map((l) => [l.syncId, l]));
    const cloudLocMap = new Map(cloudData.locations.map((l) => [l.syncId, l]));
    const allLocKeys = new Set([...localLocMap.keys(), ...cloudLocMap.keys()].filter(Boolean));

    const locsToLocal = [];
    const locsToCloud = [];

    for (const key of allLocKeys) {
      const local = localLocMap.get(key);
      const cloud = cloudLocMap.get(key);

      if (local && cloud) {
        if ((local.updatedAt || 0) >= (cloud.updatedAt || 0)) {
          locsToCloud.push(local);
        } else {
          locsToLocal.push(cloud);
        }
      } else if (local) {
        locsToCloud.push(local);
      } else if (cloud) {
        locsToLocal.push(cloud);
      }
    }

    // 6. Write to Firestore
    const batch = writeBatch(db);
    if (Object.keys(mergedPrefsToCloud).length > 0) {
      batch.set(prefsDoc(userId), { ...mergedPrefsToCloud, updatedAt: serverTimestamp() }, { merge: true });
    }

    for (const record of salahToCloud) {
      batch.set(doc(salahLogsCol(userId), `${record.date}_${record.salahName}`), record, { merge: true });
    }

    for (const loc of locsToCloud) {
      if (loc.syncId) {
        batch.set(doc(locationsCol(userId), loc.syncId), loc, { merge: true });
      }
    }

    await batch.commit();
    await setDoc(userDoc(userId), { lastSyncedAt: serverTimestamp() }, { merge: true });

    // 7. Write to Local SQLite
    const statements: any[] = [];
    
    for (const pref of mergedPrefsToLocal) {
      statements.push({
        statement: `INSERT OR REPLACE INTO userPreferencesTable (preferenceName, preferenceValue, updatedAt) VALUES (?, ?, ?)`,
        values: [pref.key, pref.val, pref.updated],
      });
    }

    for (const record of salahToLocal) {
      statements.push({
        statement: `INSERT INTO salahDataTable(date, salahName, salahStatus, reasons, notes, createdAt, updatedAt, deleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(date, salahName) DO UPDATE SET 
          salahStatus = excluded.salahStatus,
          reasons = excluded.reasons,
          notes = excluded.notes,
          updatedAt = excluded.updatedAt,
          deleted = excluded.deleted`,
        values: [
          record.date,
          record.salahName,
          record.salahStatus,
          record.reasons || "",
          record.notes || "",
          record.createdAt || 0,
          record.updatedAt || 0,
          record.deleted || 0,
        ],
      });
    }

    for (const loc of locsToLocal) {
      statements.push({
        statement: `UPDATE userLocationsTable SET 
          locationName = ?, latitude = ?, longitude = ?, isSelected = ?, updatedAt = ?, deleted = ? 
          WHERE syncId = ?`,
        values: [loc.locationName, loc.latitude, loc.longitude, loc.isSelected || 0, loc.updatedAt || 0, loc.deleted || 0, loc.syncId],
      });
      statements.push({
        statement: `INSERT INTO userLocationsTable (syncId, locationName, latitude, longitude, isSelected, createdAt, updatedAt, deleted) 
        SELECT ?, ?, ?, ?, ?, ?, ?, ? 
        WHERE NOT EXISTS (SELECT 1 FROM userLocationsTable WHERE syncId = ?)`,
        values: [loc.syncId, loc.locationName, loc.latitude, loc.longitude, loc.isSelected || 0, loc.createdAt || 0, loc.updatedAt || 0, loc.deleted || 0, loc.syncId]
      });
    }
    
    if (statements.length > 0) {
      const BATCH_SIZE = 50;
      for (let i = 0; i < statements.length; i += BATCH_SIZE) {
        await dbConnection.current.executeSet(statements.slice(i, i + BATCH_SIZE));
      }
    }

    console.log("Bidirectional sync completed successfully.");

  } catch (error) {
    console.error("Error during bidirectional sync:", error);
    throw error;
  } finally {
    isSyncing = false;
    if (dbConnection.current) {
      await toggleDBConnection(dbConnection, "close");
    }
  }
}

export async function hasCloudData(userId: string): Promise<boolean> {
  try {
    const prefsSnap = await getDoc(prefsDoc(userId));
    return prefsSnap.exists();
  } catch (error) {
    console.error("Failed to check cloud data:", error);
    return false;
  }
}

export async function getLastSyncTimestamp(userId: string): Promise<Date | null> {
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

// Deprecated functions replaced by performBidirectionalSync
export async function pushSingleSalahLogToFirestore() {}
export async function pushSinglePreferenceToFirestore() {}
export async function subscribeToPreferences() { return () => {}; }
export async function fullSyncToFirestore() {}
export async function pullFromFirestore() { return { preferences: null, salahLogs: [], locations: [] }; }
export async function seedSQLiteFromCloud() {}
