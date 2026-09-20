import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  checkAndGenerateWeeklyReflectionNotification,
  getWeeklyReflectionPeriodKey,
  generateDeterministicReflectionNotificationId,
} from "./weeklyReflection";
import { mockdbConnection, mockUserPrefs } from "../__mocks__/test-utils";
import { LocalNotifications } from "@capacitor/local-notifications";
import * as helpers from "./helpers";

vi.mock("@capacitor/local-notifications", () => ({
  LocalNotifications: {
    schedule: vi.fn().mockResolvedValue(undefined),
    createChannel: vi.fn().mockResolvedValue(undefined),
    addListener: vi.fn().mockResolvedValue({ remove: vi.fn() }),
  },
}));

describe("Weekly Reflection Notifications (Bug 4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(helpers, "checkNotificationPermissions").mockResolvedValue("granted");
    vi.spyOn(helpers, "updateUserPrefs").mockResolvedValue(undefined);
  });

  it("calculates Monday-based weekly reflection period key correctly", () => {
    // 2026-09-20 is Sunday -> week started 2026-09-14
    const sunday = new Date("2026-09-20T12:00:00Z");
    expect(getWeeklyReflectionPeriodKey(sunday)).toBe("2026-09-14");

    // 2026-09-21 is Monday -> week starts 2026-09-21
    const monday = new Date("2026-09-21T10:00:00Z");
    expect(getWeeklyReflectionPeriodKey(monday)).toBe("2026-09-21");
  });

  it("generates deterministic integer notification ID within valid 32-bit range", () => {
    const id1 = generateDeterministicReflectionNotificationId("2026-09-14");
    const id2 = generateDeterministicReflectionNotificationId("2026-09-14");
    const idNextWeek = generateDeterministicReflectionNotificationId("2026-09-21");

    expect(id1).toBe(id2);
    expect(id1).not.toBe(idNextWeek);
    expect(id1).toBeGreaterThan(2000000);
  });

  it("delivers weekly reflection notification when a new week arrives", async () => {
    const mockSetUserPrefs = vi.fn();
    const testDate = new Date("2026-09-14T10:00:00Z");

    const result = await checkAndGenerateWeeklyReflectionNotification(
      mockdbConnection,
      {
        ...mockUserPrefs,
        weeklyReflectionNotification: "1",
        lastWeeklyReflectionDelivered: "",
      },
      [],
      mockSetUserPrefs,
      { referenceDate: testDate },
    );

    expect(result).toBe(true);
    expect(LocalNotifications.schedule).toHaveBeenCalledTimes(1);

    const callArgs = (LocalNotifications.schedule as any).mock.calls[0][0];
    expect(callArgs.notifications).toHaveLength(1);

    const notif = callArgs.notifications[0];
    expect(notif.title).toBe("Weekly Reflection");
    expect(notif.channelId).toBe("weekly-reflection");
    expect(notif.body).toContain("—");
    expect(notif.extra.type).toBe("weekly_reflection");
    expect(notif.extra.weekStart).toBe("2026-09-14");

    // Verifies persistence into DB
    expect(helpers.updateUserPrefs).toHaveBeenCalledWith(
      mockdbConnection,
      "lastWeeklyReflectionDelivered",
      "2026-09-14",
      mockSetUserPrefs,
    );
    expect(helpers.updateUserPrefs).toHaveBeenCalledWith(
      mockdbConnection,
      "lastWeeklyReflectionId",
      expect.any(String),
      mockSetUserPrefs,
    );
  });

  it("is one-and-done: does not repeatedly notify or trigger when app is reopened within the same week", async () => {
    const mockSetUserPrefs = vi.fn();
    const testDate = new Date("2026-09-16T15:00:00Z"); // Wednesday in same week

    const result = await checkAndGenerateWeeklyReflectionNotification(
      mockdbConnection,
      {
        ...mockUserPrefs,
        weeklyReflectionNotification: "1",
        lastWeeklyReflectionDelivered: "2026-09-14", // Already delivered this week
      },
      [],
      mockSetUserPrefs,
      { referenceDate: testDate },
    );

    expect(result).toBe(false);
    expect(LocalNotifications.schedule).not.toHaveBeenCalled();
    expect(helpers.updateUserPrefs).not.toHaveBeenCalled();
  });

  it("rotates to a new reflection when advancing to the next week without duplicating previous hadith", async () => {
    const mockSetUserPrefs = vi.fn();
    const weekTwoDate = new Date("2026-09-21T09:00:00Z"); // Next Monday

    const result = await checkAndGenerateWeeklyReflectionNotification(
      mockdbConnection,
      {
        ...mockUserPrefs,
        weeklyReflectionNotification: "1",
        lastWeeklyReflectionDelivered: "2026-09-14", // Previous week delivered
        lastWeeklyReflectionId: "hadith-good-deeds",
      },
      [],
      mockSetUserPrefs,
      { referenceDate: weekTwoDate },
    );

    expect(result).toBe(true);
    expect(LocalNotifications.schedule).toHaveBeenCalledTimes(1);

    const callArgs = (LocalNotifications.schedule as any).mock.calls[0][0];
    const notif = callArgs.notifications[0];
    expect(notif.extra.weekStart).toBe("2026-09-21");
    // Ensures the previous hadith was avoided if alternatives exist
    expect(notif.extra.hadithId).not.toBe("hadith-good-deeds");

    expect(helpers.updateUserPrefs).toHaveBeenCalledWith(
      mockdbConnection,
      "lastWeeklyReflectionDelivered",
      "2026-09-21",
      mockSetUserPrefs,
    );
  });

  it("respects user setting when weekly reflection notifications are disabled", async () => {
    const mockSetUserPrefs = vi.fn();
    const testDate = new Date("2026-09-14T10:00:00Z");

    const result = await checkAndGenerateWeeklyReflectionNotification(
      mockdbConnection,
      {
        ...mockUserPrefs,
        weeklyReflectionNotification: "0",
        lastWeeklyReflectionDelivered: "",
      },
      [],
      mockSetUserPrefs,
      { referenceDate: testDate },
    );

    expect(result).toBe(false);
    expect(LocalNotifications.schedule).not.toHaveBeenCalled();
  });

  it("does not schedule when notification permission is denied", async () => {
    vi.spyOn(helpers, "checkNotificationPermissions").mockResolvedValue("denied");
    const mockSetUserPrefs = vi.fn();
    const testDate = new Date("2026-09-14T10:00:00Z");

    const result = await checkAndGenerateWeeklyReflectionNotification(
      mockdbConnection,
      {
        ...mockUserPrefs,
        weeklyReflectionNotification: "1",
        lastWeeklyReflectionDelivered: "",
      },
      [],
      mockSetUserPrefs,
      { referenceDate: testDate },
    );

    expect(result).toBe(false);
    expect(LocalNotifications.schedule).not.toHaveBeenCalled();
  });
});
