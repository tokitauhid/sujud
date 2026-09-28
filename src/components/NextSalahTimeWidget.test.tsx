import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import NextSalahTimeWidget from "./NextSalahTimeWidget";
import { mockUserPrefs, mockUserLocations } from "../__mocks__/test-utils";
import { nextSalahTimeType } from "../types/types";

describe("NextSalahTimeWidget - Distinct Prayer Windows and Sunrise-Dhuhr Gap", () => {
  const activePrefs = {
    ...mockUserPrefs,
    prayerCalculationMethod: "MuslimWorldLeague",
  };

  it("renders null if calculation method is not set", () => {
    const { container } = render(
      <NextSalahTimeWidget
        userPreferences={{ ...mockUserPrefs, prayerCalculationMethod: "" }}
        userLocations={mockUserLocations}
        nextSalahNameAndTime={{
          currentSalah: "fajr",
          nextSalah: "sunrise",
          nextSalahTime: new Date(),
          hoursRemaining: 0,
          minsRemaining: 45,
        }}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders null if userLocations is empty", () => {
    const { container } = render(
      <NextSalahTimeWidget
        userPreferences={activePrefs}
        userLocations={[]}
        nextSalahNameAndTime={{
          currentSalah: "fajr",
          nextSalah: "sunrise",
          nextSalahTime: new Date(),
          hoursRemaining: 0,
          minsRemaining: 45,
        }}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("displays Fajr as current prayer before sunrise (during Fajr)", () => {
    const fajrState: nextSalahTimeType = {
      currentSalah: "fajr",
      nextSalah: "sunrise",
      nextSalahTime: new Date(),
      hoursRemaining: 1,
      minsRemaining: 15,
    };

    render(
      <NextSalahTimeWidget
        userPreferences={activePrefs}
        userLocations={mockUserLocations}
        nextSalahNameAndTime={fajrState}
      />
    );

    expect(screen.getByText(/CURRENT PRAYER/i)).toBeInTheDocument();
    expect(screen.getByText("Fajr")).toBeInTheDocument();
    expect(screen.getByText(/to go until/i)).toBeInTheDocument();
    expect(screen.getByText("Sunrise")).toBeInTheDocument();
  });

  it("does NOT show Fajr as current prayer after sunrise (sunrise -> Dhuhr gap)", () => {
    // In the non-salah morning period: currentSalah is "sunrise", nextSalah is "dhuhr"
    const morningGapState: nextSalahTimeType = {
      currentSalah: "sunrise",
      nextSalah: "dhuhr",
      nextSalahTime: new Date(),
      hoursRemaining: 4,
      minsRemaining: 30,
    };

    render(
      <NextSalahTimeWidget
        userPreferences={activePrefs}
        userLocations={mockUserLocations}
        nextSalahNameAndTime={morningGapState}
      />
    );

    // Must show UPCOMING PRAYER: Dhuhr
    expect(screen.getByText(/UPCOMING PRAYER/i)).toBeInTheDocument();
    expect(screen.getByText("Dhuhr")).toBeInTheDocument();

    // Must NOT show any CURRENT PRAYER
    expect(screen.queryByText(/CURRENT PRAYER/i)).not.toBeInTheDocument();

    // Must NOT mention Fajr anywhere
    expect(screen.queryByText("Fajr")).not.toBeInTheDocument();

    // Countdown should indicate time to go until Dhuhr
    expect(screen.getByText(/4 hours and/i)).toBeInTheDocument();
    expect(screen.getByText(/30 minutes to go/i)).toBeInTheDocument();
  });

  it("displays Dhuhr as current prayer when Dhuhr begins", () => {
    const dhuhrState: nextSalahTimeType = {
      currentSalah: "dhuhr",
      nextSalah: "asr",
      nextSalahTime: new Date(),
      hoursRemaining: 3,
      minsRemaining: 20,
    };

    render(
      <NextSalahTimeWidget
        userPreferences={activePrefs}
        userLocations={mockUserLocations}
        nextSalahNameAndTime={dhuhrState}
      />
    );

    expect(screen.getByText(/CURRENT PRAYER/i)).toBeInTheDocument();
    expect(screen.getByText("Dhuhr")).toBeInTheDocument();
    expect(screen.getByText(/to go until/i)).toBeInTheDocument();
    expect(screen.getByText("Asr")).toBeInTheDocument();
  });

  it("displays Asr as current prayer with countdown to Maghrib", () => {
    const asrState: nextSalahTimeType = {
      currentSalah: "asr",
      nextSalah: "maghrib",
      nextSalahTime: new Date(),
      hoursRemaining: 2,
      minsRemaining: 10,
    };

    render(
      <NextSalahTimeWidget
        userPreferences={activePrefs}
        userLocations={mockUserLocations}
        nextSalahNameAndTime={asrState}
      />
    );

    expect(screen.getByText(/CURRENT PRAYER/i)).toBeInTheDocument();
    expect(screen.getByText("Asr")).toBeInTheDocument();
    expect(screen.getByText("Maghrib")).toBeInTheDocument();
  });
});
