import { SQLiteDBConnection } from "@capacitor-community/sqlite";
import { DBConnectionStateType, LocationsDataObjTypeArr } from "../types/types";
import { generateUUID } from "./helpers";
import { syncLocationToCloud } from "../firebase/syncService";

// ---------------------------------------------------------------------------
// Serialized DB operation queue
// ---------------------------------------------------------------------------
// All DB operations are funneled through this queue so that concurrent callers
// (sync listeners, updateUserPrefs, fetchDataFromDB, etc.) never race against
// each other when opening/closing the connection.

let dbQueue: Promise<void> = Promise.resolve();

/**
 * Enqueue a DB operation. The callback receives the open DB connection.
 * Operations are executed one at a time in FIFO order.
 */
export function withDB<T>(
  dbConnection: React.MutableRefObject<SQLiteDBConnection | undefined>,
  operation: (db: SQLiteDBConnection) => Promise<T>
): Promise<T> {
  let resolve: (v: T) => void;
  let reject: (e: any) => void;
  const resultPromise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  dbQueue = dbQueue.then(async () => {
    try {
      if (!dbConnection.current) {
        throw new Error("dbConnection.current is not available");
      }
      await ensureDBOpen(dbConnection);
      const result = await operation(dbConnection.current);
      resolve!(result);
    } catch (e) {
      reject!(e);
    }
  });

  return resultPromise;
}

/**
 * Ensure the DB is open. Does NOT close it — the DB stays open during the
 * app lifecycle. Only call toggleDBConnection("close") when the app is
 * being backgrounded or destroyed.
 */
export async function ensureDBOpen(
  dbConnection: React.MutableRefObject<SQLiteDBConnection | undefined>
) {
  if (!dbConnection.current) {
    throw new Error("dbConnection.current is not available");
  }
  if (typeof dbConnection.current.isDBOpen === "function") {
    const isDatabaseOpen = await dbConnection.current.isDBOpen();
    if (!isDatabaseOpen.result && typeof dbConnection.current.open === "function") {
      await dbConnection.current.open();
    }
  }
}

// export async function queuedToggleDBConnection(
export async function toggleDBConnection(
  dbConnection: React.MutableRefObject<SQLiteDBConnection | undefined>,
  action: DBConnectionStateType,
) {
  // console.log("toggleDBConnection is being run...");

  try {
    if (!dbConnection || !dbConnection.current) {
      return;
    }

    if (action === "close") {
      // Keep DB open during app lifecycle to prevent "database not opened" errors
      // across concurrent queries, background sync, and Quick Log.
      return;
    }

    await ensureDBOpen(dbConnection);
  } catch (error) {
    console.error(`toggleDBConnection(${action}) failed:`, error);
  }
}

export const fetchAllLocations = async (
  dbConnection: React.MutableRefObject<SQLiteDBConnection | undefined>,
): Promise<{
  allLocations: LocationsDataObjTypeArr;
}> => {
  try {
    if (!dbConnection || !dbConnection.current) {
      throw new Error("dbConnection / dbconnection.current does not exist");
    }

    const res = await withDB(dbConnection, async (db) => {
      return await db.query(
        "SELECT * from userLocationsTable WHERE deleted = 0",
      );
    });

    if (!res || !res.values) {
      throw new Error("Failed to obtain data from userLocationsTable");
    }

    const allLocations: LocationsDataObjTypeArr = res.values;

    return { allLocations };
  } catch (error) {
    console.error("fetchAllLocations failed", error);
    return { allLocations: [] };
  }
};

export const addUserLocation = async (
  dbConnection: React.MutableRefObject<SQLiteDBConnection | undefined>,
  locationName: string,
  latitude: number,
  longitude: number,
  isSelected: number,
  isDefaultLocationCheckBoxChecked?: boolean,
) => {
  const stmnt = `INSERT INTO userLocationsTable (syncId, locationName, latitude, longitude, isSelected, createdAt, updatedAt, deleted) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?);
      `;

  if (!dbConnection || !dbConnection.current) {
    throw new Error("dbConnection / dbconnection.current does not exist");
  }

  const now = Date.now();
  const syncId = generateUUID();
  const params = [syncId, locationName, latitude, longitude, isSelected, now, now, 0];

  const lastId = await withDB(dbConnection, async (db) => {
    if (isDefaultLocationCheckBoxChecked && isSelected === 1) {
      await db.run(
        `UPDATE userLocationsTable SET isSelected = 0`,
      );
    }
    return await db.run(stmnt, params);
  });

  // Push to cloud (fire-and-forget)
  syncLocationToCloud({
    syncId,
    locationName,
    latitude,
    longitude,
    isSelected,
    createdAt: now,
    updatedAt: now,
    deleted: 0,
  });

  return lastId;
};

// export const modifyUserLocation = async (dbConnection, id, name, lat, long, isSelected) => {

//      try {

//   await toggleDBConnection(dbConnection, "open");

// //update statement goes here

// const stmnt = `UPDATE userlocationsTable WHERE id = ?`

// const params = [locationName, latitude, longitude, isSelected]

// await dbConnection.current.run(stmnt, params);

// const res = await db.current.query(stmnt)
// setUserLocations(res.values)

//     } catch(error) {

//       console.error(error)
// } finally {

// toggleDBConnection(dbConnection, "close");

// }

// }
