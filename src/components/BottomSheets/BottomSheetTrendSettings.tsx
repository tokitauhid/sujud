import React, { useState } from "react";
import {
  IonModal,
  IonToggle,
  IonItem,
  IonInput,
} from "@ionic/react";
import { SQLiteDBConnection } from "@capacitor-community/sqlite";
import { BarChart3, Clock, Sparkles } from "lucide-react";
import { userPreferencesType } from "../../types/types";
import { updateUserPrefs, checkNotificationPermissions } from "../../utils/helpers";
import { INITIAL_MODAL_BREAKPOINT, MODAL_BREAKPOINTS } from "../../utils/constants";
import { LocalNotifications } from "@capacitor/local-notifications";

interface BottomSheetTrendSettingsProps {
  dbConnection: React.MutableRefObject<SQLiteDBConnection | undefined>;
  triggerId: string;
  userPreferences: userPreferencesType;
  setUserPreferences: React.Dispatch<React.SetStateAction<userPreferencesType>>;
}

export const BottomSheetTrendSettings: React.FC<BottomSheetTrendSettingsProps> = ({
  dbConnection,
  triggerId,
  userPreferences,
  setUserPreferences,
}) => {
  const [masterToggle, setMasterToggle] = useState<boolean>(
    userPreferences.trendNotificationEnabled === "1",
  );
  const [weeklyToggle, setWeeklyToggle] = useState<boolean>(
    userPreferences.trendWeeklyNotification === "1",
  );
  const [monthlyToggle, setMonthlyToggle] = useState<boolean>(
    userPreferences.trendMonthlyNotification === "1",
  );
  const [yearlyToggle, setYearlyToggle] = useState<boolean>(
    userPreferences.trendYearlyNotification === "1",
  );
  const [deliveryTime, setDeliveryTime] = useState<string>(
    userPreferences.trendNotificationDeliveryTime || "18:00",
  );

  const handleToggle = async (
    field: keyof userPreferencesType,
    currentValue: boolean,
    setter: React.Dispatch<React.SetStateAction<boolean>>,
  ) => {
    const newValue = !currentValue;
    setter(newValue);
    const prefVal = newValue ? "1" : "0";

    await updateUserPrefs(dbConnection, field, prefVal, setUserPreferences);

    if (newValue) {
      const permission = await checkNotificationPermissions();
      if (permission !== "granted") {
        await LocalNotifications.requestPermissions();
      }
    }
  };

  const handleTimeChange = async (e: CustomEvent) => {
    const timeVal = e.detail.value || "18:00";
    setDeliveryTime(timeVal);
    await updateUserPrefs(
      dbConnection,
      "trendNotificationDeliveryTime",
      timeVal,
      setUserPreferences,
    );
  };

  return (
    <IonModal
      className="modal-fit-content"
      mode="ios"
      trigger={triggerId}
      initialBreakpoint={INITIAL_MODAL_BREAKPOINT}
      breakpoints={MODAL_BREAKPOINTS}
    >
      <div className="bg-[#121212] text-white font-mono p-4 pb-8 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2 pb-2 border-b border-[#242424]">
          <BarChart3 className="w-5 h-5 text-[#10B981]" />
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-white">
              TREND NOTIFICATIONS
            </h2>
            <p className="text-[11px] text-[#71717A]">
              Screen Time-style prayer habit summaries & insights
            </p>
          </div>
        </div>

        {/* Master Toggle */}
        <div className="border border-[#242424] bg-[#161616] p-3 flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-white">Enable Trend Reports</div>
            <div className="text-[10px] text-[#71717A] mt-0.5">
              Receive periodic reports on your lock screen
            </div>
          </div>
          <IonToggle
            mode="md"
            style={{ "--track-background": "#333", "--track-background-checked": "#10B981" }}
            checked={masterToggle}
            onIonChange={() =>
              handleToggle("trendNotificationEnabled", masterToggle, setMasterToggle)
            }
          />
        </div>

        {/* Granular Period Toggles */}
        {masterToggle && (
          <div className="border border-[#242424] bg-[#161616] divide-y divide-[#242424]">
            {/* Weekly Toggle */}
            <div className="p-3 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-white">Weekly Summary</div>
                <div className="text-[10px] text-[#71717A] mt-0.5">
                  Delivered on Sunday evening with week-over-week progress
                </div>
              </div>
              <IonToggle
                mode="md"
                style={{ "--track-background": "#333", "--track-background-checked": "#10B981" }}
                checked={weeklyToggle}
                onIonChange={() =>
                  handleToggle("trendWeeklyNotification", weeklyToggle, setWeeklyToggle)
                }
              />
            </div>

            {/* Monthly Toggle */}
            <div className="p-3 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-white">Monthly Summary</div>
                <div className="text-[10px] text-[#71717A] mt-0.5">
                  Delivered at the conclusion of each calendar month
                </div>
              </div>
              <IonToggle
                mode="md"
                style={{ "--track-background": "#333", "--track-background-checked": "#10B981" }}
                checked={monthlyToggle}
                onIonChange={() =>
                  handleToggle("trendMonthlyNotification", monthlyToggle, setMonthlyToggle)
                }
              />
            </div>

            {/* Yearly Toggle */}
            <div className="p-3 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-white">Yearly Summary</div>
                <div className="text-[10px] text-[#71717A] mt-0.5">
                  Annual prayer consistency overview at year end
                </div>
              </div>
              <IonToggle
                mode="md"
                style={{ "--track-background": "#333", "--track-background-checked": "#10B981" }}
                checked={yearlyToggle}
                onIonChange={() =>
                  handleToggle("trendYearlyNotification", yearlyToggle, setYearlyToggle)
                }
              />
            </div>

            {/* Delivery Time Picker */}
            <div className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#94A3B8]" />
                <div>
                  <div className="text-xs font-bold text-white">Delivery Time</div>
                  <div className="text-[10px] text-[#71717A] mt-0.5">
                    Calm daytime or early evening default
                  </div>
                </div>
              </div>
              <div className="w-24">
                <IonItem lines="none" className="bg-[#242424] rounded-none text-white text-xs">
                  <IonInput
                    type="time"
                    value={deliveryTime}
                    onIonChange={handleTimeChange}
                    className="text-right font-mono"
                  />
                </IonItem>
              </div>
            </div>
          </div>
        )}

        {/* Explanatory Info Card */}
        <div className="bg-[#10B981]/5 border border-[#10B981]/20 p-3 text-[11px] text-[#A7F3D0] space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-[#10B981]">
            <Sparkles className="w-3.5 h-3.5" />
            <span>HOW TREND REPORTS WORK</span>
          </div>
          <p>
            Reports are generated once per completed period and never duplicated. Tapping a notification opens the exact immutable snapshot saved in your history.
          </p>
        </div>
      </div>
    </IonModal>
  );
};

export default BottomSheetTrendSettings;
