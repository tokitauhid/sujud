import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import BottomSheetAdhanSettings from "./BottomSheetAdhanSettings";
import { mockdbConnection, mockUserPrefs, mockLocations } from "../../__mocks__/test-utils";

vi.mock("../../services/AdhanAlarm", () => ({
  AdhanAlarm: {
    scheduleAdhan: vi.fn(),
    cancelAdhan: vi.fn(),
    stopAdhan: vi.fn(),
    testAdhan: vi.fn(),
    openAutostartSettings: vi.fn(),
    openBatterySaverSettings: vi.fn(),
    openExactAlarmSettings: vi.fn(),
    getDeviceStatus: vi.fn().mockResolvedValue({
      manufacturer: "Xiaomi",
      isXiaomi: true,
      canScheduleExactAlarms: true,
      isIgnoringBatteryOptimizations: true,
    }),
  },
}));

describe("BottomSheetAdhanSettings Component", () => {
  it("renders adhan settings title, quick presets, and prayer list cards", () => {
    const mockSetPrefs = vi.fn();
    render(
      <BottomSheetAdhanSettings
        dbConnection={mockdbConnection}
        triggerId="open-adhan-settings-sheet"
        userPreferences={{
          ...mockUserPrefs,
          fajrNotification: "adhan",
          dhuhrNotification: "adhan",
          asrNotification: "off",
          maghribNotification: "adhan",
          ishaNotification: "off",
          dhuhrAdhanMode: "offset",
          dhuhrAdhanOffset: "15",
        }}
        setUserPreferences={mockSetPrefs}
        userLocations={mockLocations}
      />,
    );

    expect(screen.getByText(/ADHAN SETTINGS & SCHEDULING/i)).toBeInTheDocument();
    expect(screen.getByText(/QUICK PRESETS/i)).toBeInTheDocument();
    expect(screen.getByText(/Enable All Adhans/i)).toBeInTheDocument();
    expect(screen.getByText(/Set All to \+15m Offset/i)).toBeInTheDocument();
    expect(screen.getByText(/Reset All to Start Time/i)).toBeInTheDocument();

    // Prayers
    expect(screen.getByText(/^Fajr$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Dhuhr$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Asr$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Maghrib$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Isha$/i)).toBeInTheDocument();
  });
});
