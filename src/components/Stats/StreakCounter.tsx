import { createLocalisedDate } from "../../utils/helpers";
import { streakDatesObjType } from "../../types/types";
import { format, isSameDay } from "date-fns";
import { GoInfo } from "react-icons/go";
import { Dialog } from "@capacitor/dialog";
import BottomSheetStreaksHistory from "../BottomSheets/BottomSheetStreaksHistory";
import { useState } from "react";

interface StreakCounterProps {
  streakDatesObjectsArr: streakDatesObjType[];
  activeStreakCount: number;
  userGender: string;
}

const StreakCounter = ({
  streakDatesObjectsArr,
  activeStreakCount,
  userGender,
}: StreakCounterProps) => {
  const [showStreakHistorySheet, setShowStreakHistorySheet] = useState(false);
  const activeStreakObj = streakDatesObjectsArr.filter(
    (obj) => obj.isActive === true,
  )[0];

  const showStreakInfo = async () => {
    await Dialog.alert({
      title: "Streaks Explained",
      message:
        userGender === "male"
          ? `Streaks represent the number of consecutive days you've completed all your Salah, starting from the first day of full completion.

          - Streaks continue if you pray in a group or alone.
          - If you miss a Salah or are late, your streak resets.`
          : `Streaks represent the number of consecutive days you've completed all your Salah, starting from the first day of full completion.
          
          - Streaks continue as long as you pray on time.
          - If you select "Excused", your streak will pause (it won't break, but it also won't increase).`,
    });
  };

  const hasStreakDays = streakDatesObjectsArr.some((obj) => obj.days > 0);

  const filteredStreakDatesObjectsArr = streakDatesObjectsArr.filter(
    (obj) => obj.startDate.getTime() !== obj.endDate.getTime(),
  );

  return (
    <>
      <div className="mb-4 bg-[#121212] border border-[#242424] rounded-[4px] font-mono">
        <section className="flex items-center justify-between p-3 border-b border-[#242424] text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#F59E0B]"></span>
            <span className="text-xs font-bold tracking-wider uppercase text-white">
              CURRENT STREAK
            </span>
          </div>
          <button
            onClick={showStreakInfo}
            className="text-[#71717A] hover:text-white transition-colors cursor-pointer"
            aria-label="Streak info"
          >
            <GoInfo className="text-sm" />
          </button>
        </section>

        <div className="py-4 px-3 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-white tabular-nums tracking-tight">
            {activeStreakCount} {activeStreakCount !== 1 ? "Days" : "Day"}
          </span>
          {activeStreakObj && activeStreakObj.days > 0 && (
            <span className="text-[11px] text-[#71717A] mt-1">
              {createLocalisedDate(format(activeStreakObj.startDate, "yyyy-MM-dd"))[1]}
              {!isSameDay(activeStreakObj.startDate, activeStreakObj.endDate) &&
                ` — ${createLocalisedDate(format(activeStreakObj.endDate, "yyyy-MM-dd"))[1]}`}
            </span>
          )}
        </div>

        {hasStreakDays && filteredStreakDatesObjectsArr.length > 0 && (
          <button
            onClick={() => setShowStreakHistorySheet(true)}
            className="w-full py-2 border-t border-[#242424] text-[11px] uppercase tracking-wider text-[#8E8E93] hover:text-white hover:bg-[#161616] transition-colors"
          >
            View Streak History →
          </button>
        )}
      </div>
      <BottomSheetStreaksHistory
        setShowStreakHistorySheet={setShowStreakHistorySheet}
        showStreakHistorySheet={showStreakHistorySheet}
        filteredStreakDatesObjectsArr={filteredStreakDatesObjectsArr}
      />
    </>
  );
};

export default StreakCounter;
