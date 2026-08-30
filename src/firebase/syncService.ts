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

/**
 * After syncing salah data into SQLite, ensure userStartDate covers the
 * earliest salah record so the home screen displays all synced dates.
 */
async function adjustUserStartDateIfNeeded(
  dbConnection: React.MutableRefObject<SQLiteDBConnection | undefined>
): Promise<void> {
  if (!dbConnection.current) return;
  try {
    const earliestResult = await dbConnection.current.query(
      `SELECT MIN(date) as minDate FROM salahDataTable WHERE deleted = 0`
    );
    const earliestDate = earliestResult?.values?.[0]?.minDate;
    if (!earliestDate) return;

    const currentStartResult = await dbConnection.current.query(
      `SELECT preferenceValue FROM userPreferencesTable WHERE preferenceName = 'userStartDate'`
    );
    const currentStart = currentStartResult?.values?.[0]?.preferenceValue;

    // If no start date exists, or the earliest salah date is before it, update
    if (!currentStart || earliestDate < currentStart) {
      console.log(`[SYNC] Adjusting userStartDate from "${currentStart}" to "${earliestDate}"`);
      await dbConnection.current.run(
        `INSERT OR REPLACE INTO userPreferencesTable (preferenceName, preferenceValue, updatedAt) VALUES ('userStartDate', ?, ?)`,
        [earliestDate, Date.now()]
      );
    }
  } catch (e) {
    console.error("Failed to adjust userStartDate:", e);
  }
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

  let wasDbOpen = false;

  try {
    if (!dbConnection.current) {
      throw new Error("Database connection not available");
    }

    const dbOpenState = await dbConnection.current.isDBOpen();
    wasDbOpen = dbOpenState.result || false;

    if (!wasDbOpen) {
      await toggleDBConnection(dbConnection, "open");
    }

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
    console.log(`[SYNC DEBUG] Cloud salahLogs snapshot size: ${logsSnap.size}`);
    logsSnap.forEach((docSnap) => {
      const data = docSnap.data();
      cloudData.salahLogs.push({
        ...data,
        createdAt: normalizeTimestamp(data.createdAt),
        updatedAt: normalizeTimestamp(data.updatedAt),
      } as DBResultDataObjType);
    });
    console.log(`[SYNC DEBUG] Cloud salahLogs parsed: ${cloudData.salahLogs.length}`);
    if (cloudData.salahLogs.length > 0) {
      console.log(`[SYNC DEBUG] Sample cloud log[0]:`, JSON.stringify(cloudData.salahLogs[0]));
      console.log(`[SYNC DEBUG] Sample cloud log[last]:`, JSON.stringify(cloudData.salahLogs[cloudData.salahLogs.length - 1]));
    }

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

    console.log(`[SYNC DEBUG] Local salah count: ${localSalahs.length}, Cloud salah count: ${cloudData.salahLogs.length}`);
    console.log(`[SYNC DEBUG] All unique salah keys: ${allSalahKeys.size}`);
    console.log(`[SYNC DEBUG] salahToLocal: ${salahToLocal.length}, salahToCloud: ${salahToCloud.length}`);

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

    // Split writes to Firestore into batches of max 500
    const allOperations = [
      ...(Object.keys(mergedPrefsToCloud).length > 0 ? [{ type: 'set', ref: prefsDoc(userId), data: { ...mergedPrefsToCloud, updatedAt: serverTimestamp() }, merge: true }] : []),
      ...salahToCloud.map(record => ({
        type: 'set',
        ref: doc(salahLogsCol(userId), `${record.date}_${record.salahName}`),
        data: {
          date: record.date,
          salahName: record.salahName,
          salahStatus: record.salahStatus,
          reasons: record.reasons || "",
          notes: record.notes || "",
          createdAt: record.createdAt || 0,
          updatedAt: record.updatedAt || 0,
          deleted: record.deleted || 0,
        },
        merge: true
      })),
      ...locsToCloud.filter(loc => loc.syncId).map(loc => ({
        type: 'set',
        ref: doc(locationsCol(userId), loc.syncId!),
        data: {
          syncId: loc.syncId,
          locationName: loc.locationName || "",
          latitude: loc.latitude || 0,
          longitude: loc.longitude || 0,
          isSelected: loc.isSelected || 0,
          createdAt: loc.createdAt || 0,
          updatedAt: loc.updatedAt || 0,
          deleted: loc.deleted || 0,
        },
        merge: true
      })),
      { type: 'set', ref: userDoc(userId), data: { lastSyncedAt: serverTimestamp() }, merge: true }
    ];

    const CHUNK_SIZE = 450;
    for (let i = 0; i < allOperations.length; i += CHUNK_SIZE) {
      const batchChunk = allOperations.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      for (const op of batchChunk) {
        batch.set(op.ref, op.data, { merge: op.merge });
      }
      await batch.commit();
    }

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
    
    console.log(`[SYNC DEBUG] Total SQLite statements to execute: ${statements.length}`);
    if (statements.length > 0) {
      const BATCH_SIZE = 50;
      for (let i = 0; i < statements.length; i += BATCH_SIZE) {
        try {
          const batch = statements.slice(i, i + BATCH_SIZE);
          console.log(`[SYNC DEBUG] Executing batch ${i}-${i + batch.length - 1} (${batch.length} statements)`);
          await dbConnection.current.executeSet(batch);
          console.log(`[SYNC DEBUG] Batch ${i}-${i + batch.length - 1} succeeded`);
        } catch (err) {
          console.error(`[SYNC DEBUG] Batch insert error at index ${i}:`, err);
          // Log the failing statements for diagnosis
          const failBatch = statements.slice(i, i + BATCH_SIZE);
          failBatch.forEach((s: any, idx: number) => {
            console.error(`[SYNC DEBUG]   Statement[${i + idx}]:`, s.statement.substring(0, 80), "values:", JSON.stringify(s.values));
          });
        }
      }
    }

    console.log("Bidirectional sync completed successfully.");

    // Ensure userStartDate covers all synced data
    await adjustUserStartDateIfNeeded(dbConnection);

  } catch (error) {
    console.error("Error during bidirectional sync:", error);
    throw error;
  } finally {
    isSyncing = false;
    if (dbConnection.current && !wasDbOpen) {
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

// ---------------------------------------------------------------------------
// MANUAL OVERWRITE SYNC OPERATIONS
// ---------------------------------------------------------------------------

export async function pushLocalDataToCloud(
  userId: string,
  dbConnection: React.MutableRefObject<SQLiteDBConnection | undefined>
): Promise<void> {
  if (isSyncing) throw new Error("Sync already in progress");
  isSyncing = true;
  let wasDbOpen = false;
  try {
    if (!dbConnection.current) throw new Error("Database connection not available");
    
    const dbOpenState = await dbConnection.current.isDBOpen();
    wasDbOpen = dbOpenState.result || false;

    if (!wasDbOpen) {
      await toggleDBConnection(dbConnection, "open");
    }

    const localPrefsResult = await dbConnection.current.query(`SELECT * FROM userPreferencesTable`);
    const localSalahResult = await dbConnection.current.query(`SELECT * FROM salahDataTable WHERE deleted = 0 OR deleted IS NULL`);
    const localLocationsResult = await dbConnection.current.query(`SELECT * FROM userLocationsTable WHERE deleted = 0 OR deleted IS NULL`);

    const localPrefs = localPrefsResult.values || [];
    const localSalahs = (localSalahResult.values as DBResultDataObjType[]) || [];
    const localLocations = (localLocationsResult.values as LocationsDataObjType[]) || [];

    // Clear existing cloud syncable data for safety/exact match
    const existingLogsSnap = await getDocs(salahLogsCol(userId));
    const existingLocsSnap = await getDocs(locationsCol(userId));

    const normalizedPrefs: Record<string, { value: string; updatedAt: number }> = {};
    for (const p of localPrefs) {
      normalizedPrefs[p.preferenceName] = {
        value: p.preferenceValue,
        updatedAt: p.updatedAt || 0,
      };
    }

    const allOperations: any[] = [
      ...existingLogsSnap.docs.map(snap => ({ type: 'delete', ref: snap.ref })),
      ...existingLocsSnap.docs.map(snap => ({ type: 'delete', ref: snap.ref })),
      { type: 'set', ref: prefsDoc(userId), data: { ...normalizedPrefs, updatedAt: serverTimestamp() } },
      ...localSalahs.map(record => ({
        type: 'set',
        ref: doc(salahLogsCol(userId), `${record.date}_${record.salahName}`),
        data: {
          date: record.date,
          salahName: record.salahName,
          salahStatus: record.salahStatus,
          reasons: record.reasons || "",
          notes: record.notes || "",
          createdAt: record.createdAt || 0,
          updatedAt: record.updatedAt || 0,
          deleted: 0,
        }
      })),
      ...localLocations.filter(loc => loc.syncId).map(loc => ({
        type: 'set',
        ref: doc(locationsCol(userId), loc.syncId!),
        data: {
          syncId: loc.syncId,
          locationName: loc.locationName || "",
          latitude: loc.latitude || 0,
          longitude: loc.longitude || 0,
          isSelected: loc.isSelected || 0,
          createdAt: loc.createdAt || 0,
          updatedAt: loc.updatedAt || 0,
          deleted: 0,
        }
      })),
      { type: 'set', ref: userDoc(userId), data: { lastSyncedAt: serverTimestamp() }, merge: true }
    ];

    const CHUNK_SIZE = 450;
    for (let i = 0; i < allOperations.length; i += CHUNK_SIZE) {
      const batchChunk = allOperations.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      for (const op of batchChunk) {
        if (op.type === 'delete') {
          batch.delete(op.ref);
        } else if (op.type === 'set') {
          if (op.merge) {
            batch.set(op.ref, op.data, { merge: op.merge });
          } else {
            batch.set(op.ref, op.data);
          }
        }
      }
      await batch.commit();
    }

  } finally {
    isSyncing = false;
    if (dbConnection.current && !wasDbOpen) await toggleDBConnection(dbConnection, "close");
  }
}

export async function pullCloudDataToLocal(
  userId: string,
  dbConnection: React.MutableRefObject<SQLiteDBConnection | undefined>
): Promise<void> {
  if (isSyncing) throw new Error("Sync already in progress");
  isSyncing = true;
  let wasDbOpen = false;
  try {
    if (!dbConnection.current) throw new Error("Database connection not available");

    const dbOpenState = await dbConnection.current.isDBOpen();
    wasDbOpen = dbOpenState.result || false;

    const prefsSnap = await getDoc(prefsDoc(userId));
    const logsSnap = await getDocs(salahLogsCol(userId));
    const locsSnap = await getDocs(locationsCol(userId));

    if (!wasDbOpen) {
      await toggleDBConnection(dbConnection, "open");
    }
    
    // Start replacing local data via statements
    const statements: any[] = [];
    
    // Delete existing syncable data (we don't delete schema)
    statements.push({ statement: `DELETE FROM userPreferencesTable`, values: [] });
    statements.push({ statement: `DELETE FROM salahDataTable`, values: [] });
    statements.push({ statement: `DELETE FROM userLocationsTable`, values: [] });

    if (prefsSnap.exists()) {
      const data = prefsSnap.data();
      for (const [k, v] of Object.entries(data)) {
        if (k === "updatedAt") continue;
        let strVal = "";
        let up = 0;
        if (typeof v === "object" && v !== null && "value" in v) {
          strVal = (v as any).value;
          up = normalizeTimestamp((v as any).updatedAt);
        } else {
          strVal = Array.isArray(v) ? v.join(",") : String(v);
        }
        statements.push({
          statement: `INSERT INTO userPreferencesTable (preferenceName, preferenceValue, updatedAt) VALUES (?, ?, ?)`,
          values: [k, strVal, up]
        });
      }
    }

    console.log(`[PULL DEBUG] Cloud snapshots - prefs exists: ${prefsSnap.exists()}, logs: ${logsSnap.size}, locs: ${locsSnap.size}`);

    logsSnap.forEach(snap => {
      const d = snap.data();
      statements.push({
        statement: `INSERT OR REPLACE INTO salahDataTable(date, salahName, salahStatus, reasons, notes, createdAt, updatedAt, deleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        values: [d.date ?? "", d.salahName ?? "", d.salahStatus ?? "Missed", d.reasons ?? "", d.notes ?? "", normalizeTimestamp(d.createdAt), normalizeTimestamp(d.updatedAt), d.deleted ?? 0],
      });
    });

    locsSnap.forEach(snap => {
      const d = snap.data();
      statements.push({
        statement: `INSERT OR REPLACE INTO userLocationsTable (syncId, locationName, latitude, longitude, isSelected, createdAt, updatedAt, deleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        values: [d.syncId ?? "", d.locationName ?? "", d.latitude ?? 0, d.longitude ?? 0, d.isSelected ?? 0, normalizeTimestamp(d.createdAt), normalizeTimestamp(d.updatedAt), d.deleted ?? 0],
      });
    });

    console.log(`[PULL DEBUG] Total statements to execute: ${statements.length}`);
    if (statements.length > 0) {
      const BATCH_SIZE = 50;
      for (let i = 0; i < statements.length; i += BATCH_SIZE) {
        try {
          const batch = statements.slice(i, i + BATCH_SIZE);
          console.log(`[PULL DEBUG] Executing batch ${i}-${i + batch.length - 1} (${batch.length} statements)`);
          await dbConnection.current.executeSet(batch);
          console.log(`[PULL DEBUG] Batch ${i}-${i + batch.length - 1} succeeded`);
        } catch (err) {
          console.error(`[PULL DEBUG] Batch insert error at index ${i}:`, err);
          const failBatch = statements.slice(i, i + BATCH_SIZE);
          failBatch.forEach((s: any, idx: number) => {
            console.error(`[PULL DEBUG]   Statement[${i + idx}]:`, s.statement.substring(0, 80), "values:", JSON.stringify(s.values));
          });
        }
      }
    }

    // Verify what actually ended up in SQLite after pull
    try {
      const verifyResult = await dbConnection.current.query(`SELECT COUNT(*) as count FROM salahDataTable`);
      const verifyDeleted = await dbConnection.current.query(`SELECT COUNT(*) as count FROM salahDataTable WHERE deleted = 0`);
      console.log(`[PULL DEBUG] After pull - total salah rows: ${verifyResult?.values?.[0]?.count}, non-deleted: ${verifyDeleted?.values?.[0]?.count}`);
    } catch (e) {
      console.error(`[PULL DEBUG] Verify query failed:`, e);
    }
    
    // Ensure userStartDate covers all pulled data
    await adjustUserStartDateIfNeeded(dbConnection);
    
    await setDoc(userDoc(userId), { lastSyncedAt: serverTimestamp() }, { merge: true });

  } finally {
    isSyncing = false;
    if (dbConnection.current && !wasDbOpen) await toggleDBConnection(dbConnection, "close");
  }
}

export async function getSyncDataCounts(
  userId: string,
  dbConnection: React.MutableRefObject<SQLiteDBConnection | undefined>
) {
  let localSalahs = 0, localLocs = 0;
  let cloudSalahs = 0, cloudLocs = 0;

  let wasDbOpen = false;
  try {
    if (dbConnection.current) {
      const dbOpenState = await dbConnection.current.isDBOpen();
      wasDbOpen = dbOpenState.result || false;
      if (!wasDbOpen) await toggleDBConnection(dbConnection, "open");

      const sResult = await dbConnection.current.query(`SELECT COUNT(*) as count FROM salahDataTable WHERE deleted = 0 OR deleted IS NULL`);
      const lResult = await dbConnection.current.query(`SELECT COUNT(*) as count FROM userLocationsTable WHERE deleted = 0 OR deleted IS NULL`);
      if (sResult?.values && sResult.values.length > 0) localSalahs = sResult.values[0].count;
      if (lResult?.values && lResult.values.length > 0) localLocs = lResult.values[0].count;
      
      if (!wasDbOpen) await toggleDBConnection(dbConnection, "close");
    }

    const logsSnap = await getDocs(salahLogsCol(userId));
    const locsSnap = await getDocs(locationsCol(userId));

    logsSnap.forEach(d => { if (d.data().deleted !== 1) cloudSalahs++; });
    locsSnap.forEach(d => { if (d.data().deleted !== 1) cloudLocs++; });
  } catch (error) {
    console.error("Failed to get counts", error);
  }

  return {
    local: { salahs: localSalahs, locations: localLocs },
    cloud: { salahs: cloudSalahs, locations: cloudLocs },
  };
}
