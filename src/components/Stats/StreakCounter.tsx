import { createLocalisedDate } from "../../utils/helpers";
import { streakDatesObjType } from "../../types/types";
import { format, isSameDay } from "date-fns";
import { GoInfo } from "react-icons/go";
import { Dialog } from "@capacitor/dialog";
import BottomSheetStreaksHistory from "../BottomSheets/BottomSheetStreaksHistory";
import { useState } from "react";
import { Flame } from "lucide-react";

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

  const longestStreak = streakDatesObjectsArr.reduce(
    (max, obj) => Math.max(max, obj.days),
    activeStreakCount,
  );

  const getMotivationalMessage = (count: number) => {
    if (count === 0) {
      return "Complete all 5 prayers on time today to ignite your streak.";
    }
    if (count < 3) {
      return "Every prayer builds consistency. Keep the flame burning!";
    }
    if (count < 7) {
      return "Approaching a full week! Steadfastness brings peace to the heart.";
    }
    if (count < 14) {
      return "Mashallah! Over a week of unbroken devotion. Keep striving.";
    }
    if (count < 30) {
      return "Exceptional steadfastness! You are forging an unbreakable habit.";
    }
    return "Unwavering devotion! An extraordinary milestone of steadfastness.";
  };

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
      <div
        className={`mb-4 border rounded-none font-mono transition-all ${
          activeStreakCount > 0
            ? "bg-[#161311] border-[#B5876E]/40 shadow-[0_0_18px_rgba(181,135,110,0.1)]"
            : "bg-[#121212] border-[#242424]"
        }`}
      >
        {/* Top Highlight Accent Bar */}
        {activeStreakCount > 0 && (
          <div className="h-[2px] w-full bg-[#B5876E]" />
        )}

        <section className="flex items-center justify-between p-3 border-b border-[#242424] text-xs">
          <div className="flex items-center gap-2">
            <Flame
              className={`w-4 h-4 shrink-0 ${
                activeStreakCount > 0
                  ? "text-[#CC9374] fill-[#B5876E]/25"
                  : "text-[#725A4C]"
              }`}
            />
            <span className="text-xs font-bold tracking-wider uppercase text-white">
              CURRENT STREAK
            </span>
            {activeStreakCount > 0 && (
              <span className="px-1.5 py-0.5 text-[9px] font-mono uppercase bg-[#B5876E]/20 text-[#CC9374] border border-[#B5876E]/40 font-bold">
                ACTIVE
              </span>
            )}
          </div>
          <button
            onClick={showStreakInfo}
            className="text-[#71717A] hover:text-white transition-colors cursor-pointer"
            aria-label="Streak info"
          >
            <GoInfo className="text-sm" />
          </button>
        </section>

        {/* Hero Counter Area */}
        <div className="py-6 px-4 flex flex-col items-center justify-center text-center">
          <div className="flex items-baseline justify-center gap-2 mb-1">
            <span className="text-5xl font-black text-white tabular-nums tracking-tight font-mono">
              {activeStreakCount}
            </span>
            <span className="text-sm font-bold text-[#CC9374] font-mono tracking-widest uppercase">
              {activeStreakCount === 1 ? "DAY" : "DAYS"}
            </span>
          </div>

          {activeStreakObj && activeStreakObj.days > 0 ? (
            <div className="text-[11px] text-[#A1A1AA] font-mono mt-1">
              {createLocalisedDate(format(activeStreakObj.startDate, "yyyy-MM-dd"))[1]}
              {!isSameDay(activeStreakObj.startDate, activeStreakObj.endDate) &&
                ` — ${createLocalisedDate(format(activeStreakObj.endDate, "yyyy-MM-dd"))[1]}`}
            </div>
          ) : (
            <span className="text-[11px] text-[#71717A] mt-1 font-mono">
              No active streak today
            </span>
          )}

          <p className="text-[11px] text-[#8E8E93] max-w-[290px] mt-3 italic leading-relaxed">
            "{getMotivationalMessage(activeStreakCount)}"
          </p>
        </div>

        {/* Comparison Strip: Current vs Best */}
        <div className="grid grid-cols-2 border-t border-[#242424] divide-x divide-[#242424] text-xs font-mono py-2.5 bg-[#141414]">
          <div className="flex flex-col items-center justify-center px-2">
            <span className="text-[10px] uppercase text-[#71717A] tracking-wider">
              Current
            </span>
            <span className="text-sm font-bold text-[#CC9374] tabular-nums mt-0.5">
              {activeStreakCount} {activeStreakCount === 1 ? "Day" : "Days"}
            </span>
          </div>
          <div className="flex flex-col items-center justify-center px-2">
            <span className="text-[10px] uppercase text-[#71717A] tracking-wider">
              Best Record
            </span>
            <span className="text-sm font-bold text-white tabular-nums mt-0.5">
              {longestStreak} {longestStreak === 1 ? "Day" : "Days"}
            </span>
          </div>
        </div>

        {hasStreakDays && filteredStreakDatesObjectsArr.length > 0 && (
          <button
            onClick={() => setShowStreakHistorySheet(true)}
            className="w-full py-2.5 border-t border-[#242424] text-[11px] uppercase tracking-wider text-[#B5876E] hover:text-[#CC9374] hover:bg-[#181412] transition-colors font-mono font-semibold"
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
