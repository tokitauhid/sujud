import { useMemo } from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
} from "date-fns";
import CalendarDay from "./CalendarDay";

interface CalendarGridProps {
  currentMonthDate: Date;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const CalendarGrid = ({
  currentMonthDate,
  selectedDate,
  onSelectDate,
}: CalendarGridProps) => {
  const daysInGrid = useMemo(() => {
    const monthStart = startOfMonth(currentMonthDate);
    const monthEnd = endOfMonth(currentMonthDate);

    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [currentMonthDate]);

  return (
    <div className="w-full">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-[#242424] bg-[#141414]">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="py-1.5 text-center text-[10px] font-mono font-semibold uppercase tracking-wider text-[#71717A]"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-px bg-[#242424] border-b border-[#242424]">
        {daysInGrid.map((day) => (
          <CalendarDay
            key={format(day, "yyyy-MM-dd")}
            day={day}
            selectedDate={selectedDate}
            currentMonthDate={currentMonthDate}
            onSelectDate={onSelectDate}
          />
        ))}
      </div>
    </div>
  );
};

export default CalendarGrid;
