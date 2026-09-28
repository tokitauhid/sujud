import { useMemo } from "react";
import { format, startOfMonth, endOfMonth, isSameMonth } from "date-fns";
import { IonIcon } from "@ionic/react";
import { chevronBackOutline, chevronForwardOutline } from "ionicons/icons";
import { getHijriMonthRange } from "../../utils/hijriCalendar";

interface CalendarHeaderProps {
  currentMonthDate: Date;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onReturnToToday: () => void;
  isCurrentMonthToday: boolean;
}

const CalendarHeader = ({
  currentMonthDate,
  onPreviousMonth,
  onNextMonth,
  onReturnToToday,
  isCurrentMonthToday,
}: CalendarHeaderProps) => {
  const gregorianLabel = format(currentMonthDate, "MMMM yyyy");

  const hijriMonthRange = useMemo(() => {
    const monthStart = startOfMonth(currentMonthDate);
    const monthEnd = endOfMonth(currentMonthDate);
    return getHijriMonthRange(monthStart, monthEnd);
  }, [currentMonthDate]);

  const isTodayVisible = isSameMonth(currentMonthDate, new Date());

  return (
    <div className="flex flex-col gap-2 p-3 border-b border-[#242424] bg-[#161616]">
      <div className="flex items-center justify-between">
        {/* Month title & Hijri range */}
        <div>
          <h2 className="text-xs sm:text-sm font-mono font-bold uppercase tracking-wider text-white">
            {gregorianLabel}
          </h2>
          <p className="text-[10px] sm:text-xs font-mono text-[#8E8E93] mt-0.5">
            {hijriMonthRange}
          </p>
        </div>

        {/* Navigation controls */}
        <div className="flex items-center gap-1.5 font-mono">
          <button
            type="button"
            onClick={onReturnToToday}
            aria-label="Return to today"
            data-testid="calendar-today-button"
            className={`px-2 py-1 text-[11px] font-mono uppercase tracking-wider border rounded-none transition-colors cursor-pointer ${
              isTodayVisible && isCurrentMonthToday
                ? "border-[#10B981] bg-[#10B981]/10 text-[#10B981]"
                : "border-[#2A2A2A] bg-[#121212] text-[#8E8E93] hover:text-white hover:border-[#3F3F46]"
            }`}
          >
            Today
          </button>

          <button
            type="button"
            onClick={onPreviousMonth}
            aria-label="Previous month"
            data-testid="calendar-prev-month-button"
            className="p-1 border border-[#2A2A2A] bg-[#121212] hover:border-[#3F3F46] text-[#8E8E93] hover:text-white transition-colors rounded-none cursor-pointer flex items-center justify-center"
          >
            <IonIcon icon={chevronBackOutline} className="text-sm" />
          </button>

          <button
            type="button"
            onClick={onNextMonth}
            aria-label="Next month"
            data-testid="calendar-next-month-button"
            className="p-1 border border-[#2A2A2A] bg-[#121212] hover:border-[#3F3F46] text-[#8E8E93] hover:text-white transition-colors rounded-none cursor-pointer flex items-center justify-center"
          >
            <IonIcon icon={chevronForwardOutline} className="text-sm" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default CalendarHeader;
