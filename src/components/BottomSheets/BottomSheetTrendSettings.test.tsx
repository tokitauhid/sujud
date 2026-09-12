import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import BottomSheetTrendSettings from "./BottomSheetTrendSettings";
import { mockdbConnection, mockUserPrefs } from "../../__mocks__/test-utils";

describe("BottomSheetTrendSettings Component", () => {
  it("renders trend notifications options and toggles", () => {
    const mockSetPrefs = vi.fn();
    render(
      <BottomSheetTrendSettings
        dbConnection={mockdbConnection}
        triggerId="test-trigger"
        userPreferences={{
          ...mockUserPrefs,
          trendNotificationEnabled: "1",
          trendWeeklyNotification: "1",
          trendMonthlyNotification: "0",
          trendYearlyNotification: "0",
        }}
        setUserPreferences={mockSetPrefs}
      />,
    );

    expect(screen.getByText(/TREND NOTIFICATIONS/i)).toBeInTheDocument();
    expect(screen.getByText(/Enable Trend Reports/i)).toBeInTheDocument();
    expect(screen.getByText(/Weekly Summary/i)).toBeInTheDocument();
    expect(screen.getByText(/Monthly Summary/i)).toBeInTheDocument();
    expect(screen.getByText(/Yearly Summary/i)).toBeInTheDocument();
    expect(screen.getByText(/Delivery Time/i)).toBeInTheDocument();
  });
});
