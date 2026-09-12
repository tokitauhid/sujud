import { describe, it, expect } from "vitest";
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
  determineTrendReflectionTopic,
} from "./trendAnalysis";
import {
  SalahRecordsArrayType,
  TrendMetrics,
  TrendSnapshotRecord,
} from "../types/types";
import { IslamicContentRecord } from "../types/islamicContent";

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

  describe("Islamic Hadith Reflection Integration (Phase 3)", () => {
    const mockFixture: IslamicContentRecord[] = [
      {
        id: "hadith-good-deeds",
        type: "hadith",
        arabicText: "أَحَبُّ الأَعْمَالِ إِلَى اللَّهِ أَدْوَمُهَا",
        translatedText: "The most beloved of deeds to Allah are those most consistent.",
        language: "en",
        collection: "Sahih al-Bukhari",
        reference: "Book 76, Hadith 472",
        grading: "Sahih",
        sourceUrl: "https://sunnah.com/bukhari:6464",
        tags: ["good-deeds"],
        reviewed: true,
        licenseNote: "Public domain text; test fixture.",
      },
      {
        id: "hadith-consistency",
        type: "hadith",
        translatedText: "Keep doing good deeds with steadfastness.",
        language: "en",
        collection: "Sahih Muslim",
        reference: "Book 6, Hadith 262",
        grading: "Sahih",
        sourceUrl: "https://sunnah.com/muslim:782",
        tags: ["consistency"],
        reviewed: true,
        licenseNote: "Public domain text; test fixture.",
      },
      {
        id: "hadith-jamaah",
        type: "hadith",
        translatedText: "Prayer in congregation is twenty-seven times more rewarding.",
        language: "en",
        collection: "Sahih al-Bukhari",
        reference: "Book 10, Hadith 41",
        grading: "Sahih",
        sourceUrl: "https://sunnah.com/bukhari:645",
        tags: ["jamaah"],
        reviewed: true,
        licenseNote: "Public domain text; test fixture.",
      },
      {
        id: "hadith-returning",
        type: "hadith",
        translatedText: "Allah accepts repentance of His servant as long as difficulty persists.",
        language: "en",
        collection: "Jami` at-Tirmidhi",
        reference: "Book 48, Hadith 168",
        grading: "Hasan",
        sourceUrl: "https://sunnah.com/tirmidhi:3537",
        tags: ["returning-after-difficulty"],
        reviewed: true,
        licenseNote: "Public domain text; test fixture.",
      },
      {
        id: "hadith-time",
        type: "hadith",
        translatedText: "The most virtuous deed is prayer at its proper time.",
        language: "en",
        collection: "Sahih al-Bukhari",
        reference: "Book 9, Hadith 1",
        grading: "Sahih",
        sourceUrl: "https://sunnah.com/bukhari:527",
        tags: ["time-and-prayer"],
        reviewed: true,
        licenseNote: "Public domain text; test fixture.",
      },
      {
        id: "hadith-patience",
        type: "hadith",
        translatedText: "Whoever persists in patience, Allah gives him strength.",
        language: "en",
        collection: "Sahih al-Bukhari",
        reference: "Book 24, Hadith 67",
        grading: "Sahih",
        sourceUrl: "https://sunnah.com/bukhari:1469",
        tags: ["patience"],
        reviewed: true,
        licenseNote: "Public domain text; test fixture.",
      },
    ];

    const createBaseMetrics = (overrides: Partial<TrendMetrics> = {}): TrendMetrics => ({
      periodType: "weekly",
      periodStart: "2026-09-07",
      periodEnd: "2026-09-13",
      totalExpected: 35,
      completed: 30,
      missed: 0,
      late: 0,
      alone: 10,
      inJamaah: 20,
      completionPercentage: 86,
      previousCompletionPercentage: 86,
      completionPercentageChange: 0,
      bestDay: null,
      weakestDay: null,
      currentStreak: 3,
      longestStreak: 5,
      perfectDaysCount: 3,
      totalDays: 7,
      mostFrequentlyMissedPrayer: null,
      mostImprovedPrayer: null,
      days: [],
      prayersBreakdown: [],
      isMaleMode: true,
      ...overrides,
    });

    describe("Reflection Topic Priority Selection", () => {
      it("prioritizes strong improvement (Priority 1) -> good-deeds", () => {
        const metrics = createBaseMetrics({
          completionPercentageChange: 10,
          missed: 3, // Even if missed > 0, improvement takes priority
          perfectDaysCount: 7,
        });
        const topic = determineTrendReflectionTopic(metrics, true);
        expect(topic).toBe("good-deeds");
      });

      it("selects strong streak or perfect week (Priority 2) -> consistency", () => {
        const metricsPerfect = createBaseMetrics({
          completionPercentageChange: 2, // < 5%
          perfectDaysCount: 7,
          totalDays: 7,
        });
        expect(determineTrendReflectionTopic(metricsPerfect, true)).toBe("consistency");

        const metricsStreak = createBaseMetrics({
          completionPercentageChange: 0,
          currentStreak: 8,
        });
        expect(determineTrendReflectionTopic(metricsStreak, true)).toBe("consistency");
      });

      it("selects male-mode Jamaah improvement (Priority 3) -> jamaah", () => {
        const metrics = createBaseMetrics({
          completionPercentageChange: 2,
          currentStreak: 2,
          perfectDaysCount: 2,
          jamaahCountChange: 5,
        });
        const topicMale = determineTrendReflectionTopic(metrics, true);
        expect(topicMale).toBe("jamaah");
      });

      it("does not select Jamaah topic for female users even with jamaah count change", () => {
        const metrics = createBaseMetrics({
          completionPercentageChange: 2,
          currentStreak: 2,
          perfectDaysCount: 2,
          jamaahCountChange: 5,
          isMaleMode: false,
        });
        // In female mode, jamaah improvement condition is bypassed; falls back to consistency
        const topicFemale = determineTrendReflectionTopic(metrics, false);
        expect(topicFemale).not.toBe("jamaah");
        expect(topicFemale).toBe("consistency");
      });

      it("selects frequent missed prayer (Priority 4) -> returning-after-difficulty", () => {
        const metrics = createBaseMetrics({
          completionPercentageChange: 0,
          currentStreak: 0,
          perfectDaysCount: 0,
          missed: 4,
          late: 2,
        });
        const topic = determineTrendReflectionTopic(metrics, true);
        expect(topic).toBe("returning-after-difficulty");
      });

      it("selects frequent late prayer (Priority 5) -> time-and-prayer", () => {
        const metrics = createBaseMetrics({
          completionPercentageChange: 0,
          currentStreak: 0,
          perfectDaysCount: 0,
          missed: 0,
          late: 5,
        });
        const topic = determineTrendReflectionTopic(metrics, true);
        expect(topic).toBe("time-and-prayer");
      });

      it("selects declining completion rate (Priority 6) -> patience", () => {
        const metrics = createBaseMetrics({
          completionPercentageChange: -8,
          currentStreak: 0,
          perfectDaysCount: 0,
          missed: 0,
          late: 0,
        });
        const topic = determineTrendReflectionTopic(metrics, true);
        expect(topic).toBe("patience");
      });

      it("falls back to general consistency (Priority 7) -> consistency", () => {
        const metrics = createBaseMetrics({
          completionPercentageChange: 0,
          currentStreak: 1,
          perfectDaysCount: 1,
          missed: 0,
          late: 0,
        });
        const topic = determineTrendReflectionTopic(metrics, true);
        expect(topic).toBe("consistency");
      });
    });

    describe("Summary and Snapshot Integration", () => {
      it("embeds hadithReflection in generated summary", () => {
        const metrics = createBaseMetrics({
          completionPercentageChange: 12,
        });

        const summary = generateAnalysisSummary(metrics, true, {
          content: mockFixture,
        });

        expect(summary.hadithReflection).not.toBeNull();
        expect(summary.hadithReflection?.id).toBe("hadith-good-deeds");
        expect(summary.hadithReflection?.topic).toBe("good-deeds");
        expect(summary.hadithReflection?.collection).toBe("Sahih al-Bukhari");
        expect(summary.hadithReflection?.reference).toBe("Book 76, Hadith 472");
        expect(summary.hadithReflection?.grading).toBe("Sahih");
        expect(summary.hadithReflection?.sourceUrl).toBe("https://sunnah.com/bukhari:6464");
        expect(summary.hadithReflection?.displayText).toBe(
          "The most beloved of deeds to Allah are those most consistent.",
        );
      });

      it("serializes hadithReflection cleanly into summaryJson", () => {
        const metrics = createBaseMetrics({
          completionPercentageChange: 12,
        });

        const summary = generateAnalysisSummary(metrics, true, {
          content: mockFixture,
        });

        const snapshot: TrendSnapshotRecord = {
          id: "test-snap-01",
          periodType: "weekly",
          periodStart: "2026-09-07",
          periodEnd: "2026-09-13",
          generatedAt: 123456789,
          schemaVersion: 1,
          dataVersion: "test-hash",
          metricsJson: JSON.stringify(metrics),
          summaryJson: JSON.stringify(summary),
          isMaleMode: 1,
          isNotificationSent: 0,
          createdAt: 123456789,
        };

        const parsedSummary = JSON.parse(snapshot.summaryJson);
        expect(parsedSummary.hadithReflection).toBeDefined();
        expect(parsedSummary.hadithReflection.id).toBe("hadith-good-deeds");
        expect(parsedSummary.hadithReflection.collection).toBe("Sahih al-Bukhari");
      });

      it("proves historical snapshot stability across dataset changes", () => {
        // Generate snapshot with original fixture
        const metrics = createBaseMetrics({ completionPercentageChange: 12 });
        const initialSummary = generateAnalysisSummary(metrics, true, {
          content: mockFixture,
        });
        const savedSnapshot: TrendSnapshotRecord = {
          id: "historic-snap-1",
          periodType: "weekly",
          periodStart: "2026-09-07",
          periodEnd: "2026-09-13",
          generatedAt: 1000,
          schemaVersion: 1,
          dataVersion: "hash-v1",
          metricsJson: JSON.stringify(metrics),
          summaryJson: JSON.stringify(initialSummary),
          isMaleMode: 1,
          isNotificationSent: 1,
          createdAt: 1000,
        };

        // Simulate reading the historical snapshot from SQLite later:
        const retrievedSummary = JSON.parse(savedSnapshot.summaryJson);
        expect(retrievedSummary.hadithReflection.id).toBe("hadith-good-deeds");

        // Even if the live content pool changes completely:
        const completelyDifferentContent: IslamicContentRecord[] = [
          {
            id: "new-hadith-999",
            type: "hadith",
            translatedText: "Different text entirely.",
            language: "en",
            collection: "Sahih Muslim",
            reference: "Book 1, Hadith 99",
            grading: "Sahih",
            sourceUrl: "https://sunnah.com/muslim:99",
            tags: ["good-deeds"],
            reviewed: true,
            licenseNote: "New note",
          },
        ];

        // Recalculating live would produce the new hadith...
        const liveSummary = generateAnalysisSummary(metrics, true, {
          content: completelyDifferentContent,
        });
        expect(liveSummary.hadithReflection?.id).toBe("new-hadith-999");

        // But the historical snapshot summary remains strictly identical!
        expect(retrievedSummary.hadithReflection.id).toBe("hadith-good-deeds");
      });
    });

    describe("Empty Content & Determinism", () => {
      it("handles empty content gracefully with hadithReflection: null", () => {
        const metrics = createBaseMetrics();
        const summary = generateAnalysisSummary(metrics, true, {
          content: [],
        });

        expect(summary.hadithReflection).toBeNull();

        const json = JSON.stringify(summary);
        const parsed = JSON.parse(json);
        expect(parsed.hadithReflection).toBeNull();
      });

      it("handles default bundled empty dataset without errors", () => {
        const metrics = createBaseMetrics();
        // Calls without options.content, using bundled islamicContent.json ([])
        const summary = generateAnalysisSummary(metrics, true);
        expect(summary.hadithReflection).toBeNull();
      });

      it("deterministically selects the same reflection across multiple runs", () => {
        const metrics = createBaseMetrics({
          missed: 3,
        });

        const first = generateAnalysisSummary(metrics, true, {
          content: mockFixture,
        });
        const second = generateAnalysisSummary(metrics, true, {
          content: mockFixture,
        });

        expect(first.hadithReflection?.id).toBe(second.hadithReflection?.id);
        expect(first.hadithReflection?.id).toBe("hadith-returning");
      });
    });
  });
});
