import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import TrendAnalysisView from "./TrendAnalysisView";
import { mockdbConnection, mockUserPrefs } from "../../../__mocks__/test-utils";
import { SalahRecordsArrayType } from "../../../types/types";

const mockSalahData: SalahRecordsArrayType = [
  {
    date: "2026-09-07",
    salahs: { Fajr: "group", Dhuhr: "group", Asar: "group", Maghrib: "group", Isha: "group" },
  },
  {
    date: "2026-09-08",
    salahs: { Fajr: "male-alone", Dhuhr: "group", Asar: "group", Maghrib: "group", Isha: "group" },
  },
  {
    date: "2026-09-09",
    salahs: { Fajr: "late", Dhuhr: "group", Asar: "male-alone", Maghrib: "group", Isha: "group" },
  },
];

describe("TrendAnalysisView Component", () => {
  it("renders weekly, monthly, and yearly period tabs", () => {
    render(
      <TrendAnalysisView
        dbConnection={mockdbConnection}
        userPreferences={mockUserPrefs}
        fetchedSalahData={mockSalahData}
      />,
    );

    expect(screen.getByRole("button", { name: /weekly/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /monthly/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /yearly/i })).toBeInTheDocument();
  });

  it("switches period when tab is clicked", async () => {
    render(
      <TrendAnalysisView
        dbConnection={mockdbConnection}
        userPreferences={mockUserPrefs}
        fetchedSalahData={mockSalahData}
      />,
    );

    const monthlyBtn = screen.getByRole("button", { name: /monthly/i });
    await userEvent.click(monthlyBtn);

    expect(monthlyBtn).toHaveClass("text-white");
  });

  it("displays months on the chart X-axis when Yearly period is selected", async () => {
    render(
      <TrendAnalysisView
        dbConnection={mockdbConnection}
        userPreferences={mockUserPrefs}
        fetchedSalahData={mockSalahData}
      />,
    );

    const yearlyBtn = screen.getByRole("button", { name: /yearly/i });
    await userEvent.click(yearlyBtn);

    expect(yearlyBtn).toHaveClass("text-white");

    // All 12 months should be rendered on the X-axis
    expect(screen.getByText("Jan")).toBeInTheDocument();
    expect(screen.getByText("Feb")).toBeInTheDocument();
    expect(screen.getByText("Mar")).toBeInTheDocument();
    expect(screen.getByText("Apr")).toBeInTheDocument();
    expect(screen.getByText("May")).toBeInTheDocument();
    expect(screen.getByText("Jun")).toBeInTheDocument();
    expect(screen.getByText("Jul")).toBeInTheDocument();
    expect(screen.getByText("Aug")).toBeInTheDocument();
    expect(screen.getByText("Sep")).toBeInTheDocument();
    expect(screen.getByText("Oct")).toBeInTheDocument();
    expect(screen.getByText("Nov")).toBeInTheDocument();
    expect(screen.getByText("Dec")).toBeInTheDocument();

    // Chart header should reflect monthly completion
    expect(screen.getByText(/Monthly Completion — 12 Months/i)).toBeInTheDocument();

    // Switching back to Weekly displays weekdays instead of months
    const weeklyBtn = screen.getByRole("button", { name: /weekly/i });
    await userEvent.click(weeklyBtn);
    expect(screen.getByText(/Daily Completion — 7 Days/i)).toBeInTheDocument();
  });

  it("renders completion percentage and steadfastness streak cards", () => {
    render(
      <TrendAnalysisView
        dbConnection={mockdbConnection}
        userPreferences={mockUserPrefs}
        fetchedSalahData={mockSalahData}
      />,
    );

    expect(screen.getAllByText(/COMPLETION RATE/i)[0]).toBeInTheDocument();
    expect(screen.getByText(/STREAK & STEADFASTNESS/i)).toBeInTheDocument();
  });

  it("displays Jamaah Reporting section in male mode", () => {
    render(
      <TrendAnalysisView
        dbConnection={mockdbConnection}
        userPreferences={{ ...mockUserPrefs, userGender: "male" }}
        fetchedSalahData={mockSalahData}
      />,
    );

    expect(screen.getByText(/JAMAAH REPORTING/i)).toBeInTheDocument();
    expect(screen.getByText(/JAMAAH RATE/i)).toBeInTheDocument();
  });

  it("does not display male Jamaah reporting section for female users", () => {
    render(
      <TrendAnalysisView
        dbConnection={mockdbConnection}
        userPreferences={{ ...mockUserPrefs, userGender: "female" }}
        fetchedSalahData={mockSalahData}
      />,
    );

    expect(screen.queryByText(/JAMAAH REPORTING/i)).not.toBeInTheDocument();
  });

  it("renders prayer-status breakdown table and trend chart", () => {
    render(
      <TrendAnalysisView
        dbConnection={mockdbConnection}
        userPreferences={mockUserPrefs}
        fetchedSalahData={mockSalahData}
      />,
    );

    expect(screen.getByText(/PRAYER-STATUS BREAKDOWN/i)).toBeInTheDocument();
    expect(screen.getByText(/PRAYER CONSISTENCY & JAMAAH/i)).toBeInTheDocument();
    expect(screen.getAllByText("Fajr")[0]).toBeInTheDocument();
    expect(screen.getAllByText("Dhuhr")[0]).toBeInTheDocument();
    expect(screen.getAllByText("Asr")[0]).toBeInTheDocument();
    expect(screen.getAllByText("Maghrib")[0]).toBeInTheDocument();
    expect(screen.getAllByText("Isha")[0]).toBeInTheDocument();
  });

  it("opens saved history modal when clicking history button", async () => {
    render(
      <TrendAnalysisView
        dbConnection={mockdbConnection}
        userPreferences={mockUserPrefs}
        fetchedSalahData={mockSalahData}
      />,
    );

    const historyBtn = screen.getByLabelText(/view report history/i);
    await userEvent.click(historyBtn);

    expect(screen.getByText(/WEEKLY REPORT HISTORY/i)).toBeInTheDocument();
  });

  describe("Reflection Card Removal (Bug 4)", () => {
    it("never renders reflection section in TrendAnalysisView even when prayer data is available", () => {
      render(
        <TrendAnalysisView
          dbConnection={mockdbConnection}
          userPreferences={mockUserPrefs}
          fetchedSalahData={mockSalahData}
        />,
      );

      expect(screen.queryByText("REFLECTION")).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: /view source/i })).not.toBeInTheDocument();
    });

    it("does not render reflection section when prayer data is completely empty", () => {
      render(
        <TrendAnalysisView
          dbConnection={mockdbConnection}
          userPreferences={mockUserPrefs}
          fetchedSalahData={[]}
        />,
      );

      expect(screen.queryByText("REFLECTION")).not.toBeInTheDocument();
    });
  });
});
