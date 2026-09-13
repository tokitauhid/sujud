package com.sujud.app.adhan;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import com.sujud.app.MainActivity;
import java.util.HashSet;
import java.util.Set;

public class AdhanScheduler {
    private static final String PREFS_NAME = "sujud_adhan_alarms";
    private static final String KEY_SCHEDULED_IDS = "scheduled_ids";

    public static void scheduleAdhan(Context context, int id, String title, String body, long timestampMs, String sound) {
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager == null) return;

        Intent intent = new Intent(context, AdhanReceiver.class);
        intent.setAction(AdhanReceiver.ACTION_TRIGGER_ADHAN);
        intent.putExtra("id", id);
        intent.putExtra("title", title);
        intent.putExtra("body", body);
        intent.putExtra("sound", sound);

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }

        PendingIntent pendingIntent = PendingIntent.getBroadcast(context, id, intent, flags);

        Intent showIntent = new Intent(context, MainActivity.class);
        PendingIntent showPendingIntent = PendingIntent.getActivity(context, id, showIntent, flags);

        AlarmManager.AlarmClockInfo alarmClockInfo = new AlarmManager.AlarmClockInfo(timestampMs, showPendingIntent);
        alarmManager.setAlarmClock(alarmClockInfo, pendingIntent);

        saveScheduledId(context, id);
    }

    public static void cancelAdhan(Context context, int id) {
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager == null) return;

        Intent intent = new Intent(context, AdhanReceiver.class);
        intent.setAction(AdhanReceiver.ACTION_TRIGGER_ADHAN);

        int flags = PendingIntent.FLAG_NO_CREATE;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }

        PendingIntent pendingIntent = PendingIntent.getBroadcast(context, id, intent, flags);
        if (pendingIntent != null) {
            alarmManager.cancel(pendingIntent);
            pendingIntent.cancel();
        }

        removeScheduledId(context, id);
    }

    public static void cancelAll(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        Set<String> ids = prefs.getStringSet(KEY_SCHEDULED_IDS, new HashSet<>());
        for (String idStr : new HashSet<>(ids)) {
            try {
                int id = Integer.parseInt(idStr);
                cancelAdhan(context, id);
            } catch (NumberFormatException ignored) {}
        }
        prefs.edit().clear().apply();
    }

    private static synchronized void saveScheduledId(Context context, int id) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        Set<String> ids = new HashSet<>(prefs.getStringSet(KEY_SCHEDULED_IDS, new HashSet<>()));
        ids.add(String.valueOf(id));
        prefs.edit().putStringSet(KEY_SCHEDULED_IDS, ids).apply();
    }

    private static synchronized void removeScheduledId(Context context, int id) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        Set<String> ids = new HashSet<>(prefs.getStringSet(KEY_SCHEDULED_IDS, new HashSet<>()));
        ids.remove(String.valueOf(id));
        prefs.edit().putStringSet(KEY_SCHEDULED_IDS, ids).apply();
    }
}
