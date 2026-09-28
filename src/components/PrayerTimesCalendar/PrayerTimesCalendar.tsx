import { useState, useEffect, useRef } from "react";
import { addMonths, isSameMonth, isSameDay } from "date-fns";
import CalendarHeader from "./CalendarHeader";
import CalendarGrid from "./CalendarGrid";

interface PrayerTimesCalendarProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  className?: string;
}

const PrayerTimesCalendar = ({
  selectedDate,
  onSelectDate,
  className = "",
}: PrayerTimesCalendarProps) => {
  // Track the month currently being viewed in the calendar
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(selectedDate);
  const prevSelectedDateRef = useRef<Date>(selectedDate);

  // Sync currentMonthDate ONLY when selectedDate changes externally (e.g. from day navigation)
  useEffect(() => {
    if (!isSameDay(prevSelectedDateRef.current, selectedDate)) {
      prevSelectedDateRef.current = selectedDate;
      if (!isSameMonth(currentMonthDate, selectedDate)) {
        setCurrentMonthDate(selectedDate);
      }
    }
  }, [selectedDate, currentMonthDate]);

  const handlePreviousMonth = () => {
    setCurrentMonthDate((prev) => addMonths(prev, -1));
  };

  const handleNextMonth = () => {
    setCurrentMonthDate((prev) => addMonths(prev, 1));
  };

  const handleReturnToToday = () => {
    const today = new Date();
    setCurrentMonthDate(today);
    onSelectDate(today);
  };

  const handleDaySelect = (day: Date) => {
    onSelectDate(day);
    // If user clicked a day from adjacent month visible in the grid, update viewing month too
    if (!isSameMonth(day, currentMonthDate)) {
      setCurrentMonthDate(day);
    }
  };

  const isCurrentMonthToday = isSameDay(selectedDate, new Date());

  return (
    <div
      aria-label="Hijri and Gregorian Prayer Times Calendar"
      data-testid="prayer-times-calendar"
      className={`border border-[#242424] bg-[#121212] mb-3 overflow-hidden ${className}`}
    >
      <CalendarHeader
        currentMonthDate={currentMonthDate}
        onPreviousMonth={handlePreviousMonth}
        onNextMonth={handleNextMonth}
        onReturnToToday={handleReturnToToday}
        isCurrentMonthToday={isCurrentMonthToday}
      />
      <CalendarGrid
        currentMonthDate={currentMonthDate}
        selectedDate={selectedDate}
        onSelectDate={handleDaySelect}
      />
    </div>
  );
};

export default PrayerTimesCalendar;
