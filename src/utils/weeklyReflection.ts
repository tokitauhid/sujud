import React from "react";
import { SQLiteDBConnection } from "@capacitor-community/sqlite";
import { format, parseISO, startOfWeek } from "date-fns";
import { LocalNotifications } from "@capacitor/local-notifications";
import {
  SalahRecordsArrayType,
  userPreferencesType,
} from "../types/types";
import {
  IslamicContentRecord,
  IslamicContentTopic,
} from "../types/islamicContent";
import { selectStableHadith } from "./islamicContent";
import bundledIslamicContent from "../assets/islamicContent.json";
import {
  calculateTrendAnalysisWithComparison,
  determineTrendReflectionTopic,
  getCompletedPeriod,
} from "./trendAnalysis";
import { checkNotificationPermissions, updateUserPrefs } from "./helpers";
import { withDB } from "./dbUtils";

/**
 * Returns the calendar week starting date (Monday) as the period key.
 */
export const getWeeklyReflectionPeriodKey = (date: Date = new Date()): string => {
  return format(startOfWeek(date, { weekStartsOn: 1 }), "yyyy-MM-dd");
};

/**
 * Deterministically generates an integer notification ID for weekly reflections.
 */
export const generateDeterministicReflectionNotificationId = (
  weekStart: string,
): number => {
  const parsed = parseISO(weekStart);
  const yearShort = parsed.getFullYear() % 100;
  const dayOfYear = Math.floor(
    (parsed.getTime() - new Date(parsed.getFullYear(), 0, 0).getTime()) /
      (1000 * 60 * 60 * 24),
  );
  return 2500000 + yearShort * 1000 + dayOfYear;
};

export interface CheckWeeklyReflectionOptions {
  referenceDate?: Date;
  content?: IslamicContentRecord[];
}

/**
 * Checks if a weekly reflection notification is due for the current week.
 *
 * Rules:
 * 1. Only runs if weekly reflection notification is enabled (default "1").
 * 2. Delivers one Reflection as a notification once per week.
 * 3. Once delivered, it is recorded in preferences and treated as one-and-done for that week.
 * 4. Survives app restarts and does NOT repeatedly trigger upon reopening the app.
 * 5. Rotates to a new Reflection when the next week begins, avoiding immediate repeats.
 */
export const checkAndGenerateWeeklyReflectionNotification = async (
  dbConnection: React.MutableRefObject<SQLiteDBConnection | undefined>,
  userPreferences: userPreferencesType,
  salahRecords: SalahRecordsArrayType = [],
  setUserPreferences?: React.Dispatch<React.SetStateAction<userPreferencesType>>,
  options?: CheckWeeklyReflectionOptions,
): Promise<boolean> => {
  try {
    let enabled = userPreferences.weeklyReflectionNotification;
    let lastDelivered = userPreferences.lastWeeklyReflectionDelivered;
    let lastId = userPreferences.lastWeeklyReflectionId;

    if (dbConnection?.current) {
      try {
        await withDB(dbConnection, async (db) => {
          const rows = await db.query(
            `SELECT preferenceName, preferenceValue FROM userPreferencesTable WHERE preferenceName IN ('weeklyReflectionNotification', 'lastWeeklyReflectionDelivered', 'lastWeeklyReflectionId')`
          );
          if (rows?.values) {
            for (const r of rows.values) {
              if (r.preferenceName === "weeklyReflectionNotification") enabled = r.preferenceValue;
              if (r.preferenceName === "lastWeeklyReflectionDelivered") lastDelivered = r.preferenceValue;
              if (r.preferenceName === "lastWeeklyReflectionId") lastId = r.preferenceValue;
            }
          }
        });
      } catch (e) {
        // Fall back to passed userPreferences
      }
    }

    if (enabled === "0") {
      return false;
    }

    const permission = await checkNotificationPermissions();
    if (permission !== "granted") {
      return false;
    }

    const refDate = options?.referenceDate ?? new Date();
    const currentWeekStart = getWeeklyReflectionPeriodKey(refDate);
    const notificationId =
      generateDeterministicReflectionNotificationId(currentWeekStart);

    // One-and-done: strictly verify we have not already delivered for this week
    if (lastDelivered === currentWeekStart) {
      return false;
    }

    // Check if already active/delivered in device notifications
    if (typeof LocalNotifications.getDeliveredNotifications === "function") {
      try {
        const delivered = await LocalNotifications.getDeliveredNotifications();
        if (delivered?.notifications?.some((n) => n.id === notificationId)) {
          if (setUserPreferences) {
            await updateUserPrefs(
              dbConnection,
              "lastWeeklyReflectionDelivered",
              currentWeekStart,
              setUserPreferences,
            );
          }
          return false;
        }
      } catch (e) {
        // Ignore check error
      }
    }

    const isMaleMode = userPreferences.userGender === "male";
    let topic: IslamicContentTopic = "consistency";

    if (salahRecords && salahRecords.length > 0) {
      const completedWeek = getCompletedPeriod("weekly", refDate);
      const metrics = calculateTrendAnalysisWithComparison(
        "weekly",
        completedWeek.start,
        completedWeek.end,
        salahRecords,
        isMaleMode,
      );
      if (metrics.completed > 0) {
        topic = determineTrendReflectionTopic(metrics, isMaleMode);
      }
    }

    const contentPool =
      options?.content ?? (bundledIslamicContent as IslamicContentRecord[]);
    const periodKey = `weekly_reflection_${currentWeekStart}`;
    const previousHadithId = lastId || userPreferences.lastWeeklyReflectionId || null;

    const selectedHadith = selectStableHadith(
      topic,
      periodKey,
      contentPool,
      previousHadithId,
    );

    if (!selectedHadith) {
      return false;
    }


    const citation = selectedHadith.reference
      ? `${selectedHadith.collection} (${selectedHadith.reference})`
      : selectedHadith.collection;

    const bodyText = `"${selectedHadith.translatedText}"\n— ${citation}`;

    await LocalNotifications.schedule({
      notifications: [
        {
          id: notificationId,
          title: "Weekly Reflection",
          body: bodyText,
          schedule: {
            at: new Date(Date.now() + 1000), // deliver immediately
            allowWhileIdle: true,
          },
          sound: "default",
          channelId: "weekly-reflection",
          extra: {
            type: "weekly_reflection",
            hadithId: selectedHadith.id,
            weekStart: currentWeekStart,
            topic,
          },
        },
      ],
    });

    if (setUserPreferences) {
      await updateUserPrefs(
        dbConnection,
        "lastWeeklyReflectionDelivered",
        currentWeekStart,
        setUserPreferences,
      );
      await updateUserPrefs(
        dbConnection,
        "lastWeeklyReflectionId",
        selectedHadith.id,
        setUserPreferences,
      );
    }

    return true;
  } catch (error) {
    console.error(
      "Error in checkAndGenerateWeeklyReflectionNotification:",
      error,
    );
    return false;
  }
};
