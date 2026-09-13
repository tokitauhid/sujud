package com.sujud.app.adhan;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import com.sujud.app.MainActivity;
import com.sujud.app.R;

public class AdhanService extends Service {
    public static final String ACTION_START_ADHAN = "com.sujud.app.ACTION_START_ADHAN";
    public static final String ACTION_STOP_ADHAN = "com.sujud.app.ACTION_STOP_ADHAN";

    public static final String CHANNEL_ID = "adhan_playback_channel_v1";
    public static final int NOTIFICATION_ID = 99901;

    private MediaPlayer mediaPlayer;
    private PowerManager.WakeLock wakeLock;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();

        PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (powerManager != null) {
            wakeLock = powerManager.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK,
                "Sujud:AdhanServiceWakeLock"
            );
            wakeLock.acquire(4 * 60 * 1000L); // 4 minutes max for full adhan
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) {
            stopAdhan();
            return START_NOT_STICKY;
        }

        String action = intent.getAction();
        if (ACTION_STOP_ADHAN.equals(action)) {
            stopAdhan();
            return START_NOT_STICKY;
        }

        if (ACTION_START_ADHAN.equals(action)) {
            String title = intent.getStringExtra("title");
            String body = intent.getStringExtra("body");
            String sound = intent.getStringExtra("sound");

            startForegroundWithNotification(
                title != null ? title : "Salah Time",
                body != null ? body : "Adhan is playing..."
            );

            playAdhanSound(sound);
            return START_NOT_STICKY;
        }

        return START_NOT_STICKY;
    }

    private void startForegroundWithNotification(String title, String body) {
        Intent stopIntent = new Intent(this, AdhanService.class);
        stopIntent.setAction(ACTION_STOP_ADHAN);

        int pendingFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            pendingFlags |= PendingIntent.FLAG_IMMUTABLE;
        }

        PendingIntent stopPendingIntent = PendingIntent.getService(this, 1, stopIntent, pendingFlags);

        Intent openAppIntent = new Intent(this, MainActivity.class);
        openAppIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent openAppPendingIntent = PendingIntent.getActivity(this, 0, openAppIntent, pendingFlags);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(body)
            .setSubText("Adhan Playing")
            .setOngoing(true)
            .setAutoCancel(false)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setContentIntent(openAppPendingIntent)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Stop Adhan", stopPendingIntent);

        Notification notification = builder.build();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
    }

    private void playAdhanSound(String sound) {
        stopMediaPlayer();

        int soundResId = R.raw.adhan;
        if (sound != null && sound.toLowerCase().contains("fajr")) {
            soundResId = R.raw.adhan_fajr;
        }

        try {
            mediaPlayer = MediaPlayer.create(
                this,
                soundResId,
                new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                    .build(),
                0
            );

            if (mediaPlayer == null) {
                mediaPlayer = MediaPlayer.create(this, soundResId);
            }

            if (mediaPlayer != null) {
                mediaPlayer.setWakeMode(getApplicationContext(), PowerManager.PARTIAL_WAKE_LOCK);
                mediaPlayer.setOnCompletionListener(mp -> stopAdhan());
                mediaPlayer.setOnErrorListener((mp, what, extra) -> {
                    stopAdhan();
                    return true;
                });
                mediaPlayer.start();
            } else {
                stopAdhan();
            }
        } catch (Exception e) {
            e.printStackTrace();
            stopAdhan();
        }
    }

    private void stopMediaPlayer() {
        if (mediaPlayer != null) {
            try {
                if (mediaPlayer.isPlaying()) {
                    mediaPlayer.stop();
                }
                mediaPlayer.reset();
                mediaPlayer.release();
            } catch (Exception ignored) {}
            mediaPlayer = null;
        }
    }

    private void stopAdhan() {
        stopMediaPlayer();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE);
        } else {
            stopForeground(true);
        }
        stopSelf();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager != null) {
                NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Adhan Audio Playback",
                    NotificationManager.IMPORTANCE_HIGH
                );
                channel.setDescription("Foreground service for playing Adhan audio alerts");
                channel.setSound(null, null); // Handled by MediaPlayer
                channel.enableVibration(true);
                channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    channel.setBypassDnd(true);
                }
                manager.createNotificationChannel(channel);
            }
        }
    }

    @Override
    public void onDestroy() {
        stopMediaPlayer();
        if (wakeLock != null && wakeLock.isHeld()) {
            try {
                wakeLock.release();
            } catch (Exception ignored) {}
        }
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
