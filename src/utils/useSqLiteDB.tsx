import { useEffect, useRef, useState } from "react";

import {
  SQLiteConnection,
  SQLiteDBConnection,
  CapacitorSQLite,
} from "@capacitor-community/sqlite";
import { toggleDBConnection } from "./dbUtils";

const useSQLiteDB = () => {
  const sqliteConnection = useRef<SQLiteConnection>(); // This is the connection to the dbConnection
  const dbConnection = useRef<SQLiteDBConnection>(); // This is the connection to the database itself, will deal with READ/INSERT etc
  const [isDatabaseInitialised, setisDatabaseInitialised] =
    useState<boolean>(false);

  useEffect(() => {
    const initialiseDB = async () => {
      const upgradeStatements = [
        {
          toVersion: 1,
          statements: [
            `CREATE TABLE IF NOT EXISTS salahDataTable(
            id INTEGER PRIMARY KEY NOT NULL,
            date TEXT NOT NULL, 
            salahName TEXT NOT NULL, 
            salahStatus TEXT NOT NULL, 
            reasons TEXT DEFAULT '', 
            notes TEXT DEFAULT ''
            ) STRICT;`,
            `CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_date_salahName ON salahDataTable (date, salahName)`,
            `CREATE TABLE IF NOT EXISTS userPreferencesTable(
            preferenceName TEXT PRIMARY KEY NOT NULL,
            preferenceValue TEXT NOT NULL DEFAULT ''
            ) STRICT`,
          ],
        },
        {
          toVersion: 2,
          statements: [
            `CREATE TABLE IF NOT EXISTS userLocationsTable(
          id INTEGER PRIMARY KEY NOT NULL,
          locationName TEXT NOT NULL,
          latitude REAL NOT NULL,
          longitude REAL NOT NULL,
          isSelected INTEGER DEFAULT 0
        ) STRICT`,

            `CREATE UNIQUE INDEX IF NOT EXISTS idx_single_selected_location ON userLocationsTable (isSelected) WHERE isSelected = 1`,
          ],
        },
        {
          toVersion: 3,
          statements: [
            `ALTER TABLE salahDataTable ADD COLUMN createdAt INTEGER DEFAULT 0;`,
            `ALTER TABLE salahDataTable ADD COLUMN updatedAt INTEGER DEFAULT 0;`,
            `ALTER TABLE salahDataTable ADD COLUMN deleted INTEGER DEFAULT 0;`,
            `ALTER TABLE userLocationsTable ADD COLUMN syncId TEXT DEFAULT '';`,
            `ALTER TABLE userLocationsTable ADD COLUMN createdAt INTEGER DEFAULT 0;`,
            `ALTER TABLE userLocationsTable ADD COLUMN updatedAt INTEGER DEFAULT 0;`,
            `ALTER TABLE userLocationsTable ADD COLUMN deleted INTEGER DEFAULT 0;`,
            `ALTER TABLE userPreferencesTable ADD COLUMN updatedAt INTEGER DEFAULT 0;`,
          ],
        },
      ];

      try {
        if (sqliteConnection.current) return; // If sqliteConnection.current is not undefined or null it means the dbConnection has already been initalised so return out of the function

        sqliteConnection.current = new SQLiteConnection(CapacitorSQLite); // Create a new SQLiteConnection instance and assign it to sqliteConnection.current.

        await sqliteConnection.current.addUpgradeStatement(
          "sujuddatabase",
          upgradeStatements,
        );

        const connectionConsistency =
          await sqliteConnection.current.checkConnectionsConsistency();

        const isConn = (
          await sqliteConnection.current.isConnection(
            "sujuddatabase",
            false,
          )
        ).result; // The isConnection method checks if there is an existing connection

        if (connectionConsistency.result && isConn) {
          // Retrieve the existing connection to "sujuddatabase"

          dbConnection.current =
            await sqliteConnection.current.retrieveConnection(
              "sujuddatabase",
              false,
            );
        } else {
          // If the dbConnection does not exist then create a new connection (additionally, if the "sujuddatabase" database does not exist, create it at the same time as establishing the new connection)

          dbConnection.current =
            await sqliteConnection.current.createConnection(
              "sujuddatabase",
              false,
              "no-encryption",
              3,
              false,
            );
        }

        await initialiseTables();
        setisDatabaseInitialised(true);
      } catch (error) {
        console.error("Error initializing database: " + error);
      }
    };

    initialiseDB();
  }, []);

  // Check and update table structure here
  const initialiseTables = async () => {
    // console.log("Initialising tables...");

    try {
      if (!dbConnection.current) {
        throw new Error(
          `Table not created/initialised within initialiseTables, dbConnection.current is ${dbConnection.current}`,
        );
      }

      await toggleDBConnection(dbConnection, "open");

      await dbConnection.current.execute(
        `DROP INDEX IF EXISTS idx_single_selected_location`,
      );

      const createTablesSql: string[] = [
        `CREATE TABLE IF NOT EXISTS salahDataTable(
        id INTEGER PRIMARY KEY NOT NULL,
        date TEXT NOT NULL, 
        salahName TEXT NOT NULL, 
        salahStatus TEXT NOT NULL, 
        reasons TEXT DEFAULT '', 
        notes TEXT DEFAULT '',
        createdAt INTEGER DEFAULT 0,
        updatedAt INTEGER DEFAULT 0,
        deleted INTEGER DEFAULT 0
        ) STRICT;
        `,

        `CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_date_salahName ON salahDataTable (date, salahName)`,

        `CREATE TABLE IF NOT EXISTS userPreferencesTable(
        preferenceName TEXT PRIMARY KEY NOT NULL,
        preferenceValue TEXT NOT NULL DEFAULT '',
        updatedAt INTEGER DEFAULT 0
        ) STRICT`,

        `CREATE TABLE IF NOT EXISTS userLocationsTable(
          id INTEGER PRIMARY KEY NOT NULL,
          syncId TEXT DEFAULT '',
          locationName TEXT NOT NULL,
          latitude REAL NOT NULL,
          longitude REAL NOT NULL,
          isSelected INTEGER DEFAULT 0,
          createdAt INTEGER DEFAULT 0,
          updatedAt INTEGER DEFAULT 0,
          deleted INTEGER DEFAULT 0
        ) STRICT`,
      ];

      for (const sql of createTablesSql) {
        await dbConnection.current.execute(sql);
      }
    } catch (error) {
      console.error(error);
    } finally {
      try {
        if (!dbConnection.current) {
          throw new Error(
            `Unable to close cnnection within initialiseTables, dbConnection.current is ${dbConnection.current}`,
          );
        }

        const isDatabaseOpen = await dbConnection.current.isDBOpen();
        if (isDatabaseOpen.result) {
          await toggleDBConnection(dbConnection, "close");
        }
        // console.log("Table initialisation complete");
      } catch (error) {
        console.error(error);
      }
    }
  };

  return {
    isDatabaseInitialised,
    sqliteConnection,
    dbConnection,
    initialiseTables,
  };
};

export default useSQLiteDB;
