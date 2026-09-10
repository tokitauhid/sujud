import MissedSalahsListBottomSheet from "../components/BottomSheets/BottomSheetMissedSalahsList";
import { motion } from "framer-motion";
import SalahTable from "../components/SalahTable/SalahTable";
import MissedSalahCounter from "../components/Stats/MissedSalahCounter";
import { Dialog } from "@capacitor/dialog";
import { Flame } from "lucide-react";

import {
  SalahRecordsArrayType,
  userPreferencesType,
  SalahByDateObjType,
  nextSalahTimeType,
  LocationsDataObjTypeArr,
} from "../types/types";
import { useState } from "react";
import { format } from "date-fns";
import { getMissedSalahCount } from "../utils/helpers";
import { SQLiteDBConnection } from "@capacitor-community/sqlite";
import {
  IonContent,
  IonHeader,
  IonPage,
  IonToolbar,
} from "@ionic/react";

interface HomePageProps {
  dbConnection: React.MutableRefObject<SQLiteDBConnection | undefined>;
  setUserPreferences: React.Dispatch<React.SetStateAction<userPreferencesType>>;
  setShowJoyRideEditIcon: React.Dispatch<React.SetStateAction<boolean>>;
  showJoyRideEditIcon: boolean;
  setFetchedSalahData: React.Dispatch<
    React.SetStateAction<SalahRecordsArrayType>
  >;
  fetchedSalahData: SalahRecordsArrayType;
  userPreferences: userPreferencesType;
  setShowMissedSalahsSheet: React.Dispatch<React.SetStateAction<boolean>>;
  showMissedSalahsSheet: boolean;
  setMissedSalahList: React.Dispatch<React.SetStateAction<SalahByDateObjType>>;
  missedSalahList: SalahByDateObjType;
  setIsMultiEditMode: React.Dispatch<React.SetStateAction<boolean>>;
  isMultiEditMode: boolean;
  activeStreakCount: number;
  generateStreaks: (fetchedSalahData: SalahRecordsArrayType) => void;
  nextSalahNameAndTime?: nextSalahTimeType;
  userLocations: LocationsDataObjTypeArr;
}

import NextSalahTimeWidget from "../components/NextSalahTimeWidget";
import MissedSalahsPanel from "../components/MissedSalahsPanel";

const HomePage = ({
  dbConnection,
  setUserPreferences,
  setShowJoyRideEditIcon,
  showJoyRideEditIcon,
  setFetchedSalahData,
  fetchedSalahData,
  userPreferences,
  setShowMissedSalahsSheet,
  showMissedSalahsSheet,
  missedSalahList,
  setIsMultiEditMode,
  isMultiEditMode,
  activeStreakCount,
  generateStreaks,
  nextSalahNameAndTime,
  userLocations,
}: HomePageProps) => {
  const [selectedSalahAndDate, setSelectedSalahAndDate] =
    useState<SalahByDateObjType>({});
  const [showUpdateStatusModal, setShowUpdateStatusModal] = useState(false);
  const showStreakInfoHomePage = async () => {
    await Dialog.alert({
      title: "Streaks Explained",
      message: `Your current streak shows how many consecutive days you've completed all your Salah, starting from the first day where all Salah have been prayed. ${
        userPreferences.userGender === "male"
          ? "If you miss a Salah or are late, the streak will reset."
          : "If you're late, the streak will reset, selecting 'Excused' will pause the streak, but won't break it."
      }`,
    });
  };

  return (
    <IonPage
    // ref={page}
    >
      <IonHeader className="ion-no-border">
        <IonToolbar className="page-header-toolbar border-b border-[#242424]">
          <div className="flex items-center justify-between px-3 py-1 w-full">
            <div className="flex flex-col">
              <span className="text-xs font-bold tracking-widest uppercase text-white font-mono">
                DAILY TRACKER
              </span>
              <span className="text-[11px] font-normal text-[#8E8E93]">
                {format(new Date(), "EEE, MMM d")}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {getMissedSalahCount(missedSalahList) > 0 &&
              userPreferences.showMissedSalahCount === "1" ? (
                <MissedSalahCounter
                  dbConnection={dbConnection}
                  setShowMissedSalahsSheet={setShowMissedSalahsSheet}
                  isMultiEditMode={isMultiEditMode}
                  missedSalahList={missedSalahList}
                  setUserPreferences={setUserPreferences}
                  userPreferences={userPreferences}
                />
              ) : null}

              <button
                onClick={showStreakInfoHomePage}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-none border transition-all ${
                  activeStreakCount > 0
                    ? "border-[#F59E0B]/40 bg-[#16120E] hover:border-[#F59E0B] shadow-[0_0_12px_rgba(245,158,11,0.15)]"
                    : "border-[var(--app-border)] bg-[var(--app-surface)] hover:border-[#3F3F46]"
                }`}
                aria-label="View streak info"
              >
                <Flame
                  className={`w-3.5 h-3.5 shrink-0 ${
                    activeStreakCount > 0
                      ? "text-[#F59E0B] fill-[#F59E0B]/25"
                      : "text-[#64748B]"
                  }`}
                />
                <div className="flex items-baseline gap-1 font-mono">
                  <span className="text-xs font-bold text-white tabular-nums">
                    {activeStreakCount}
                  </span>
                  <span
                    className={`text-[9px] font-semibold tracking-wider uppercase ${
                      activeStreakCount > 0 ? "text-[#F59E0B]" : "text-[#94A3B8]"
                    }`}
                  >
                    {activeStreakCount === 1 ? "DAY" : "DAYS"}
                  </span>
                </div>
              </button>

            </div>
          </div>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <motion.section
          // {...pageTransitionStyles}
          className={`home-page-wrap h-full`}
        >
          <section className="h-full home-page-components-wrap home-page-tablet-grid">
            <div className="flex-1 min-h-0 h-full w-full">
              <SalahTable
                dbConnection={dbConnection}
                // setUserPreferences={setUserPreferences}
                setShowJoyRideEditIcon={setShowJoyRideEditIcon}
                showJoyRideEditIcon={showJoyRideEditIcon}
                userPreferences={userPreferences}
                setFetchedSalahData={setFetchedSalahData}
                fetchedSalahData={fetchedSalahData}
                setSelectedSalahAndDate={setSelectedSalahAndDate}
                selectedSalahAndDate={selectedSalahAndDate}
                setIsMultiEditMode={setIsMultiEditMode}
                isMultiEditMode={isMultiEditMode}
                setShowUpdateStatusModal={setShowUpdateStatusModal}
                showUpdateStatusModal={showUpdateStatusModal}
                generateStreaks={generateStreaks}
              />
              <MissedSalahsListBottomSheet
                dbConnection={dbConnection}
                setFetchedSalahData={setFetchedSalahData}
                setShowMissedSalahsSheet={setShowMissedSalahsSheet}
                showMissedSalahsSheet={showMissedSalahsSheet}
                missedSalahList={missedSalahList}
              />
            </div>
            
            <div className="home-page-tablet-widgets hidden md:landscape:flex flex-col h-[95%] overflow-hidden shrink-0">
              {nextSalahNameAndTime && (
                <div className="mb-4 shrink-0">
                  <NextSalahTimeWidget 
                    userPreferences={userPreferences}
                    userLocations={userLocations}
                    nextSalahNameAndTime={nextSalahNameAndTime}
                  />
                </div>
              )}
              {Object.keys(missedSalahList).length > 0 && (
                <div className="flex-1 min-h-0 flex flex-col bg-[var(--card-bg-color)] border border-[var(--app-border-color)] rounded-none overflow-hidden">
                  <MissedSalahsPanel 
                    dbConnection={dbConnection}
                    setFetchedSalahData={setFetchedSalahData}
                    missedSalahList={missedSalahList}
                  />
                </div>
              )}
            </div>
          </section>
        </motion.section>
      </IonContent>
    </IonPage>
  );
};

export default HomePage;
