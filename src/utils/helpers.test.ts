import { describe, it, expect, vi, beforeEach } from "vitest";
import { setAdhanLibraryDefaults } from "./helpers";
import { syncMultiplePreferencesToCloud } from "../firebase/syncService";
import { dictPreferencesDefaultValues } from "./constants";
import { LocationsDataObjTypeArr } from "../types/types";

vi.mock("../firebase/syncService", () => ({
  syncPreferenceToCloud: vi.fn(),
  syncMultiplePreferencesToCloud: vi.fn(),
}));

describe("setAdhanLibraryDefaults", () => {
  let mockRun: any;
  let mockDbConnection: any;
  let mockSetUserPreferences: any;

  const mockLocations: LocationsDataObjTypeArr = [
    {
      id: 1,
      locationName: "London",
      latitude: 51.5074,
      longitude: -0.1278,
      isSelected: 1,
      createdAt: 0,
      updatedAt: 0,
      deleted: 0,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockRun = vi.fn().mockResolvedValue(undefined);
    mockDbConnection = {
      current: {
        isDBOpen: vi.fn().mockResolvedValue({ result: true }),
        open: vi.fn().mockResolvedValue(undefined),
        run: mockRun,
        query: vi.fn().mockResolvedValue({ values: [] }),
      },
    };
    mockSetUserPreferences = vi.fn();
  });

  it("updates SQLite with default calculation values and syncs to cloud", async () => {
    await setAdhanLibraryDefaults(
      mockDbConnection,
      "MuslimWorldLeague",
      mockSetUserPreferences,
      dictPreferencesDefaultValues,
      mockLocations,
    );

    // Verify SQLite run was called for all defaults including prayerCalculationMethod
    expect(mockRun).toHaveBeenCalled();
    const calls = mockRun.mock.calls;
    const insertedKeys = calls.map((c: any) => c[1][0]);
    expect(insertedKeys).toContain("prayerCalculationMethod");
    expect(insertedKeys).toContain("fajrAngle");
    expect(insertedKeys).toContain("ishaAngle");
    expect(insertedKeys).toContain("highLatitudeRule");

    // Verify React state updater was called
    expect(mockSetUserPreferences).toHaveBeenCalled();

    // Verify syncMultiplePreferencesToCloud was called with prayerCalculationMethod
    expect(syncMultiplePreferencesToCloud).toHaveBeenCalledTimes(1);
    const [syncedPrefs, syncedTimestamp] = (syncMultiplePreferencesToCloud as any).mock.calls[0];
    expect(syncedPrefs.prayerCalculationMethod).toBe("MuslimWorldLeague");
    expect(syncedPrefs.fajrAngle).toBe("18");
    expect(syncedPrefs.ishaAngle).toBe("17");
    expect(typeof syncedTimestamp).toBe("number");
  });

  it("does not throw or run if calcMethod is invalid", async () => {
    await setAdhanLibraryDefaults(
      mockDbConnection,
      "" as any,
      mockSetUserPreferences,
      dictPreferencesDefaultValues,
      mockLocations,
    );

    expect(mockRun).not.toHaveBeenCalled();
    expect(syncMultiplePreferencesToCloud).not.toHaveBeenCalled();
  });

  it("does not throw or run if locations list is empty", async () => {
    await setAdhanLibraryDefaults(
      mockDbConnection,
      "MuslimWorldLeague",
      mockSetUserPreferences,
      dictPreferencesDefaultValues,
      [],
    );

    expect(mockRun).not.toHaveBeenCalled();
    expect(syncMultiplePreferencesToCloud).not.toHaveBeenCalled();
  });
});
