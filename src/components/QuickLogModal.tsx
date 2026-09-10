import { useState, useEffect } from "react";
import { format } from "date-fns";
import { IonModal, IonIcon } from "@ionic/react";
import {
  closeOutline,
  checkmarkCircle,
  checkmarkOutline,
  timeOutline,
  closeCircleOutline,
  removeCircleOutline,
} from "ionicons/icons";
import { SQLiteDBConnection } from "@capacitor-community/sqlite";
import {
  nextSalahTimeType,
  SalahNamesType,
  SalahRecordType,
  SalahRecordsArrayType,
  SalahStatusType,
  userPreferencesType,
} from "../types/types";
import { syncSalahLogToCloud } from "../firebase/syncService";
import { defaultReasons } from "../utils/constants";
import { showToast } from "../utils/helpers";

interface QuickLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  dbConnection: React.MutableRefObject<SQLiteDBConnection | undefined>;
  nextSalahNameAndTime?: nextSalahTimeType;
  setFetchedSalahData: React.Dispatch<React.SetStateAction<SalahRecordsArrayType>>;
  userPreferences: userPreferencesType;
}

const salahNames: SalahNamesType[] = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];

const mapToSalahName = (name?: string): SalahNamesType | null => {
  if (!name) return null;
  const lower = name.toLowerCase();
  switch (lower) {
    case "fajr":
      return "Fajr";
    case "sunrise":
      return "Fajr";
    case "dhuhr":
      return "Dhuhr";
    case "asr":
    case "asar":
      return "Asr";
    case "maghrib":
      return "Maghrib";
    case "isha":
      return "Isha";
    default:
      return null;
  }
};

const resolveCurrentOrNextSalah = (
  nextSalahObj?: nextSalahTimeType
): SalahNamesType => {
  if (nextSalahObj) {
    const current = mapToSalahName(nextSalahObj.currentSalah);
    if (current) return current;
    const next = mapToSalahName(nextSalahObj.nextSalah);
    if (next) return next;
  }

  const hour = new Date().getHours();
  if (hour >= 4 && hour < 12) return "Fajr";
  if (hour >= 12 && hour < 16) return "Dhuhr";
  if (hour >= 16 && hour < 18) return "Asr";
  if (hour >= 18 && hour < 20) return "Maghrib";
  return "Isha";
};

const triggerHaptic = () => {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    navigator.vibrate(10);
  }
};

const QuickLogModal = ({
  isOpen,
  onClose,
  dbConnection,
  nextSalahNameAndTime,
  setFetchedSalahData,
  userPreferences,
}: QuickLogModalProps) => {
  const [selectedSalah, setSelectedSalah] = useState<SalahNamesType>(() =>
    resolveCurrentOrNextSalah(nextSalahNameAndTime)
  );
  const [selectedStatus, setSelectedStatus] = useState<SalahStatusType>("");
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [notes, setNotes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const defaultOnTimeStatus: SalahStatusType =
    userPreferences?.userGender === "female" ? "female-alone" : "group";

  // Parse available reasons
  const reasonsList: string[] = Array.isArray(userPreferences?.reasons)
    ? userPreferences.reasons
    : typeof userPreferences?.reasons === "string"
    ? (userPreferences.reasons as string).split(",").filter(Boolean)
    : defaultReasons.split(",").filter(Boolean);

  // Automatically default to current or upcoming prayer and reset inputs on open
  useEffect(() => {
    if (isOpen) {
      setSelectedSalah(resolveCurrentOrNextSalah(nextSalahNameAndTime));
      setSelectedStatus(defaultOnTimeStatus);
      setSelectedReasons([]);
      setNotes("");
    }
  }, [isOpen, nextSalahNameAndTime, defaultOnTimeStatus]);

  const toggleReason = (reason: string) => {
    triggerHaptic();
    setSelectedReasons((prev) =>
      prev.includes(reason)
        ? prev.filter((r) => r !== reason)
        : [...prev, reason]
    );
  };

  const handleSave = async () => {
    if (!dbConnection.current || !selectedStatus || isSubmitting) return;

    try {
      setIsSubmitting(true);
      triggerHaptic();

      const today = format(new Date(), "yyyy-MM-dd");
      const now = Date.now();
      const dbSalahName = selectedSalah === "Asr" ? "Asar" : selectedSalah;
      const reasonsToInsert = selectedReasons.join(",");

      const query = `INSERT INTO salahDataTable(date, salahName, salahStatus, reasons, notes, createdAt, updatedAt, deleted)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(date, salahName) DO UPDATE SET
          salahStatus = excluded.salahStatus,
          reasons = excluded.reasons,
          notes = excluded.notes,
          updatedAt = excluded.updatedAt,
          deleted = 0`;

      await dbConnection.current.run(query, [
        today,
        dbSalahName,
        selectedStatus,
        reasonsToInsert,
        notes,
        now,
        now,
        0,
      ]);

      // Sync to cloud fire-and-forget
      syncSalahLogToCloud({
        date: today,
        salahName: dbSalahName,
        salahStatus: selectedStatus,
        reasons: reasonsToInsert,
        notes,
        createdAt: now,
        updatedAt: now,
        deleted: 0,
      });

      // Update local in-memory records
      setFetchedSalahData((prev) => {
        const existingIdx = prev.findIndex((r) => r.date === today);
        if (existingIdx !== -1) {
          const updated = [...prev];
          const record = { ...updated[existingIdx] };
          const salahs = { ...record.salahs };
          salahs[selectedSalah] = selectedStatus;
          if (selectedSalah === "Asr") salahs.Asar = selectedStatus;
          record.salahs = salahs;
          updated[existingIdx] = record;
          return updated;
        } else {
          const newRecord: SalahRecordType = {
            date: today,
            salahs: {
              Fajr: "",
              Dhuhr: "",
              Asar: "",
              Asr: "",
              Maghrib: "",
              Isha: "",
              [selectedSalah]: selectedStatus,
              ...(selectedSalah === "Asr" ? { Asar: selectedStatus } : {}),
            },
          };
          return [newRecord, ...prev];
        }
      });

      showToast(`Saved ${selectedSalah}`, "short");
      onClose();
    } catch (err) {
      console.error("Failed to quick log salah:", err);
      showToast("Error saving prayer", "short");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <IonModal
      isOpen={isOpen}
      onDidDismiss={onClose}
      initialBreakpoint={0.8}
      breakpoints={[0, 0.8, 1]}
      handle={false}
      className="quick-log-modal"
    >
      <div className="bg-[#121212] border-t border-[#242424] text-white p-4 h-full flex flex-col font-mono select-none overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#242424]">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-none bg-[#10B981]" />
            <span className="text-[10px] uppercase tracking-widest text-[#71717A]">
              QUICK LOG
            </span>
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              {format(new Date(), "EEE, MMM d")}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[#71717A] hover:text-white transition-colors"
            aria-label="Close"
          >
            <IonIcon icon={closeOutline} className="text-lg" />
          </button>
        </div>

        {/* Prayer Selector Tabs */}
        <div className="grid grid-cols-5 gap-1.5 my-3">
          {salahNames.map((name) => {
            const isSelected = selectedSalah === name;
            return (
              <button
                key={name}
                onClick={() => {
                  triggerHaptic();
                  setSelectedSalah(name);
                }}
                className={`py-2 px-1 rounded-none text-center text-[10px] uppercase tracking-wider transition-all border ${
                  isSelected
                    ? "bg-[#181818] border-white text-white font-bold"
                    : "bg-[#141414] border-[#242424] text-[#71717A] hover:text-white"
                }`}
              >
                {name}
              </button>
            );
          })}
        </div>

        {/* Status Selection Buttons */}
        <div className="text-[10px] font-mono uppercase tracking-widest text-[#71717A] mb-1.5">
          STATUS:
        </div>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <button
            onClick={() => {
              triggerHaptic();
              setSelectedStatus("group");
            }}
            className={`flex items-center justify-between p-2.5 rounded-none transition-all border ${
              selectedStatus === "group"
                ? "bg-[#1C1612] border-[#B5876E] text-white shadow-[0_0_8px_rgba(181,135,110,0.15)]"
                : "bg-[#141414] border-[#242424] text-[#71717A] hover:text-white"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-none bg-[#B5876E]" />
              <span className="text-xs font-medium tracking-wide">In Jamaah</span>
            </div>
            <IonIcon
              icon={checkmarkCircle}
              className={`text-sm ${
                selectedStatus === "group" ? "text-[#B5876E]" : "text-[#71717A]"
              }`}
            />
          </button>

          <button
            onClick={() => {
              triggerHaptic();
              setSelectedStatus(
                userPreferences.userGender === "male"
                  ? "male-alone"
                  : "female-alone",
              );
            }}
            className={`flex items-center justify-between p-2.5 rounded-none transition-all border ${
              selectedStatus === "male-alone" || selectedStatus === "female-alone"
                ? "bg-[#1A1A1A] border-[#10B981] text-white"
                : "bg-[#141414] border-[#242424] text-[#71717A] hover:text-white"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-none bg-[#10B981]" />
              <span className="text-xs font-medium tracking-wide">
                {userPreferences.userGender === "male" ? "Alone" : "Prayed"}
              </span>
            </div>
            <IonIcon
              icon={checkmarkOutline}
              className={`text-sm ${
                selectedStatus === "male-alone" || selectedStatus === "female-alone"
                  ? "text-[#10B981]"
                  : "text-[#71717A]"
              }`}
            />
          </button>

          <button
            onClick={() => {
              triggerHaptic();
              setSelectedStatus("late");
            }}
            className={`flex items-center justify-between p-2.5 rounded-none transition-all border ${
              selectedStatus === "late"
                ? "bg-[#1A1A1A] border-[#F59E0B] text-white"
                : "bg-[#141414] border-[#242424] text-[#71717A] hover:text-white"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-none bg-[#F59E0B]" />
              <span className="text-xs font-medium tracking-wide">Late</span>
            </div>
            <IonIcon icon={timeOutline} className="text-sm text-[#F59E0B]" />
          </button>

          <button
            onClick={() => {
              triggerHaptic();
              setSelectedStatus("missed");
            }}
            className={`flex items-center justify-between p-2.5 rounded-none transition-all border ${
              selectedStatus === "missed"
                ? "bg-[#1A1A1A] border-[#EF4444] text-white"
                : "bg-[#141414] border-[#242424] text-[#71717A] hover:text-white"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-none bg-[#EF4444]" />
              <span className="text-xs font-medium tracking-wide">Missed</span>
            </div>
            <IonIcon icon={closeCircleOutline} className="text-sm text-[#EF4444]" />
          </button>
        </div>

        {/* Excused Option */}
        <button
          onClick={() => {
            triggerHaptic();
            setSelectedStatus("excused");
          }}
          className={`flex items-center justify-between p-2 rounded-none mb-3 transition-all border ${
            selectedStatus === "excused"
              ? "bg-[#1A1A1A] border-white text-white"
              : "bg-[#141414] border-[#242424] text-[#71717A] hover:text-white"
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-none bg-[#71717A]" />
            <span className="text-xs font-medium tracking-wide">Excused / Exempt</span>
          </div>
          <IonIcon icon={removeCircleOutline} className="text-sm text-[#71717A]" />
        </button>

        {/* Reasons Section */}
        {reasonsList.length > 0 && (
          <div className="mt-1 mb-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#71717A]">
                REASONS (OPTIONAL):
              </span>
              {selectedReasons.length > 0 && (
                <span className="text-[10px] font-mono text-[#10B981]">
                  {selectedReasons.length} selected
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto py-1">
              {reasonsList.map((reason) => {
                const isSelected = selectedReasons.includes(reason);
                return (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => toggleReason(reason)}
                    className={`py-1 px-2.5 rounded-none text-[11px] font-mono transition-all border ${
                      isSelected
                        ? "bg-[#242424] border-white text-white font-bold"
                        : "bg-[#161616] border-[#242424] text-[#71717A] hover:text-white"
                    }`}
                  >
                    {reason}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Notes Input */}
        <div className="mb-4">
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add note (optional)..."
            className="w-full bg-[#161616] border border-[#242424] rounded-none p-2 text-xs font-mono text-white placeholder-[#52525B] focus:outline-none focus:border-white transition-colors"
          />
        </div>

        {/* Primary Save Action Button */}
        <button
          onClick={handleSave}
          disabled={!selectedStatus || isSubmitting}
          className={`w-full py-3.5 px-4 rounded-none font-mono text-xs uppercase tracking-wider font-bold transition-all border ${
            selectedStatus
              ? "bg-white text-black border-white cursor-pointer opacity-100 hover:bg-[#E4E4E7]"
              : "bg-[#181818] text-[#71717A] border-[#242424] opacity-40 cursor-not-allowed"
          }`}
          style={{
            background: selectedStatus ? "#FFFFFF" : "#181818",
            color: selectedStatus ? "#000000" : "#71717A",
          }}
        >
          {isSubmitting ? "Saving..." : `Save ${selectedSalah}`}
        </button>
      </div>
    </IonModal>
  );
};

export default QuickLogModal;
