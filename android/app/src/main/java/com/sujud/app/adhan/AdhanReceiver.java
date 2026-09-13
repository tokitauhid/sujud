package com.sujud.app.adhan;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.PowerManager;
import androidx.core.content.ContextCompat;

public class AdhanReceiver extends BroadcastReceiver {
    public static final String ACTION_TRIGGER_ADHAN = "com.sujud.app.ACTION_TRIGGER_ADHAN";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;

        PowerManager powerManager = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        PowerManager.WakeLock wakeLock = null;
        if (powerManager != null) {
            wakeLock = powerManager.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK,
                "Sujud:AdhanWakeLock"
            );
            wakeLock.acquire(15000); // Hold for 15 seconds max while service spins up
        }

        Intent serviceIntent = new Intent(context, AdhanService.class);
        serviceIntent.setAction(AdhanService.ACTION_START_ADHAN);
        serviceIntent.putExtra("id", intent.getIntExtra("id", 0));
        serviceIntent.putExtra("title", intent.getStringExtra("title"));
        serviceIntent.putExtra("body", intent.getStringExtra("body"));
        serviceIntent.putExtra("sound", intent.getStringExtra("sound"));

        try {
            ContextCompat.startForegroundService(context, serviceIntent);
        } catch (Exception e) {
            e.printStackTrace();
        } finally {
            if (wakeLock != null && wakeLock.isHeld()) {
                try {
                    wakeLock.release();
                } catch (Exception ignored) {}
            }
        }
    }
}
