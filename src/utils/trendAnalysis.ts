import {
  format,
  parseISO,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  subWeeks,
  addWeeks,
  subMonths,
  addMonths,
  subYears,
  addYears,
  eachDayOfInterval,
  addDays,
  differenceInCalendarDays,
} from "date-fns";
import { LocalNotifications } from "@capacitor/local-notifications";
import { SQLiteDBConnection } from "@capacitor-community/sqlite";
import {
  SalahRecordsArrayType,
  TrendMetrics,
  TrendPeriodType,
  TrendSnapshotRecord,
  TrendSummary,
  userPreferencesType,
  DayTrendItem,
  PrayerTrendBreakdownItem,
  DayMetricSummary,
} from "../types/types";
import { withDB } from "./dbUtils";
import { updateUserPrefs, checkNotificationPermissions } from "./helpers";
import {
  IslamicContentRecord,
  IslamicContentTopic,
  SelectedHadithReflection,
} from "../types/islamicContent";
import {
  selectStableHadith,
  formatSelectedHadithReflection,
} from "./islamicContent";
import bundledIslamicContent from "../assets/islamicContent.json";

const PRAYER_NAMES: ("Fajr" | "Dhuhr" | "Asr" | "Maghrib" | "Isha")[] = [
  "Fajr",
  "Dhuhr",
  "Asr",
  "Maghrib",
  "Isha",
];

// ---------------------------------------------------------------------------
// Period Range Helpers
// ---------------------------------------------------------------------------

export const getWeeklyPeriodRange = (
  referenceDate: Date,
): { start: string; end: string; label: string } => {
  const start = startOfWeek(referenceDate, { weekStartsOn: 1 });
  const end = endOfWeek(referenceDate, { weekStartsOn: 1 });
  const startStr = format(start, "yyyy-MM-dd");
  const endStr = format(end, "yyyy-MM-dd");
  const label = `${format(start, "MMM dd")} – ${format(end, "MMM dd, yyyy")}`;
  return { start: startStr, end: endStr, label };
};

export const getMonthlyPeriodRange = (
  referenceDate: Date,
): { start: string; end: string; label: string } => {
  const start = startOfMonth(referenceDate);
  const end = endOfMonth(referenceDate);
  const startStr = format(start, "yyyy-MM-dd");
  const endStr = format(end, "yyyy-MM-dd");
  const label = format(start, "MMMM yyyy");
  return { start: startStr, end: endStr, label };
};

export const getYearlyPeriodRange = (
  referenceDate: Date,
): { start: string; end: string; label: string } => {
  const start = startOfYear(referenceDate);
  const end = endOfYear(referenceDate);
  const startStr = format(start, "yyyy-MM-dd");
  const endStr = format(end, "yyyy-MM-dd");
  const label = format(start, "yyyy");
  return { start: startStr, end: endStr, label };
};

export const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/**
 * Aggregates daily trend items into 12 calendar months (Jan..Dec) for the Year view.
 */
export const aggregateYearlyMonths = (
  days: DayTrendItem[],
  targetYear?: number,
): DayTrendItem[] => {
  let year = targetYear;
  if (!year) {
    if (days.length > 0 && days[0].date) {
      const parsedYear = parseInt(days[0].date.slice(0, 4), 10);
      if (!isNaN(parsedYear)) {
        year = parsedYear;
      }
    }
    if (!year) {
      year = new Date().getFullYear();
    }
  }

  const monthlyBuckets: {
    completed: number;
    inJamaah: number;
    alone: number;
    late: number;
    missed: number;
    excused: number;
    totalExpected: number;
  }[] = Array.from({ length: 12 }, () => ({
    completed: 0,
    inJamaah: 0,
    alone: 0,
    late: 0,
    missed: 0,
    excused: 0,
    totalExpected: 0,
  }));

  for (const day of days) {
    if (!day.date) continue;
    const parts = day.date.split("-");
    if (parts.length >= 2) {
      const dayYear = parseInt(parts[0], 10);
      const dayMonth = parseInt(parts[1], 10) - 1;
      if (dayYear === year && dayMonth >= 0 && dayMonth < 12) {
        const bucket = monthlyBuckets[dayMonth];
        bucket.completed += day.completed;
        bucket.inJamaah += day.inJamaah;
        bucket.alone += day.alone;
        bucket.late += day.late;
        bucket.missed += day.missed;
        bucket.excused += day.excused;
        bucket.totalExpected += day.totalExpected;
      }
    }
  }

  return MONTH_LABELS.map((label, idx) => {
    const bucket = monthlyBuckets[idx];
    const monthNumberStr = String(idx + 1).padStart(2, "0");
    const date = `${year}-${monthNumberStr}`;
    const daysInMonth = new Date(year, idx + 1, 0).getDate();
    const expected = bucket.totalExpected > 0 ? bucket.totalExpected : daysInMonth * 5;
    const percentage =
      expected > 0 ? Math.round((bucket.completed / expected) * 100) : 0;
    const isAllCompleted = expected > 0 && bucket.completed === expected;

    return {
      date,
      dayLabel: label,
      totalExpected: expected,
      completed: bucket.completed,
      inJamaah: bucket.inJamaah,
      alone: bucket.alone,
      late: bucket.late,
      missed: bucket.missed,
      excused: bucket.excused,
      percentage,
      isAllCompleted,
    };
  });
};

export const getPeriodRange = (
  periodType: TrendPeriodType,
  referenceDate: Date,
): { start: string; end: string; label: string } => {
  switch (periodType) {
    case "weekly":
      return getWeeklyPeriodRange(referenceDate);
    case "monthly":
      return getMonthlyPeriodRange(referenceDate);
    case "yearly":
      return getYearlyPeriodRange(referenceDate);
  }
};

export const getPreviousPeriod = (
  periodType: TrendPeriodType,
  periodStart: string,
): { start: string; end: string; label: string } => {
  const currentStart = parseISO(periodStart);
  switch (periodType) {
    case "weekly":
      return getWeeklyPeriodRange(subWeeks(currentStart, 1));
    case "monthly":
      return getMonthlyPeriodRange(subMonths(currentStart, 1));
    case "yearly":
      return getYearlyPeriodRange(subYears(currentStart, 1));
  }
};

export const getNextPeriod = (
  periodType: TrendPeriodType,
  periodStart: string,
): { start: string; end: string; label: string } => {
  const currentStart = parseISO(periodStart);
  switch (periodType) {
    case "weekly":
      return getWeeklyPeriodRange(addWeeks(currentStart, 1));
    case "monthly":
      return getMonthlyPeriodRange(addMonths(currentStart, 1));
    case "yearly":
      return getYearlyPeriodRange(addYears(currentStart, 1));
  }
};

/**
 * Returns the most recently completed full period before current time.
 */
export const getCompletedPeriod = (
  periodType: TrendPeriodType,
  referenceDate = new Date(),
): { start: string; end: string; label: string } => {
  switch (periodType) {
    case "weekly":
      return getWeeklyPeriodRange(subWeeks(referenceDate, 1));
    case "monthly":
      return getMonthlyPeriodRange(subMonths(referenceDate, 1));
    case "yearly":
      return getYearlyPeriodRange(subYears(referenceDate, 1));
  }
};

// ---------------------------------------------------------------------------
// Source Data Hashing
// ---------------------------------------------------------------------------

/**
 * Generates a deterministic hash of all prayer statuses in the specified date range.
 * If any prayer is added, edited, or deleted, this hash will change.
 */
export const computeSourceDataHash = (
  salahRecords: SalahRecordsArrayType,
  periodStart: string,
  periodEnd: string,
): string => {
  const filtered = salahRecords
    .filter((r) => r.date >= periodStart && r.date <= periodEnd)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (filtered.length === 0) {
    return `hash_empty_${periodStart}_${periodEnd}`;
  }

  let serialized = "";
  for (const record of filtered) {
    const s = record.salahs;
    const f = s.Fajr || "";
    const d = s.Dhuhr || "";
    const a = s.Asar || s.Asr || "";
    const m = s.Maghrib || "";
    const i = s.Isha || "";
    serialized += `${record.date}|${f},${d},${a},${m},${i};`;
  }

  // 32-bit FNV-1a hash algorithm
  let hash = 2166136261;
  for (let i = 0; i < serialized.length; i++) {
    hash ^= serialized.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `v_${(hash >>> 0).toString(16)}`;
};

// ---------------------------------------------------------------------------
// Calculation Engine
// ---------------------------------------------------------------------------

export const calculateTrendAnalysis = (
  periodType: TrendPeriodType,
  periodStart: string,
  periodEnd: string,
  salahRecords: SalahRecordsArrayType,
  isMaleMode: boolean,
  previousMetrics?: TrendMetrics | null,
  referenceDate?: Date | string,
  partialLastDayPrayersCount?: number,
): TrendMetrics => {
  const startDate = parseISO(periodStart);
  const endDate = parseISO(periodEnd);
  const intervalDays = eachDayOfInterval({ start: startDate, end: endDate });

  const refDate =
    referenceDate !== undefined
      ? typeof referenceDate === "string"
        ? parseISO(referenceDate)
        : referenceDate
      : new Date();
  const todayStr = format(refDate, "yyyy-MM-dd");
  const isInProgress = periodStart <= todayStr && todayStr <= periodEnd;
  const elapsedDaysCount = isInProgress
    ? Math.max(1, differenceInCalendarDays(parseISO(todayStr), startDate) + 1)
    : intervalDays.length;

  const recordMap = new Map<string, (typeof salahRecords)[0]>();
  for (const record of salahRecords) {
    recordMap.set(record.date, record);
  }

  // Find how many prayers have been reached/logged today if in progress
  const todayRecord = recordMap.get(todayStr);
  let maxTodayPrayerIndex = -1;
  if (isInProgress) {
    for (let idx = 0; idx < PRAYER_NAMES.length; idx++) {
      const pName = PRAYER_NAMES[idx];
      const status =
        pName === "Asr"
          ? todayRecord?.salahs?.Asar || todayRecord?.salahs?.Asr || ""
          : todayRecord?.salahs?.[pName] || "";
      if (status !== "") {
        maxTodayPrayerIndex = Math.max(maxTodayPrayerIndex, idx);
      }
    }
  }

  const concludedDaysCount = isInProgress ? Math.max(0, elapsedDaysCount - 1) : 0;
  const todayExpectedPrayers = isInProgress
    ? maxTodayPrayerIndex >= 0
      ? maxTodayPrayerIndex + 1
      : 0
    : 5;

  const days: DayTrendItem[] = [];
  let totalCompleted = 0;
  let totalMissed = 0;
  let totalLate = 0;
  let totalAlone = 0;
  let totalInJamaah = 0;
  let perfectDaysCount = 0;
  let todayCompletedCount = 0;
  let todayMissedCount = 0;

  const prayerCounts: Record<
    "Fajr" | "Dhuhr" | "Asr" | "Maghrib" | "Isha",
    {
      completed: number;
      inJamaah: number;
      alone: number;
      late: number;
      missed: number;
      excused: number;
    }
  > = {
    Fajr: { completed: 0, inJamaah: 0, alone: 0, late: 0, missed: 0, excused: 0 },
    Dhuhr: { completed: 0, inJamaah: 0, alone: 0, late: 0, missed: 0, excused: 0 },
    Asr: { completed: 0, inJamaah: 0, alone: 0, late: 0, missed: 0, excused: 0 },
    Maghrib: { completed: 0, inJamaah: 0, alone: 0, late: 0, missed: 0, excused: 0 },
    Isha: { completed: 0, inJamaah: 0, alone: 0, late: 0, missed: 0, excused: 0 },
  };

  for (const day of intervalDays) {
    const dateStr = format(day, "yyyy-MM-dd");
    const dayLabel = format(day, "EEE");
    const record = recordMap.get(dateStr);
    const isToday = isInProgress && dateStr === todayStr;
    const isFuture = isInProgress && dateStr > todayStr;
    const isLastDayPartial =
      partialLastDayPrayersCount !== undefined && dateStr === periodEnd;

    let dayCompleted = 0;
    let dayInJamaah = 0;
    let dayAlone = 0;
    let dayLate = 0;
    let dayMissed = 0;
    let dayExcused = 0;

    let dayExpected = 5;
    if (isFuture) {
      dayExpected = 0;
    } else if (isToday) {
      dayExpected = todayExpectedPrayers;
    } else if (isLastDayPartial) {
      dayExpected = partialLastDayPrayersCount;
    }

    for (let pIdx = 0; pIdx < PRAYER_NAMES.length; pIdx++) {
      const pName = PRAYER_NAMES[pIdx];

      // Skip unreached prayers for in-progress days or partial elapsed cutoffs
      if (isFuture) continue;
      if (isToday && (maxTodayPrayerIndex === -1 || pIdx > maxTodayPrayerIndex)) {
        continue;
      }
      if (isLastDayPartial && pIdx >= partialLastDayPrayersCount) {
        continue;
      }

      const status =
        pName === "Asr"
          ? record?.salahs?.Asar || record?.salahs?.Asr || ""
          : record?.salahs?.[pName] || "";

      if (status === "group") {
        dayCompleted++;
        dayInJamaah++;
        prayerCounts[pName].completed++;
        prayerCounts[pName].inJamaah++;
      } else if (status === "male-alone" || status === "female-alone") {
        dayCompleted++;
        dayAlone++;
        prayerCounts[pName].completed++;
        prayerCounts[pName].alone++;
      } else if (status === "late") {
        dayCompleted++;
        dayLate++;
        prayerCounts[pName].completed++;
        prayerCounts[pName].late++;
      } else if (status === "excused") {
        dayCompleted++;
        dayExcused++;
        prayerCounts[pName].completed++;
        prayerCounts[pName].excused++;
      } else if (status === "missed") {
        dayMissed++;
        prayerCounts[pName].missed++;
      }
    }

    if (isToday) {
      todayCompletedCount = dayCompleted;
      todayMissedCount = dayMissed;
    }

    const isAllCompleted = dayExpected === 5 && dayCompleted === 5;
    if (isAllCompleted) {
      perfectDaysCount++;
    }

    totalCompleted += dayCompleted;
    totalInJamaah += dayInJamaah;
    totalAlone += dayAlone;
    totalLate += dayLate;
    totalMissed += dayMissed;

    const dayPct = Math.round((dayCompleted / 5) * 100);
    days.push({
      date: dateStr,
      dayLabel,
      totalExpected: 5,
      completed: dayCompleted,
      inJamaah: dayInJamaah,
      alone: dayAlone,
      late: dayLate,
      missed: dayMissed,
      excused: dayExcused,
      percentage: dayPct,
      isAllCompleted,
    });
  }

  let totalExpected = intervalDays.length * 5;
  if (isInProgress) {
    totalExpected = concludedDaysCount * 5 + todayExpectedPrayers;
  } else if (partialLastDayPrayersCount !== undefined) {
    totalExpected = (intervalDays.length - 1) * 5 + partialLastDayPrayersCount;
  }

  const completionPercentage =
    totalExpected > 0 ? Math.round((totalCompleted / totalExpected) * 100) : 0;

  // Best & weakest day
  let bestDay: DayMetricSummary | null = null;
  let weakestDay: DayMetricSummary | null = null;

  if (days.length > 0) {
    let maxComp = -1;
    let minComp = 999;
    for (const d of days) {
      if (isInProgress && d.date > todayStr) continue;
      if (d.completed > maxComp) {
        maxComp = d.completed;
        bestDay = {
          date: d.date,
          dayLabel: d.dayLabel,
          completed: d.completed,
          total: d.totalExpected,
          percentage: d.percentage,
        };
      }

      // Do not consider an unblemished in-progress day as the weakest day
      const isUnblemishedInProgressDay =
        isInProgress && d.date === todayStr && d.completed < 5 && d.missed === 0;
      if (!isUnblemishedInProgressDay && d.completed < minComp) {
        minComp = d.completed;
        weakestDay = {
          date: d.date,
          dayLabel: d.dayLabel,
          completed: d.completed,
          total: d.totalExpected,
          percentage: d.percentage,
        };
      }
    }
  }

  // Streaks inside this period (streak requires all 5 on-time without late or missed)
  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;

  for (let i = 0; i < days.length; i++) {
    const d = days[i];
    if (isInProgress && d.date > todayStr) break;
    const isStreakDay = d.completed === 5 && d.missed === 0 && d.late === 0;
    if (isStreakDay) {
      tempStreak++;
      if (tempStreak > longestStreak) {
        longestStreak = tempStreak;
      }
    } else {
      tempStreak = 0;
    }
  }

  // Count backwards from current active day for active streak
  const todayIdx = days.findIndex((d) => d.date === todayStr);
  const startIdx = isInProgress && todayIdx !== -1 ? todayIdx : days.length - 1;

  for (let i = startIdx; i >= 0; i--) {
    const d = days[i];
    if (isInProgress && d.date === todayStr) {
      // If today has late or missed prayers, streak is broken today
      if (d.missed > 0 || d.late > 0) {
        break;
      }
      // If today has completed all 5 on time, count today in active streak
      if (d.completed === 5) {
        currentStreak++;
      }
      // If today is in progress with 0 missed and 0 late, continue to count active streak from previous days
      continue;
    }

    const isStreakDay = d.completed === 5 && d.missed === 0 && d.late === 0;
    if (isStreakDay) {
      currentStreak++;
    } else {
      break;
    }
  }

  // Steadfastness: evaluated days count
  const isTodayConcludedOrImperfect =
    !isInProgress ||
    todayCompletedCount === 5 ||
    todayMissedCount > 0;
  const effectiveTotalDays = isInProgress
    ? isTodayConcludedOrImperfect
      ? elapsedDaysCount
      : Math.max(1, elapsedDaysCount - 1)
    : intervalDays.length;

  // Prayer-by-prayer breakdown
  const prayersBreakdown: PrayerTrendBreakdownItem[] = PRAYER_NAMES.map((name, idx) => {
    const counts = prayerCounts[name];
    let expected = intervalDays.length;
    if (isInProgress) {
      expected = concludedDaysCount + (maxTodayPrayerIndex >= idx ? 1 : 0);
    } else if (partialLastDayPrayersCount !== undefined) {
      expected = intervalDays.length - 1 + (idx < partialLastDayPrayersCount ? 1 : 0);
    }
    const rate = expected > 0 ? Math.round((counts.completed / expected) * 100) : 0;
    let changeVsPreviousRate: number | null = null;

    if (previousMetrics) {
      const prevPrayer = previousMetrics.prayersBreakdown.find((p) => p.name === name);
      if (prevPrayer) {
        changeVsPreviousRate = rate - prevPrayer.completionRate;
      }
    }

    return {
      name,
      completed: counts.completed,
      expected,
      inJamaah: counts.inJamaah,
      alone: counts.alone,
      late: counts.late,
      missed: counts.missed,
      excused: counts.excused,
      completionRate: rate,
      changeVsPreviousRate,
    };
  });

  // Most frequently missed prayer
  let mostFrequentlyMissedPrayer: string | null = null;
  let maxMissed = 0;
  for (const p of prayersBreakdown) {
    if (p.missed > maxMissed) {
      maxMissed = p.missed;
      mostFrequentlyMissedPrayer = p.name;
    }
  }

  // Most improved prayer vs previous period
  let mostImprovedPrayer: string | null = null;
  let maxImprovement = 0;
  for (const p of prayersBreakdown) {
    if (p.changeVsPreviousRate !== null && p.changeVsPreviousRate > maxImprovement) {
      maxImprovement = p.changeVsPreviousRate;
      mostImprovedPrayer = p.name;
    }
  }

  // Comparison with previous period
  const previousCompletionPercentage =
    previousMetrics !== undefined && previousMetrics !== null
      ? previousMetrics.completionPercentage
      : null;

  const completionPercentageChange =
    previousCompletionPercentage !== null
      ? completionPercentage - previousCompletionPercentage
      : null;

  // Male-mode Jamaah calculations
  let prayersWithoutJamaah: number | undefined;
  let jamaahPercentage: number | undefined;
  let previousJamaahCount: number | null | undefined;
  let jamaahCountChange: number | null | undefined;
  let mostFrequentJamaahPrayer: string | null | undefined;
  let leastFrequentJamaahPrayer: string | null | undefined;

  if (isMaleMode) {
    prayersWithoutJamaah = Math.max(0, totalCompleted - totalInJamaah);
    jamaahPercentage =
      totalCompleted > 0 ? Math.round((totalInJamaah / totalCompleted) * 100) : 0;

    previousJamaahCount =
      previousMetrics !== undefined && previousMetrics !== null
        ? previousMetrics.inJamaah
        : null;

    jamaahCountChange =
      previousJamaahCount !== null && previousJamaahCount !== undefined
        ? totalInJamaah - previousJamaahCount
        : null;

    // Most and least frequent Jamaah prayer
    let maxJamaah = -1;
    let minJamaah = 999;
    for (const p of prayersBreakdown) {
      if (p.inJamaah > maxJamaah) {
        maxJamaah = p.inJamaah;
        mostFrequentJamaahPrayer = p.name;
      }
      if (p.inJamaah < minJamaah) {
        minJamaah = p.inJamaah;
        leastFrequentJamaahPrayer = p.name;
      }
    }
    if (maxJamaah <= 0) {
      mostFrequentJamaahPrayer = null;
    }
    if (totalInJamaah === 0 || minJamaah === 999) {
      leastFrequentJamaahPrayer = null;
    }
  }

  return {
    periodType,
    periodStart,
    periodEnd,
    totalExpected,
    completed: totalCompleted,
    missed: totalMissed,
    late: totalLate,
    alone: totalAlone,
    inJamaah: totalInJamaah,
    completionPercentage,
    previousCompletionPercentage,
    completionPercentageChange,
    bestDay,
    weakestDay,
    currentStreak,
    longestStreak,
    perfectDaysCount,
    totalDays: effectiveTotalDays,
    mostFrequentlyMissedPrayer,
    mostImprovedPrayer,
    days,
    prayersBreakdown,
    isMaleMode,
    prayersWithoutJamaah,
    jamaahPercentage,
    previousJamaahCount,
    jamaahCountChange,
    mostFrequentJamaahPrayer,
    leastFrequentJamaahPrayer,
  };
};

/**
 * Calculates metrics for current period and automatically compares against the previous period.
 */
export const calculateTrendAnalysisWithComparison = (
  periodType: TrendPeriodType,
  periodStart: string,
  periodEnd: string,
  salahRecords: SalahRecordsArrayType,
  isMaleMode: boolean,
  referenceDate?: Date | string,
): TrendMetrics => {
  const refDate =
    referenceDate !== undefined
      ? typeof referenceDate === "string"
        ? parseISO(referenceDate)
        : referenceDate
      : new Date();
  const todayStr = format(refDate, "yyyy-MM-dd");
  const isInProgress = periodStart <= todayStr && todayStr <= periodEnd;
  const prevPeriod = getPreviousPeriod(periodType, periodStart);

  let prevMetrics: TrendMetrics;

  if (isInProgress) {
    const elapsedDaysCount = Math.max(
      1,
      differenceInCalendarDays(parseISO(todayStr), parseISO(periodStart)) + 1,
    );
    const prevElapsedEnd = format(
      addDays(parseISO(prevPeriod.start), elapsedDaysCount - 1),
      "yyyy-MM-dd",
    );

    // Find how many prayers have been reached/logged today
    const todayRecord = salahRecords.find((r) => r.date === todayStr);
    let maxTodayPrayerIndex = -1;
    for (let idx = 0; idx < PRAYER_NAMES.length; idx++) {
      const pName = PRAYER_NAMES[idx];
      const status =
        pName === "Asr"
          ? todayRecord?.salahs?.Asar || todayRecord?.salahs?.Asr || ""
          : todayRecord?.salahs?.[pName] || "";
      if (status !== "") {
        maxTodayPrayerIndex = Math.max(maxTodayPrayerIndex, idx);
      }
    }
    const todayPrayerCount =
      maxTodayPrayerIndex >= 0 ? maxTodayPrayerIndex + 1 : 0;

    // Evaluate equivalent elapsed days in the previous period up to equivalent today's prayer count
    prevMetrics = calculateTrendAnalysis(
      periodType,
      prevPeriod.start,
      prevElapsedEnd,
      salahRecords,
      isMaleMode,
      null,
      refDate,
      todayPrayerCount,
    );
  } else {
    // For fully completed (or past) periods, compare full period vs full period
    prevMetrics = calculateTrendAnalysis(
      periodType,
      prevPeriod.start,
      prevPeriod.end,
      salahRecords,
      isMaleMode,
      null,
      refDate,
    );
  }

  return calculateTrendAnalysis(
    periodType,
    periodStart,
    periodEnd,
    salahRecords,
    isMaleMode,
    prevMetrics,
    refDate,
  );
};

// ---------------------------------------------------------------------------
// Reflection Topic Determination
// ---------------------------------------------------------------------------

/**
 * Determines a reflection topic from TrendMetrics based on the priority:
 * 1. Strong improvement (completion percentage change >= 5)
 * 2. Strong streak or perfect week
 * 3. Jamaah improvement in male mode
 * 4. Frequent missed prayer
 * 5. Frequent late prayer
 * 6. Declining completion rate
 * 7. General consistency
 *
 * Does not infer religious blame. Used strictly to select a relevant reflection topic.
 */
export const determineTrendReflectionTopic = (
  metrics: TrendMetrics,
  isMaleMode: boolean,
): IslamicContentTopic => {
  // 1. Strong improvement
  if (
    metrics.completionPercentageChange !== null &&
    metrics.completionPercentageChange !== undefined &&
    metrics.completionPercentageChange >= 5
  ) {
    return "good-deeds";
  }

  // 2. Strong streak or perfect week
  const isPerfectPeriod =
    metrics.totalDays > 0 && metrics.perfectDaysCount === metrics.totalDays;
  if (
    isPerfectPeriod ||
    metrics.currentStreak >= 7 ||
    metrics.longestStreak >= 7
  ) {
    return "consistency";
  }

  // 3. Jamaah improvement in male mode
  if (
    isMaleMode &&
    metrics.jamaahCountChange !== null &&
    metrics.jamaahCountChange !== undefined &&
    metrics.jamaahCountChange > 0
  ) {
    return "jamaah";
  }

  // 4. Frequent missed prayer
  if (metrics.missed > 0) {
    return "returning-after-difficulty";
  }

  // 5. Frequent late prayer
  if (metrics.late > 0) {
    return "time-and-prayer";
  }

  // 6. Declining completion rate
  if (
    metrics.completionPercentageChange !== null &&
    metrics.completionPercentageChange !== undefined &&
    metrics.completionPercentageChange < 0
  ) {
    return "patience";
  }

  // 7. General consistency fallback
  return "consistency";
};

// ---------------------------------------------------------------------------
// Summary & Notification Text Generator
// ---------------------------------------------------------------------------

export interface GenerateAnalysisSummaryOptions {
  content?: IslamicContentRecord[];
  previousHadithId?: string | null;
  periodKey?: string;
}

export const generateAnalysisSummary = (
  metrics: TrendMetrics,
  isMaleMode: boolean,
  options?: GenerateAnalysisSummaryOptions,
): TrendSummary => {
  const insights: string[] = [];
  const periodNoun =
    metrics.periodType === "weekly"
      ? "this week"
      : metrics.periodType === "monthly"
        ? "this month"
        : "this year";

  const prevPeriodNoun =
    metrics.periodType === "weekly"
      ? "last week"
      : metrics.periodType === "monthly"
        ? "last month"
        : "last year";

  // Headline
  let headline = `Your ${metrics.periodType} completion rate is ${metrics.completionPercentage}%.`;
  if (metrics.completionPercentageChange !== null) {
    if (metrics.completionPercentageChange > 0) {
      headline = `Your completion rate improved by ${metrics.completionPercentageChange}% ${periodNoun}!`;
      insights.push(
        `Your ${metrics.periodType} completion rate increased from ${metrics.previousCompletionPercentage}% to ${metrics.completionPercentage}%.`,
      );
    } else if (metrics.completionPercentageChange < 0) {
      headline = `You completed ${metrics.completed} of ${metrics.totalExpected} prayers ${periodNoun}.`;
      insights.push(
        `Your completion rate was ${metrics.completionPercentage}% (down ${Math.abs(metrics.completionPercentageChange)}% compared to ${prevPeriodNoun}).`,
      );
    } else {
      headline = `Your completion rate remained steady at ${metrics.completionPercentage}%.`;
      insights.push(`Your completion rate remained steady at ${metrics.completionPercentage}%.`);
    }
  } else {
    insights.push("Not enough previous data for comparison.");
  }

  // Male-mode Jamaah details
  let details = `You completed ${metrics.completed} of ${metrics.totalExpected} prayers.`;
  if (isMaleMode && metrics.inJamaah > 0) {
    const jPct = metrics.jamaahPercentage || 0;
    if (metrics.jamaahCountChange !== null && metrics.jamaahCountChange !== undefined) {
      if (metrics.jamaahCountChange > 0) {
        details += ` ${metrics.inJamaah} were in Jamaah (${jPct}% of completed prayers), up from ${metrics.previousJamaahCount} ${prevPeriodNoun}.`;
        insights.push(
          `You prayed ${metrics.inJamaah} times in Jamaah ${periodNoun}, up from ${metrics.previousJamaahCount} ${prevPeriodNoun}.`,
        );
      } else {
        details += ` ${metrics.inJamaah} were in Jamaah (${jPct}% of completed prayers).`;
        insights.push(`You completed ${metrics.inJamaah} prayers in Jamaah (${jPct}%).`);
      }
    } else {
      details += ` ${metrics.inJamaah} were in Jamaah (${jPct}% of completed prayers).`;
      insights.push(`You completed ${metrics.inJamaah} prayers in Jamaah (${jPct}%).`);
    }

    if (metrics.mostFrequentJamaahPrayer) {
      insights.push(
        `${metrics.mostFrequentJamaahPrayer} was your most frequent prayer in Jamaah.`,
      );
    }
  }

  // Perfect days
  if (metrics.perfectDaysCount > 0) {
    insights.push(
      `You completed all five prayers on ${metrics.perfectDaysCount} of ${metrics.totalDays} days.`,
    );
  }

  // Most frequently missed prayer
  if (metrics.mostFrequentlyMissedPrayer && metrics.missed > 0) {
    insights.push(
      `${metrics.mostFrequentlyMissedPrayer} was your most frequently missed prayer ${periodNoun}.`,
    );
  } else if (metrics.missed === 0 && metrics.completed > 0) {
    insights.push(`Zero missed prayers ${periodNoun}! Outstanding steadfastness.`);
  }

  // Strongest day
  if (metrics.bestDay && metrics.bestDay.completed > 0) {
    insights.push(`Your strongest day was ${metrics.bestDay.dayLabel}.`);
  }

  // Most improved prayer
  if (metrics.mostImprovedPrayer) {
    insights.push(
      `You improved most in praying ${metrics.mostImprovedPrayer} on time.`,
    );
  }

  // Streak
  if (metrics.currentStreak > 0) {
    insights.push(
      `Your current streak is ${metrics.currentStreak} ${metrics.currentStreak === 1 ? "day" : "days"}.`,
    );
  } else if (metrics.longestStreak > 0) {
    insights.push(
      `Your best streak ${periodNoun} was ${metrics.longestStreak} ${metrics.longestStreak === 1 ? "day" : "days"}.`,
    );
  }

  // Hadith Reflection Selection (Only when meaningful prayer data exists)
  let hadithReflection: SelectedHadithReflection | null = null;
  let selectedHadith: IslamicContentRecord | null = null;
  if (metrics.completed > 0) {
    const topic = determineTrendReflectionTopic(metrics, isMaleMode);
    const contentPool =
      options?.content ?? (bundledIslamicContent as IslamicContentRecord[]);
    const periodKey =
      options?.periodKey ?? `${metrics.periodType}_${metrics.periodStart}`;
    const previousHadithId = options?.previousHadithId ?? null;

    selectedHadith = selectStableHadith(
      topic,
      periodKey,
      contentPool,
      previousHadithId,
    );

    hadithReflection = selectedHadith
      ? formatSelectedHadithReflection(selectedHadith, topic)
      : null;
  }

  // Screen Time-style lock-screen notification (Phase 5)
  const capitalizedType =
    metrics.periodType.charAt(0).toUpperCase() + metrics.periodType.slice(1);
  const notificationTitle = `Sujud ${capitalizedType} Summary`;

  let baseNotice = "";
  if (metrics.completionPercentageChange !== null && metrics.completionPercentageChange > 0) {
    baseNotice = `Your Salah completion improved by ${metrics.completionPercentageChange}% ${periodNoun}.`;
  } else if (isMaleMode && (metrics.inJamaah || 0) > 0) {
    baseNotice = `You completed ${metrics.completed} of ${metrics.totalExpected} prayers ${periodNoun} (${metrics.inJamaah} in Jamaah).`;
  } else {
    baseNotice = `You completed ${metrics.completed} of ${metrics.totalExpected} prayers ${periodNoun} (${metrics.completionPercentage}%).`;
  }

  // Include short hadith reference when meaningful data exists, record is reviewed,
  // attribution is complete, and notification length remains concise (< 180 chars)
  const canIncludeReflection =
    metrics.completed > 0 &&
    hadithReflection !== null &&
    Boolean(selectedHadith?.reviewed) &&
    Boolean(hadithReflection.collection && hadithReflection.collection.trim().length > 0);

  let notificationBody = `${baseNotice} Tap to see your full report.`;
  if (canIncludeReflection && hadithReflection) {
    const candidateBody = `${baseNotice} Your full report includes a reflection from ${hadithReflection.collection}.`;
    if (candidateBody.length <= 180) {
      notificationBody = candidateBody;
    }
  }

  return {
    headline,
    details,
    insights,
    notificationTitle,
    notificationBody,
    hadithReflection,
  };
};

// ---------------------------------------------------------------------------
// SQLite Persistence Layer
// ---------------------------------------------------------------------------

export const saveAnalysisSnapshot = async (
  dbConnection: React.MutableRefObject<SQLiteDBConnection | undefined>,
  snapshot: TrendSnapshotRecord,
): Promise<void> => {
  await withDB(dbConnection, async (db) => {
    const query = `
      INSERT OR REPLACE INTO trendAnalysisSnapshotsTable (
        id,
        periodType,
        periodStart,
        periodEnd,
        generatedAt,
        schemaVersion,
        dataVersion,
        metricsJson,
        summaryJson,
        isMaleMode,
        isNotificationSent,
        createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;
    await db.run(query, [
      snapshot.id,
      snapshot.periodType,
      snapshot.periodStart,
      snapshot.periodEnd,
      snapshot.generatedAt,
      snapshot.schemaVersion,
      snapshot.dataVersion,
      snapshot.metricsJson,
      snapshot.summaryJson,
      snapshot.isMaleMode,
      snapshot.isNotificationSent,
      snapshot.createdAt,
    ]);
  });
};

export const getAnalysisHistory = async (
  dbConnection: React.MutableRefObject<SQLiteDBConnection | undefined>,
  periodType: TrendPeriodType,
): Promise<TrendSnapshotRecord[]> => {
  return await withDB(dbConnection, async (db) => {
    const res = await db.query(
      `SELECT * FROM trendAnalysisSnapshotsTable WHERE periodType = ? ORDER BY generatedAt DESC LIMIT 50`,
      [periodType],
    );
    return (res.values as TrendSnapshotRecord[]) || [];
  });
};

export const getSnapshotById = async (
  dbConnection: React.MutableRefObject<SQLiteDBConnection | undefined>,
  id: string,
): Promise<TrendSnapshotRecord | null> => {
  return await withDB(dbConnection, async (db) => {
    const res = await db.query(
      `SELECT * FROM trendAnalysisSnapshotsTable WHERE id = ? LIMIT 1`,
      [id],
    );
    if (res.values && res.values.length > 0) {
      return res.values[0] as TrendSnapshotRecord;
    }
    return null;
  });
};

export const findMatchingSnapshot = async (
  dbConnection: React.MutableRefObject<SQLiteDBConnection | undefined>,
  periodType: TrendPeriodType,
  periodStart: string,
  periodEnd: string,
  dataVersion: string,
): Promise<TrendSnapshotRecord | null> => {
  return await withDB(dbConnection, async (db) => {
    const res = await db.query(
      `SELECT * FROM trendAnalysisSnapshotsTable 
       WHERE periodType = ? AND periodStart = ? AND periodEnd = ? AND dataVersion = ? 
       ORDER BY generatedAt DESC LIMIT 1`,
      [periodType, periodStart, periodEnd, dataVersion],
    );
    if (res.values && res.values.length > 0) {
      return res.values[0] as TrendSnapshotRecord;
    }
    return null;
  });
};

export const markSnapshotNotificationSent = async (
  dbConnection: React.MutableRefObject<SQLiteDBConnection | undefined>,
  snapshotId: string,
): Promise<void> => {
  await withDB(dbConnection, async (db) => {
    await db.run(
      `UPDATE trendAnalysisSnapshotsTable SET isNotificationSent = 1 WHERE id = ?`,
      [snapshotId],
    );
  });
};

// ---------------------------------------------------------------------------
// Notification Schedulers & Idempotency
// ---------------------------------------------------------------------------

const generateDeterministicNotificationId = (
  periodType: TrendPeriodType,
  periodStart: string,
): number => {
  const parsed = parseISO(periodStart);
  const yearShort = parsed.getFullYear() % 100;
  const dayOfYear = Math.floor(
    (parsed.getTime() - new Date(parsed.getFullYear(), 0, 0).getTime()) /
      (1000 * 60 * 60 * 24),
  );

  switch (periodType) {
    case "weekly":
      return 2000000 + yearShort * 1000 + dayOfYear;
    case "monthly":
      return 2100000 + yearShort * 100 + (parsed.getMonth() + 1);
    case "yearly":
      return 2200000 + yearShort;
  }
};

/**
 * Checks if a completed weekly, monthly, or yearly period is ready for notification.
 * Generates an immutable snapshot, schedules the lock-screen summary notification,
 * and records idempotency state to strictly prevent duplicates.
 */
export const checkAndGenerateTrendNotifications = async (
  dbConnection: React.MutableRefObject<SQLiteDBConnection | undefined>,
  userPreferences: userPreferencesType,
  salahRecords: SalahRecordsArrayType,
  setUserPreferences?: React.Dispatch<React.SetStateAction<userPreferencesType>>,
): Promise<boolean> => {
  try {
    let enabled = userPreferences.trendNotificationEnabled;
    let weeklyNotification = userPreferences.trendWeeklyNotification;
    let monthlyNotification = userPreferences.trendMonthlyNotification;
    let yearlyNotification = userPreferences.trendYearlyNotification;
    let lastTrendWeekly = userPreferences.lastTrendWeeklyDelivered;
    let lastTrendMonthly = userPreferences.lastTrendMonthlyDelivered;
    let lastTrendYearly = userPreferences.lastTrendYearlyDelivered;

    if (dbConnection?.current) {
      try {
        await withDB(dbConnection, async (db) => {
          const rows = await db.query(
            `SELECT preferenceName, preferenceValue FROM userPreferencesTable WHERE preferenceName IN (
              'trendNotificationEnabled', 'trendWeeklyNotification', 'trendMonthlyNotification',
              'trendYearlyNotification', 'lastTrendWeeklyDelivered', 'lastTrendMonthlyDelivered',
              'lastTrendYearlyDelivered'
            )`
          );
          if (rows?.values) {
            for (const r of rows.values) {
              if (r.preferenceName === "trendNotificationEnabled") enabled = r.preferenceValue;
              if (r.preferenceName === "trendWeeklyNotification") weeklyNotification = r.preferenceValue;
              if (r.preferenceName === "trendMonthlyNotification") monthlyNotification = r.preferenceValue;
              if (r.preferenceName === "trendYearlyNotification") yearlyNotification = r.preferenceValue;
              if (r.preferenceName === "lastTrendWeeklyDelivered") lastTrendWeekly = r.preferenceValue;
              if (r.preferenceName === "lastTrendMonthlyDelivered") lastTrendMonthly = r.preferenceValue;
              if (r.preferenceName === "lastTrendYearlyDelivered") lastTrendYearly = r.preferenceValue;
            }
          }
        });
      } catch (e) {
        // Fall back to passed userPreferences
      }
    }

    if (enabled !== "1") {
      return false;
    }

    const permission = await checkNotificationPermissions();
    if (permission !== "granted") {
      return false;
    }

    const now = new Date();
    const isMaleMode = userPreferences.userGender === "male";

    // 1. Check Weekly Summary (Mandatory First Milestone)
    if (weeklyNotification === "1") {
      const completedWeek = getCompletedPeriod("weekly", now);
      // Ensure we haven't already sent for this completed week
      if (lastTrendWeekly !== completedWeek.start) {
        const dataHash = computeSourceDataHash(
          salahRecords,
          completedWeek.start,
          completedWeek.end,
        );

        // Check if there is meaningful data
        const metrics = calculateTrendAnalysisWithComparison(
          "weekly",
          completedWeek.start,
          completedWeek.end,
          salahRecords,
          isMaleMode,
        );

        if (metrics.completed > 0) {
          // Find or create snapshot
          let snapshot = await findMatchingSnapshot(
            dbConnection,
            "weekly",
            completedWeek.start,
            completedWeek.end,
            dataHash,
          );

          const summary = generateAnalysisSummary(metrics, isMaleMode);

          if (!snapshot) {
            const newSnapshot: TrendSnapshotRecord = {
              id: `snapshot_weekly_${completedWeek.start}_${Date.now()}`,
              periodType: "weekly",
              periodStart: completedWeek.start,
              periodEnd: completedWeek.end,
              generatedAt: Date.now(),
              schemaVersion: 1,
              dataVersion: dataHash,
              metricsJson: JSON.stringify(metrics),
              summaryJson: JSON.stringify(summary),
              isMaleMode: isMaleMode ? 1 : 0,
              isNotificationSent: 0,
              createdAt: Date.now(),
            };
            await saveAnalysisSnapshot(dbConnection, newSnapshot);
            snapshot = newSnapshot;
          }

          if (snapshot.isNotificationSent !== 1) {
            const notificationId = generateDeterministicNotificationId(
              "weekly",
              completedWeek.start,
            );

            await LocalNotifications.schedule({
              notifications: [
                {
                  id: notificationId,
                  title: summary.notificationTitle,
                  body: summary.notificationBody,
                  schedule: {
                    at: new Date(Date.now() + 1000), // deliver immediately
                    allowWhileIdle: true,
                  },
                  sound: "default",
                  channelId: "trend-summary",
                  extra: {
                    type: "trend_analysis",
                    periodType: "weekly",
                    snapshotId: snapshot.id,
                    periodStart: snapshot.periodStart,
                    periodEnd: snapshot.periodEnd,
                  },
                },
              ],
            });

            await markSnapshotNotificationSent(dbConnection, snapshot.id);

            if (setUserPreferences) {
              await updateUserPrefs(
                dbConnection,
                "lastTrendWeeklyDelivered",
                completedWeek.start,
                setUserPreferences,
              );
            }
            return true;
          }
        }
      }
    }

    // 2. Check Monthly Summary (Secondary Milestone)
    if (monthlyNotification === "1") {
      const completedMonth = getCompletedPeriod("monthly", now);
      if (lastTrendMonthly !== completedMonth.start) {
        const dataHash = computeSourceDataHash(
          salahRecords,
          completedMonth.start,
          completedMonth.end,
        );

        const metrics = calculateTrendAnalysisWithComparison(
          "monthly",
          completedMonth.start,
          completedMonth.end,
          salahRecords,
          isMaleMode,
        );

        if (metrics.completed > 0) {
          let snapshot = await findMatchingSnapshot(
            dbConnection,
            "monthly",
            completedMonth.start,
            completedMonth.end,
            dataHash,
          );

          const summary = generateAnalysisSummary(metrics, isMaleMode);

          if (!snapshot) {
            const newSnapshot: TrendSnapshotRecord = {
              id: `snapshot_monthly_${completedMonth.start}_${Date.now()}`,
              periodType: "monthly",
              periodStart: completedMonth.start,
              periodEnd: completedMonth.end,
              generatedAt: Date.now(),
              schemaVersion: 1,
              dataVersion: dataHash,
              metricsJson: JSON.stringify(metrics),
              summaryJson: JSON.stringify(summary),
              isMaleMode: isMaleMode ? 1 : 0,
              isNotificationSent: 0,
              createdAt: Date.now(),
            };
            await saveAnalysisSnapshot(dbConnection, newSnapshot);
            snapshot = newSnapshot;
          }

          if (snapshot.isNotificationSent !== 1) {
            const notificationId = generateDeterministicNotificationId(
              "monthly",
              completedMonth.start,
            );

            await LocalNotifications.schedule({
              notifications: [
                {
                  id: notificationId,
                  title: summary.notificationTitle,
                  body: summary.notificationBody,
                  schedule: {
                    at: new Date(Date.now() + 1000),
                    allowWhileIdle: true,
                  },
                  sound: "default",
                  channelId: "trend-summary",
                  extra: {
                    type: "trend_analysis",
                    periodType: "monthly",
                    snapshotId: snapshot.id,
                    periodStart: snapshot.periodStart,
                    periodEnd: snapshot.periodEnd,
                  },
                },
              ],
            });

            await markSnapshotNotificationSent(dbConnection, snapshot.id);

            if (setUserPreferences) {
              await updateUserPrefs(
                dbConnection,
                "lastTrendMonthlyDelivered",
                completedMonth.start,
                setUserPreferences,
              );
            }
            return true;
          }
        }
      }
    }

    // 3. Check Yearly Summary
    if (yearlyNotification === "1") {
      const completedYear = getCompletedPeriod("yearly", now);
      if (lastTrendYearly !== completedYear.start) {
        const dataHash = computeSourceDataHash(
          salahRecords,
          completedYear.start,
          completedYear.end,
        );

        const metrics = calculateTrendAnalysisWithComparison(
          "yearly",
          completedYear.start,
          completedYear.end,
          salahRecords,
          isMaleMode,
        );

        if (metrics.completed > 0) {
          let snapshot = await findMatchingSnapshot(
            dbConnection,
            "yearly",
            completedYear.start,
            completedYear.end,
            dataHash,
          );

          const summary = generateAnalysisSummary(metrics, isMaleMode);

          if (!snapshot) {
            const newSnapshot: TrendSnapshotRecord = {
              id: `snapshot_yearly_${completedYear.start}_${Date.now()}`,
              periodType: "yearly",
              periodStart: completedYear.start,
              periodEnd: completedYear.end,
              generatedAt: Date.now(),
              schemaVersion: 1,
              dataVersion: dataHash,
              metricsJson: JSON.stringify(metrics),
              summaryJson: JSON.stringify(summary),
              isMaleMode: isMaleMode ? 1 : 0,
              isNotificationSent: 0,
              createdAt: Date.now(),
            };
            await saveAnalysisSnapshot(dbConnection, newSnapshot);
            snapshot = newSnapshot;
          }

          if (snapshot.isNotificationSent !== 1) {
            const notificationId = generateDeterministicNotificationId(
              "yearly",
              completedYear.start,
            );

            await LocalNotifications.schedule({
              notifications: [
                {
                  id: notificationId,
                  title: summary.notificationTitle,
                  body: summary.notificationBody,
                  schedule: {
                    at: new Date(Date.now() + 1000),
                    allowWhileIdle: true,
                  },
                  sound: "default",
                  channelId: "trend-summary",
                  extra: {
                    type: "trend_analysis",
                    periodType: "yearly",
                    snapshotId: snapshot.id,
                    periodStart: snapshot.periodStart,
                    periodEnd: snapshot.periodEnd,
                  },
                },
              ],
            });

            await markSnapshotNotificationSent(dbConnection, snapshot.id);

            if (setUserPreferences) {
              await updateUserPrefs(
                dbConnection,
                "lastTrendYearlyDelivered",
                completedYear.start,
                setUserPreferences,
              );
            }
            return true;
          }
        }
      }
    }

    return false;
  } catch (error) {
    console.error("Error in checkAndGenerateTrendNotifications:", error);
    return false;
  }
};
