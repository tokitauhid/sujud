import React, { useState, useEffect } from "react";
import {
  IonModal,
  IonToggle,
} from "@ionic/react";
import { SQLiteDBConnection } from "@capacitor-community/sqlite";
import {
  Volume2,
  Clock,
  Play,
  Square,
  Plus,
  Minus,
  Sparkles,
} from "lucide-react";
import {
  AdhanSchedulingMode,
  LocationsDataObjTypeArr,
  SalahNamesTypeAdhanLibrary,
  userPreferencesType,
} from "../../types/types";
import {
  updateUserPrefs,
  scheduleSalahNotifications,
  cancelNotifications,
  generateActiveLocationParams,
} from "../../utils/helpers";
import {
  INITIAL_MODAL_BREAKPOINT,
  MODAL_BREAKPOINTS,
} from "../../utils/constants";
import { PrayerTimes } from "adhan";
import { format } from "date-fns";
import { AdhanAlarm } from "../../services/AdhanAlarm";

interface BottomSheetAdhanSettingsProps {
  dbConnection: React.MutableRefObject<SQLiteDBConnection | undefined>;
  triggerId: string;
  userPreferences: userPreferencesType;
  setUserPreferences: React.Dispatch<React.SetStateAction<userPreferencesType>>;
  userLocations: LocationsDataObjTypeArr;
}

const ADHAN_PRAYERS: {
  key: "fajr" | "dhuhr" | "asr" | "maghrib" | "isha";
  label: string;
  sound: "adhan_fajr" | "adhan";
}[] = [
  { key: "fajr", label: "Fajr", sound: "adhan_fajr" },
  { key: "dhuhr", label: "Dhuhr", sound: "adhan" },
  { key: "asr", label: "Asr", sound: "adhan" },
  { key: "maghrib", label: "Maghrib", sound: "adhan" },
  { key: "isha", label: "Isha", sound: "adhan" },
];

const OFFSET_PRESETS = [5, 10, 15, 20, 30, 45];

export const BottomSheetAdhanSettings: React.FC<BottomSheetAdhanSettingsProps> = ({
  dbConnection,
  triggerId,
  userPreferences,
  setUserPreferences,
  userLocations,
}) => {
  const [todayPrayerTimes, setTodayPrayerTimes] = useState<{
    [key: string]: Date;
  }>({});
  const [playingSound, setPlayingSound] = useState<string | null>(null);

  // Compute today's calculated prayer start times
  useEffect(() => {
    const calculateTimes = async () => {
      if (!userLocations || userLocations.length === 0) return;
      const res = await generateActiveLocationParams(
        userLocations,
        userPreferences,
      );
      if (!res) return;
      const { params, coordinates } = res;
      const pt = new PrayerTimes(coordinates, new Date(), params);

      setTodayPrayerTimes({
        fajr: pt.fajr,
        dhuhr: pt.dhuhr,
        asr: pt.asr,
        maghrib: pt.maghrib,
        isha: pt.isha,
      });
    };

    calculateTimes();
  }, [userLocations, userPreferences.prayerCalculationMethod, userPreferences.madhab]);

  // Format time according to user preferences
  const formatTimeDisplay = (date?: Date) => {
    if (!date) return "--:--";
    const pattern = userPreferences.timeFormat === "24hr" ? "HH:mm" : "h:mm a";
    return format(date, pattern);
  };

  // Compute calculated Adhan time for preview
  const getAdhanPreviewTime = (salah: "fajr" | "dhuhr" | "asr" | "maghrib" | "isha") => {
    const startTime = todayPrayerTimes[salah];
    if (!startTime) return "--:--";

    const modeKey = `${salah}AdhanMode` as keyof userPreferencesType;
    const mode = (userPreferences[modeKey] as AdhanSchedulingMode) || "start";

    if (mode === "start") {
      return formatTimeDisplay(startTime);
    }

    if (mode === "offset") {
      const offsetKey = `${salah}AdhanOffset` as keyof userPreferencesType;
      const offset = parseInt((userPreferences[offsetKey] as string) || "0", 10);
      const offsetDate = new Date(startTime.getTime() + offset * 60 * 1000);
      return formatTimeDisplay(offsetDate);
    }

    if (mode === "manual") {
      const manualKey = `${salah}AdhanManualTime` as keyof userPreferencesType;
      const manualTime = (userPreferences[manualKey] as string) || "12:00";
      const [h, m] = manualTime.split(":").map(Number);
      const manualDate = new Date();
      manualDate.setHours(h, m, 0, 0);
      return formatTimeDisplay(manualDate);
    }

    return formatTimeDisplay(startTime);
  };

  // Toggle Adhan On/Off for a prayer
  const handleToggleAdhan = async (
    salah: "fajr" | "dhuhr" | "asr" | "maghrib" | "isha",
    enabled: boolean,
  ) => {
    const notifKey = `${salah}Notification` as keyof userPreferencesType;
    const newStatus = enabled ? "adhan" : "off";

    await updateUserPrefs(dbConnection, notifKey, newStatus, setUserPreferences);

    if (enabled) {
      const updatedPrefs = { ...userPreferences, [notifKey]: "adhan" };
      await scheduleSalahNotifications(
        userLocations,
        salah as SalahNamesTypeAdhanLibrary,
        updatedPrefs,
        "adhan",
      );
    } else {
      await cancelNotifications(salah as SalahNamesTypeAdhanLibrary);
    }
  };

  // Change Scheduling Mode
  const handleModeChange = async (
    salah: "fajr" | "dhuhr" | "asr" | "maghrib" | "isha",
    mode: AdhanSchedulingMode,
  ) => {
    const modeKey = `${salah}AdhanMode` as keyof userPreferencesType;
    await updateUserPrefs(dbConnection, modeKey, mode, setUserPreferences);

    const notifKey = `${salah}Notification` as keyof userPreferencesType;
    if (userPreferences[notifKey] === "adhan") {
      const updatedPrefs = { ...userPreferences, [modeKey]: mode };
      await scheduleSalahNotifications(
        userLocations,
        salah as SalahNamesTypeAdhanLibrary,
        updatedPrefs,
        "adhan",
      );
    }
  };

  // Change Offset
  const handleOffsetChange = async (
    salah: "fajr" | "dhuhr" | "asr" | "maghrib" | "isha",
    offsetMinutes: number,
  ) => {
    const offsetKey = `${salah}AdhanOffset` as keyof userPreferencesType;
    const offsetStr = String(offsetMinutes);

    await updateUserPrefs(dbConnection, offsetKey, offsetStr, setUserPreferences);

    const notifKey = `${salah}Notification` as keyof userPreferencesType;
    if (userPreferences[notifKey] === "adhan") {
      const updatedPrefs = { ...userPreferences, [offsetKey]: offsetStr };
      await scheduleSalahNotifications(
        userLocations,
        salah as SalahNamesTypeAdhanLibrary,
        updatedPrefs,
        "adhan",
      );
    }
  };

  // Change Manual Time
  const handleManualTimeChange = async (
    salah: "fajr" | "dhuhr" | "asr" | "maghrib" | "isha",
    timeStr: string,
  ) => {
    const manualKey = `${salah}AdhanManualTime` as keyof userPreferencesType;
    await updateUserPrefs(dbConnection, manualKey, timeStr, setUserPreferences);

    const notifKey = `${salah}Notification` as keyof userPreferencesType;
    if (userPreferences[notifKey] === "adhan") {
      const updatedPrefs = { ...userPreferences, [manualKey]: timeStr };
      await scheduleSalahNotifications(
        userLocations,
        salah as SalahNamesTypeAdhanLibrary,
        updatedPrefs,
        "adhan",
      );
    }
  };

  // Quick Action: Apply offset to all prayers
  const handleApplyOffsetToAll = async (offsetMin: number) => {
    const updatedPrefs = { ...userPreferences };
    for (const prayer of ADHAN_PRAYERS) {
      const modeKey = `${prayer.key}AdhanMode` as keyof userPreferencesType;
      const offsetKey = `${prayer.key}AdhanOffset` as keyof userPreferencesType;

      (updatedPrefs as any)[modeKey] = "offset";
      (updatedPrefs as any)[offsetKey] = String(offsetMin);

      await updateUserPrefs(dbConnection, modeKey, "offset", setUserPreferences);
      await updateUserPrefs(dbConnection, offsetKey, String(offsetMin), setUserPreferences);

      const notifKey = `${prayer.key}Notification` as keyof userPreferencesType;
      if (userPreferences[notifKey] === "adhan") {
        await scheduleSalahNotifications(
          userLocations,
          prayer.key as SalahNamesTypeAdhanLibrary,
          updatedPrefs,
          "adhan",
        );
      }
    }
  };

  // Quick Action: Enable Adhan for all 5 prayers
  const handleEnableAllAdhans = async () => {
    const updatedPrefs = { ...userPreferences };
    for (const prayer of ADHAN_PRAYERS) {
      const notifKey = `${prayer.key}Notification` as keyof userPreferencesType;
      (updatedPrefs as any)[notifKey] = "adhan";
      await updateUserPrefs(dbConnection, notifKey, "adhan", setUserPreferences);
      await scheduleSalahNotifications(
        userLocations,
        prayer.key as SalahNamesTypeAdhanLibrary,
        updatedPrefs,
        "adhan",
      );
    }
  };

  // Test sound playback
  const handleTestAudio = async (sound: "adhan_fajr" | "adhan") => {
    if (playingSound === sound) {
      await AdhanAlarm.stopAdhan();
      setPlayingSound(null);
    } else {
      setPlayingSound(sound);
      await AdhanAlarm.testAdhan({ sound });
    }
  };

  return (
    <IonModal
      className="modal-fit-content"
      mode="ios"
      trigger={triggerId}
      initialBreakpoint={INITIAL_MODAL_BREAKPOINT}
      breakpoints={MODAL_BREAKPOINTS}
    >
      <div className="bg-[#121212] text-white font-mono p-4 pb-12 space-y-4 max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center gap-2 pb-2 border-b border-[#242424]">
          <Volume2 className="w-5 h-5 text-[#D4AF37]" />
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-white">
              ADHAN SETTINGS & SCHEDULING
            </h2>
            <p className="text-[11px] text-[#71717A]">
              Customize Adhan timing per prayer: at start, offset, or fixed manual time
            </p>
          </div>
        </div>

        {/* Quick Bulk Presets Bar */}
        <div className="p-3 bg-[#181818] border border-[#242424] rounded-none space-y-2">
          <div className="flex items-center gap-1.5 text-[10px] text-[#A1A1AA] uppercase font-bold tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span>QUICK PRESETS</span>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              onClick={handleEnableAllAdhans}
              className="px-2.5 py-1 text-[11px] bg-[#242424] hover:bg-[#2A2A2A] text-white rounded-none border border-[#383838] transition-colors"
            >
              Enable All Adhans
            </button>
            <button
              onClick={() => handleApplyOffsetToAll(15)}
              className="px-2.5 py-1 text-[11px] bg-[#242424] hover:bg-[#2A2A2A] text-white rounded-none border border-[#383838] transition-colors"
            >
              Set All to +15m Offset
            </button>
            <button
              onClick={() => handleApplyOffsetToAll(0)}
              className="px-2.5 py-1 text-[11px] bg-[#242424] hover:bg-[#2A2A2A] text-[#71717A] rounded-none border border-[#383838] transition-colors"
            >
              Reset All to Start Time
            </button>
          </div>
        </div>

        {/* Prayer List Cards */}
        <div className="space-y-3">
          {ADHAN_PRAYERS.map((prayer) => {
            const notifKey = `${prayer.key}Notification` as keyof userPreferencesType;
            const isAdhanEnabled = userPreferences[notifKey] === "adhan";

            const modeKey = `${prayer.key}AdhanMode` as keyof userPreferencesType;
            const currentMode: AdhanSchedulingMode =
              (userPreferences[modeKey] as AdhanSchedulingMode) || "start";

            const offsetKey = `${prayer.key}AdhanOffset` as keyof userPreferencesType;
            const currentOffset = parseInt(
              (userPreferences[offsetKey] as string) || "0",
              10,
            );

            const manualKey = `${prayer.key}AdhanManualTime` as keyof userPreferencesType;
            const currentManualTime =
              (userPreferences[manualKey] as string) || "12:00";

            const startTimeFormatted = formatTimeDisplay(
              todayPrayerTimes[prayer.key],
            );
            const adhanPreview = getAdhanPreviewTime(prayer.key);

            return (
              <div
                key={prayer.key}
                className={`p-3 border rounded-none transition-all ${
                  isAdhanEnabled
                    ? "bg-[#181818] border-[#383838]"
                    : "bg-[#141414] border-[#242424] opacity-80"
                }`}
              >
                {/* Prayer Header & Toggle */}
                <div className="flex items-center justify-between pb-2 border-b border-[#242424]">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-white">
                        {prayer.label}
                      </span>
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded-none font-bold uppercase ${
                          isAdhanEnabled
                            ? "bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/40"
                            : "bg-[#242424] text-[#71717A]"
                        }`}
                      >
                        {isAdhanEnabled ? "Adhan Active" : "Silent / Off"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-[#A1A1AA] mt-0.5">
                      <span>Waqt: {startTimeFormatted}</span>
                      {isAdhanEnabled && (
                        <span className="text-[#D4AF37] font-semibold">
                          ➔ Adhan: {adhanPreview}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Audio Test Button */}
                    <button
                      onClick={() => handleTestAudio(prayer.sound)}
                      title="Test Adhan Sound"
                      className={`p-1.5 rounded-none border transition-colors ${
                        playingSound === prayer.sound
                          ? "bg-red-500/20 text-red-400 border-red-500/40"
                          : "bg-[#242424] text-[#A1A1AA] border-[#383838] hover:text-white"
                      }`}
                    >
                      {playingSound === prayer.sound ? (
                        <Square className="w-3.5 h-3.5" />
                      ) : (
                        <Play className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {/* Adhan Toggle */}
                    <IonToggle
                      mode="md"
                      style={{ "--track-background": "#383838" }}
                      checked={isAdhanEnabled}
                      onIonChange={(e) =>
                        handleToggleAdhan(prayer.key, e.detail.checked)
                      }
                    />
                  </div>
                </div>

                {/* Scheduling Mode Controls (Visible only when Adhan is enabled) */}
                {isAdhanEnabled && (
                  <div className="pt-3 space-y-3">
                    {/* Mode Selector Tabs */}
                    <div>
                      <div className="text-[10px] text-[#71717A] uppercase tracking-wider mb-1">
                        TIMING MODE
                      </div>
                      <div className="grid grid-cols-3 gap-1 p-0.5 bg-[#121212] border border-[#242424]">
                        <button
                          onClick={() => handleModeChange(prayer.key, "start")}
                          className={`py-1 text-[10px] uppercase font-semibold transition-all ${
                            currentMode === "start"
                              ? "bg-[#D4AF37] text-black shadow"
                              : "text-[#A1A1AA] hover:text-white"
                          }`}
                        >
                          At Start
                        </button>
                        <button
                          onClick={() => handleModeChange(prayer.key, "offset")}
                          className={`py-1 text-[10px] uppercase font-semibold transition-all ${
                            currentMode === "offset"
                              ? "bg-[#D4AF37] text-black shadow"
                              : "text-[#A1A1AA] hover:text-white"
                          }`}
                        >
                          Offset (+/-)
                        </button>
                        <button
                          onClick={() => handleModeChange(prayer.key, "manual")}
                          className={`py-1 text-[10px] uppercase font-semibold transition-all ${
                            currentMode === "manual"
                              ? "bg-[#D4AF37] text-black shadow"
                              : "text-[#A1A1AA] hover:text-white"
                          }`}
                        >
                          Fixed Time
                        </button>
                      </div>
                    </div>

                    {/* Mode 1: At Start */}
                    {currentMode === "start" && (
                      <div className="p-2 bg-[#121212] border border-[#242424] text-[11px] text-[#A1A1AA]">
                        Adhan will sound exactly when {prayer.label} begins at{" "}
                        <span className="text-white font-bold">{startTimeFormatted}</span>.
                      </div>
                    )}

                    {/* Mode 2: Offset */}
                    {currentMode === "offset" && (
                      <div className="p-2 bg-[#121212] border border-[#242424] space-y-2">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-[#A1A1AA]">
                            Offset:{" "}
                            <span className="text-[#D4AF37] font-bold">
                              {currentOffset >= 0 ? `+${currentOffset}` : currentOffset} min
                            </span>
                          </span>
                          <span className="text-white font-semibold">
                            Scheduled: {adhanPreview}
                          </span>
                        </div>

                        {/* Presets */}
                        <div className="flex flex-wrap gap-1">
                          {OFFSET_PRESETS.map((preset) => (
                            <button
                              key={preset}
                              onClick={() => handleOffsetChange(prayer.key, preset)}
                              className={`px-2 py-0.5 text-[10px] border transition-colors ${
                                currentOffset === preset
                                  ? "bg-[#D4AF37] text-black border-[#D4AF37] font-bold"
                                  : "bg-[#181818] text-[#A1A1AA] border-[#2A2A2A] hover:text-white"
                              }`}
                            >
                              +{preset}m
                            </button>
                          ))}
                        </div>

                        {/* Stepper for custom offset */}
                        <div className="flex items-center gap-2 pt-1 border-t border-[#1F1F1F]">
                          <span className="text-[10px] text-[#71717A]">Custom:</span>
                          <button
                            onClick={() =>
                              handleOffsetChange(
                                prayer.key,
                                Math.max(-60, currentOffset - 5),
                              )
                            }
                            className="p-1 bg-[#1E1E1E] hover:bg-[#282828] text-white border border-[#333]"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <input
                            type="number"
                            value={currentOffset}
                            onChange={(e) =>
                              handleOffsetChange(
                                prayer.key,
                                parseInt(e.target.value || "0", 10),
                              )
                            }
                            className="w-14 text-center bg-[#181818] border border-[#333] text-white text-xs py-0.5 focus:outline-none focus:border-[#D4AF37]"
                          />
                          <button
                            onClick={() =>
                              handleOffsetChange(
                                prayer.key,
                                Math.min(180, currentOffset + 5),
                              )
                            }
                            className="p-1 bg-[#1E1E1E] hover:bg-[#282828] text-white border border-[#333]"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                          <span className="text-[10px] text-[#71717A]">min</span>
                        </div>
                      </div>
                    )}

                    {/* Mode 3: Manual Fixed Time */}
                    {currentMode === "manual" && (
                      <div className="p-2 bg-[#121212] border border-[#242424] space-y-2">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-[#A1A1AA]">Fixed Time:</span>
                          <span className="text-[#D4AF37] font-bold">
                            {adhanPreview}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-[#71717A]" />
                          <input
                            type="time"
                            value={currentManualTime}
                            onChange={(e) =>
                              handleManualTimeChange(prayer.key, e.target.value)
                            }
                            className="bg-[#181818] border border-[#333] text-white text-xs px-2 py-1 rounded-none focus:outline-none focus:border-[#D4AF37]"
                          />
                          <span className="text-[10px] text-[#71717A]">
                            Daily fixed Adhan time
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Tip info */}
        <div className="p-3 bg-[#181818] border border-[#242424] text-[10px] text-[#71717A] space-y-1">
          <p className="font-bold text-[#A1A1AA]">
            IMPORTANT FOR XIAOMI (HYPEROS / MIUI), COLOROS, OXYGENOS, REALME UI, VIVO & HUAWEI:
          </p>
          <p>
            To ensure Adhan plays properly when your phone is locked or asleep, please make sure to enable <strong className="text-white">Autostart</strong> and turn off <strong className="text-white">Battery Optimization</strong> (set to "No restrictions") under <strong className="text-[#D4AF37]">Prayer Notifications</strong>.
          </p>
        </div>
      </div>
    </IonModal>
  );
};

export default BottomSheetAdhanSettings;
