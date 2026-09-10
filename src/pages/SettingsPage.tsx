import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";

import { Share } from "@capacitor/share";
import SettingIndividual from "../components/Settings/SettingIndividual";
import {
  DBResultDataObjType,
  LocationsDataObjTypeArr,
  themeType,
  userPreferencesType,
} from "../types/types";
import { Filesystem, Encoding, Directory } from "@capacitor/filesystem";
import { MdOutlineChevronRight } from "react-icons/md";
import BottomSheetNotifications from "../components/BottomSheets/BottomSheetNotifications";
import {
  SQLiteConnection,
  SQLiteDBConnection,
} from "@capacitor-community/sqlite";
import { Capacitor } from "@capacitor/core";
import {
  updateUserPrefs,
  showToast,
  showAlert,
} from "../utils/helpers";
import BottomSheetStartDate from "../components/BottomSheets/BottomSheetStartDate";
import BottomSheetEditReasons from "../components/BottomSheets/BottomSheetEditReasons";

import {
  IonContent,
  IonHeader,
  IonPage,
  IonToggle,
  IonToolbar,
} from "@ionic/react";
import BottomSheetThemeOptions from "../components/BottomSheets/BottomSheetThemeOptions";
import { toggleDBConnection } from "../utils/dbUtils";
import BottomSheetSalahTimesSettings from "../components/BottomSheets/SalahTimesSheets/BottomSheetSalahTimesSettings";
import BottomSheetBatchUpdate from "../components/BottomSheets/BottomSheetBatchUpdate";
import CloudSyncSettings from "../components/Settings/CloudSyncSettings";

interface SettingsPageProps {
  sqliteConnection: React.MutableRefObject<SQLiteConnection | undefined>;
  dbConnection: React.MutableRefObject<SQLiteDBConnection | undefined>;
  handleSalahTrackingDataFromDB: (
    DBResultAllSalahData: DBResultDataObjType[],
    userStartDate: string,
  ) => Promise<void>;
  isAppActive: boolean;
  theme: themeType;
  handleTheme: (theme?: themeType) => string;
  fetchDataFromDB: (isDBImported?: boolean) => Promise<void>;
  setUserPreferences: React.Dispatch<React.SetStateAction<userPreferencesType>>;
  setShowSalahTimesSettingsSheet: React.Dispatch<React.SetStateAction<boolean>>;
  showSalahTimesSettingsSheet: boolean;
  userPreferences: userPreferencesType;
  userLocations: LocationsDataObjTypeArr;
}

const SettingsPage = ({
  sqliteConnection,
  dbConnection,
  handleSalahTrackingDataFromDB,
  isAppActive,
  theme,
  handleTheme,
  fetchDataFromDB,
  setUserPreferences,
  setShowSalahTimesSettingsSheet,
  showSalahTimesSettingsSheet,
  userPreferences,
  userLocations,
}: SettingsPageProps) => {
  const importDBRef = useRef<HTMLInputElement | null>(null);
  const diaglogElement = useRef<HTMLDialogElement | null>(null);
  const [dialogElementText, setDialogElementText] = useState<string>("");
  const [
    isMissedSalahCounterOptionChecked,
    setIsMissedSalahCounterOptionChecked,
  ] = useState<boolean>(
    userPreferences.showMissedSalahCount === "0" ? false : true,
  );
  const [showBatchUpdateModal, setShowBatchUpdateModal] = useState(false);

  const triggerInput = () => {
    if (importDBRef.current) {
      importDBRef.current.click();
    } else {
      console.error("importDBRef.current does not exist");
    }
  };

  const handleDBExport = async () => {
    try {
      if (!sqliteConnection.current) {
        throw new Error("sqliteConnection does not exist");
      }
      await toggleDBConnection(dbConnection, "open");
      const rawBackupData = await dbConnection.current!.exportToJson("full");
      rawBackupData.export!.overwrite = true;
      const exportedDBAsJson = JSON.stringify(rawBackupData.export);

      try {
        await sqliteConnection.current.isJsonValid(exportedDBAsJson);
      } catch (error) {
        throw new Error("Invalid JSON format: " + error);
      }

      const date = new Date();
      const formattedDate = date
        .toISOString()
        .replace(/T/, "-")
        .replace(/[:]/g, "-")
        .slice(0, 19);

      const writeResult = await Filesystem.writeFile({
        path: `sujud-backup-${formattedDate}.json`,
        data: exportedDBAsJson,
        directory: Directory.Cache,
        encoding: Encoding.UTF8,
      });

      const filePath = writeResult.uri;
      diaglogElement.current?.showModal();
      setDialogElementText("Generating file, please wait...");
      if (Capacitor.isNativePlatform()) {
        try {
          await Share.share({
            title: "sujud-backup",
            files: [filePath],
            dialogTitle: "Share your database backup",
          });
        } catch (error) {
          console.error("Error sharing file: ", error);
          throw new Error("Error sharing file");
        }
      }

      await Filesystem.deleteFile({
        path: filePath,
        directory: Directory.Cache,
      });
    } catch (error) {
      console.error(error);
    } finally {
      diaglogElement.current?.close();
      setDialogElementText("");
      await toggleDBConnection(dbConnection, "close");
    }
  };

  const handleDBImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      await toggleDBConnection(dbConnection, "close");
      const reader = new FileReader();
      reader.onload = async (e) => {
        if (!sqliteConnection.current) {
          throw new Error("sqliteConnection does not exist");
        }
        if (!e.target) {
          throw new Error("e.target is null");
        }
        let fileContent = e.target.result;
        if (typeof fileContent !== "string") {
          throw new Error("File content is not a string");
        }

        try {
          const parsedJSON = JSON.parse(fileContent);
          if (parsedJSON.database && parsedJSON.database !== "sujuddatabase") {
            parsedJSON.database = "sujuddatabase";
            fileContent = JSON.stringify(parsedJSON);
          }
        } catch (error) {
          console.error("Error parsing JSON to update database name", error);
        }

        try {
          await sqliteConnection.current.isJsonValid(fileContent);
        } catch (error) {
          showToast(`File not recognised, file is invalid - ${error}`, "long");
          throw new Error("JSON is not valid");
        }
        try {
          diaglogElement.current?.showModal();
          setDialogElementText("Importing file, please wait...");
          await sqliteConnection.current.importFromJson(fileContent);
          diaglogElement.current?.close();
          showToast("Import Successful", "short");

          const isDBImported = true;
          await fetchDataFromDB(isDBImported);
        } catch (error) {
          console.error("Error importing backup file", error);
          diaglogElement.current?.close();
          showToast(`Unable to import file - ${error}`, "long");
          throw new Error("Error importing backup file");
        }
      };
      reader.onerror = (error) => {
        console.error("Error reading file: ", error);
      };
      if (!e.target.files) {
        throw new Error("e.target.files does not exist");
      }

      const file = e.target.files[0];

      if (file) {
        reader.readAsText(file);
      } else {
        throw new Error("No file selected");
      }
    } catch (error) {
      console.error(error);
    } finally {
      diaglogElement.current?.close();
      setDialogElementText("");
    }
  };

  const link = (url: string) => {
    window.location.href = url;
  };

  const hasMountedMissedSalah = useRef(false);
  useEffect(() => {
    if (!hasMountedMissedSalah.current) {
      hasMountedMissedSalah.current = true;
      return;
    }

    const updateStateAndDB = async () => {
      if (isMissedSalahCounterOptionChecked) {
        await updateUserPrefs(
          dbConnection,
          "showMissedSalahCount",
          "1",
          setUserPreferences,
        );
      } else {
        await updateUserPrefs(
          dbConnection,
          "showMissedSalahCount",
          "0",
          setUserPreferences,
        );
      }
    };

    updateStateAndDB();
  }, [isMissedSalahCounterOptionChecked]);

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar className="page-header-toolbar border-b border-[#242424]">
          <div className="flex items-center justify-between px-3 py-1">
            <span className="text-xs font-bold tracking-widest uppercase text-white font-mono">
              SETTINGS
            </span>
          </div>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <motion.section className="settings-page-wrap p-4 max-w-lg mx-auto font-mono">
          <div className="space-y-5">
            {/* ACCOUNT & CLOUD SYNC */}
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-[#71717A] px-1 mb-1.5">
                ACCOUNT & SYNC
              </div>
              <CloudSyncSettings
                dbConnection={dbConnection}
                sqliteConnection={sqliteConnection}
                userPreferences={userPreferences}
                userLocations={userLocations}
                fetchDataFromDB={fetchDataFromDB}
              />
            </div>

            {/* NOTIFICATIONS */}
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-[#71717A] px-1 mb-1.5">
                NOTIFICATIONS
              </div>
              <div className="border border-[#242424] rounded-[4px] bg-[#121212] overflow-hidden divide-y divide-[#242424]">
                <div
                  className="flex items-center justify-between py-3 px-3.5 bg-[#121212] hover:bg-[#161616] transition-colors cursor-pointer"
                  id="open-notification-options-sheet"
                >
                  <div className="flex flex-col pr-2">
                    <p className="text-xs font-mono font-medium text-white tracking-wide">
                      Prayer Notifications
                    </p>
                    <p className="text-[11px] font-mono text-[#71717A] mt-0.5">
                      Configure adhan and prayer reminder alerts
                    </p>
                  </div>
                  <MdOutlineChevronRight className="text-[#52525B] text-base" />
                </div>
              </div>
              <BottomSheetNotifications
                dbConnection={dbConnection}
                triggerId="open-notification-options-sheet"
                isAppActive={isAppActive}
                setUserPreferences={setUserPreferences}
                userPreferences={userPreferences}
                userLocations={userLocations}
              />
            </div>

            {/* PREFERENCES & DISPLAY */}
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-[#71717A] px-1 mb-1.5">
                PREFERENCES & DISPLAY
              </div>
              <div className="border border-[#242424] rounded-[4px] bg-[#121212] overflow-hidden divide-y divide-[#242424]">
                <SettingIndividual
                  id="open-theme-options-sheet"
                  headingText="Theme"
                  subText="Matte Charcoal / System Theme"
                />
                <SettingIndividual
                  onClick={() => {
                    if (userLocations.length === 0) {
                      showAlert(
                        "Location / Salah times not set",
                        "Please add a location or set up Salah times on the Salah times page first.",
                      );
                      return;
                    }
                    setShowSalahTimesSettingsSheet(true);
                  }}
                  headingText="Salah Times Calculation"
                  subText="Adjust calculation method and juristic angles"
                />
                <div className="flex items-center justify-between py-3 px-3.5 bg-[#121212]">
                  <div className="flex flex-col pr-2">
                    <p className="text-xs font-mono font-medium text-white tracking-wide">
                      Missed Salah Counter
                    </p>
                    <p className="text-[11px] font-mono text-[#71717A] mt-0.5">
                      Display missed salah counter on tracker
                    </p>
                  </div>
                  <IonToggle
                    style={{
                      "--track-background": "#242424",
                      "--track-background-checked": "#10B981",
                      "--handle-background": "#FFFFFF",
                      "--handle-background-checked": "#FFFFFF",
                    }}
                    checked={isMissedSalahCounterOptionChecked}
                    onIonChange={() => {
                      setIsMissedSalahCounterOptionChecked((prev) => !prev);
                    }}
                  />
                </div>
                <SettingIndividual
                  id="open-edit-reasons-sheet"
                  headingText="Edit Reasons"
                  subText="Add or modify missed prayer reasons"
                />
                <SettingIndividual
                  id="open-change-start-date-sheet"
                  headingText="App Start Date"
                  subText="Change tracking inception date"
                />
              </div>

              <BottomSheetThemeOptions
                dbConnection={dbConnection}
                triggerId="open-theme-options-sheet"
                setUserPreferences={setUserPreferences}
                theme={theme}
                handleTheme={handleTheme}
              />
              <BottomSheetSalahTimesSettings
                setShowSalahTimesSettingsSheet={setShowSalahTimesSettingsSheet}
                showSalahTimesSettingsSheet={showSalahTimesSettingsSheet}
                dbConnection={dbConnection}
                setUserPreferences={setUserPreferences}
                userPreferences={userPreferences}
                userLocations={userLocations}
              />
              <BottomSheetEditReasons
                dbConnection={dbConnection}
                triggerId="open-edit-reasons-sheet"
                setUserPreferences={setUserPreferences}
                userPreferences={userPreferences}
              />
              <BottomSheetStartDate
                dbConnection={dbConnection}
                triggerId="open-change-start-date-sheet"
                setUserPreferences={setUserPreferences}
                userPreferences={userPreferences}
                fetchDataFromDB={fetchDataFromDB}
              />
              <BottomSheetBatchUpdate
                dbConnection={dbConnection}
                handleSalahTrackingDataFromDB={handleSalahTrackingDataFromDB}
                setShowBatchUpdateModal={setShowBatchUpdateModal}
                showBatchUpdateModal={showBatchUpdateModal}
                userPreferences={userPreferences}
              />
            </div>

            {/* DATA & BACKUP */}
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-[#71717A] px-1 mb-1.5">
                DATA & BACKUP
              </div>
              <div className="border border-[#242424] rounded-[4px] bg-[#121212] overflow-hidden divide-y divide-[#242424]">
                <SettingIndividual
                  headingText="Import Data"
                  subText="Restore SQLite database from JSON backup file"
                  onClick={triggerInput}
                />
                <SettingIndividual
                  headingText="Export Data"
                  subText="Generate full SQLite database JSON backup"
                  onClick={async () => {
                    await handleDBExport();
                  }}
                />
              </div>
            </div>

            {/* ABOUT & SYSTEM */}
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-[#71717A] px-1 mb-1.5">
                ABOUT & SYSTEM
              </div>
              <div className="border border-[#242424] rounded-[4px] bg-[#121212] overflow-hidden divide-y divide-[#242424]">
                <SettingIndividual
                  headingText="Source Code"
                  subText="github.com/tokitauhid/sujud"
                  onClick={() => {
                    link("https://github.com/tokitauhid/sujud");
                  }}
                />
                <div className="flex items-center justify-between py-3 px-3.5 bg-[#121212]">
                  <div className="flex flex-col">
                    <p className="text-xs font-mono font-medium text-white tracking-wide">
                      Build Version
                    </p>
                    <p className="text-[11px] font-mono text-[#71717A] mt-0.5">
                      Strict Utilitarian System
                    </p>
                  </div>
                  <span className="text-xs font-mono text-[#8E8E93]">v1.4.0</span>
                </div>
              </div>
            </div>

            <input
              ref={importDBRef}
              className="hidden"
              onChange={handleDBImport}
              type="file"
              accept=".json"
              id="backupfile"
              name="backupfile"
            />
            <dialog
              className="fixed z-50 p-4 text-white transform -translate-x-1/2 rounded-[4px] border border-[#242424] -translate-y-3/4 bg-[#121212] font-mono text-xs top-3/4 left-1/2"
              ref={diaglogElement}
            >
              {dialogElementText}
            </dialog>
          </div>
        </motion.section>
      </IonContent>
    </IonPage>
  );
};

export default SettingsPage;

