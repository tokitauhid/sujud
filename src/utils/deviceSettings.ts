/**
 * Device-Specific Settings Management (Bug 6)
 *
 * Settings are synchronized only during initial setup of a device.
 * After initial setup is complete, settings remain strictly local to each device.
 * Changing a setting on Device A does not modify Device B, and vice versa.
 */

export const INITIAL_SETTINGS_SETUP_KEY = "hasCompletedInitialSettingsSync";

/**
 * Checks whether this device has completed its initial settings setup/sync.
 */
export const isInitialSettingsSetupCompleted = (): boolean => {
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      return false;
    }
    return window.localStorage.getItem(INITIAL_SETTINGS_SETUP_KEY) === "true";
  } catch {
    return false;
  }
};

/**
 * Marks that initial settings setup has completed on this device.
 * From this point onward, settings updates remain strictly local to this device.
 */
export const markInitialSettingsSetupCompleted = (): void => {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(INITIAL_SETTINGS_SETUP_KEY, "true");
    }
  } catch (e) {
    console.error("[DEVICE_SETTINGS] Failed to mark initial setup completed:", e);
  }
};

/**
 * Resets the initial settings setup state (e.g. for testing or app reinitialization).
 */
export const resetInitialSettingsSetup = (): void => {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.removeItem(INITIAL_SETTINGS_SETUP_KEY);
    }
  } catch (e) {
    console.error("[DEVICE_SETTINGS] Failed to reset initial setup:", e);
  }
};
