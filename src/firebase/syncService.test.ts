import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  syncMultiplePreferencesToCloud,
  syncSalahLogToCloud,
  pullCloudDataToLocal,
  recordSyncSuccess,
  subscribeSyncState,
  getLocalLastSyncTimestamp,
  getLastSyncTimestamp,
  performManualSync,
  formatLastSynced,
} from "./syncService";
import { setDoc, getDoc, getDocs, getDocFromServer } from "firebase/firestore";

vi.mock("firebase/firestore", () => ({
  doc: vi.fn((...args: any[]) => ({ path: args.join("/") })),
  collection: vi.fn((...args: any[]) => ({ path: args.join("/") })),
  setDoc: vi.fn().mockResolvedValue(undefined),
  getDoc: vi.fn(),
  getDocs: vi.fn().mockResolvedValue({ docs: [], size: 0, forEach: vi.fn() }),
  getDocFromServer: vi.fn(),
  serverTimestamp: vi.fn(() => 12345),
  Timestamp: {
    fromMillis: (ms: number) => ({ toMillis: () => ms, toDate: () => new Date(ms) }),
  },
  onSnapshot: vi.fn(),
}));

vi.mock("./firebaseConfig", () => ({
  auth: { currentUser: { uid: "test-user-123" } },
  db: {},
}));

describe("syncService preferences cloud sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("syncMultiplePreferencesToCloud formats payload and calls setDoc with merge: true", () => {
    const prefs = {
      prayerCalculationMethod: "Karachi",
      fajrAngle: "18",
      ishaAngle: "18",
    };
    const now = 1700000000;

    syncMultiplePreferencesToCloud(prefs, now);

    expect(setDoc).toHaveBeenCalledTimes(1);
    const [, payload, options] = (setDoc as any).mock.calls[0];
    expect(options).toEqual({ merge: true });
    expect(payload.prayerCalculationMethod).toEqual({ value: "Karachi", updatedAt: now });
    expect(payload.fajrAngle).toEqual({ value: "18", updatedAt: now });
    expect(payload.ishaAngle).toEqual({ value: "18", updatedAt: now });
  });

  it("pullCloudDataToLocal preserves local prayerCalculationMethod when cloud is empty", async () => {
    // Cloud has empty prayerCalculationMethod
    (getDoc as any).mockResolvedValue({
      exists: () => true,
      data: () => ({
        country: { value: "Pakistan", updatedAt: 1000 },
        prayerCalculationMethod: { value: "", updatedAt: 1000 },
      }),
    });

    const mockExecuteSet = vi.fn().mockResolvedValue(undefined);
    const mockDbConnection: any = {
      current: {
        isDBOpen: vi.fn().mockResolvedValue({ result: true }),
        open: vi.fn().mockResolvedValue(undefined),
        query: vi.fn().mockImplementation(async (sql: string) => {
          if (sql.includes("prayerCalculationMethod")) {
            return {
              values: [
                {
                  preferenceName: "prayerCalculationMethod",
                  preferenceValue: "Karachi",
                  updatedAt: 2000,
                },
              ],
            };
          }
          return { values: [] };
        }),
        executeSet: mockExecuteSet,
        run: vi.fn().mockResolvedValue(undefined),
      },
    };

    await pullCloudDataToLocal("test-user-123", mockDbConnection);

    expect(mockExecuteSet).toHaveBeenCalled();
    const allBatches = mockExecuteSet.mock.calls;
    const allStatements = allBatches.flatMap((call: any) => call[0]);

    // Check that Karachi was preserved in the statements
    const prayerMethodStmt = allStatements.find(
      (s: any) => s.values && s.values.includes("Karachi")
    );
    expect(prayerMethodStmt).toBeDefined();
    expect(prayerMethodStmt.values).toContain("prayerCalculationMethod");
    expect(prayerMethodStmt.values).toContain("Karachi");
  });
});

describe("syncService timestamp tracking & Settings reactivity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("returns null when no sync has ever occurred", () => {
    expect(getLocalLastSyncTimestamp("test-user-123")).toBeNull();
  });

  it("recordSyncSuccess persists timestamp to localStorage and notifies subscribers immediately", () => {
    const subscriber = vi.fn();
    const unsub = subscribeSyncState(subscriber);

    const testTime = new Date(2026, 9, 1, 10, 0, 0);
    recordSyncSuccess("test-user-123", testTime);

    expect(subscriber).toHaveBeenCalledWith({
      status: "synced",
      lastSynced: testTime,
    });

    const stored = getLocalLastSyncTimestamp("test-user-123");
    expect(stored).toEqual(testTime);

    unsub();
  });

  it("getLastSyncTimestamp returns local timestamp if remote is older or fails", async () => {
    const localTime = new Date(Date.now() - 60000); // 1 min ago
    recordSyncSuccess("test-user-123", localTime);

    // Mock remote returning older timestamp (10 hours ago)
    const remoteOlder = new Date(Date.now() - 36000000);
    (getDoc as any).mockResolvedValue({
      exists: () => true,
      data: () => ({
        lastSyncedAt: {
          toDate: () => remoteOlder,
        },
      }),
    });

    const result = await getLastSyncTimestamp("test-user-123");
    expect(result).toEqual(localTime);
  });

  it("getLastSyncTimestamp adopts newer remote timestamp and updates local persistence", async () => {
    const localOlder = new Date(Date.now() - 36000000); // 10 hours ago
    recordSyncSuccess("test-user-123", localOlder);

    const remoteNewer = new Date(Date.now() - 60000); // 1 min ago
    (getDoc as any).mockResolvedValue({
      exists: () => true,
      data: () => ({
        lastSyncedAt: {
          toDate: () => remoteNewer,
        },
      }),
    });

    const result = await getLastSyncTimestamp("test-user-123");
    expect(result).toEqual(remoteNewer);
    expect(getLocalLastSyncTimestamp("test-user-123")).toEqual(remoteNewer);
  });

  it("performManualSync verifies server and returns actual server sync timestamp", async () => {
    const serverTime = new Date(2026, 9, 1, 11, 30, 0);
    (getDocFromServer as any).mockResolvedValue({
      data: () => ({
        lastSyncedAt: {
          toDate: () => serverTime,
        },
      }),
    });

    const result = await performManualSync("test-user-123");

    expect(result).toEqual(serverTime);
    expect(getLocalLastSyncTimestamp("test-user-123")).toEqual(serverTime);
  });

  it("performManualSync throws when offline and does NOT alter previous timestamp", async () => {
    const previousTime = new Date(2026, 9, 1, 9, 0, 0);
    recordSyncSuccess("test-user-123", previousTime);

    // Simulate failure during server contact
    (setDoc as any).mockRejectedValueOnce(new Error("Network unavailable"));

    await expect(performManualSync("test-user-123")).rejects.toThrow();

    // Previous successful timestamp must remain untouched
    expect(getLocalLastSyncTimestamp("test-user-123")).toEqual(previousTime);
  });

  it("syncSalahLogToCloud triggers recordSyncSuccess on successful push", async () => {
    const subscriber = vi.fn();
    const unsub = subscribeSyncState(subscriber);

    syncSalahLogToCloud({
      date: "2026-10-01",
      salahName: "Fajr",
      salahStatus: "In Jamaah",
      reasons: "",
      notes: "",
      createdAt: 1000,
      updatedAt: 1000,
      deleted: 0,
    });

    // Wait a tick for promise microtask to resolve
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(subscriber).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "synced",
      })
    );
    expect(getLocalLastSyncTimestamp("test-user-123")).not.toBeNull();

    unsub();
  });
});

describe("formatLastSynced relative time strings", () => {
  it("formats null as 'Never synced'", () => {
    expect(formatLastSynced(null)).toBe("Never synced");
  });

  it("formats recent sync as 'Synced just now'", () => {
    const justNow = new Date(Date.now() - 10000); // 10s ago
    expect(formatLastSynced(justNow)).toBe("Synced just now");
  });

  it("formats 1 minute ago as 'Synced 1 minute ago'", () => {
    const oneMinAgo = new Date(Date.now() - 65000); // 65s ago
    expect(formatLastSynced(oneMinAgo)).toBe("Synced 1 minute ago");
  });

  it("formats 5 minutes ago as 'Synced 5 minutes ago'", () => {
    const fiveMinsAgo = new Date(Date.now() - 5 * 60000);
    expect(formatLastSynced(fiveMinsAgo)).toBe("Synced 5 minutes ago");
  });

  it("formats 1 hour ago as 'Synced 1 hour ago'", () => {
    const oneHourAgo = new Date(Date.now() - 65 * 60000);
    expect(formatLastSynced(oneHourAgo)).toBe("Synced 1 hour ago");
  });

  it("formats 3 hours ago as 'Synced 3 hours ago'", () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 3600000);
    expect(formatLastSynced(threeHoursAgo)).toBe("Synced 3 hours ago");
  });

  it("formats 1 day ago as 'Synced 1 day ago'", () => {
    const oneDayAgo = new Date(Date.now() - 25 * 3600000);
    expect(formatLastSynced(oneDayAgo)).toBe("Synced 1 day ago");
  });

  it("formats multiple days ago as 'Synced X days ago'", () => {
    const fourDaysAgo = new Date(Date.now() - 4 * 86400000);
    expect(formatLastSynced(fourDaysAgo)).toBe("Synced 4 days ago");
  });
});
