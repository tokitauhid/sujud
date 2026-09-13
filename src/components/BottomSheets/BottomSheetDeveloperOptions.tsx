import { useState, useEffect } from "react";
import { IonButton, IonModal } from "@ionic/react";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { AdhanAlarm, DeviceStatus } from "../../services/AdhanAlarm";
import { showToast, upperCaseFirstLetter } from "../../utils/helpers";
import {
  INITIAL_MODAL_BREAKPOINT,
  MODAL_BREAKPOINTS,
} from "../../utils/constants";

interface BottomSheetDeveloperOptionsProps {
  triggerId: string;
  onDisableDeveloperMode: () => void;
}

const BottomSheetDeveloperOptions = ({
  triggerId,
  onDisableDeveloperMode,
}: BottomSheetDeveloperOptionsProps) => {
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus | null>(null);
  const [activeTimerMsg, setActiveTimerMsg] = useState<string | null>(null);

  useEffect(() => {
    if (Capacitor.getPlatform() === "android") {
      AdhanAlarm.getDeviceStatus().then((status) => {
        setDeviceStatus(status);
      });
    }
  }, []);

  const handleScheduleTestAlarm = async (seconds: number) => {
    if (Capacitor.getPlatform() !== "android") {
      await showToast("Alarm scheduling is only available on Android", "short");
      return;
    }

    const triggerTime = Date.now() + seconds * 1000;
    try {
      await AdhanAlarm.scheduleAdhan({
        id: 9991,
        title: "Test Adhan Alarm",
        body: `Alarm Clock timer fired after ${seconds}s while locked!`,
        timestamp: triggerTime,
        sound: "adhan_fajr",
      });

      const formattedTime = new Date(triggerTime).toLocaleTimeString();
      setActiveTimerMsg(`Alarm scheduled for ${formattedTime} (${seconds}s). Lock device to test!`);
      await showToast(`Alarm armed for ${formattedTime}. Lock device now!`, "long");
    } catch (e: any) {
      await showToast(`Error: ${e.message || String(e)}`, "long");
    }
  };

  const handleCancelTestAlarm = async () => {
    if (Capacitor.getPlatform() === "android") {
      await AdhanAlarm.cancelAdhan({ id: 9991 });
      setActiveTimerMsg(null);
      await showToast("Test alarms cancelled", "short");
    }
  };

  const ensureNotificationPermission = async () => {
    try {
      const perm = await LocalNotifications.checkPermissions();
      if (perm.display !== "granted") {
        const req = await LocalNotifications.requestPermissions();
        return req.display === "granted";
      }
      return true;
    } catch {
      return true;
    }
  };

  const handleSendImmediateNotification = async () => {
    try {
      const granted = await ensureNotificationPermission();
      if (!granted) {
        await showToast("Notification permission not granted", "short");
        return;
      }

      await LocalNotifications.createChannel({
        id: "salah-reminders-without-adhan",
        name: "Salah reminders without adhan",
        importance: 4,
        description: "Salah reminders",
        sound: "default",
        visibility: 1,
        vibration: true,
      });

      const notifId = Math.floor(Date.now() % 100000);
      await LocalNotifications.schedule({
        notifications: [
          {
            id: notifId,
            title: "Sujud Test Notification",
            body: "This is a direct standard notification test.",
            channelId: "salah-reminders-without-adhan",
            sound: "default",
          },
        ],
      });
      await showToast("Immediate notification dispatched!", "short");
    } catch (e: any) {
      await showToast(`Notification error: ${e.message || String(e)}`, "short");
    }
  };

  const handleSendDelayedNotification = async (seconds: number) => {
    try {
      const granted = await ensureNotificationPermission();
      if (!granted) {
        await showToast("Notification permission not granted", "short");
        return;
      }

      await LocalNotifications.createChannel({
        id: "salah-reminders-without-adhan",
        name: "Salah reminders without adhan",
        importance: 4,
        description: "Salah reminders",
        sound: "default",
        visibility: 1,
        vibration: true,
      });

      const notifId = Math.floor(Date.now() % 100000);
      await LocalNotifications.schedule({
        notifications: [
          {
            id: notifId,
            title: `Sujud Delayed (${seconds}s)`,
            body: `Standard notification fired after ${seconds} seconds.`,
            channelId: "salah-reminders-without-adhan",
            sound: "default",
            schedule: {
              at: new Date(Date.now() + seconds * 1000),
              allowWhileIdle: true,
            },
          },
        ],
      });
      await showToast(`Notification scheduled in ${seconds}s (you can lock screen)`, "short");
    } catch (e: any) {
      await showToast(`Notification error: ${e.message || String(e)}`, "short");
    }
  };

  const handleSendSalahTestNotification = async (
    salah: "fajr" | "sunrise" | "dhuhr" | "asr" | "maghrib" | "isha",
    mode: "standard" | "adhan",
  ) => {
    try {
      const granted = await ensureNotificationPermission();
      if (!granted) {
        await showToast("Notification permission not granted", "short");
        return;
      }

      const salahTitle = upperCaseFirstLetter(salah);
      const salahBody =
        salah === "sunrise"
          ? "The sun is rising!"
          : `It's time to pray ${salahTitle}`;

      if (mode === "adhan" && Capacitor.getPlatform() === "android") {
        await AdhanAlarm.testAdhan({ sound: salah === "fajr" ? "adhan_fajr" : "adhan" });
        await showToast(`Playing ${salahTitle} Adhan audio service`, "short");
        return;
      }

      const channelId =
        mode === "adhan" && salah === "fajr"
          ? "fajr-reminder-with-adhan"
          : mode === "adhan" && salah !== "sunrise"
            ? "dhuhr-asr-maghrib-isha-reminders-with-adhan"
            : "salah-reminders-without-adhan";

      const sound =
        mode === "adhan"
          ? salah === "fajr"
            ? "adhan_fajr.mp3"
            : "adhan.mp3"
          : "default";

      await LocalNotifications.createChannel({
        id: channelId,
        name: `${salahTitle} Reminders`,
        importance: 4,
        description: `Notification alerts for ${salahTitle}`,
        sound: sound,
        visibility: 1,
        vibration: true,
      });

      const notifId = Math.floor(Date.now() % 100000);
      await LocalNotifications.schedule({
        notifications: [
          {
            id: notifId,
            title: salahTitle,
            body: salahBody,
            channelId: channelId,
            sound: sound,
          },
        ],
      });

      await showToast(`Sent ${salahTitle} test notification!`, "short");
    } catch (e: any) {
      await showToast(`Error: ${e.message || String(e)}`, "short");
    }
  };

  return (
    <IonModal
      mode="ios"
      expandToScroll={true}
      className="modal-fit-content"
      trigger={triggerId}
      initialBreakpoint={INITIAL_MODAL_BREAKPOINT}
      breakpoints={MODAL_BREAKPOINTS}
    >
      <section className="py-8 px-4 font-sans max-h-[85vh] overflow-y-auto text-white">
        <div className="flex items-center justify-between pb-3 border-b border-[#2A2A2A] mb-4">
          <div>
            <h2 className="text-base font-mono font-semibold text-[#F59E0B] tracking-wide">
              DEVELOPER OPTIONS
            </h2>
            <p className="text-xs font-mono text-[#71717A] mt-0.5">
              Diagnostics & background notification testing
            </p>
          </div>
          <span className="text-[10px] font-mono bg-[#F59E0B]/20 text-[#F59E0B] px-2 py-0.5 border border-[#F59E0B]/40">
            DEBUG
          </span>
        </div>

        {/* 1. ADHAN AUDIO SERVICE TEST */}
        <div className="mb-5 p-3.5 bg-[#141414] border border-[#242424] rounded-none">
          <p className="text-xs font-mono font-medium text-white mb-1 uppercase tracking-wider">
            1. Adhan Audio Playback (Foreground Service)
          </p>
          <p className="text-[11px] font-mono text-[#71717A] mb-3 leading-relaxed">
            Plays through native MediaPlayer on <code className="text-[#38BDF8]">USAGE_ALARM</code> stream with lockscreen Stop action.
          </p>
          <div className="flex flex-wrap gap-2">
            <IonButton
              size="small"
              onClick={async () => {
                await AdhanAlarm.testAdhan({ sound: "adhan" });
                await showToast("Testing Regular Adhan audio", "short");
              }}
            >
              Play Regular Adhan
            </IonButton>
            <IonButton
              size="small"
              fill="outline"
              onClick={async () => {
                await AdhanAlarm.testAdhan({ sound: "adhan_fajr" });
                await showToast("Testing Fajr Adhan audio", "short");
              }}
            >
              Play Fajr Adhan
            </IonButton>
            <IonButton
              size="small"
              color="danger"
              fill="clear"
              onClick={async () => {
                await AdhanAlarm.stopAdhan();
                await showToast("Adhan stopped", "short");
              }}
            >
              Stop Audio
            </IonButton>
          </div>
        </div>

        {/* 2. ALARM CLOCK TIMER TEST (LOCK SCREEN TEST) */}
        <div className="mb-5 p-3.5 bg-[#141414] border border-[#242424] rounded-none">
          <p className="text-xs font-mono font-medium text-white mb-1 uppercase tracking-wider">
            2. Scheduled AlarmClock Test (Wake From Sleep)
          </p>
          <p className="text-[11px] font-mono text-[#71717A] mb-3 leading-relaxed">
            Uses <code className="text-[#38BDF8]">AlarmManager.setAlarmClock()</code>. Tap a timer, lock the screen, and verify it wakes the device.
          </p>
          {activeTimerMsg && (
            <div className="p-2 mb-3 bg-[#F59E0B]/10 border border-[#F59E0B]/40 text-[#F59E0B] text-xs font-mono">
              ⏰ {activeTimerMsg}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <IonButton
              size="small"
              fill="outline"
              onClick={() => handleScheduleTestAlarm(10)}
            >
              10s Timer
            </IonButton>
            <IonButton
              size="small"
              fill="outline"
              onClick={() => handleScheduleTestAlarm(30)}
            >
              30s Timer
            </IonButton>
            <IonButton
              size="small"
              fill="outline"
              onClick={() => handleScheduleTestAlarm(60)}
            >
              1m Timer
            </IonButton>
            <IonButton
              size="small"
              color="danger"
              fill="clear"
              onClick={handleCancelTestAlarm}
            >
              Cancel Alarms
            </IonButton>
          </div>
        </div>

        {/* 3. SALAH TIME NOTIFICATION TESTING */}
        <div className="mb-5 p-3.5 bg-[#141414] border border-[#242424] rounded-none">
          <p className="text-xs font-mono font-medium text-white mb-1 uppercase tracking-wider">
            3. Salah Time Notification Testing
          </p>
          <p className="text-[11px] font-mono text-[#71717A] mb-3 leading-relaxed">
            Immediately fires the real notification for each specific Salah using its designated channel & format.
          </p>

          <div className="text-[10px] font-mono text-[#A1A1AA] uppercase tracking-wider mb-1.5">
            Standard Banner Alerts:
          </div>
          <div className="flex flex-wrap gap-2 mb-3">
            {(["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"] as const).map((salah) => (
              <IonButton
                key={salah}
                size="small"
                fill="outline"
                onClick={() => handleSendSalahTestNotification(salah, "standard")}
              >
                {upperCaseFirstLetter(salah)}
              </IonButton>
            ))}
          </div>

          <div className="text-[10px] font-mono text-[#D4AF37] uppercase tracking-wider mb-1.5">
            With Adhan Sound (Native Service):
          </div>
          <div className="flex flex-wrap gap-2">
            {(["fajr", "dhuhr", "asr", "maghrib", "isha"] as const).map((salah) => (
              <IonButton
                key={salah}
                size="small"
                fill="solid"
                onClick={() => handleSendSalahTestNotification(salah, "adhan")}
              >
                {upperCaseFirstLetter(salah)} Adhan
              </IonButton>
            ))}
          </div>
        </div>

        {/* 4. GENERIC LOCAL NOTIFICATIONS TEST */}
        <div className="mb-5 p-3.5 bg-[#141414] border border-[#242424] rounded-none">
          <p className="text-xs font-mono font-medium text-white mb-1 uppercase tracking-wider">
            4. Generic Local Notifications
          </p>
          <p className="text-[11px] font-mono text-[#71717A] mb-3 leading-relaxed">
            Tests Capacitor LocalNotifications delivery mechanism and background dispatch.
          </p>
          <div className="flex flex-wrap gap-2">
            <IonButton
              size="small"
              fill="outline"
              onClick={handleSendImmediateNotification}
            >
              Send Immediate
            </IonButton>
            <IonButton
              size="small"
              fill="outline"
              onClick={() => handleSendDelayedNotification(5)}
            >
              5s Delay
            </IonButton>
            <IonButton
              size="small"
              fill="outline"
              onClick={() => handleSendDelayedNotification(10)}
            >
              10s Delay
            </IonButton>
          </div>
        </div>

        {/* 4. DEVICE DIAGNOSTICS */}
        <div className="mb-5 p-3.5 bg-[#141414] border border-[#242424] rounded-none">
          <p className="text-xs font-mono font-medium text-white mb-2 uppercase tracking-wider">
            4. Device & System Diagnostics
          </p>
          <div className="text-[11px] font-mono space-y-1.5 mb-3 text-[#A1A1AA]">
            <div className="flex justify-between py-1 border-b border-[#222]">
              <span>Manufacturer:</span>
              <span className="text-white font-medium">{deviceStatus?.manufacturer || "Web / Other"}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#222]">
              <span>HyperOS / Xiaomi:</span>
              <span className={deviceStatus?.isXiaomi ? "text-[#10B981]" : "text-[#71717A]"}>
                {deviceStatus?.isXiaomi ? "Detected (HyperOS/MIUI)" : "No"}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#222]">
              <span>Exact Alarm Permission:</span>
              <span className={deviceStatus?.canScheduleExactAlarms ? "text-[#10B981]" : "text-[#EF4444]"}>
                {deviceStatus?.canScheduleExactAlarms ? "Granted" : "Denied"}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#222]">
              <span>Battery Optimization:</span>
              <span className={deviceStatus?.isIgnoringBatteryOptimizations ? "text-[#10B981]" : "text-[#EF4444]"}>
                {deviceStatus?.isIgnoringBatteryOptimizations ? "Unrestricted" : "Optimized (Restricted)"}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2 mt-2">
            {deviceStatus?.isXiaomi && (
              <IonButton
                size="small"
                fill="outline"
                onClick={async () => {
                  await AdhanAlarm.openAutostartSettings();
                }}
              >
                Open Xiaomi Autostart
              </IonButton>
            )}
            <IonButton
              size="small"
              fill="outline"
              onClick={async () => {
                await AdhanAlarm.openBatterySaverSettings();
              }}
            >
              Open Battery Saver Settings
            </IonButton>
            <IonButton
              size="small"
              fill="outline"
              onClick={async () => {
                await AdhanAlarm.openExactAlarmSettings();
              }}
            >
              Open Exact Alarm Settings
            </IonButton>
          </div>
        </div>

        {/* 5. DISABLE DEVELOPER OPTIONS */}
        <div className="pt-2 border-t border-[#242424] flex justify-center">
          <IonButton
            size="small"
            color="medium"
            fill="clear"
            onClick={onDisableDeveloperMode}
          >
            Turn Off Developer Options
          </IonButton>
        </div>
      </section>
    </IonModal>
  );
};

export default BottomSheetDeveloperOptions;
