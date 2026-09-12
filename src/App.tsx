import { useState, useEffect, useRef } from "react";
import { IonReactRouter } from "@ionic/react-router";
import { App as capacitorApp } from "@capacitor/app";

import {
  IonApp,
  IonIcon,
  IonRouterOutlet,
  IonTabBar,
  IonTabButton,
  IonTabs,
} from "@ionic/react";

import {
  add,
  home,
  homeOutline,
  settings,
  settingsOutline,
  statsChart,
  statsChartOutline,
  time,
  timeOutline,
} from "ionicons/icons";

import NavTabItem from "./components/Navigation/NavTabItem";
import QuickLogModal from "./components/QuickLogModal";

import { Redirect } from "react-router-dom";

import HomePage from "./pages/HomePage";
import SettingsPage from "./pages/SettingsPage";
import StatsPage from "./pages/StatsPage";


import {
  checkNotificationPermissions,
  updateUserPrefs,
  setStatusAndNavBarBGColor,
  getSalahTimes,
  scheduleSalahNotifications,
  getNextSalah,
  scheduleAfterIshaDailyNotifications,
} from "./utils/helpers";
import {
  DBResultDataObjType,
  PreferenceObjType,
  userPreferencesType,
  SalahNamesType,
  SalahRecordType,
  SalahRecordsArrayType,
  SalahStatusType,
  SalahByDateObjType,
  streakDatesObjType,
  themeType,
  LocationsDataObjTypeArr,
  nextSalahTimeType,
  salahTimesObjType,
  OnboardingMode,
} from "./types/types";

import { Style } from "@capacitor/status-bar";
import { SplashScreen } from "@capacitor/splash-screen";
import { Capacitor, PluginListenerHandle } from "@capacitor/core";
import {
  format,
  parse,
  differenceInDays,
  subDays,
  parseISO,
  isAfter,
  startOfDay,
  isValid,
} from "date-fns";
import { PreferenceType } from "./types/types";

import useSQLiteDB from "./utils/useSqLiteDB";
// import { LocalNotifications } from "@capacitor/local-notifications";
import Onboarding from "./components/Onboarding";
import { Route } from "react-router-dom";
import SalahTimesPage from "./pages/SalahTimesPage";
import { withDB } from "./utils/dbUtils";
import { LocalNotifications } from "@capacitor/local-notifications";
import {
  adhanLibrarySalahs,
  dictPreferencesDefaultValues,
} from "./utils/constants";
import TabletSideNav from "./components/TabletSideNav";
import { FirebaseAuthProvider, useFirebaseAuth } from "./firebase/useFirebaseAuth";
import { initRealtimeSync, initialSyncOnSignIn } from "./firebase/syncService";
import { checkAndGenerateTrendNotifications } from "./utils/trendAnalysis";


const AppContent = () => {
  const justLaunched = useRef(true);
  const { user } = useFirebaseAuth();

  const {
    isDatabaseInitialised,
    sqliteConnection,
    dbConnection,
    initialiseTables,
  } = useSQLiteDB();

  const [onboardingMode, setOnboardingMode] = useState<OnboardingMode>(null);

  const [showMissedSalahsSheet, setShowMissedSalahsSheet] = useState(false);
  const [showSalahTimesSettingsSheet, setShowSalahTimesSettingsSheet] =
    useState(false);
  const [missedSalahList, setMissedSalahList] = useState<SalahByDateObjType>(
    {},
  );
  const [userLocations, setUserLocations] = useState<LocationsDataObjTypeArr>(
    [],
  );
  const [isMultiEditMode, setIsMultiEditMode] = useState<boolean>(false);
  const [showJoyRideEditIcon, setShowJoyRideEditIcon] =
    useState<boolean>(false);
  const [streakDatesObjectsArr, setStreakDatesObjectsArr] = useState<
    streakDatesObjType[]
  >([]);
  const [activeStreakCount, setActiveStreakCount] = useState(0);
  const [fetchedSalahData, setFetchedSalahData] =
    useState<SalahRecordsArrayType>([]);

  const [userPreferences, setUserPreferences] = useState<userPreferencesType>(
    dictPreferencesDefaultValues,
  );
  const [showLocationFailureToast, setShowLocationFailureToast] =
    useState<boolean>(false);
  const [showLocationAddedToast, setShowLocationAddedToast] =
    useState<boolean>(false);
  const [showLocationDeletedToast, setShowLocationDeletedToast] =
    useState<boolean>(false);

  const [salahTimes, setSalahtimes] = useState({
    fajr: "",
    sunrise: "",
    dhuhr: "",
    asr: "",
    maghrib: "",
    isha: "",
  });

  const [nextSalahNameAndTime, setNextSalahNameAndTime] =
    useState<nextSalahTimeType>({
      currentSalah: "",
      nextSalah: "",
      nextSalahTime: null as Date | null,
      hoursRemaining: 0,
      minsRemaining: 0,
    });

  const [isAppActive, setIsAppActive] = useState(true);
  const [showQuickLogModal, setShowQuickLogModal] = useState(false);

  // -----------------------------------------------------------------------
  // Real-time cloud sync: replaces the old AutomaticSync component
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!user || !isDatabaseInitialised || !dbConnection.current) return;

    let unsubscribe: (() => void) | null = null;

    const setup = async () => {
      // One-time initial sync on sign-in
      try {
        const result = await initialSyncOnSignIn(user.uid, dbConnection);
        if (result === 'pulled') {
          await fetchDataFromDB();
        }
      } catch (e) {
        console.error("[SYNC] Initial sync failed:", e);
      }

      // Start real-time listeners
      unsubscribe = initRealtimeSync(user.uid, dbConnection, {
        onSalahLogsChanged: () => {
          // Refresh salah data from SQLite to get consistent state
          fetchDataFromDB();
        },
        onPreferencesChanged: (prefs) => {
          // Update React state directly from incoming prefs
          setUserPreferences(prev => {
            const updated = { ...prev };
            for (const [key, pref] of Object.entries(prefs)) {
              if (key === "reasons") {
                const val = pref.value;
                (updated as any).reasons = Array.isArray(val)
                  ? val
                  : typeof val === "string"
                  ? val.split(",").filter(Boolean)
                  : [];
              } else {
                (updated as any)[key] = pref.value;
              }
            }
            return updated;
          });
        },
        onLocationsChanged: () => {
          // Refresh locations from SQLite
          fetchDataFromDB();
        },
      });
    };

    setup();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user?.uid, isDatabaseInitialised]);

  useEffect(() => {
    // if (!isDatabaseInitialised) return;
    let appState: PluginListenerHandle;

    (async () => {
      appState = await capacitorApp.addListener(
        "appStateChange",
        ({ isActive }) => {
          if (isActive) {
            (async () => {
              try {
                const todaysDate = startOfDay(new Date());
                const lastLaunchDate = startOfDay(
                  new Date(userPreferences.lastLaunchDate),
                );

                if (isAfter(todaysDate, lastLaunchDate)) {
                  await scheduleAllSalahNotifications();
                  await fetchDataFromDB();
                  await checkAndGenerateTrendNotifications(
                    dbConnection,
                    userPreferences,
                    fetchedSalahData,
                    setUserPreferences,
                  );
                  // await generateSalahTimes(
                  //   userLocations,
                  //   userPreferences,
                  //   setSalahtimes,
                  // );
                }

                // await getNextSalahDetails();

                await updateUserPrefs(
                  dbConnection,
                  "lastLaunchDate",
                  new Date().toISOString(),
                  setUserPreferences,
                );

              } catch (error) {
                console.error(
                  "Unable to generate salah times / schedule notifications",
                  error,
                );
              }
            })();
          }
          setIsAppActive(isActive);
        },
      );
    })();

    return () => {
      appState?.remove();
    };
  }, []);
  // }, [userLocations, userPreferences]);

  const getNextSalahDetails = async () => {
    if (!userLocations) {
      console.error("userLocations is undefined");
      return;
    }

    const result = await getNextSalah(userLocations, userPreferences);
    if (!result) return;

    // console.log("RESULT IN GET NEXT SALAH DETAILS: ", result);

    const {
      currentSalah,
      nextSalah,
      nextSalahTime,
      hoursRemaining,
      minsRemaining,
    } = result;
    setNextSalahNameAndTime({
      currentSalah: currentSalah,
      nextSalah: nextSalah,
      nextSalahTime: nextSalahTime,
      hoursRemaining: hoursRemaining,
      minsRemaining: minsRemaining,
    });
    // setNextSalahNameAndTime({
    //   currentSalah: "none",
    //   nextSalah: "fajr",
    //   nextSalahTime: nextSalahTime,
    //   hoursRemaining: hoursRemaining,
    //   minsRemaining: minsRemaining,
    // });

    // console.log("nextSalahNameAndTime:", nextSalahNameAndTime);
  };

  useEffect(() => {
    if (!isDatabaseInitialised) return;
    getNextSalahDetails();

    const interval = setInterval(() => {
      getNextSalahDetails();
    }, 30000);

    return () => clearInterval(interval);
  }, [userLocations, isDatabaseInitialised, userPreferences]);

  const [theme, setTheme] = useState<themeType>("dark");

  const handleTheme = (theme?: themeType) => {
    let themeColor = theme ? theme : userPreferences.theme;

    setTheme(themeColor);
    let statusBarThemeColor: string = "#242424";

    if (themeColor === "system") {
      const media = window.matchMedia("(prefers-color-scheme: dark)");
      themeColor = media.matches ? "dark" : "light";
    }

    if (themeColor === "dark") {
      statusBarThemeColor = "#121315";
      document.body.classList.add("dark");
    } else if (themeColor === "light") {
      statusBarThemeColor = "#FAF7F4";
      document.body.classList.remove("dark");
    }

    if (Capacitor.isNativePlatform()) {
      const statusBarIconsColor =
        statusBarThemeColor === "#FAF7F4" ? Style.Light : Style.Dark;
      if (Capacitor.getPlatform() === "android" && justLaunched.current) {
        setTimeout(() => {
          setStatusAndNavBarBGColor(statusBarThemeColor, statusBarIconsColor);
          justLaunched.current = false;
        }, 750);
      } else {
        setStatusAndNavBarBGColor(statusBarThemeColor, statusBarIconsColor);
      }
    }

    return statusBarThemeColor;
  };

  useEffect(() => {
    const initializeApp = async () => {
      // await SplashScreen.hide({ fadeOutDuration: 250 });
      if (isDatabaseInitialised === true) {
        await fetchDataFromDB();

        if (Capacitor.isNativePlatform()) {
          setTimeout(async () => {
            await SplashScreen.hide({ fadeOutDuration: 250 });
          }, 500);
        }

        await updateUserPrefs(
          dbConnection,
          "lastLaunchDate",
          // new Date().toISOString(),
          new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          setUserPreferences,
        );

      }
    };

    initializeApp();
  }, [isDatabaseInitialised]);

  useEffect(() => {
    if (Capacitor.getPlatform() !== "android") return;

    const createAndroidNotificationChannels = async () => {
      await LocalNotifications.createChannel({
        id: "daily-reminder",
        name: "Daily Reminder",
        importance: 4,
        description: "Daily reminder to log prayers",
        sound: "default",
        visibility: 1,
        vibration: true,
      });

      await LocalNotifications.createChannel({
        id: "dhuhr-asr-maghrib-isha-reminders-with-adhan",
        name: "Salah reminders (Adhan)",
        importance: 4,
        description: "Adhan for Dhuhr, Asr, Maghrib and Isha",
        sound: "adhan.mp3",
        visibility: 1,
        vibration: true,
      });

      await LocalNotifications.createChannel({
        id: "fajr-reminder-with-adhan",
        name: "Fajr Adhan",
        importance: 4,
        description: "Fajr adhan reminder",
        sound: "adhan_fajr.mp3",
        visibility: 1,
        vibration: true,
      });

      await LocalNotifications.createChannel({
        id: "salah-reminders-without-adhan",
        name: "Salah reminders without adhan",
        importance: 4,
        description: "Salah reminders",
        sound: "default",
        visibility: 1,
        vibration: true,
      });

      await LocalNotifications.createChannel({
        id: "trend-summary",
        name: "Weekly & Periodic Trend Summary",
        importance: 4,
        description: "Periodic summaries of your prayer habits and progress",
        sound: "default",
        visibility: 1,
        vibration: true,
      });
    };

    createAndroidNotificationChannels();
  }, []);

  useEffect(() => {
    // Listen for notification tap / action performance for deep-linking
    let listenerHandle: any = null;

    const setupNotificationListener = async () => {
      try {
        listenerHandle = await LocalNotifications.addListener(
          "localNotificationActionPerformed",
          (notificationAction) => {
            const extra = notificationAction?.notification?.extra;
            if (extra?.type === "trend_analysis" && extra?.snapshotId) {
              window.location.href = `/StatsPage?tab=trends&snapshotId=${encodeURIComponent(
                extra.snapshotId,
              )}`;
            }
          },
        );
      } catch (err) {
        console.error("Error setting up notification action listener:", err);
      }
    };

    setupNotificationListener();

    return () => {
      if (listenerHandle && listenerHandle.remove) {
        listenerHandle.remove();
      }
    };
  }, []);

  useEffect(() => {
    if (isDatabaseInitialised && fetchedSalahData.length > 0) {
      checkAndGenerateTrendNotifications(
        dbConnection,
        userPreferences,
        fetchedSalahData,
        setUserPreferences,
      );
    }
  }, [isDatabaseInitialised, fetchedSalahData.length]);

  useEffect(() => {
    handleTheme(userPreferences.theme);
  }, [userPreferences.theme]);

  const scheduleAllSalahNotifications = async () => {
    const salahs = adhanLibrarySalahs;

    for (let i = 0; i < salahs.length; i++) {
      const salahAdjustmentKey = `${salahs[i]}Notification`;

      const salahNotificationSetting =
        userPreferences[salahAdjustmentKey as keyof userPreferencesType];

      if (
        salahNotificationSetting === "on" ||
        salahNotificationSetting === "adhan"
      ) {
        await scheduleSalahNotifications(
          userLocations,
          salahs[i],
          userPreferences,
          salahNotificationSetting,
        );
      }
    }
  };

  const generateSalahTimes = async (
    userLocations: LocationsDataObjTypeArr,
    userPreferences: userPreferencesType,
    setSalahtimes: React.Dispatch<React.SetStateAction<salahTimesObjType>>,
  ) => {
    await getSalahTimes(
      userLocations,
      new Date(),
      userPreferences,
      setSalahtimes,
    );
  };

  useEffect(() => {
    if (
      !isDatabaseInitialised ||
      userLocations.length === 0 ||
      userPreferences.prayerCalculationMethod === ""
    ) {
      return;
    }

    // const todaysDate = new Date();

    (async () => {
      try {
        await generateSalahTimes(userLocations, userPreferences, setSalahtimes);
        await scheduleAllSalahNotifications();
      } catch (error) {
        console.error(
          "Unable to generate salah times / schedule notifications",
        );
      }
    })();

    const scheduleDailyNotifications = async () => {
      await scheduleAfterIshaDailyNotifications(
        Number(userPreferences.dailyNotificationAfterIshaDelay),
        userLocations,
        userPreferences,
      );
    };

    if (
      userPreferences.dailyNotification === "1" &&
      userPreferences.dailyNotificationOption === "afterIsha"
    ) {
      scheduleDailyNotifications();
    }

    getNextSalahDetails();
  }, [
    userPreferences.prayerCalculationMethod,
    userPreferences.madhab,
    userPreferences.highLatitudeRule,
    userPreferences.fajrAngle,
    userPreferences.ishaAngle,
    userPreferences.fajrAdjustment,
    userPreferences.dhuhrAdjustment,
    userPreferences.asrAdjustment,
    userPreferences.maghribAdjustment,
    userPreferences.ishaAdjustment,
    userPreferences.shafaqRule,
    userPreferences.polarCircleResolution,
    userPreferences.timeFormat,
    // userPreferences.country,
    userLocations,
  ]);

  useEffect(() => {
    let copyOfMissedSalahList: SalahByDateObjType = {};
    fetchedSalahData.forEach((obj) => {
      for (let salahName in obj.salahs) {
        if (obj.salahs[salahName as SalahNamesType] === "missed") {
          const arr = copyOfMissedSalahList[obj.date] ?? [];
          arr.push(salahName as SalahNamesType);
          copyOfMissedSalahList[obj.date] = arr;
        }
      }
    });
    setMissedSalahList({ ...copyOfMissedSalahList });
  }, [fetchedSalahData]);

  const fetchDataFromDB = async (isDBImported?: boolean) => {
    try {
      if (!dbConnection || !dbConnection.current) {
        throw new Error("dbConnection / dbconnection.current does not exist");
      }

      if (isDBImported) {
        await initialiseTables();
        await updateUserPrefs(
          dbConnection,
          "isExistingUser",
          "1",
          setUserPreferences,
        );
      }

      // Query SQLite inside withDB so reads are queued behind any in-progress writes
      let { DBResultPreferences: prefsResult, DBResultAllSalahData, DBResultLocations } =
        await withDB(dbConnection, async (db) => {
          const p = await db.query(`SELECT * FROM userPreferencesTable`);
          const s = await db.query(`SELECT * FROM salahDataTable WHERE deleted = 0`);
          const l = await db.query(`SELECT * FROM userLocationsTable WHERE deleted = 0`);
          return {
            DBResultPreferences: p,
            DBResultAllSalahData: s,
            DBResultLocations: l,
          };
        });

      let DBResultPreferences = prefsResult;

      console.log(`[FETCH DEBUG] Prefs: ${DBResultPreferences?.values?.length ?? 0}, Salahs: ${DBResultAllSalahData?.values?.length ?? 0}, Locs: ${DBResultLocations?.values?.length ?? 0}`);

      if (!DBResultPreferences || !DBResultPreferences.values) {
        throw new Error(
          "DBResultPreferences or DBResultPreferences.values do not exist",
        );
      }
      if (!DBResultAllSalahData || !DBResultAllSalahData.values) {
        throw new Error(
          "DBResultAllSalahData or !DBResultAllSalahData.values do not exist",
        );
      }
      if (!DBResultLocations || !DBResultLocations.values) {
        throw new Error(
          "DBResultLocations or !DBResultLocations.values do not exist",
        );
      }

      if (window.location.search.includes("demo_data=1")) {
        const hasLocation = DBResultLocations.values.some((l: any) => l.isSelected === 1);
        if (!hasLocation) {
          await dbConnection.current.run(
            `INSERT OR REPLACE INTO userLocationsTable(id, locationName, latitude, longitude, isSelected) VALUES (1, 'London, UK', 51.5074, -0.1278, 1)`
          );
          const today = new Date();
          const twoWeeksAgo = new Date(today);
          twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
          const startDateStr = format(twoWeeksAgo, "yyyy-MM-dd");

          await dbConnection.current.run(
            `INSERT OR REPLACE INTO userPreferencesTable(preferenceName, preferenceValue) VALUES ('userStartDate', ?)`,
            [startDateStr]
          );
          await dbConnection.current.run(
            `INSERT OR REPLACE INTO userPreferencesTable(preferenceName, preferenceValue) VALUES ('prayerCalculationMethod', 'MuslimWorldLeague')`
          );
          await dbConnection.current.run(
            `INSERT OR REPLACE INTO userPreferencesTable(preferenceName, preferenceValue) VALUES ('country', 'United Kingdom')`
          );
          await dbConnection.current.run(
            `INSERT OR REPLACE INTO userPreferencesTable(preferenceName, preferenceValue) VALUES ('isExistingUser', '1')`
          );
          await dbConnection.current.run(
            `INSERT OR REPLACE INTO userPreferencesTable(preferenceName, preferenceValue) VALUES ('userGender', 'male')`
          );

          for (let i = 0; i <= 14; i++) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const dateStr = format(d, "yyyy-MM-dd");
            const isAllJamaah = i === 1 || i === 3 || i === 5 || i === 8;
            const prayers = ["Fajr", "Dhuhr", "Asar", "Maghrib", "Isha"];
            for (let pIdx = 0; pIdx < prayers.length; pIdx++) {
              const p = prayers[pIdx];
              let status = "group";
              if (!isAllJamaah) {
                status = (i + pIdx) % 3 === 0 ? "male-alone" : "group";
              }
              await dbConnection.current.run(
                `INSERT OR REPLACE INTO salahDataTable(date, salahName, salahStatus, reasons, notes, createdAt, updatedAt, deleted) VALUES (?, ?, ?, '', '', ?, ?, 0)`,
                [dateStr, p, status, Date.now(), Date.now()]
              );
            }
          }
          DBResultLocations = await dbConnection.current.query(`SELECT * FROM userLocationsTable`);
          DBResultPreferences = await dbConnection.current.query(`SELECT * FROM userPreferencesTable`);
          DBResultAllSalahData = await dbConnection.current.query(`SELECT * FROM salahDataTable WHERE deleted = 0`);
        }
      }

      if (!DBResultPreferences.values || !DBResultAllSalahData.values || !DBResultLocations.values) {
        throw new Error("Missing DB values");
      }

      setUserLocations(DBResultLocations.values);

      const userNotificationPermission = await checkNotificationPermissions();

      const notificationValue = DBResultPreferences.values.find(
        (row) => row.preferenceName === "dailyNotification",
      );

      const isExistingUser =
        DBResultPreferences.values.find(
          (row) => row.preferenceName === "isExistingUser",
        ) || "";

      if (
        (isExistingUser === "" || isExistingUser.preferenceValue === "0") &&
        !window.location.search.includes("no_onboarding")
      ) {
        setOnboardingMode("newUser");
      }

      if (
        userNotificationPermission !== "granted" &&
        notificationValue === "1"
      ) {
        try {
          await updateUserPrefs(
            dbConnection,
            "dailyNotification",
            "0",
            setUserPreferences,
          );

          // Re-read preferences after the update (DB stays open)
          DBResultPreferences = await dbConnection.current.query(
            `SELECT * FROM userPreferencesTable`,
          );
        } catch (error) {
          console.error(
            "Error modifying dailyNotification value in database:",
            error,
          );
        }
      }
      try {
        if (!DBResultPreferences || !DBResultPreferences.values) {
          throw new Error(
            "DBResultPreferences or DBResultPreferences.values do not exist",
          );
        }
        await handleUserPreferencesDataFromDB(
          DBResultPreferences.values as PreferenceObjType[],
          DBResultAllSalahData.values,
        );
      } catch (error) {
        console.error(error);
      }
    } catch (error) {
      console.error(error);
      return;
    }
    // NOTE: DB intentionally NOT closed here — it stays open for sync listeners
  };

  const handleUserPreferencesDataFromDB = async (
    DBResultPreferences: PreferenceObjType[],
    DBResultAllSalahData: DBResultDataObjType[],
  ) => {
    let DBResultPreferencesValues = DBResultPreferences;

    try {
      if (!dbConnection || !dbConnection.current) {
        throw new Error("dbConnection / dbconnection.current does not exist");
      }

      if (DBResultPreferencesValues.length === 0) {
        const params = Object.keys(dictPreferencesDefaultValues)
          .map((key) => {
            const value =
              dictPreferencesDefaultValues[key as keyof userPreferencesType];
            return [key, Array.isArray(value) ? value.join(",") : value];
          })
          .flat();

        const placeholders = Array(params.length / 2)
          .fill("(?, ?)")
          .join(", ");

        const insertQuery = `
        INSERT INTO userPreferencesTable (preferenceName, preferenceValue) 
        VALUES ${placeholders};
        `;

        await dbConnection.current.run(insertQuery, params);
        const DBResultPreferencesQuery = await dbConnection.current.query(
          `SELECT * FROM userPreferencesTable`,
        );

        if (!DBResultPreferencesQuery || !DBResultPreferencesQuery.values) {
          throw new Error(
            "No values returned from the DBResultPreferencesQuery.",
          );
        }
        DBResultPreferencesValues =
          DBResultPreferencesQuery.values as PreferenceObjType[];
      } else if (DBResultPreferencesValues.length > 0) {
        const DBResultPreferencesQuery = await dbConnection.current.query(
          `SELECT * FROM userPreferencesTable`,
        );

        if (!DBResultPreferencesQuery || !DBResultPreferencesQuery.values) {
          throw new Error(
            "No values returned from the DBResultPreferencesQuery.",
          );
        }

        DBResultPreferencesValues =
          DBResultPreferencesQuery.values as PreferenceObjType[];
      }
    } catch (error) {
      console.error(error);
    }

    // ---------------------------------------------------------------
    // BATCHED preference assignment: build the full prefs object in
    // one pass, then call setUserPreferences ONCE instead of 30+ times
    // ---------------------------------------------------------------
    const batchedPrefs: Partial<userPreferencesType> = {};
    const missingPrefs: PreferenceType[] = [];

    for (const key of Object.keys(dictPreferencesDefaultValues)) {
      const preference = key as keyof userPreferencesType;
      const preferenceQuery = DBResultPreferencesValues.find(
        (row) => row.preferenceName === preference,
      );

      if (preferenceQuery) {
        const prefName = preferenceQuery.preferenceName;
        const prefValue = preferenceQuery.preferenceValue;
        (batchedPrefs as any)[prefName] =
          prefName === "reasons"
            ? (typeof prefValue === "string" ? prefValue.split(",").filter(Boolean) : (Array.isArray(prefValue) ? prefValue : []))
            : prefValue;
      } else {
        missingPrefs.push(preference);
      }
    }

    // Insert missing preferences into DB (rare — first run or import)
    for (const pref of missingPrefs) {
      await updateUserPrefs(
        dbConnection,
        pref,
        dictPreferencesDefaultValues[pref],
        setUserPreferences,
      );
      // Also add to our batch so the final state is complete
      (batchedPrefs as any)[pref] = dictPreferencesDefaultValues[pref];
    }

    // Single setState call for all preferences
    setUserPreferences((prev) => ({ ...prev, ...batchedPrefs }));

    const startDatePref = DBResultPreferencesValues.find(
      (row) => row.preferenceName === "userStartDate",
    )?.preferenceValue;

    if (!startDatePref) {
      throw new Error("userStartDate not found in preferences");
    }

    await handleSalahTrackingDataFromDB(DBResultAllSalahData, startDatePref);
  };

  const handleSalahTrackingDataFromDB = async (
    DBResultAllSalahData: DBResultDataObjType[],
    userStartDate: string,
  ) => {
    const singleSalahObjArr: SalahRecordsArrayType = [];
    const missedSalahObj: SalahByDateObjType = {};
    const todaysDate = new Date();

    const userStartDateFormattedToDateObject: Date = parse(
      userStartDate,
      "yyyy-MM-dd",
      new Date(),
    );

    if (!isValid(userStartDateFormattedToDateObject)) {
      console.error("Invalid start date, ", userStartDate);
      return;
    }

    const dict: Record<string, DBResultDataObjType[]> = {};

    for (let i = 0; i < DBResultAllSalahData.length; i++) {
      const currentEntry = DBResultAllSalahData[i];

      if (!dict[currentEntry.date]) {
        dict[currentEntry.date] = [];
      }

      dict[currentEntry.date].push(currentEntry);
    }

    console.log("DICTIONARY BUILT");

    const totalDays: number =
      differenceInDays(todaysDate, userStartDateFormattedToDateObject) + 1;

    console.log("TOTAL DAYS GENERATED");

    let currentDate = todaysDate;

    for (let j = 0; j < totalDays; j++) {
      const currentDateFormatted = format(currentDate, "yyyy-MM-dd");

      let singleSalahObj: SalahRecordType = {
        date: currentDateFormatted,
        salahs: {
          Fajr: "",
          Dhuhr: "",
          Asar: "",
          Maghrib: "",
          Isha: "",
        },
      };

      const dataForCurrentDate = dict[currentDateFormatted] || [];

      for (let i = 0; i < dataForCurrentDate.length; i++) {
        let salahName: SalahNamesType = dataForCurrentDate[i].salahName;
        let salahStatus: SalahStatusType = dataForCurrentDate[i].salahStatus;
        singleSalahObj.salahs[salahName] = salahStatus;

        if (salahStatus === "missed") {
          if (dataForCurrentDate[i].date in missedSalahObj) {
            missedSalahObj[dataForCurrentDate[i].date].push(salahName);
          } else {
            missedSalahObj[dataForCurrentDate[i].date] = [salahName];
          }
        }
      }

      singleSalahObjArr.push(singleSalahObj);
      currentDate = subDays(currentDate, 1);
    }

    // Direct assignment — no need to spread-copy, the arrays/objects
    // are freshly constructed above and not shared with anything else.
    setFetchedSalahData(singleSalahObjArr);
    setMissedSalahList(missedSalahObj);
    generateStreaks(singleSalahObjArr);
  };

  // const [activeLocation, setActiveLocation] = useState();

  const generateStreaks = (fetchedSalahData: SalahRecordsArrayType) => {
    const reversedFetchedSalahDataArr = fetchedSalahData.slice().reverse();
    const streakDatesObjectsArray: streakDatesObjType[] = [];
    const streakDatesArr: Date[] = [];
    let excusedDays = 0;
    const todaysDate = new Date();
    let isActiveStreak = false;

    const isConsecutiveDay = (date2: Date, date1: Date) =>
      differenceInDays(date1, date2) === 1;

    const streakBreakingStatuses = ["missed", "late", ""];

    const isStreakBreakingStatus = (statusesArr: SalahStatusType[]) =>
      statusesArr.some((status) => streakBreakingStatuses.includes(status));

    for (
      let i = reversedFetchedSalahDataArr.length > 1 ? 1 : 0;
      i < reversedFetchedSalahDataArr.length;
      i++
    ) {
      const salahStatuses = Object.values(
        reversedFetchedSalahDataArr[i].salahs,
      );

      if (reversedFetchedSalahDataArr.length === 1) {
        const salahStatuses = Object.values(
          reversedFetchedSalahDataArr[0].salahs,
        );

        if (!isStreakBreakingStatus(salahStatuses)) {
          if (salahStatuses.includes("excused")) {
            excusedDays += 1;
          }
          streakDatesArr.push(todaysDate);

          isActiveStreak = true;
          handleEndOfStreak(
            streakDatesArr,
            isActiveStreak,
            excusedDays,
            streakDatesObjectsArray,
          );
          excusedDays = 0;
        }
        return;
      }

      const previousDate = parseISO(reversedFetchedSalahDataArr[i - 1].date);
      const currentDate = parseISO(reversedFetchedSalahDataArr[i].date);
      const firstDateSalahStatuses = Object.values(
        reversedFetchedSalahDataArr[0].salahs,
      );

      if (
        isConsecutiveDay(previousDate, todaysDate) &&
        !salahStatuses.includes("late") &&
        !salahStatuses.includes("missed")
      ) {
        isActiveStreak = true;
      }
      if (
        isConsecutiveDay(previousDate, currentDate) &&
        !isStreakBreakingStatus(salahStatuses)
      ) {
        if (salahStatuses.includes("excused")) {
          excusedDays += 1;
        }

        i === 1 && !isStreakBreakingStatus(firstDateSalahStatuses)
          ? streakDatesArr.push(previousDate, currentDate)
          : streakDatesArr.push(currentDate);

        if (isConsecutiveDay(previousDate, todaysDate)) {
          handleEndOfStreak(
            streakDatesArr,
            isActiveStreak,
            excusedDays,
            streakDatesObjectsArray,
          );
          excusedDays = 0;
        }
      } else {
        handleEndOfStreak(
          streakDatesArr,
          isActiveStreak,
          excusedDays,
          streakDatesObjectsArray,
        );
        excusedDays = 0;
      }
    }
  };

  const handleEndOfStreak = (
    streakDatesArr: Date[],
    isActiveStreak: boolean,
    excusedDays: number,
    streakDatesObjectsArray: streakDatesObjType[],
  ) => {
    // console.log("excusedDays: ", excusedDays);
    // console.log("streakDatesArr: ", streakDatesArr.length);

    // if (excusedDays === streakDatesArr.length) return;
    if (streakDatesArr.length > 0) {
      const streakDaysAmount =
        streakDatesArr.length === 1
          ? 1
          : differenceInDays(
              streakDatesArr[streakDatesArr.length - 1],
              subDays(streakDatesArr[0], 1),
            );
      if (isActiveStreak) {
        setActiveStreakCount(streakDaysAmount - excusedDays);
      } else if (!isActiveStreak) {
        setActiveStreakCount(0);
      }

      let streakDatesObj: streakDatesObjType = {
        startDate: streakDatesArr[0],
        endDate: streakDatesArr[streakDatesArr.length - 1],
        days: streakDaysAmount - excusedDays,
        isActive: isActiveStreak,
        excusedDays: excusedDays,
      };

      streakDatesObjectsArray.push(streakDatesObj);

      setStreakDatesObjectsArr(
        streakDatesObjectsArray
          .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
          .reverse(),
      );
      excusedDays = 0;
      streakDatesArr.length = 0;
    }
  };

  const todayDateStr = format(new Date(), "yyyy-MM-dd");
  const todaySalahRecord = fetchedSalahData.find((r) => r.date === todayDateStr);
  const completedTodayPrayers = todaySalahRecord
    ? [
        todaySalahRecord.salahs.Fajr,
        todaySalahRecord.salahs.Dhuhr,
        todaySalahRecord.salahs.Asar || todaySalahRecord.salahs.Asr,
        todaySalahRecord.salahs.Maghrib,
        todaySalahRecord.salahs.Isha,
      ].filter((s) => Boolean(s) && s !== "missed").length
    : 0;

  const trackerStatusDot = completedTodayPrayers === 5 ? "emerald" : undefined;

  const handleTabClick = () => {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(8);
    }
  };

  return (
    <IonApp>
      <IonReactRouter>
        <IonTabs className="app">
          <IonRouterOutlet
          //  animated={false}
          >
            <Route
              exact
              path="/HomePage"
              render={() => (
                <HomePage
                  dbConnection={dbConnection}
                  setFetchedSalahData={setFetchedSalahData}
                  setUserPreferences={setUserPreferences}
                  setShowJoyRideEditIcon={setShowJoyRideEditIcon}
                  showJoyRideEditIcon={showJoyRideEditIcon}
                  userPreferences={userPreferences}
                  fetchedSalahData={fetchedSalahData}
                  setMissedSalahList={setMissedSalahList}
                  setShowMissedSalahsSheet={setShowMissedSalahsSheet}
                  showMissedSalahsSheet={showMissedSalahsSheet}
                  missedSalahList={missedSalahList}
                  setIsMultiEditMode={setIsMultiEditMode}
                  isMultiEditMode={isMultiEditMode}
                  activeStreakCount={activeStreakCount}
                  generateStreaks={generateStreaks}
                  nextSalahNameAndTime={nextSalahNameAndTime}
                  userLocations={userLocations}
                />
              )}
            />
            <Route
              exact
              path="/SettingsPage"
              render={() => (
                <SettingsPage
                  sqliteConnection={sqliteConnection}
                  dbConnection={dbConnection}
                  setUserPreferences={setUserPreferences}
                  handleSalahTrackingDataFromDB={handleSalahTrackingDataFromDB}
                  isAppActive={isAppActive}
                  theme={theme}
                  handleTheme={handleTheme}
                  fetchDataFromDB={fetchDataFromDB}
                  userPreferences={userPreferences}
                  setShowSalahTimesSettingsSheet={
                    setShowSalahTimesSettingsSheet
                  }
                  showSalahTimesSettingsSheet={showSalahTimesSettingsSheet}
                  userLocations={userLocations}
                />
              )}
            />
            <Route
              exact
              path="/StatsPage"
              render={() => (
                <StatsPage
                  dbConnection={dbConnection}
                  userPreferences={userPreferences}
                  fetchedSalahData={fetchedSalahData}
                  activeStreakCount={activeStreakCount}
                  streakDatesObjectsArr={streakDatesObjectsArr}
                />
              )}
            />
            <Route
              exact
              path="/SalahTimesPage"
              render={() => (
                <SalahTimesPage
                  dbConnection={dbConnection}
                  setShowJoyRideEditIcon={setShowJoyRideEditIcon}
                  setUserPreferences={setUserPreferences}
                  userPreferences={userPreferences}
                  setUserLocations={setUserLocations}
                  userLocations={userLocations}
                  setSalahtimes={setSalahtimes}
                  salahTimes={salahTimes}
                  nextSalahNameAndTime={nextSalahNameAndTime}
                  setShowLocationFailureToast={setShowLocationFailureToast}
                  showLocationFailureToast={showLocationFailureToast}
                  setShowLocationAddedToast={setShowLocationAddedToast}
                  showLocationAddedToast={showLocationAddedToast}
                  setShowLocationDeletedToast={setShowLocationDeletedToast}
                  showLocationDeletedToast={showLocationDeletedToast}
                  setOnboardingMode={setOnboardingMode}
                  onboardingMode={onboardingMode}
                />
              )}
            />
          </IonRouterOutlet>

          <IonTabBar id="nav-bar" slot="bottom">
            <IonTabButton tab="HomePage" href="/HomePage" onClick={handleTabClick}>
              <NavTabItem
                href="/HomePage"
                label="TRACKER"
                iconOutline={homeOutline}
                iconFilled={home}
                statusDot={trackerStatusDot}
              />
            </IonTabButton>

            <IonTabButton tab="StatsPage" href="/StatsPage" onClick={handleTabClick}>
              <NavTabItem
                href="/StatsPage"
                label="STATS"
                iconOutline={statsChartOutline}
                iconFilled={statsChart}
              />
            </IonTabButton>

            {/* Feature 5: Center Quick-Log Action */}
            <IonTabButton
              tab="QuickLog"
              onClick={(e) => {
                e.preventDefault();
                handleTabClick();
                setShowQuickLogModal(true);
              }}
            >
              <div className="flex flex-col items-center justify-center w-full h-full py-1 font-mono">
                <div className="w-8 h-7 rounded-none border border-[#2A2A2A] bg-[#181818] hover:bg-[#202020] flex items-center justify-center text-white transition-all">
                  <IonIcon icon={add} className="text-base text-white" />
                </div>
                <span className="text-[9px] font-semibold uppercase tracking-wider text-[#A1A1AA] mt-0.5">
                  LOG
                </span>
              </div>
            </IonTabButton>

            <IonTabButton tab="SalahTimesPage" href="/SalahTimesPage" onClick={handleTabClick}>
              <NavTabItem
                href="/SalahTimesPage"
                label="PRAYERS"
                iconOutline={timeOutline}
                iconFilled={time}
              />
            </IonTabButton>

            <IonTabButton tab="SettingsPage" href="/SettingsPage" onClick={handleTabClick}>
              <NavTabItem
                href="/SettingsPage"
                label="CONFIG"
                iconOutline={settingsOutline}
                iconFilled={settings}
              />
            </IonTabButton>
          </IonTabBar>
        </IonTabs>
        <TabletSideNav />
        <QuickLogModal
          isOpen={showQuickLogModal}
          onClose={() => setShowQuickLogModal(false)}
          dbConnection={dbConnection}
          nextSalahNameAndTime={nextSalahNameAndTime}
          setFetchedSalahData={setFetchedSalahData}
          userPreferences={userPreferences}
        />
        <Route exact path="/" render={() => <Redirect to="/HomePage" />} />
      </IonReactRouter>
      {/* {onboardingMode && ( */}
      <Onboarding
        setOnboardingMode={setOnboardingMode}
        onboardingMode={onboardingMode}
        setShowJoyRideEditIcon={setShowJoyRideEditIcon}
        dbConnection={dbConnection}
        setUserPreferences={setUserPreferences}
        userPreferences={userPreferences}
        setUserLocations={setUserLocations}
        userLocations={userLocations}
        setShowLocationFailureToast={setShowLocationFailureToast}
        setShowLocationAddedToast={setShowLocationAddedToast}
        fetchDataFromDB={fetchDataFromDB}
      />
      {/* // )} */}

    </IonApp>
  );
};

const App = () => {
  return (
    <FirebaseAuthProvider>
      <AppContent />
    </FirebaseAuthProvider>
  );
};

export default App;
