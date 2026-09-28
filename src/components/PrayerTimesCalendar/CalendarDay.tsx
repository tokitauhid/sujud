import { useMemo } from "react";
import { format, isSameDay } from "date-fns";
import {
  getHijriDate,
  getIslamicEventForDate,
  HijriDate,
} from "../../utils/hijriCalendar";

interface CalendarDayProps {
  day: Date;
  selectedDate: Date;
  currentMonthDate: Date;
  onSelectDate: (date: Date) => void;
}

const CalendarDay = ({
  day,
  selectedDate,
  currentMonthDate,
  onSelectDate,
}: CalendarDayProps) => {
  const isSelected = isSameDay(day, selectedDate);
  const isToday = isSameDay(day, new Date());
  const isCurrentMonth = day.getMonth() === currentMonthDate.getMonth();

  const hijriDate: HijriDate = useMemo(() => getHijriDate(day), [day]);
  const event = useMemo(() => getIslamicEventForDate(hijriDate), [hijriDate]);

  const gregorianDay = day.getDate();
  const hijriLabel = `${hijriDate.day} ${hijriDate.monthNameShort}`;

  const accessibleLabel = `${format(day, "EEEE, MMMM d, yyyy")}. Hijri date: ${hijriDate.formatted}.${
    event ? ` Event: ${event.title}.` : ""
  }${isToday ? " Today." : ""}${isSelected ? " Currently selected." : ""}`;

  return (
    <button
      type="button"
      onClick={() => onSelectDate(day)}
      aria-label={accessibleLabel}
      aria-pressed={isSelected}
      data-testid={`calendar-day-${format(day, "yyyy-MM-dd")}`}
      className={`group relative flex flex-col items-center justify-between p-1 w-full min-h-[52px] sm:min-h-[56px] border rounded-none transition-colors cursor-pointer select-none text-left focus:outline-none focus:ring-1 focus:ring-[#10B981] ${
        isSelected
          ? "bg-[#1E1E1E] border-[#10B981] z-10"
          : isToday
            ? "bg-[#161616] border-[#3F3F46] hover:border-[#52525B]"
            : isCurrentMonth
              ? "bg-[#121212] border-[#242424] hover:bg-[#181818] hover:border-[#3F3F46]"
              : "bg-[#0C0C0C] border-[#1A1A1A] hover:bg-[#141414] text-[#52525B]"
      }`}
    >
      {/* Top row: Gregorian day number + Today / Selected badge */}
      <div className="flex items-center justify-between w-full">
        <span
          className={`text-xs sm:text-sm font-mono font-bold leading-none ${
            isSelected
              ? "text-white"
              : isToday
                ? "text-[#10B981]"
                : isCurrentMonth
                  ? "text-white"
                  : "text-[#52525B]"
          }`}
        >
          {gregorianDay}
        </span>

        {isToday && (
          <span
            className="text-[8px] font-mono uppercase tracking-wider text-[#10B981] font-semibold"
            aria-hidden="true"
          >
            TODAY
          </span>
        )}
      </div>

      {/* Middle row: Hijri day and short month */}
      <div className="w-full text-center my-0.5">
        <span
          className={`text-[9px] sm:text-[10px] font-mono leading-none block truncate ${
            isSelected
              ? "text-[#34D399] font-medium"
              : isToday
                ? "text-[#10B981] font-medium"
                : isCurrentMonth
                  ? "text-[#8E8E93]"
                  : "text-[#3F3F46]"
          }`}
          title={`${hijriDate.day} ${hijriDate.monthName}`}
        >
          {hijriLabel}
        </span>
      </div>

      {/* Bottom row: Islamic event indicator */}
      <div className="flex items-center justify-center w-full min-h-[8px]">
        {event ? (
          <div
            className="flex items-center justify-center gap-1 w-full"
            title={event.title}
          >
            <span
              className={`w-1.5 h-1.5 rounded-none flex-shrink-0 ${
                event.type === "major" ? "bg-[#10B981]" : "bg-[#F59E0B]"
              }`}
              aria-hidden="true"
            />
            <span
              className={`text-[8px] font-mono truncate hidden md:inline leading-none ${
                event.type === "major" ? "text-[#10B981]" : "text-[#F59E0B]"
              }`}
            >
              {event.title}
            </span>
          </div>
        ) : (
          <div className="h-1.5" />
        )}
      </div>
    </button>
  );
};

export default CalendarDay;
