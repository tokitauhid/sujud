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
  onSnapshot,
  QuerySnapshot,
  DocumentSnapshot,
} from "firebase/firestore";
import { db, auth } from "./firebaseConfig";
import {
  DBResultDataObjType,
  LocationsDataObjType,
} from "../types/types";
import { SQLiteDBConnection } from "@capacitor-community/sqlite";
import { withDB } from "../utils/dbUtils";

const userDoc = (userId: string) => doc(db!, "users", userId);
const prefsDoc = (userId: string) =>
  doc(db!, "users", userId, "preferences", "data");
const locationsCol = (userId: string) =>
  collection(db!, "users", userId, "locations");
const salahLogsCol = (userId: string) =>
  collection(db!, "users", userId, "salahLogs");

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

export type SyncStatus = "idle" | "syncing" | "synced" | "error";

export interface CloudData {
  preferences: Record<string, { value: string; updatedAt: number }> | null;
  salahLogs: DBResultDataObjType[];
  locations: LocationsDataObjType[];
}

export interface RealtimeSyncCallbacks {
  onSalahLogsChanged: (changes: Array<{ type: 'added' | 'modified' | 'removed'; data: DBResultDataObjType }>) => void;
  onPreferencesChanged: (prefs: Record<string, { value: string; updatedAt: number }>) => void;
  onLocationsChanged: (changes: Array<{ type: 'added' | 'modified' | 'removed'; data: LocationsDataObjType }>) => void;
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
    await withDB(dbConnection, async (db) => {
      const earliestResult = await db.query(
        `SELECT MIN(date) as minDate FROM salahDataTable WHERE deleted = 0`
      );
      const earliestDate = earliestResult?.values?.[0]?.minDate;
      if (!earliestDate) return;

      const currentStartResult = await db.query(
        `SELECT preferenceValue FROM userPreferencesTable WHERE preferenceName = 'userStartDate'`
      );
      const currentStart = currentStartResult?.values?.[0]?.preferenceValue;

      // If no start date exists, or the earliest salah date is before it, update
      if (!currentStart || earliestDate < currentStart) {
        console.log(`[SYNC] Adjusting userStartDate from "${currentStart}" to "${earliestDate}"`);
        await db.run(
          `INSERT OR REPLACE INTO userPreferencesTable (preferenceName, preferenceValue, updatedAt) VALUES ('userStartDate', ?, ?)`,
          [earliestDate, Date.now()]
        );
      }
    });
  } catch (e) {
    console.error("Failed to adjust userStartDate:", e);
  }
}

// ---------------------------------------------------------------------------
// OUTBOUND SYNC — Fire-and-forget single-document writes
// ---------------------------------------------------------------------------

/**
 * Push a single salah log record to Firestore.
 * Call this fire-and-forget after every SQLite salah mutation.
 */
export function syncSalahLogToCloud(record: {
  date: string;
  salahName: string;
  salahStatus: string;
  reasons: string;
  notes: string;
  createdAt: number;
  updatedAt: number;
  deleted: number;
}): void {
  const user = auth?.currentUser;
  if (!user || !db) return;

  const docId = `${record.date}_${record.salahName}`;
  setDoc(doc(db, "users", user.uid, "salahLogs", docId), record, { merge: true })
    .catch(e => console.error("[SYNC] Failed to push salah log:", e));
}

/**
 * Push a single preference to Firestore.
 * Call this fire-and-forget after every preference mutation.
 */
export function syncPreferenceToCloud(
  prefName: string,
  prefValue: string,
  updatedAt: number
): void {
  const user = auth?.currentUser;
  if (!user || !db) return;

  setDoc(
    doc(db, "users", user.uid, "preferences", "data"),
    { [prefName]: { value: prefValue, updatedAt } },
    { merge: true }
  ).catch(e => console.error("[SYNC] Failed to push preference:", e));
}

/**
 * Push a single location record to Firestore.
 * Call this fire-and-forget after every location mutation.
 */
export function syncLocationToCloud(record: {
  syncId: string;
  locationName: string;
  latitude: number;
  longitude: number;
  isSelected: number;
  createdAt: number;
  updatedAt: number;
  deleted: number;
}): void {
  const user = auth?.currentUser;
  if (!user || !db) return;
  if (!record.syncId) return; // Can't sync without a syncId

  setDoc(doc(db, "users", user.uid, "locations", record.syncId), record, { merge: true })
    .catch(e => console.error("[SYNC] Failed to push location:", e));
}

// ---------------------------------------------------------------------------
// INBOUND SYNC — Real-time onSnapshot listeners
// ---------------------------------------------------------------------------

/**
 * Initialize real-time Firestore listeners for all syncable collections.
 * Returns a cleanup function that unsubscribes all listeners.
 *
 * SQLite writes now go through ensureDBOpen() so they never silently fail
 * because a concurrent caller (e.g. updateUserPrefs) closed the connection.
 *
 * Callbacks are debounced (300 ms) so rapid-fire snapshot changes are batched
 * into a single React state update instead of N consecutive ones.
 */
export function initRealtimeSync(
  userId: string,
  dbConnection: React.MutableRefObject<SQLiteDBConnection | undefined>,
  callbacks: RealtimeSyncCallbacks
): () => void {
  if (!db) return () => {};

  // Debounce helpers — collect changes, flush once after 300 ms of silence
  let salahDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  let locationsDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  const DEBOUNCE_MS = 300;

  // --- Salah Logs listener ---
  const unsubSalahs = onSnapshot(
    collection(db, "users", userId, "salahLogs"),
    (snapshot: QuerySnapshot) => {
      const docChanges = snapshot.docChanges();
      if (docChanges.length === 0) return;

      const changes: Array<{ type: 'added' | 'modified' | 'removed'; data: DBResultDataObjType }> = [];
      const statements: Array<{ statement: string; values: any[] }> = [];

      docChanges.forEach(change => {
        // Skip local echoes — this change originated on THIS device
        if (change.doc.metadata.hasPendingWrites) return;

        const data = change.doc.data();
        const record: DBResultDataObjType = {
          id: 0, // SQLite will assign
          date: data.date ?? "",
          salahName: data.salahName ?? "",
          salahStatus: data.salahStatus ?? "Missed",
          reasons: data.reasons ?? "",
          notes: data.notes ?? "",
          createdAt: normalizeTimestamp(data.createdAt),
          updatedAt: normalizeTimestamp(data.updatedAt),
          deleted: data.deleted ?? 0,
        };

        changes.push({ type: change.type, data: record });

        if (change.type === 'added' || change.type === 'modified') {
          statements.push({
            statement: `INSERT INTO salahDataTable(date, salahName, salahStatus, reasons, notes, createdAt, updatedAt, deleted)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(date, salahName) DO UPDATE SET
                 salahStatus = excluded.salahStatus,
                 reasons = excluded.reasons,
                 notes = excluded.notes,
                 updatedAt = excluded.updatedAt,
                 deleted = excluded.deleted`,
            values: [record.date, record.salahName, record.salahStatus, record.reasons, record.notes, record.createdAt, record.updatedAt, record.deleted],
          });
        }
      });

      const persistAndNotifySalahs = async () => {
        try {
          if (statements.length > 0 && dbConnection.current) {
            await withDB(dbConnection, async (db) => {
              const BATCH_SIZE = 50;
              for (let i = 0; i < statements.length; i += BATCH_SIZE) {
                await db.executeSet(statements.slice(i, i + BATCH_SIZE));
              }
            });
          }
          if (changes.length > 0) {
            if (salahDebounceTimer) clearTimeout(salahDebounceTimer);
            salahDebounceTimer = setTimeout(() => {
              callbacks.onSalahLogsChanged(changes);
            }, DEBOUNCE_MS);
          }
        } catch (e) {
          console.error("[SYNC] Failed to write incoming salah batch:", e);
        }
      };
      persistAndNotifySalahs();
    },
    (error) => console.error("[SYNC] Salah logs listener error:", error)
  );

  // --- Preferences listener ---
  const unsubPrefs = onSnapshot(
    doc(db, "users", userId, "preferences", "data"),
    (snapshot: DocumentSnapshot) => {
      if (snapshot.metadata.hasPendingWrites) return;
      if (!snapshot.exists()) return;

      const data = snapshot.data();
      const prefs: Record<string, { value: string; updatedAt: number }> = {};

      for (const [key, val] of Object.entries(data)) {
        if (key === "updatedAt") continue;
        if (typeof val === "object" && val !== null && "value" in val) {
          prefs[key] = { value: (val as any).value, updatedAt: normalizeTimestamp((val as any).updatedAt) };
        }
      }

      const statements: Array<{ statement: string; values: any[] }> = [];
      for (const [key, pref] of Object.entries(prefs)) {
        statements.push({
          statement: `INSERT OR REPLACE INTO userPreferencesTable (preferenceName, preferenceValue, updatedAt) VALUES (?, ?, ?)`,
          values: [key, pref.value, pref.updatedAt],
        });
      }

      const persistAndNotifyPrefs = async () => {
        try {
          if (statements.length > 0 && dbConnection.current) {
            await withDB(dbConnection, async (db) => {
              const BATCH_SIZE = 50;
              for (let i = 0; i < statements.length; i += BATCH_SIZE) {
                await db.executeSet(statements.slice(i, i + BATCH_SIZE));
              }
            });
          }
          callbacks.onPreferencesChanged(prefs);
        } catch (e) {
          console.error("[SYNC] Failed to write incoming prefs batch:", e);
          callbacks.onPreferencesChanged(prefs);
        }
      };
      persistAndNotifyPrefs();
    },
    (error) => console.error("[SYNC] Preferences listener error:", error)
  );

  // --- Locations listener ---
  const unsubLocations = onSnapshot(
    collection(db, "users", userId, "locations"),
    (snapshot: QuerySnapshot) => {
      const docChanges = snapshot.docChanges();
      if (docChanges.length === 0) return;

      const changes: Array<{ type: 'added' | 'modified' | 'removed'; data: LocationsDataObjType }> = [];
      const incomingLocations: LocationsDataObjType[] = [];

      docChanges.forEach(change => {
        if (change.doc.metadata.hasPendingWrites) return;

        const data = change.doc.data();
        const record: LocationsDataObjType = {
          id: 0,
          syncId: data.syncId ?? "",
          locationName: data.locationName ?? "",
          latitude: data.latitude ?? 0,
          longitude: data.longitude ?? 0,
          isSelected: data.isSelected ?? 0,
          createdAt: normalizeTimestamp(data.createdAt),
          updatedAt: normalizeTimestamp(data.updatedAt),
          deleted: data.deleted ?? 0,
        };

        changes.push({ type: change.type, data: record });

        if ((change.type === 'added' || change.type === 'modified') && record.syncId) {
          incomingLocations.push(record);
        }
      });

      const persistAndNotifyLocations = async () => {
        try {
          if (incomingLocations.length > 0 && dbConnection.current) {
            await withDB(dbConnection, async (db) => {
              for (const loc of incomingLocations) {
                const existing = await db.query(
                  `SELECT id FROM userLocationsTable WHERE syncId = ?`,
                  [loc.syncId]
                );
                if (existing?.values && existing.values.length > 0) {
                  await db.run(
                    `UPDATE userLocationsTable SET locationName = ?, latitude = ?, longitude = ?, isSelected = ?, updatedAt = ?, deleted = ? WHERE syncId = ?`,
                    [loc.locationName, loc.latitude, loc.longitude, loc.isSelected, loc.updatedAt, loc.deleted, loc.syncId]
                  );
                } else {
                  await db.run(
                    `INSERT INTO userLocationsTable (syncId, locationName, latitude, longitude, isSelected, createdAt, updatedAt, deleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [loc.syncId, loc.locationName, loc.latitude, loc.longitude, loc.isSelected, loc.createdAt, loc.updatedAt, loc.deleted]
                  );
                }
              }
            });
          }
          if (changes.length > 0) {
            if (locationsDebounceTimer) clearTimeout(locationsDebounceTimer);
            locationsDebounceTimer = setTimeout(() => {
              callbacks.onLocationsChanged(changes);
            }, DEBOUNCE_MS);
          }
        } catch (e) {
          console.error("[SYNC] Failed to write incoming locations:", e);
        }
      };
      persistAndNotifyLocations();
    },
    (error) => console.error("[SYNC] Locations listener error:", error)
  );

  return () => {
    if (salahDebounceTimer) clearTimeout(salahDebounceTimer);
    if (locationsDebounceTimer) clearTimeout(locationsDebounceTimer);
    unsubSalahs();
    unsubPrefs();
    unsubLocations();
  };
}

// ---------------------------------------------------------------------------
// INITIAL SYNC ON SIGN-IN
// ---------------------------------------------------------------------------

/**
 * Called once after a user signs in.
 * - If cloud has data: pull everything to local SQLite (new device scenario)
 * - If cloud is empty: push local data to cloud (first sign-in scenario)
 * Returns: 'pulled' | 'pushed' | 'empty' to indicate what happened.
 */
export async function initialSyncOnSignIn(
  userId: string,
  dbConnection: React.MutableRefObject<SQLiteDBConnection | undefined>
): Promise<'pulled' | 'pushed' | 'empty'> {
  if (!db || !userId) return 'empty';
  const cloudHasData = await hasCloudData(userId);

  if (cloudHasData) {
    await pullCloudDataToLocal(userId, dbConnection);
    return 'pulled';
  }

  // Check if local has data
  if (!dbConnection.current) return 'empty';

  try {
    const hasLocal = await withDB(dbConnection, async (db) => {
      const localCount = await db.query(
        `SELECT COUNT(*) as count FROM salahDataTable WHERE deleted = 0`
      );
      return (localCount?.values?.[0]?.count ?? 0) > 0;
    });

    if (hasLocal) {
      await pushLocalDataToCloud(userId, dbConnection);
      return 'pushed';
    }
  } catch (e) {
    console.error("[SYNC] initialSyncOnSignIn check failed:", e);
  }

  return 'empty';
}

// ---------------------------------------------------------------------------
// UTILITY FUNCTIONS
// ---------------------------------------------------------------------------

export async function hasCloudData(userId: string): Promise<boolean> {
  if (!db || !userId) return false;
  try {
    const prefsSnap = await getDoc(prefsDoc(userId));
    return prefsSnap.exists();
  } catch (error) {
    console.error("Failed to check cloud data:", error);
    return false;
  }
}

export async function getLastSyncTimestamp(userId: string): Promise<Date | null> {
  if (!db || !userId) return null;
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

// ---------------------------------------------------------------------------
// MANUAL OVERWRITE SYNC OPERATIONS (Emergency recovery)
// ---------------------------------------------------------------------------

let isSyncing = false;

export async function pushLocalDataToCloud(
  userId: string,
  dbConnection: React.MutableRefObject<SQLiteDBConnection | undefined>
): Promise<void> {
  if (!db || !userId) throw new Error("Cloud service is not initialized");
  if (isSyncing) throw new Error("Sync already in progress");
  isSyncing = true;
  try {
    if (!dbConnection.current) throw new Error("Database connection not available");

    const { localPrefs, localSalahs, localLocations } = await withDB(dbConnection, async (db) => {
      const localPrefsResult = await db.query(`SELECT * FROM userPreferencesTable`);
      const localSalahResult = await db.query(`SELECT * FROM salahDataTable WHERE deleted = 0 OR deleted IS NULL`);
      const localLocationsResult = await db.query(`SELECT * FROM userLocationsTable WHERE deleted = 0 OR deleted IS NULL`);
      return {
        localPrefs: localPrefsResult.values || [],
        localSalahs: (localSalahResult.values as DBResultDataObjType[]) || [],
        localLocations: (localLocationsResult.values as LocationsDataObjType[]) || [],
      };
    });

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
      if (!db) throw new Error("Firestore is not initialized.");
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
  }
}

export async function pullCloudDataToLocal(
  userId: string,
  dbConnection: React.MutableRefObject<SQLiteDBConnection | undefined>
): Promise<void> {
  if (!db || !userId) throw new Error("Cloud service is not initialized");
  if (isSyncing) throw new Error("Sync already in progress");
  isSyncing = true;
  try {
    if (!dbConnection.current) throw new Error("Database connection not available");

    const prefsSnap = await getDoc(prefsDoc(userId));
    const logsSnap = await getDocs(salahLogsCol(userId));
    const locsSnap = await getDocs(locationsCol(userId));

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
      await withDB(dbConnection, async (db) => {
        const BATCH_SIZE = 50;
        for (let i = 0; i < statements.length; i += BATCH_SIZE) {
          try {
            const batch = statements.slice(i, i + BATCH_SIZE);
            console.log(`[PULL DEBUG] Executing batch ${i}-${i + batch.length - 1} (${batch.length} statements)`);
            await db.executeSet(batch);
            console.log(`[PULL DEBUG] Batch ${i}-${i + batch.length - 1} succeeded`);
          } catch (err) {
            console.error(`[PULL DEBUG] Batch insert error at index ${i}:`, err);
            const failBatch = statements.slice(i, i + BATCH_SIZE);
            failBatch.forEach((s: any, idx: number) => {
              console.error(`[PULL DEBUG]   Statement[${i + idx}]:`, s.statement.substring(0, 80), "values:", JSON.stringify(s.values));
            });
          }
        }
      });
    }

    // Verify what actually ended up in SQLite after pull
    try {
      await withDB(dbConnection, async (db) => {
        const verifyResult = await db.query(`SELECT COUNT(*) as count FROM salahDataTable`);
        const verifyDeleted = await db.query(`SELECT COUNT(*) as count FROM salahDataTable WHERE deleted = 0`);
        console.log(`[PULL DEBUG] After pull - total salah rows: ${verifyResult?.values?.[0]?.count}, non-deleted: ${verifyDeleted?.values?.[0]?.count}`);
      });
    } catch (e) {
      console.error(`[PULL DEBUG] Verify query failed:`, e);
    }
    
    // Ensure userStartDate covers all pulled data
    await adjustUserStartDateIfNeeded(dbConnection);
    
    await setDoc(userDoc(userId), { lastSyncedAt: serverTimestamp() }, { merge: true });

  } finally {
    isSyncing = false;
  }
}

export async function getSyncDataCounts(
  userId: string,
  dbConnection: React.MutableRefObject<SQLiteDBConnection | undefined>
) {
  if (!db || !userId) {
    return {
      local: { salahs: 0, locations: 0 },
      cloud: { salahs: 0, locations: 0 },
    };
  }
  let localSalahs = 0, localLocs = 0;
  let cloudSalahs = 0, cloudLocs = 0;

  try {
    if (dbConnection.current) {
      const counts = await withDB(dbConnection, async (db) => {
        const sResult = await db.query(`SELECT COUNT(*) as count FROM salahDataTable WHERE deleted = 0 OR deleted IS NULL`);
        const lResult = await db.query(`SELECT COUNT(*) as count FROM userLocationsTable WHERE deleted = 0 OR deleted IS NULL`);
        return {
          salahs: sResult?.values?.[0]?.count ?? 0,
          locations: lResult?.values?.[0]?.count ?? 0,
        };
      });
      localSalahs = counts.salahs;
      localLocs = counts.locations;
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
