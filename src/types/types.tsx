import { calculationMethods } from "../utils/constants";
import type { SelectedHadithReflection } from "./islamicContent";

export type OnboardingMode = "newUser" | "salahTimes" | null;

export type CalculationMethodsType =
  | "MuslimWorldLeague"
  | "Egyptian"
  | "Karachi"
  | "UmmAlQura"
  | "Dubai"
  | "Qatar"
  | "Kuwait"
  | "MoonsightingCommittee"
  | "NorthAmerica"
  | "Singapore"
  | "Turkey"
  | "Tehran"
  | "";
// | "Not listed"

export type countryOptionsType =
  | "Egypt"
  | "Pakistan"
  | "Saudi Arabia"
  | "UAE"
  | "Qatar"
  | "Kuwait"
  | "Turkey"
  | "Iran"
  | "UK"
  | "US"
  | "Canada"
  | "Singapore"
  | "Malaysia"
  | "Indonesia"
  | "Not listed";

export type SalahNotificationSettings = "off" | "on" | "adhan";

type binaryValue = "0" | "1";

export type dailyNotificationOption = "afterIsha" | "fixedTime";

export interface userPreferencesType {
  userStartDate: string;
  userGender: string;
  dailyNotification: binaryValue;
  dailyNotificationTime: string;
  reasons: string[];
  showReasons: binaryValue;
  showMissedSalahCount: binaryValue;
  isExistingUser: binaryValue;
  isMissedSalahToolTipShown: binaryValue;
  appLaunchCount: string;
  saveButtonTapCount: string;
  haptics: binaryValue;
  theme: "dark" | "light" | "system";
  timeFormat: "12hr" | "24hr";
  prayerCalculationMethod: CalculationMethodsType;
  madhab: "hanafi" | "shafi";
  highLatitudeRule: "middleofthenight" | "seventhofthenight" | "twilightangle";
  fajrAngle: string;
  ishaAngle: string;
  fajrAdjustment: string;
  dhuhrAdjustment: string;
  asrAdjustment: string;
  maghribAdjustment: string;
  ishaAdjustment: string;
  shafaqRule: "general" | "ahmer" | "abyad";
  fajrNotification: SalahNotificationSettings;
  sunriseNotification: SalahNotificationSettings;
  dhuhrNotification: SalahNotificationSettings;
  asrNotification: SalahNotificationSettings;
  maghribNotification: SalahNotificationSettings;
  ishaNotification: SalahNotificationSettings;
  hasSeenBatteryPrompt: binaryValue;
  polarCircleResolution: "AqrabBalad" | "AqrabYaum" | "Unresolved";
  country: countryOptionsType | "";
  dailyNotificationOption: dailyNotificationOption;
  dailyNotificationAfterIshaDelay: string;
  lastLaunchDate: string;
  trendNotificationEnabled: binaryValue;
  trendWeeklyNotification: binaryValue;
  trendMonthlyNotification: binaryValue;
  trendYearlyNotification: binaryValue;
  trendNotificationDeliveryTime: string;
  lastTrendWeeklyDelivered: string;
  lastTrendMonthlyDelivered: string;
  lastTrendYearlyDelivered: string;
}

export type calculationMethod = (typeof calculationMethods)[number];

export type PreferenceType = keyof userPreferencesType;

export type PreferenceObjType = {
  preferenceName: PreferenceType;
  preferenceValue: string;
};

export type LocationsDataObjType = {
  id: number;
  syncId: string;
  locationName: string;
  latitude: number;
  longitude: number;
  isSelected: number;
  createdAt: number;
  updatedAt: number;
  deleted: number;
};

export type LocationsDataObjTypeArr = LocationsDataObjType[];

export type themeType = "light" | "dark" | "system";

export type SalahStatusType =
  | "group"
  | "male-alone"
  | "female-alone"
  | "late"
  | "missed"
  | "excused"
  | "";

export interface SalahsType {
  Fajr: SalahStatusType;
  Dhuhr: SalahStatusType;
  Asar: SalahStatusType;
  Asr?: SalahStatusType;
  Maghrib: SalahStatusType;
  Isha: SalahStatusType;
}

export interface SalahRecordType {
  date: string;
  salahs: SalahsType;
}

export type SalahRecordsArrayType = SalahRecordType[];

export type SalahDataType = {
  [date: string]: string[];
};

export type SalahNamesType =
  | "Fajr"
  | "Dhuhr"
  | "Asr"
  | "Asar"
  | "Maghrib"
  | "Isha";

export type SalahNamesTypeAdhanLibrary =
  | "fajr"
  | "sunrise"
  | "dhuhr"
  | "asr"
  | "maghrib"
  | "isha";

// export type SalahNamesTypeAdhanLibrary =
//   | "none"
//   | "fajr"
//   | "sunrise"
//   | "dhuhr"
//   | "asr"
//   | "maghrib"
//   | "isha";

export type nextSalahTimeType = {
  currentSalah: string;
  nextSalah: SalahNamesTypeAdhanLibrary | "" | "none";
  nextSalahTime: Date | null;
  hoursRemaining: number;
  minsRemaining: number;
};

export type salahTimesObjType = {
  fajr: string;
  sunrise: string;
  dhuhr: string;
  asr: string;
  maghrib: string;
  isha: string;
};

export interface SalahEntryType {
  salahName: SalahNamesType;
  salahStatus: SalahStatusType;
}

export type salahReasonsOverallNumbersType = {
  "male-alone": { [reason: string]: number };
  late: { [reason: string]: number };
  missed: { [reason: string]: number };
};

export type SalahByDateObjType = {
  [date: string]: SalahNamesType[];
};

export interface restructuredMissedSalahListProp {
  [date: string]: SalahNamesType;
}

export interface clickedDateDataObj {
  date: string;
  id: number | null;
  salahName: SalahNamesType;
  salahStatus: SalahStatusType;
  notes: string;
  reasons: string;
}

export type DBConnectionStateType = "open" | "close";

export type userGenderType = "male" | "female";

export type currentStartDateType = number;

export type DBResultDataObjType = {
  id: number;
  date: string;
  salahName: SalahNamesType;
  salahStatus: SalahStatusType;
  reasons: string;
  notes: string;
  createdAt: number;
  updatedAt: number;
  deleted: number;
};

export type DBResultDataObjArrayType = DBResultDataObjType[];

export type reasonsToShowType =
  | ""
  | "male-alone"
  | "late"
  | "missed"
  | undefined;

export type streakDatesObjType = {
  startDate: Date;
  endDate: Date;
  days: number;
  isActive: boolean;
  excusedDays: number;
};

export type TrendPeriodType = "weekly" | "monthly" | "yearly";

export interface DayTrendItem {
  date: string;
  dayLabel: string;
  totalExpected: number;
  completed: number;
  inJamaah: number;
  alone: number;
  late: number;
  missed: number;
  excused: number;
  percentage: number;
  isAllCompleted: boolean;
}

export interface PrayerTrendBreakdownItem {
  name: "Fajr" | "Dhuhr" | "Asr" | "Maghrib" | "Isha";
  completed: number;
  expected: number;
  inJamaah: number;
  alone: number;
  late: number;
  missed: number;
  excused: number;
  completionRate: number;
  changeVsPreviousRate: number | null;
}

export interface DayMetricSummary {
  date: string;
  dayLabel: string;
  completed: number;
  total: number;
  percentage: number;
}

export interface TrendMetrics {
  periodType: TrendPeriodType;
  periodStart: string;
  periodEnd: string;
  totalExpected: number;
  completed: number;
  missed: number;
  late: number;
  alone: number;
  inJamaah: number;
  completionPercentage: number;
  previousCompletionPercentage: number | null;
  completionPercentageChange: number | null;
  bestDay: DayMetricSummary | null;
  weakestDay: DayMetricSummary | null;
  currentStreak: number;
  longestStreak: number;
  perfectDaysCount: number;
  totalDays: number;
  mostFrequentlyMissedPrayer: string | null;
  mostImprovedPrayer: string | null;
  days: DayTrendItem[];
  prayersBreakdown: PrayerTrendBreakdownItem[];
  // Male mode specific metrics
  isMaleMode: boolean;
  prayersWithoutJamaah?: number;
  jamaahPercentage?: number;
  previousJamaahCount?: number | null;
  jamaahCountChange?: number | null;
  mostFrequentJamaahPrayer?: string | null;
  leastFrequentJamaahPrayer?: string | null;
}

export interface TrendSummary {
  headline: string;
  details: string;
  insights: string[];
  notificationTitle: string;
  notificationBody: string;
  hadithReflection?: SelectedHadithReflection | null;
}

export interface TrendSnapshotRecord {
  id: string;
  periodType: TrendPeriodType;
  periodStart: string;
  periodEnd: string;
  generatedAt: number;
  schemaVersion: number;
  dataVersion: string;
  metricsJson: string;
  summaryJson: string;
  isMaleMode: number;
  isNotificationSent: number;
  createdAt: number;
}

export type {
  IslamicContentType,
  IslamicContentTopic,
  IslamicContentRecord,
  SelectedHadithReflection,
  ContentValidationResult,
  SelectHadithOptions,
} from "./islamicContent";
