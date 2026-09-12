import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
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

    const historyBtn = screen.getByLabelText(/view saved snapshot history/i);
    await userEvent.click(historyBtn);

    expect(screen.getByText(/SAVED WEEKLY SNAPSHOTS/i)).toBeInTheDocument();
  });
});
