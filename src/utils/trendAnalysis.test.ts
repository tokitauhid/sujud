import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getWeeklyPeriodRange,
  getMonthlyPeriodRange,
  getYearlyPeriodRange,
  getPreviousPeriod,
  getNextPeriod,
  computeSourceDataHash,
  calculateTrendAnalysis,
  calculateTrendAnalysisWithComparison,
  generateAnalysisSummary,
} from "./trendAnalysis";
import { SalahRecordsArrayType } from "../types/types";

describe("Trend Analysis Calculation Engine", () => {
  describe("Period Boundaries", () => {
    it("calculates weekly boundaries starting on Monday and ending on Sunday", () => {
      // Wednesday, Sep 9, 2026
      const refDate = new Date(2026, 8, 9);
      const week = getWeeklyPeriodRange(refDate);

      expect(week.start).toBe("2026-09-07"); // Monday
      expect(week.end).toBe("2026-09-13"); // Sunday
    });

    it("calculates monthly boundaries for full calendar month", () => {
      // Sep 15, 2026
      const refDate = new Date(2026, 8, 15);
      const month = getMonthlyPeriodRange(refDate);

      expect(month.start).toBe("2026-09-01");
      expect(month.end).toBe("2026-09-30");
    });

    it("calculates leap year February monthly boundaries correctly", () => {
      // Feb 10, 2024 (leap year)
      const refDate = new Date(2024, 1, 10);
      const month = getMonthlyPeriodRange(refDate);

      expect(month.start).toBe("2024-02-01");
      expect(month.end).toBe("2024-02-29");
    });

    it("calculates yearly boundaries for calendar year", () => {
      const refDate = new Date(2026, 5, 1);
      const year = getYearlyPeriodRange(refDate);

      expect(year.start).toBe("2026-01-01");
      expect(year.end).toBe("2026-12-31");
    });

    it("calculates previous and next periods correctly across month and year boundaries", () => {
      // Week across month boundary
      const prevWeek = getPreviousPeriod("weekly", "2026-09-07");
      expect(prevWeek.start).toBe("2026-08-31");
      expect(prevWeek.end).toBe("2026-09-06");

      const nextWeek = getNextPeriod("weekly", "2026-08-31");
      expect(nextWeek.start).toBe("2026-09-07");
      expect(nextWeek.end).toBe("2026-09-13");

      // Month across year boundary
      const prevMonth = getPreviousPeriod("monthly", "2026-01-01");
      expect(prevMonth.start).toBe("2025-12-01");
      expect(prevMonth.end).toBe("2025-12-31");

      const nextMonth = getNextPeriod("monthly", "2025-12-01");
      expect(nextMonth.start).toBe("2026-01-01");
      expect(nextMonth.end).toBe("2026-01-31");
    });
  });

  describe("Source Data Hashing & Immutability", () => {
    it("produces deterministic hash for identical data and changes when data changes", () => {
      const records1: SalahRecordsArrayType = [
        {
          date: "2026-09-07",
          salahs: { Fajr: "group", Dhuhr: "group", Asar: "male-alone", Maghrib: "group", Isha: "group" },
        },
        {
          date: "2026-09-08",
          salahs: { Fajr: "late", Dhuhr: "male-alone", Asar: "missed", Maghrib: "group", Isha: "male-alone" },
        },
      ];

      const records2: SalahRecordsArrayType = [
        {
          date: "2026-09-07",
          salahs: { Fajr: "group", Dhuhr: "group", Asar: "male-alone", Maghrib: "group", Isha: "group" },
        },
        {
          date: "2026-09-08",
          salahs: { Fajr: "late", Dhuhr: "male-alone", Asar: "missed", Maghrib: "group", Isha: "male-alone" },
        },
      ];

      // Modified record
      const recordsModified: SalahRecordsArrayType = [
        {
          date: "2026-09-07",
          salahs: { Fajr: "group", Dhuhr: "group", Asar: "male-alone", Maghrib: "group", Isha: "group" },
        },
        {
          date: "2026-09-08",
          salahs: { Fajr: "late", Dhuhr: "male-alone", Asar: "group", Maghrib: "group", Isha: "male-alone" }, // changed Asar from missed to group
        },
      ];

      const hash1 = computeSourceDataHash(records1, "2026-09-07", "2026-09-13");
      const hash2 = computeSourceDataHash(records2, "2026-09-07", "2026-09-13");
      const hashModified = computeSourceDataHash(recordsModified, "2026-09-07", "2026-09-13");

      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(hashModified);
    });

    it("returns stable hash for empty data range", () => {
      const hashEmpty = computeSourceDataHash([], "2026-09-07", "2026-09-13");
      expect(hashEmpty).toBe("hash_empty_2026-09-07_2026-09-13");
    });
  });

  describe("Metrics & Calculations", () => {
    const mockWeekRecords: SalahRecordsArrayType = [
      {
        date: "2026-09-07",
        salahs: { Fajr: "group", Dhuhr: "group", Asar: "group", Maghrib: "group", Isha: "group" }, // 5/5 perfect, 5 Jamaah
      },
      {
        date: "2026-09-08",
        salahs: { Fajr: "male-alone", Dhuhr: "group", Asar: "group", Maghrib: "group", Isha: "group" }, // 5/5, 4 Jamaah, 1 alone
      },
      {
        date: "2026-09-09",
        salahs: { Fajr: "late", Dhuhr: "group", Asar: "male-alone", Maghrib: "group", Isha: "group" }, // 5/5 (1 late), 3 Jamaah
      },
      {
        date: "2026-09-10",
        salahs: { Fajr: "missed", Dhuhr: "group", Asar: "group", Maghrib: "group", Isha: "male-alone" }, // 4/5 (1 missed), 3 Jamaah
      },
      {
        date: "2026-09-11",
        salahs: { Fajr: "group", Dhuhr: "group", Asar: "group", Maghrib: "group", Isha: "group" }, // 5/5 perfect, 5 Jamaah
      },
      {
        date: "2026-09-12",
        salahs: { Fajr: "group", Dhuhr: "group", Asar: "group", Maghrib: "group", Isha: "group" }, // 5/5 perfect, 5 Jamaah
      },
      {
        date: "2026-09-13",
        salahs: { Fajr: "group", Dhuhr: "group", Asar: "group", Maghrib: "group", Isha: "group" }, // 5/5 perfect, 5 Jamaah
      },
    ];

    it("accurately calculates total expected, completed, missed, late, and completion percentage", () => {
      const metrics = calculateTrendAnalysis(
        "weekly",
        "2026-09-07",
        "2026-09-13",
        mockWeekRecords,
        true, // male mode
      );

      expect(metrics.totalExpected).toBe(35); // 7 days * 5
      expect(metrics.completed).toBe(34); // 34 completed (on time + late)
      expect(metrics.missed).toBe(1); // Sep 10 Fajr
      expect(metrics.late).toBe(1); // Sep 09 Fajr
      expect(metrics.inJamaah).toBe(30);
      expect(metrics.alone).toBe(3);
      expect(metrics.completionPercentage).toBe(97); // 34 / 35 = 97%
    });

    it("correctly identifies perfect days and streaks", () => {
      const metrics = calculateTrendAnalysis(
        "weekly",
        "2026-09-07",
        "2026-09-13",
        mockWeekRecords,
        true,
      );

      // Days with all 5 completed on time without missed/late:
      // Sep 7: perfect
      // Sep 8: perfect (male-alone counts as on time)
      // Sep 9: Fajr was late -> streak breaks!
      // Sep 10: Fajr missed -> breaks
      // Sep 11: perfect
      // Sep 7, 8, 9, 11, 12, 13 had all 5 prayers completed = 6 days
      expect(metrics.perfectDaysCount).toBe(6);
      expect(metrics.currentStreak).toBe(3); // Sep 11, 12, 13 (on-time perfect streak)
      expect(metrics.longestStreak).toBe(3);
    });

    it("identifies best day and weakest day", () => {
      const metrics = calculateTrendAnalysis(
        "weekly",
        "2026-09-07",
        "2026-09-13",
        mockWeekRecords,
        true,
      );

      expect(metrics.bestDay?.completed).toBe(5);
      expect(metrics.weakestDay?.date).toBe("2026-09-10");
      expect(metrics.weakestDay?.completed).toBe(4);
    });

    it("identifies most frequently missed prayer", () => {
      const metrics = calculateTrendAnalysis(
        "weekly",
        "2026-09-07",
        "2026-09-13",
        mockWeekRecords,
        true,
      );

      expect(metrics.mostFrequentlyMissedPrayer).toBe("Fajr");
    });

    it("calculates male-mode Jamaah metrics strictly and accurately", () => {
      const metrics = calculateTrendAnalysis(
        "weekly",
        "2026-09-07",
        "2026-09-13",
        mockWeekRecords,
        true, // male mode
      );

      expect(metrics.isMaleMode).toBe(true);
      expect(metrics.inJamaah).toBe(30);
      expect(metrics.prayersWithoutJamaah).toBe(4); // 34 completed - 30 Jamaah = 4
      expect(metrics.jamaahPercentage).toBe(88); // 30 / 34 = 88%
      expect(metrics.mostFrequentJamaahPrayer).toBeDefined();
    });

    it("omits male Jamaah prominence when user is not male", () => {
      const metrics = calculateTrendAnalysis(
        "weekly",
        "2026-09-07",
        "2026-09-13",
        mockWeekRecords,
        false, // female mode
      );

      expect(metrics.isMaleMode).toBe(false);
      expect(metrics.prayersWithoutJamaah).toBeUndefined();
      expect(metrics.jamaahPercentage).toBeUndefined();
    });

    it("handles comparison with previous period and calculates most improved prayer", () => {
      const previousWeekRecords: SalahRecordsArrayType = [
        {
          date: "2026-08-31",
          salahs: { Fajr: "missed", Dhuhr: "group", Asar: "missed", Maghrib: "group", Isha: "male-alone" },
        },
        {
          date: "2026-09-01",
          salahs: { Fajr: "missed", Dhuhr: "group", Asar: "male-alone", Maghrib: "group", Isha: "male-alone" },
        },
      ];

      const allRecords = [...previousWeekRecords, ...mockWeekRecords];
      const metrics = calculateTrendAnalysisWithComparison(
        "weekly",
        "2026-09-07",
        "2026-09-13",
        allRecords,
        true,
      );

      expect(metrics.previousCompletionPercentage).toBeDefined();
      expect(metrics.completionPercentageChange).toBeGreaterThan(0);
      expect(metrics.mostImprovedPrayer).toBeDefined();
    });

    it("handles empty data gracefully without throwing or NaN", () => {
      const metrics = calculateTrendAnalysis(
        "weekly",
        "2026-09-07",
        "2026-09-13",
        [],
        true,
      );

      expect(metrics.completed).toBe(0);
      expect(metrics.missed).toBe(0);
      expect(metrics.completionPercentage).toBe(0);
      expect(metrics.perfectDaysCount).toBe(0);
      expect(metrics.currentStreak).toBe(0);
      expect(metrics.longestStreak).toBe(0);
      expect(metrics.mostFrequentlyMissedPrayer).toBeNull();
      expect(metrics.mostImprovedPrayer).toBeNull();
    });
  });

  describe("Summary and Notification Generator", () => {
    it("generates encouraging summary and Screen Time-style notification", () => {
      const records: SalahRecordsArrayType = [
        {
          date: "2026-09-07",
          salahs: { Fajr: "group", Dhuhr: "group", Asar: "group", Maghrib: "group", Isha: "group" },
        },
        {
          date: "2026-09-08",
          salahs: { Fajr: "group", Dhuhr: "group", Asar: "group", Maghrib: "group", Isha: "group" },
        },
      ];

      const metrics = calculateTrendAnalysis(
        "weekly",
        "2026-09-07",
        "2026-09-13",
        records,
        true,
      );

      const summary = generateAnalysisSummary(metrics, true);

      expect(summary.notificationTitle).toBe("Sujud Weekly Summary");
      expect(summary.notificationBody).toContain("You completed");
      expect(summary.notificationBody).toContain("Tap to see your full report.");
      expect(summary.insights.length).toBeGreaterThan(0);
    });
  });
});
