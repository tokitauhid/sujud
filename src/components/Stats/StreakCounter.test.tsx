import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import StreakCounter from "./StreakCounter";
import { streakDatesObjType } from "../../types/types";

describe("StreakCounter Component", () => {
  const mockStreakDates: streakDatesObjType[] = [
    {
      startDate: new Date("2026-08-27T00:00:00.000Z"),
      endDate: new Date("2026-09-10T00:00:00.000Z"),
      days: 15,
      isActive: true,
    },
  ];

  it("renders verified Hadith reflection with collection and reference when active streak exists", () => {
    render(
      <StreakCounter
        streakDatesObjectsArr={mockStreakDates}
        activeStreakCount={15}
        userGender="male"
      />,
    );

    expect(screen.getByText("15")).toBeInTheDocument();
    expect(screen.getByText("DAYS")).toBeInTheDocument();

    // Verify Hadith collection attribution is rendered
    expect(screen.getByText(/Sahih al-Bukhari/i)).toBeInTheDocument();

    // Verify link to source is present
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", expect.stringContaining("sunnah.com/bukhari:"));
  });

  it("renders motivational action message when active streak is 0", () => {
    render(
      <StreakCounter
        streakDatesObjectsArr={[]}
        activeStreakCount={0}
        userGender="male"
      />,
    );

    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getByText("DAYS")).toBeInTheDocument();
    expect(
      screen.getByText(/Complete all 5 prayers on time today to ignite your streak/i),
    ).toBeInTheDocument();
  });

  it("rotates Hadith daily across consecutive dates", () => {
    const { unmount: unmountDay1 } = render(
      <StreakCounter
        streakDatesObjectsArr={mockStreakDates}
        activeStreakCount={5}
        userGender="male"
        currentDate="2026-09-20"
      />,
    );
    const day1Link = screen.getByRole("link").getAttribute("href");
    unmountDay1();

    const { unmount: unmountDay2 } = render(
      <StreakCounter
        streakDatesObjectsArr={mockStreakDates}
        activeStreakCount={5}
        userGender="male"
        currentDate="2026-09-21"
      />,
    );
    const day2Link = screen.getByRole("link").getAttribute("href");
    unmountDay2();

    const { unmount: unmountDay3 } = render(
      <StreakCounter
        streakDatesObjectsArr={mockStreakDates}
        activeStreakCount={5}
        userGender="male"
        currentDate="2026-09-22"
      />,
    );
    const day3Link = screen.getByRole("link").getAttribute("href");
    unmountDay3();

    // Consecutive days must yield different hadiths in rotation
    expect(day1Link).not.toBe(day2Link);
    expect(day2Link).not.toBe(day3Link);
  });

  it("maintains the exact same Hadith on the same day even if streak count changes or app restarts", () => {
    const { unmount: unmountStreak5 } = render(
      <StreakCounter
        streakDatesObjectsArr={mockStreakDates}
        activeStreakCount={5}
        userGender="male"
        currentDate="2026-09-20"
      />,
    );
    const hadithStreak5 = screen.getByRole("link").getAttribute("href");
    unmountStreak5();

    // Same day, higher streak count
    const { unmount: unmountStreak6 } = render(
      <StreakCounter
        streakDatesObjectsArr={mockStreakDates}
        activeStreakCount={6}
        userGender="male"
        currentDate="2026-09-20"
      />,
    );
    const hadithStreak6 = screen.getByRole("link").getAttribute("href");
    unmountStreak6();

    // Must be identical because it depends on the calendar date, not the streak count
    expect(hadithStreak5).toBe(hadithStreak6);
  });

  it("updates the Hadith when calendar date changes while mounted", () => {
    const { rerender } = render(
      <StreakCounter
        streakDatesObjectsArr={mockStreakDates}
        activeStreakCount={5}
        userGender="male"
        currentDate="2026-09-20"
      />,
    );
    const initialLink = screen.getByRole("link").getAttribute("href");

    // Re-render with next day
    rerender(
      <StreakCounter
        streakDatesObjectsArr={mockStreakDates}
        activeStreakCount={5}
        userGender="male"
        currentDate="2026-09-21"
      />,
    );
    const updatedLink = screen.getByRole("link").getAttribute("href");

    expect(updatedLink).not.toBe(initialLink);
  });
});
