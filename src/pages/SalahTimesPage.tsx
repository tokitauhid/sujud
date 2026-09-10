import {
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonModal,
  IonPage,
  IonTitle,
  IonToolbar,
  isPlatform,
  useIonViewWillLeave,
} from "@ionic/react";
import {
  LocationsDataObjTypeArr,
  nextSalahTimeType,
  OnboardingMode,
  SalahNamesTypeAdhanLibrary,
  salahTimesObjType,
  userPreferencesType,
} from "../types/types";

import { SQLiteDBConnection } from "@capacitor-community/sqlite";
import {
  chevronBackOutline,
  chevronDown,
  chevronForwardOutline,
  megaphone,
  navigate,
  notifications,
  notificationsOff,
} from "ionicons/icons";

import { useState } from "react";
import Toast from "../components/Toast";
import {
  getSalahTimes,
  handleNotificationPermissions,
  upperCaseFirstLetter,
} from "../utils/helpers";
import BottomSheetLocationsList from "../components/BottomSheets/SalahTimesSheets/BottomSheetLocationsList";
import BottomSheetAddLocation from "../components/BottomSheets/SalahTimesSheets/BottomSheetAddLocation";
import BottomSheetPerSalahNotifications from "../components/BottomSheets/SalahTimesSheets/BottomSheetPerSalahNotifications";
import { addDays, isSameDay, format } from "date-fns";
import {
  INITIAL_MODAL_BREAKPOINT,
  MODAL_BREAKPOINTS,
  prayerCalculationMethodLabels,
} from "../utils/constants";
import Onboarding from "../components/Onboarding";
import CalculationMethodOptions from "../components/CalculationMethodOptions";
import NextSalahTimeWidget from "../components/NextSalahTimeWidget";

interface SalahTimesPageProps {
  dbConnection: React.MutableRefObject<SQLiteDBConnection | undefined>;
  setShowJoyRideEditIcon?: React.Dispatch<React.SetStateAction<boolean>>;
  setUserPreferences: React.Dispatch<React.SetStateAction<userPreferencesType>>;
  userPreferences: userPreferencesType;
  setUserLocations: React.Dispatch<
    React.SetStateAction<LocationsDataObjTypeArr>
  >;
  userLocations: LocationsDataObjTypeArr;
  setSalahtimes?: React.Dispatch<React.SetStateAction<salahTimesObjType>>;
  salahTimes?: salahTimesObjType;
  nextSalahNameAndTime?: nextSalahTimeType;
  setShowLocationFailureToast?: React.Dispatch<React.SetStateAction<boolean>>;
  showLocationFailureToast?: boolean;
  setShowLocationAddedToast?: React.Dispatch<React.SetStateAction<boolean>>;
  showLocationAddedToast?: boolean;
  setShowLocationDeletedToast?: React.Dispatch<React.SetStateAction<boolean>>;
  showLocationDeletedToast?: boolean;
  setOnboardingMode?: React.Dispatch<React.SetStateAction<OnboardingMode>>;
  onboardingMode?: OnboardingMode;
}

const defaultSalahTimesObj: salahTimesObjType = {
  fajr: "",
  sunrise: "",
  dhuhr: "",
  asr: "",
  maghrib: "",
  isha: "",
};

const defaultNextSalahNameAndTime: nextSalahTimeType = {
  currentSalah: "",
  nextSalah: "",
  nextSalahTime: null,
  hoursRemaining: 0,
  minsRemaining: 0,
};

const SalahTimesPage = ({
  dbConnection,
  setShowJoyRideEditIcon = () => {},
  setUserPreferences,
  userPreferences,
  setUserLocations,
  userLocations,
  setSalahtimes = () => {},
  salahTimes = defaultSalahTimesObj,
  nextSalahNameAndTime = defaultNextSalahNameAndTime,
  setShowLocationFailureToast = () => {},
  showLocationFailureToast = false,
  setShowLocationAddedToast = () => {},
  showLocationAddedToast = false,
  setShowLocationDeletedToast = () => {},
  showLocationDeletedToast = false,
  setOnboardingMode = () => {},
  onboardingMode,
}: SalahTimesPageProps) => {
  const [showAddLocationSheet, setShowAddLocationSheet] = useState(false);
  const [showLocationsListSheet, setShowLocationsListSheet] = useState(false);

  const [selectedSalah, setSelectedSalah] =
    useState<SalahNamesTypeAdhanLibrary>("fajr");
  const [showSalahNotificationsSheet, setShowSalahNotificationsSheet] =
    useState(false);
  const [dateToShow, setDateToShow] = useState(new Date());
  const [showCalcMethodsSheet, setShowCalcMethodsSheet] = useState(false);
  const [segmentOption, setSegmentOption] = useState<"manual" | "country">(
    "country",
  );

  useIonViewWillLeave(() => {
    setDateToShow(new Date());
  });

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar className="page-header-toolbar border-b border-[#242424]">
          <div className="flex items-center justify-between px-3 py-1">
            <span className="text-xs font-bold tracking-widest uppercase text-white font-mono">
              PRAYER TIMES
            </span>
            {userLocations?.find((l) => l.isSelected === 1) && (
              <button
                aria-label="show all locations"
                onClick={() => setShowLocationsListSheet(true)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-[3px] border border-[#2A2A2A] bg-[#161616] text-[#8E8E93] hover:text-white text-xs font-mono transition-colors cursor-pointer"
              >
                <IonIcon icon={navigate} className="text-xs" />
                <span>
                  {userLocations.find((l) => l.isSelected === 1)?.locationName}
                </span>
                <IonIcon icon={chevronDown} className="text-[10px]" />
              </button>
            )}
          </div>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        {/* bg-[var(--card-bg-color)]  */}
        <section className="salah-times-page-components-wrap">
          <div className="salah-times-tablet-grid">
            <div className="salah-times-hero-col">
              <NextSalahTimeWidget
                userPreferences={userPreferences}
                userLocations={userLocations}
                nextSalahNameAndTime={nextSalahNameAndTime}
              />
              <section className="text-center">
                {userPreferences.prayerCalculationMethod === "" && (
                  <h4>Salah Times Not Set</h4>
                )}
                {userPreferences.prayerCalculationMethod === "" &&
                  userLocations.length === 0 && (
                    <IonButton
                      onClick={() => {
                        setOnboardingMode("salahTimes");
                      }}
                      className="w-1/2"
                    >
                      Set Up Salah Times
                    </IonButton>
                  )}
                {userPreferences.prayerCalculationMethod === "" &&
                  userLocations.length > 0 && (
                    <IonButton
                      onClick={() => {
                        setShowCalcMethodsSheet(true);
                      }}
                      className="w-1/2"
                    >
                      Select Calculation Method
                    </IonButton>
                  )}
                {userPreferences.prayerCalculationMethod !== "" &&
                  userLocations.length === 0 && (
                    <IonButton
                      onClick={() => {
                        setShowAddLocationSheet(true);
                      }}
                      className="w-1/2"
                    >
                      Add Location
                    </IonButton>
                  )}

                <BottomSheetAddLocation
                  setShowAddLocationSheet={setShowAddLocationSheet}
                  showAddLocationSheet={showAddLocationSheet}
                  dbConnection={dbConnection}
                  setUserLocations={setUserLocations}
                  userLocations={userLocations}
                  setShowLocationFailureToast={setShowLocationFailureToast}
                  setShowLocationAddedToast={setShowLocationAddedToast}
                />
                <IonModal
                  style={{ "--height": "80vh" }}
                  isOpen={showCalcMethodsSheet}
                  onDidDismiss={() => {
                    setShowCalcMethodsSheet(false);
                  }}
                  className={`${isPlatform("ios") ? "" : "modal-height"}`}
                  mode="ios"
                  initialBreakpoint={INITIAL_MODAL_BREAKPOINT}
                  breakpoints={MODAL_BREAKPOINTS}
                >
                  <IonHeader>
                    <IonToolbar
                      style={{
                        "--background": "transparent",
                      }}
                    >
                      <IonTitle>Calculation Methods</IonTitle>
                    </IonToolbar>
                  </IonHeader>

                  <CalculationMethodOptions
                    dbConnection={dbConnection}
                    setSegmentOption={setSegmentOption}
                    segmentOption={segmentOption}
                    setUserPreferences={setUserPreferences}
                    userPreferences={userPreferences}
                    userLocations={userLocations}
                  />
                </IonModal>

                <Onboarding
                  setShowJoyRideEditIcon={setShowJoyRideEditIcon}
                  dbConnection={dbConnection}
                  setUserPreferences={setUserPreferences}
                  userPreferences={userPreferences}
                  setUserLocations={setUserLocations}
                  userLocations={userLocations}
                  setShowLocationFailureToast={setShowLocationFailureToast}
                  setShowLocationAddedToast={setShowLocationAddedToast}
                  setOnboardingMode={setOnboardingMode}
                  onboardingMode={onboardingMode}
                />
              </section>
              {userPreferences.prayerCalculationMethod !== "" &&
                userLocations?.length > 0 && (
                  <p className="mx-2 my-4 text-xs text-center opacity-50 text-[var(--ion-text-color)]">
                    Note: These times have been calculated using the
                    <span className="font-bold">
                      {" "}
                      {
                        prayerCalculationMethodLabels[
                          userPreferences.prayerCalculationMethod
                        ]
                      }{" "}
                    </span>
                    method with Fajr Angle {userPreferences.fajrAngle}° and Isha
                    Angle {userPreferences.ishaAngle}°, your local mosque times may
                    differ.
                  </p>
                )}
            </div>

            <div className="salah-times-timetable-col font-mono">
              <section
                className={` ${
                  userLocations?.length === 0 ||
                  userPreferences.prayerCalculationMethod === ""
                    ? "opacity-50"
                    : "opacity-100"
                } flex items-center justify-between w-full mx-auto mb-3 border-b border-[#242424] pb-2`}
              >
                <button
                  className="p-1 rounded-[3px] border border-[#242424] bg-[#161616] hover:border-[#3F3F46] text-[#8E8E93] hover:text-white transition-colors cursor-pointer"
                  onClick={async () => {
                    if (!userLocations || userLocations.length === 0) {
                      return;
                    }

                    const nextDate = addDays(dateToShow, -1);
                    setDateToShow(nextDate);

                    await getSalahTimes(
                      userLocations,
                      nextDate,
                      userPreferences,
                      setSalahtimes,
                    );
                  }}
                  aria-label="Previous day"
                >
                  <IonIcon
                    className="text-sm"
                    icon={chevronBackOutline}
                  />
                </button>
                <p className="text-xs font-semibold text-white tracking-wider uppercase">
                  {isSameDay(dateToShow, new Date())
                    ? "Today"
                    : isSameDay(addDays(new Date(), -1), dateToShow)
                      ? "Yesterday"
                      : isSameDay(addDays(new Date(), 1), dateToShow)
                        ? "Tomorrow"
                        : format(dateToShow, "EEE, MMM d")}
                </p>
                <button
                  className="p-1 rounded-[3px] border border-[#242424] bg-[#161616] hover:border-[#3F3F46] text-[#8E8E93] hover:text-white transition-colors cursor-pointer"
                  onClick={async () => {
                    if (!userLocations || userLocations.length === 0) {
                      return;
                    }

                    const nextDate = addDays(dateToShow, 1);
                    setDateToShow(nextDate);

                    await getSalahTimes(
                      userLocations,
                      nextDate,
                      userPreferences,
                      setSalahtimes,
                    );
                  }}
                  aria-label="Next day"
                >
                  <IonIcon
                    className="text-sm"
                    icon={chevronForwardOutline}
                  />
                </button>
              </section>

              <section
                className={`border border-[#242424] rounded-[4px] bg-[#121212] overflow-hidden ${
                  userLocations?.length === 0 ||
                  userPreferences.prayerCalculationMethod === ""
                    ? "opacity-50"
                    : "opacity-100"
                }`}
              >
                {(
                  Object.entries(salahTimes) as [keyof typeof salahTimes, string][]
                ).map(([name, time], idx, arr) => {
                  const arabicNames: Record<string, string> = {
                    fajr: "الفجر",
                    sunrise: "الشروق",
                    dhuhr: "الظهر",
                    asr: "العصر",
                    maghrib: "المغرب",
                    isha: "العشاء",
                  };
                  const isCurrentPrayer =
                    name === nextSalahNameAndTime.currentSalah && name !== "sunrise";
                  const isNextPrayer =
                    name === nextSalahNameAndTime.nextSalah && name !== "sunrise";
                  const isLast = idx === arr.length - 1;

                  return (
                    <div
                      className={`flex items-center justify-between px-3.5 py-3 text-sm transition-colors ${
                        !isLast ? "border-b border-[#242424]" : ""
                      } ${isCurrentPrayer || isNextPrayer ? "bg-[#181818]" : ""}`}
                      key={name + time}
                    >
                      <div className="flex items-center gap-2">
                        {isCurrentPrayer || isNextPrayer ? (
                          <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]" />
                        ) : null}
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-white text-xs">
                              {upperCaseFirstLetter(name)}
                            </p>
                            {isCurrentPrayer ? (
                              <span className="text-[10px] text-[#F59E0B] uppercase tracking-wider">
                                Current
                              </span>
                            ) : isNextPrayer ? (
                              <span className="text-[10px] text-[#F59E0B] uppercase tracking-wider">
                                Upcoming
                              </span>
                            ) : null}
                          </div>
                          <p className="text-[10px] text-[#71717A]" dir="rtl">
                            {arabicNames[name] || ""}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-white font-bold text-xs tracking-wider tabular-nums">
                          {time === "Invalid Date" ||
                          userLocations?.length === 0 ||
                          userPreferences.prayerCalculationMethod === ""
                            ? "--:--"
                            : time}
                        </span>
                        <button
                          onClick={async () => {
                            if (
                              userPreferences.prayerCalculationMethod === null ||
                              userPreferences.prayerCalculationMethod === "" ||
                              userLocations?.length === 0
                            ) {
                              return;
                            }

                            const notificationPermission =
                              await handleNotificationPermissions();

                            if (notificationPermission === "granted") {
                              setSelectedSalah(name);
                              setShowSalahNotificationsSheet(true);
                            }
                          }}
                          className="text-[#71717A] hover:text-white p-1 transition-colors cursor-pointer"
                          aria-label={`Notification for ${name}`}
                        >
                          <IonIcon
                            className={`text-sm ${
                              isCurrentPrayer
                                ? "text-[#F59E0B]"
                                : userPreferences[`${name}Notification`] !== "off"
                                  ? "text-white"
                                  : "text-[#52525B]"
                            }`}
                            icon={
                              userPreferences[`${name}Notification`] === "off"
                                ? notificationsOff
                                : userPreferences[`${name}Notification`] === "on"
                                  ? notifications
                                  : userPreferences[`${name}Notification`] === "adhan"
                                    ? megaphone
                                    : ""
                            }
                          />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </section>
            </div>
          </div>
        </section>
      </IonContent>
      <BottomSheetLocationsList
        setShowLocationsListSheet={setShowLocationsListSheet}
        showLocationsListSheet={showLocationsListSheet}
        dbConnection={dbConnection}
        setUserLocations={setUserLocations}
        userLocations={userLocations}
        setShowAddLocationSheet={setShowAddLocationSheet}
        setShowLocationDeletedToast={setShowLocationDeletedToast}
        setSalahtimes={setSalahtimes}
        setUserPreferences={setUserPreferences}
        userPreferences={userPreferences}
      />

      <BottomSheetPerSalahNotifications
        setShowSalahNotificationsSheet={setShowSalahNotificationsSheet}
        showSalahNotificationsSheet={showSalahNotificationsSheet}
        dbConnection={dbConnection}
        selectedSalah={selectedSalah}
        setUserPreferences={setUserPreferences}
        userPreferences={userPreferences}
        userLocations={userLocations}
      />
      <Toast
        isOpen={showLocationFailureToast}
        message="Unable to retrieve location, please try again"
        setShow={setShowLocationFailureToast}
        testId={"location-fail-toast"}
      />
      <Toast
        isOpen={showLocationAddedToast}
        message="Location added successfully"
        setShow={setShowLocationAddedToast}
        testId={"location-successfully-added-toast"}
      />
      <Toast
        isOpen={showLocationDeletedToast}
        message="Location deleted successfully"
        setShow={setShowLocationAddedToast}
        testId={"location-successfully-deleted-toast"}
      />
    </IonPage>
  );
};

export default SalahTimesPage;
