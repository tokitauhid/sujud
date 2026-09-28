import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import PrayerTimesCalendar from "./PrayerTimesCalendar";
import EventInformation from "./EventInformation";
import { getHijriDate, getIslamicEventForDate } from "../../utils/hijriCalendar";

describe("PrayerTimesCalendar Component", () => {
  it("renders Gregorian calendar and Hijri month range in header", () => {
    const testDate = new Date(2026, 8, 28); // Sep 28, 2026
    const onSelectDate = vi.fn();

    render(
      <PrayerTimesCalendar
        selectedDate={testDate}
        onSelectDate={onSelectDate}
      />,
    );

    // Gregorian month in header
    expect(screen.getByText(/September 2026/i)).toBeInTheDocument();
    // Hijri month range
    expect(screen.getByText(/1448 AH/i)).toBeInTheDocument();

    // Weekday headers
    ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].forEach((day) => {
      expect(screen.getByText(day)).toBeInTheDocument();
    });
  });

  it("renders cells with both Gregorian day and Hijri date", () => {
    const testDate = new Date(2026, 8, 28);
    const onSelectDate = vi.fn();

    render(
      <PrayerTimesCalendar
        selectedDate={testDate}
        onSelectDate={onSelectDate}
      />,
    );

    // Test date cell: 28th Sep 2026
    const dayButton = screen.getByTestId("calendar-day-2026-09-28");
    expect(dayButton).toBeInTheDocument();
    expect(dayButton).toHaveTextContent("28");

    // Hijri date for 2026-09-28 is 17 Rabi' al-Thani
    const hijri = getHijriDate(testDate);
    expect(dayButton).toHaveTextContent(String(hijri.day));
  });

  it("calls onSelectDate when a day cell is clicked", () => {
    const testDate = new Date(2026, 8, 28);
    const onSelectDate = vi.fn();

    render(
      <PrayerTimesCalendar
        selectedDate={testDate}
        onSelectDate={onSelectDate}
      />,
    );

    const targetDay = screen.getByTestId("calendar-day-2026-09-15");
    fireEvent.click(targetDay);

    expect(onSelectDate).toHaveBeenCalledTimes(1);
    const selectedCall = onSelectDate.mock.calls[0][0];
    expect(selectedCall.getDate()).toBe(15);
    expect(selectedCall.getMonth()).toBe(8); // September
  });

  it("navigates between months when previous and next buttons are clicked", () => {
    const testDate = new Date(2026, 8, 28); // Sep 2026
    const onSelectDate = vi.fn();

    render(
      <PrayerTimesCalendar
        selectedDate={testDate}
        onSelectDate={onSelectDate}
      />,
    );

    const prevButton = screen.getByTestId("calendar-prev-month-button");
    const nextButton = screen.getByTestId("calendar-next-month-button");

    // Go to previous month (August 2026)
    fireEvent.click(prevButton);
    expect(screen.getByText(/August 2026/i)).toBeInTheDocument();

    // Go forward twice to October 2026
    fireEvent.click(nextButton);
    fireEvent.click(nextButton);
    expect(screen.getByText(/October 2026/i)).toBeInTheDocument();
  });

  it("returns to today when Today button is clicked", () => {
    const testDate = new Date(2025, 0, 1); // Jan 2025 (in the past)
    const onSelectDate = vi.fn();

    render(
      <PrayerTimesCalendar
        selectedDate={testDate}
        onSelectDate={onSelectDate}
      />,
    );

    const todayButton = screen.getByTestId("calendar-today-button");
    fireEvent.click(todayButton);

    expect(onSelectDate).toHaveBeenCalled();
    const callDate = onSelectDate.mock.calls[0][0];
    const today = new Date();
    expect(callDate.getDate()).toBe(today.getDate());
    expect(callDate.getMonth()).toBe(today.getMonth());
    expect(callDate.getFullYear()).toBe(today.getFullYear());
  });

  it("displays event indicators on dates with Islamic events", () => {
    // Ramadan 1, 1447 corresponds to 2026-02-18
    const feb2026 = new Date(2026, 1, 18);
    const onSelectDate = vi.fn();

    render(
      <PrayerTimesCalendar
        selectedDate={feb2026}
        onSelectDate={onSelectDate}
      />,
    );

    const ramadanCell = screen.getByTestId("calendar-day-2026-02-18");
    expect(ramadanCell).toBeInTheDocument();
    // Has event indicator
    expect(ramadanCell.getAttribute("aria-label")).toContain("Ramadan Begins");
  });
});

describe("EventInformation Component", () => {
  it("renders event details when an event is present", () => {
    const ramadanDate = new Date(2026, 1, 18);
    const hijri = getHijriDate(ramadanDate);
    const event = getIslamicEventForDate(hijri);

    expect(event).not.toBeNull();

    render(<EventInformation event={event} hijriDate={hijri} />);

    expect(screen.getByTestId("event-information-card")).toBeInTheDocument();
    expect(screen.getByText("Ramadan Begins")).toBeInTheDocument();
    expect(screen.getByText(/holy month of fasting/i)).toBeInTheDocument();
    expect(screen.getByText(/Major Event/i)).toBeInTheDocument();
  });

  it("renders null and no empty container when event is null", () => {
    const { container } = render(
      <EventInformation event={null} />,
    );

    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId("event-information-card")).not.toBeInTheDocument();
  });
});
