import { describe, it, expect, vi, beforeEach } from "vitest";
import { syncMultiplePreferencesToCloud, pullCloudDataToLocal } from "./syncService";
import { setDoc, getDoc, getDocs } from "firebase/firestore";

vi.mock("firebase/firestore", () => ({
  doc: vi.fn((...args: any[]) => ({ path: args.join("/") })),
  collection: vi.fn((...args: any[]) => ({ path: args.join("/") })),
  setDoc: vi.fn().mockResolvedValue(undefined),
  getDoc: vi.fn(),
  getDocs: vi.fn().mockResolvedValue({ docs: [], size: 0, forEach: vi.fn() }),
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
