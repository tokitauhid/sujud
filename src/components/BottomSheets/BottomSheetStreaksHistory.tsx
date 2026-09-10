import {
  INITIAL_MODAL_BREAKPOINT,
  MODAL_BREAKPOINTS,
  salahStatusColorsHexCodes,
} from "../../utils/constants";
import { streakDatesObjType } from "../../types/types";
import { format } from "date-fns";
import { IonContent, IonModal } from "@ionic/react";
import { createLocalisedDate } from "../../utils/helpers";
import { Flame } from "lucide-react";

interface BottomSheetStreaksHistoryProps {
  setShowStreakHistorySheet: React.Dispatch<React.SetStateAction<boolean>>;
  showStreakHistorySheet: boolean;
  filteredStreakDatesObjectsArr: streakDatesObjType[];
}
const BottomSheetStreaksHistory = ({
  setShowStreakHistorySheet,
  showStreakHistorySheet,
  filteredStreakDatesObjectsArr,
}: BottomSheetStreaksHistoryProps) => {
  return (
    <IonModal
      mode="ios"
      className="modal-height"
      isOpen={showStreakHistorySheet}
      onDidDismiss={() => {
        setShowStreakHistorySheet(false);
      }}
      initialBreakpoint={INITIAL_MODAL_BREAKPOINT}
      breakpoints={MODAL_BREAKPOINTS}
    >
      <IonContent>
        <section className="mt-8 mb-10 px-4">
          <div className="flex items-center justify-center gap-2 mb-6">
            <Flame className="w-5 h-5 text-[#F59E0B] fill-[#F59E0B]/25" />
            <h1 className="text-xl font-bold font-mono tracking-wider uppercase text-white m-0">
              STREAKS HISTORY
            </h1>
          </div>

          <ul className="space-y-2.5">
            {filteredStreakDatesObjectsArr.map((item, i) => {
              const startDateStr = createLocalisedDate(
                format(item.startDate, "yyyy-MM-dd"),
              )[1];
              const endDateStr = createLocalisedDate(
                format(item.endDate, "yyyy-MM-dd"),
              )[1];

              return (
                item.days > 0 && (
                  <li
                    key={i}
                    className={`p-3.5 rounded-none border font-mono transition-all ${
                      item.isActive
                        ? "border-[#F59E0B]/40 bg-[#16120E] shadow-[0_0_12px_rgba(245,158,11,0.12)]"
                        : "border-[var(--app-border)] bg-[var(--app-card-bg)]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Flame
                          className={`w-4 h-4 shrink-0 ${
                            item.isActive
                              ? "text-[#F59E0B] fill-[#F59E0B]/25"
                              : "text-[#64748B]"
                          }`}
                        />
                        <span className="text-xs text-[#94A3B8]">
                          {startDateStr === endDateStr
                            ? startDateStr
                            : `${startDateStr} — ${endDateStr}`}
                        </span>
                      </div>

                       <div className="flex items-center gap-2">
                        {item.isActive && (
                          <span className="px-1.5 py-0.5 text-[9px] uppercase bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/40 font-bold">
                            ACTIVE
                          </span>
                        )}
                        <span
                          className={`text-sm font-bold tabular-nums ${
                            item.isActive ? "text-[#F59E0B]" : "text-white"
                          }`}
                        >
                          {item.days} {item.days !== 1 ? "Days" : "Day"}
                        </span>
                      </div>
                    </div>

                    {item.excusedDays > 0 && (
                      <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-[#242424] text-[10px] text-[#71717A]">
                        <span
                          style={{
                            backgroundColor: salahStatusColorsHexCodes.excused,
                          }}
                          className="w-2 h-2 rounded-none inline-block"
                        />
                        <span>{item.excusedDays} excused days paused</span>
                      </div>
                    )}
                  </li>
                )
              );
            })}
          </ul>
        </section>
      </IonContent>
    </IonModal>
  );
};

export default BottomSheetStreaksHistory;
