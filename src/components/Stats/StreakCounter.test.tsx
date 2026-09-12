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
});
