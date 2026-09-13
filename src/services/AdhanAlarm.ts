import { registerPlugin, Capacitor } from "@capacitor/core";

export interface DeviceStatus {
  manufacturer: string;
  isXiaomi: boolean;
  canScheduleExactAlarms: boolean;
  isIgnoringBatteryOptimizations: boolean;
}

export interface AdhanAlarmPlugin {
  scheduleAdhan(options: {
    id: number;
    title: string;
    body: string;
    timestamp: number; // Unix epoch ms
    sound?: string; // "adhan" | "adhan_fajr"
  }): Promise<void>;

  cancelAdhan(options: { id: number }): Promise<void>;

  cancelAll(): Promise<void>;

  stopAdhan(): Promise<void>;

  testAdhan(options?: { sound?: string }): Promise<void>;

  openAutostartSettings(): Promise<{ success: boolean }>;

  openBatterySaverSettings(): Promise<{ success: boolean }>;

  openExactAlarmSettings(): Promise<{ success: boolean }>;

  getDeviceStatus(): Promise<DeviceStatus>;
}

const AdhanAlarmNative = registerPlugin<AdhanAlarmPlugin>("AdhanAlarm", {
  web: {
    scheduleAdhan: async () => {},
    cancelAdhan: async () => {},
    cancelAll: async () => {},
    stopAdhan: async () => {},
    testAdhan: async () => {
      console.log("[AdhanAlarm Web Mock] Playing test adhan");
    },
    openAutostartSettings: async () => ({ success: false }),
    openBatterySaverSettings: async () => ({ success: false }),
    openExactAlarmSettings: async () => ({ success: false }),
    getDeviceStatus: async () => ({
      manufacturer: "Web",
      isXiaomi: false,
      canScheduleExactAlarms: true,
      isIgnoringBatteryOptimizations: true,
    }),
  },
});

export const AdhanAlarm: AdhanAlarmPlugin = {
  scheduleAdhan: async (options) => {
    if (Capacitor.getPlatform() === "android") {
      return AdhanAlarmNative.scheduleAdhan(options);
    }
  },
  cancelAdhan: async (options) => {
    if (Capacitor.getPlatform() === "android") {
      return AdhanAlarmNative.cancelAdhan(options);
    }
  },
  cancelAll: async () => {
    if (Capacitor.getPlatform() === "android") {
      return AdhanAlarmNative.cancelAll();
    }
  },
  stopAdhan: async () => {
    if (Capacitor.getPlatform() === "android") {
      return AdhanAlarmNative.stopAdhan();
    }
  },
  testAdhan: async (options) => {
    if (Capacitor.getPlatform() === "android") {
      return AdhanAlarmNative.testAdhan(options);
    } else {
      console.log("[AdhanAlarm Web] Test adhan triggered");
    }
  },
  openAutostartSettings: async () => {
    if (Capacitor.getPlatform() === "android") {
      return AdhanAlarmNative.openAutostartSettings();
    }
    return { success: false };
  },
  openBatterySaverSettings: async () => {
    if (Capacitor.getPlatform() === "android") {
      return AdhanAlarmNative.openBatterySaverSettings();
    }
    return { success: false };
  },
  openExactAlarmSettings: async () => {
    if (Capacitor.getPlatform() === "android") {
      return AdhanAlarmNative.openExactAlarmSettings();
    }
    return { success: false };
  },
  getDeviceStatus: async () => {
    if (Capacitor.getPlatform() === "android") {
      return AdhanAlarmNative.getDeviceStatus();
    }
    return {
      manufacturer: "Browser",
      isXiaomi: false,
      canScheduleExactAlarms: true,
      isIgnoringBatteryOptimizations: true,
    };
  },
};
