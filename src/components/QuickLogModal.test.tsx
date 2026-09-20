import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import QuickLogModal, { resolveCurrentOrNextSalah } from "./QuickLogModal";
import { mockUserPrefs } from "../__mocks__/test-utils";
import { SQLiteDBConnection } from "@capacitor-community/sqlite";
import { format } from "date-fns";

// Mock helpers
vi.mock("../utils/helpers", async () => {
  const actual = await vi.importActual("../utils/helpers");
  return {
    ...actual,
    showToast: vi.fn(),
  };
});

// Mock syncSalahLogToCloud
vi.mock("../firebase/syncService", () => ({
  syncSalahLogToCloud: vi.fn(),
}));

import { showToast } from "../utils/helpers";

describe("QuickLogModal Component", () => {
  let mockDb: {
    run: ReturnType<typeof vi.fn>;
    query: ReturnType<typeof vi.fn>;
  };
  let dbConnectionRef: React.MutableRefObject<SQLiteDBConnection | undefined>;
  const mockSetFetchedSalahData = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = {
      run: vi.fn().mockResolvedValue({ changes: { changes: 1 } }),
      query: vi.fn().mockResolvedValue({ values: [] }),
    };
    dbConnectionRef = {
      current: mockDb as unknown as SQLiteDBConnection,
    };
  });

  describe("resolveCurrentOrNextSalah helper", () => {
    it("resolves current salah when available", () => {
      expect(
        resolveCurrentOrNextSalah({
          currentSalah: "dhuhr",
          nextSalah: "asr",
          nextSalahTime: new Date(),
          hoursRemaining: 1,
          minsRemaining: 30,
        })
      ).toBe("Dhuhr");
    });

    it("resolves next salah when current is none or sunrise", () => {
      expect(
        resolveCurrentOrNextSalah({
          currentSalah: "none",
          nextSalah: "fajr",
          nextSalahTime: new Date(),
          hoursRemaining: 4,
          minsRemaining: 0,
        })
      ).toBe("Fajr");
    });
  });

  describe("Bug 3A: Prayer Already Saved Handling", () => {
    it("safely handles logging an already-saved prayer idempotently without throwing an error", async () => {
      const today = format(new Date(), "yyyy-MM-dd");

      // DB returns existing identical record
      mockDb.query.mockResolvedValueOnce({
        values: [
          {
            id: 42,
            salahStatus: "group",
            reasons: "",
            notes: "",
            createdAt: 1000,
          },
        ],
      });

      render(
        <QuickLogModal
          isOpen={true}
          onClose={mockOnClose}
          dbConnection={dbConnectionRef}
          nextSalahNameAndTime={{
            currentSalah: "dhuhr",
            nextSalah: "asr",
            nextSalahTime: new Date(),
            hoursRemaining: 1,
            minsRemaining: 0,
          }}
          setFetchedSalahData={mockSetFetchedSalahData}
          fetchedSalahData={[
            {
              date: today,
              salahs: {
                Fajr: "",
                Dhuhr: "group",
                Asar: "",
                Asr: "",
                Maghrib: "",
                Isha: "",
              },
            },
          ]}
          userPreferences={mockUserPrefs}
        />
      );

      // Verify already logged indicator is displayed
      expect(screen.getByText(/already logged for today/i)).toBeInTheDocument();

      // Click save / update
      const saveBtn = screen.getByRole("button", { name: /update dhuhr/i });
      await userEvent.click(saveBtn);

      await waitFor(() => {
        // Should show clear toast that it is already logged
        expect(showToast).toHaveBeenCalledWith("Dhuhr is already logged", "short");
        // Should close gracefully
        expect(mockOnClose).toHaveBeenCalled();
        // Should NOT run redundant SQL insert/update
        expect(mockDb.run).not.toHaveBeenCalled();
      });
    });

    it("updates existing record by primary key ID when status changes for an already recorded prayer", async () => {
      const today = format(new Date(), "yyyy-MM-dd");

      // DB returns existing record with status 'late'
      mockDb.query.mockResolvedValueOnce({
        values: [
          {
            id: 99,
            salahStatus: "late",
            reasons: "Traffic",
            notes: "",
            createdAt: 5000,
          },
        ],
      });

      render(
        <QuickLogModal
          isOpen={true}
          onClose={mockOnClose}
          dbConnection={dbConnectionRef}
          nextSalahNameAndTime={{
            currentSalah: "dhuhr",
            nextSalah: "asr",
            nextSalahTime: new Date(),
            hoursRemaining: 1,
            minsRemaining: 0,
          }}
          setFetchedSalahData={mockSetFetchedSalahData}
          fetchedSalahData={[
            {
              date: today,
              salahs: {
                Fajr: "",
                Dhuhr: "late",
                Asar: "",
                Asr: "",
                Maghrib: "",
                Isha: "",
              },
            },
          ]}
          userPreferences={mockUserPrefs}
        />
      );

      // Change status to 'In Jamaah'
      const jamaahBtn = screen.getByText("In Jamaah");
      await userEvent.click(jamaahBtn);

      const saveBtn = screen.getByRole("button", { name: /update dhuhr/i });
      await userEvent.click(saveBtn);

      await waitFor(() => {
        // Verify it runs UPDATE by primary key id rather than duplicate insert
        expect(mockDb.run).toHaveBeenCalledWith(
          expect.stringContaining("UPDATE salahDataTable SET salahStatus = ?"),
          expect.arrayContaining(["group", 99])
        );
        expect(showToast).toHaveBeenCalledWith("Updated Dhuhr", "short");
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it("performs clean first-time logging when no record exists", async () => {
      // DB returns no existing record
      mockDb.query.mockResolvedValueOnce({ values: [] });

      render(
        <QuickLogModal
          isOpen={true}
          onClose={mockOnClose}
          dbConnection={dbConnectionRef}
          nextSalahNameAndTime={{
            currentSalah: "fajr",
            nextSalah: "dhuhr",
            nextSalahTime: new Date(),
            hoursRemaining: 5,
            minsRemaining: 0,
          }}
          setFetchedSalahData={mockSetFetchedSalahData}
          fetchedSalahData={[]}
          userPreferences={mockUserPrefs}
        />
      );

      const saveBtn = screen.getByRole("button", { name: /save fajr/i });
      await userEvent.click(saveBtn);

      await waitFor(() => {
        expect(mockDb.run).toHaveBeenCalledWith(
          expect.stringContaining("INSERT OR REPLACE INTO salahDataTable"),
          expect.anything()
        );
        expect(showToast).toHaveBeenCalledWith("Saved Fajr", "short");
        expect(mockOnClose).toHaveBeenCalled();
      });
    });
  });

  describe("Bug 3B: Stale Prayer Slot Refresh & Revalidation", () => {
    it("calls onRefreshSchedule on modal open to avoid stale prayer slot", async () => {
      const mockRefreshSchedule = vi.fn().mockResolvedValue({
        currentSalah: "asr",
        nextSalah: "maghrib",
        nextSalahTime: new Date(),
        hoursRemaining: 2,
        minsRemaining: 15,
      });

      render(
        <QuickLogModal
          isOpen={true}
          onClose={mockOnClose}
          dbConnection={dbConnectionRef}
          nextSalahNameAndTime={{
            currentSalah: "dhuhr", // Stale value passed initially
            nextSalah: "asr",
            nextSalahTime: new Date(),
            hoursRemaining: 0,
            minsRemaining: 1,
          }}
          setFetchedSalahData={mockSetFetchedSalahData}
          userPreferences={mockUserPrefs}
          onRefreshSchedule={mockRefreshSchedule}
        />
      );

      // Verify schedule was refreshed immediately on open
      expect(mockRefreshSchedule).toHaveBeenCalled();

      // Verify it updated the slot to Asr based on refreshed schedule
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /save asr/i })).toBeInTheDocument();
      });
    });

    it("revalidates schedule prior to saving", async () => {
      const mockRefreshSchedule = vi.fn().mockResolvedValue(undefined);
      mockDb.query.mockResolvedValueOnce({ values: [] });

      render(
        <QuickLogModal
          isOpen={true}
          onClose={mockOnClose}
          dbConnection={dbConnectionRef}
          nextSalahNameAndTime={{
            currentSalah: "maghrib",
            nextSalah: "isha",
            nextSalahTime: new Date(),
            hoursRemaining: 1,
            minsRemaining: 0,
          }}
          setFetchedSalahData={mockSetFetchedSalahData}
          userPreferences={mockUserPrefs}
          onRefreshSchedule={mockRefreshSchedule}
        />
      );

      const saveBtn = screen.getByRole("button", { name: /save maghrib/i });
      await userEvent.click(saveBtn);

      await waitFor(() => {
        expect(mockRefreshSchedule).toHaveBeenCalled();
        expect(mockDb.run).toHaveBeenCalled();
      });
    });
  });
});
