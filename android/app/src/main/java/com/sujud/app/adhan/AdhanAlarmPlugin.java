package com.sujud.app.adhan;

import android.app.AlarmManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "AdhanAlarm")
public class AdhanAlarmPlugin extends Plugin {

    @PluginMethod
    public void scheduleAdhan(PluginCall call) {
        Integer id = null;
        Object rawId = call.getData().opt("id");
        if (rawId instanceof Number) {
            id = ((Number) rawId).intValue();
        }

        Long timestamp = null;
        Object rawTs = call.getData().opt("timestamp");
        if (rawTs instanceof Number) {
            timestamp = ((Number) rawTs).longValue();
        }

        String title = call.getString("title", "Salah Time");
        String body = call.getString("body", "It's time to pray");
        String sound = call.getString("sound", "adhan");

        if (id == null || timestamp == null) {
            call.reject("Must provide id and timestamp");
            return;
        }

        AdhanScheduler.scheduleAdhan(getContext(), id, title, body, timestamp, sound);
        call.resolve();
    }

    @PluginMethod
    public void cancelAdhan(PluginCall call) {
        Integer id = null;
        Object rawId = call.getData().opt("id");
        if (rawId instanceof Number) {
            id = ((Number) rawId).intValue();
        }
        if (id == null) {
            call.reject("Must provide id");
            return;
        }
        AdhanScheduler.cancelAdhan(getContext(), id);
        call.resolve();
    }

    @PluginMethod
    public void cancelAll(PluginCall call) {
        AdhanScheduler.cancelAll(getContext());
        call.resolve();
    }

    @PluginMethod
    public void stopAdhan(PluginCall call) {
        Intent intent = new Intent(getContext(), AdhanService.class);
        intent.setAction(AdhanService.ACTION_STOP_ADHAN);
        getContext().startService(intent);
        call.resolve();
    }

    @PluginMethod
    public void testAdhan(PluginCall call) {
        String sound = call.getString("sound", "adhan");
        Intent serviceIntent = new Intent(getContext(), AdhanService.class);
        serviceIntent.setAction(AdhanService.ACTION_START_ADHAN);
        serviceIntent.putExtra("id", 9999);
        serviceIntent.putExtra("title", "Test Adhan Alert");
        serviceIntent.putExtra("body", "Testing high-reliability Adhan audio playback");
        serviceIntent.putExtra("sound", sound);

        try {
            ContextCompat.startForegroundService(getContext(), serviceIntent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to start test adhan: " + e.getMessage());
        }
    }

    @PluginMethod
    public void openAutostartSettings(PluginCall call) {
        Context context = getContext();
        String manufacturer = Build.MANUFACTURER.toLowerCase();
        Intent intent = new Intent();
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

        boolean customIntentFound = false;
        if (manufacturer.contains("xiaomi") || manufacturer.contains("redmi") || manufacturer.contains("poco")) {
            intent.setComponent(new ComponentName(
                "com.miui.securitycenter",
                "com.miui.permcenter.autostart.AutoStartManagementActivity"
            ));
            customIntentFound = true;
        } else if (manufacturer.contains("oppo") || manufacturer.contains("realme")) {
            intent.setComponent(new ComponentName(
                "com.coloros.safecenter",
                "com.coloros.safecenter.permission.startup.StartupAppListActivity"
            ));
            customIntentFound = true;
        } else if (manufacturer.contains("vivo") || manufacturer.contains("iqoo")) {
            intent.setComponent(new ComponentName(
                "com.iqoo.secure",
                "com.iqoo.secure.ui.phoneoptimize.AddWhiteListActivity"
            ));
            customIntentFound = true;
        } else if (manufacturer.contains("huawei") || manufacturer.contains("honor")) {
            intent.setComponent(new ComponentName(
                "com.huawei.systemmanager",
                "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity"
            ));
            customIntentFound = true;
        }

        try {
            if (customIntentFound) {
                context.startActivity(intent);
                call.resolve(new JSObject().put("success", true));
                return;
            }
        } catch (Exception ignored) {}

        // Fallback to app details settings
        try {
            Intent fallback = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            fallback.setData(Uri.parse("package:" + context.getPackageName()));
            fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(fallback);
            call.resolve(new JSObject().put("success", true));
        } catch (Exception e) {
            call.reject("Could not open settings: " + e.getMessage());
        }
    }

    @PluginMethod
    public void openBatterySaverSettings(PluginCall call) {
        Context context = getContext();
        String manufacturer = Build.MANUFACTURER.toLowerCase();
        Intent intent = new Intent();
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

        boolean customIntentFound = false;
        if (manufacturer.contains("xiaomi") || manufacturer.contains("redmi") || manufacturer.contains("poco")) {
            intent.setComponent(new ComponentName(
                "com.miui.powerkeeper",
                "com.miui.powerkeeper.ui.HiddenAppsConfigActivity"
            ));
            intent.putExtra("package_name", context.getPackageName());
            intent.putExtra("package_label", context.getApplicationInfo().loadLabel(context.getPackageManager()));
            customIntentFound = true;
        }

        try {
            if (customIntentFound) {
                context.startActivity(intent);
                call.resolve(new JSObject().put("success", true));
                return;
            }
        } catch (Exception ignored) {}

        // Fallback to standard ignore battery optimizations
        try {
            Intent fallback = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
            fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(fallback);
            call.resolve(new JSObject().put("success", true));
        } catch (Exception ignored) {
            Intent appDetails = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            appDetails.setData(Uri.parse("package:" + context.getPackageName()));
            appDetails.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(appDetails);
            call.resolve(new JSObject().put("success", true));
        }
    }

    @PluginMethod
    public void openExactAlarmSettings(PluginCall call) {
        Context context = getContext();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            try {
                Intent intent = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM);
                intent.setData(Uri.parse("package:" + context.getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(intent);
                call.resolve(new JSObject().put("success", true));
                return;
            } catch (Exception ignored) {}
        }
        call.resolve(new JSObject().put("success", false));
    }

    @PluginMethod
    public void getDeviceStatus(PluginCall call) {
        Context context = getContext();
        String manufacturer = Build.MANUFACTURER;
        boolean isXiaomi = manufacturer.toLowerCase().contains("xiaomi")
            || manufacturer.toLowerCase().contains("redmi")
            || manufacturer.toLowerCase().contains("poco");

        boolean canScheduleExact = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (alarmManager != null) {
                canScheduleExact = alarmManager.canScheduleExactAlarms();
            }
        }

        PowerManager powerManager = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        boolean isIgnoringBattery = false;
        if (powerManager != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            isIgnoringBattery = powerManager.isIgnoringBatteryOptimizations(context.getPackageName());
        }

        JSObject ret = new JSObject();
        ret.put("manufacturer", manufacturer);
        ret.put("isXiaomi", isXiaomi);
        ret.put("canScheduleExactAlarms", canScheduleExact);
        ret.put("isIgnoringBatteryOptimizations", isIgnoringBattery);
        call.resolve(ret);
    }
}
