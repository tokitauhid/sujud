import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isInitialSettingsSetupCompleted,
  markInitialSettingsSetupCompleted,
  resetInitialSettingsSetup,
  INITIAL_SETTINGS_SETUP_KEY,
} from "./deviceSettings";
import { updateUserPrefs, setAdhanLibraryDefaults } from "./helpers";
import { syncPreferenceToCloud, syncMultiplePreferencesToCloud } from "../firebase/syncService";
import { dictPreferencesDefaultValues } from "./constants";
import { LocationsDataObjTypeArr } from "../types/types";

vi.mock("../firebase/syncService", () => ({
  syncPreferenceToCloud: vi.fn(),
  syncMultiplePreferencesToCloud: vi.fn(),
}));

describe("deviceSettings lifecycle and sync gating (Bug 6)", () => {
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
    localStorage.clear();
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

  it("reports not completed by default, completed after mark, not completed after reset", () => {
    expect(isInitialSettingsSetupCompleted()).toBe(false);
    expect(localStorage.getItem(INITIAL_SETTINGS_SETUP_KEY)).toBeNull();

    markInitialSettingsSetupCompleted();
    expect(isInitialSettingsSetupCompleted()).toBe(true);
    expect(localStorage.getItem(INITIAL_SETTINGS_SETUP_KEY)).toBe("true");

    resetInitialSettingsSetup();
    expect(isInitialSettingsSetupCompleted()).toBe(false);
    expect(localStorage.getItem(INITIAL_SETTINGS_SETUP_KEY)).toBeNull();
  });

  it("updateUserPrefs syncs to cloud during initial setup", async () => {
    resetInitialSettingsSetup();
    expect(isInitialSettingsSetupCompleted()).toBe(false);

    await updateUserPrefs(
      mockDbConnection,
      "prayerCalculationMethod",
      "Karachi",
      mockSetUserPreferences
    );

    expect(mockRun).toHaveBeenCalled();
    expect(mockSetUserPreferences).toHaveBeenCalled();
    expect(syncPreferenceToCloud).toHaveBeenCalledTimes(1);
    expect(syncPreferenceToCloud).toHaveBeenCalledWith(
      "prayerCalculationMethod",
      "Karachi",
      expect.any(Number)
    );
  });

  it("updateUserPrefs does NOT sync to cloud after initial setup is completed", async () => {
    markInitialSettingsSetupCompleted();
    expect(isInitialSettingsSetupCompleted()).toBe(true);

    await updateUserPrefs(
      mockDbConnection,
      "prayerCalculationMethod",
      "NorthAmerica",
      mockSetUserPreferences
    );

    expect(mockRun).toHaveBeenCalled();
    expect(mockSetUserPreferences).toHaveBeenCalled();
    expect(syncPreferenceToCloud).not.toHaveBeenCalled();
  });

  it("setAdhanLibraryDefaults syncs to cloud during initial setup", async () => {
    resetInitialSettingsSetup();
    expect(isInitialSettingsSetupCompleted()).toBe(false);

    await setAdhanLibraryDefaults(
      mockDbConnection,
      "MuslimWorldLeague",
      mockSetUserPreferences,
      dictPreferencesDefaultValues,
      mockLocations
    );

    expect(syncMultiplePreferencesToCloud).toHaveBeenCalledTimes(1);
  });

  it("setAdhanLibraryDefaults does NOT sync to cloud after initial setup is completed", async () => {
    markInitialSettingsSetupCompleted();
    expect(isInitialSettingsSetupCompleted()).toBe(true);

    await setAdhanLibraryDefaults(
      mockDbConnection,
      "MuslimWorldLeague",
      mockSetUserPreferences,
      dictPreferencesDefaultValues,
      mockLocations
    );

    expect(mockRun).toHaveBeenCalled();
    expect(mockSetUserPreferences).toHaveBeenCalled();
    expect(syncMultiplePreferencesToCloud).not.toHaveBeenCalled();
  });
});
