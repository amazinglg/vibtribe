package app.vibtribe.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.IBinder;
import androidx.core.app.NotificationCompat;

/**
 * Foreground service that keeps the VibTribe process alive during an active
 * voice/video call and shows a persistent ongoing-call notification with
 * Mute / End actions. The action buttons launch MainActivity with URL
 * parameters that the JS CallProvider intercepts (?muteCall=ID, ?endCall=ID).
 *
 * Started via window.VtCall.start(...) from JS once the call reaches the
 * connected state; stopped via window.VtCall.stop().
 */
public class OngoingCallService extends Service {
    public static final String CHANNEL_ID = "vibtribe_ongoing_calls";
    public static final int NOTIFICATION_ID = 78321;

    public static final String ACTION_START  = "app.vibtribe.app.CALL_ONGOING_START";
    public static final String ACTION_UPDATE = "app.vibtribe.app.CALL_ONGOING_UPDATE";
    public static final String ACTION_STOP   = "app.vibtribe.app.CALL_ONGOING_STOP";

    public static final String EXTRA_CALL_ID     = "callId";
    public static final String EXTRA_CHAT_ID     = "chatId";
    public static final String EXTRA_CALLER_NAME = "callerName";
    public static final String EXTRA_CALL_TYPE   = "callType";
    public static final String EXTRA_MUTED       = "muted";

    private String callId;
    private String chatId;
    private String callerName;
    private String callType;
    private boolean muted;

    @Override
    public IBinder onBind(Intent intent) { return null; }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) return START_STICKY;
        String action = intent.getAction();
        if (ACTION_STOP.equals(action)) {
            stopForeground(true);
            stopSelf();
            return START_NOT_STICKY;
        }
        if (intent.hasExtra(EXTRA_CALL_ID))     callId     = intent.getStringExtra(EXTRA_CALL_ID);
        if (intent.hasExtra(EXTRA_CHAT_ID))     chatId     = intent.getStringExtra(EXTRA_CHAT_ID);
        if (intent.hasExtra(EXTRA_CALLER_NAME)) callerName = intent.getStringExtra(EXTRA_CALLER_NAME);
        if (intent.hasExtra(EXTRA_CALL_TYPE))   callType   = intent.getStringExtra(EXTRA_CALL_TYPE);
        if (intent.hasExtra(EXTRA_MUTED))       muted      = intent.getBooleanExtra(EXTRA_MUTED, false);

        createChannel();
        Notification n = buildNotification();
        if (ACTION_START.equals(action)) {
            int type = 0;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                type = android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE;
                if ("video".equals(callType)) {
                    type |= android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA;
                }
            }
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    startForeground(NOTIFICATION_ID, n, type);
                } else {
                    startForeground(NOTIFICATION_ID, n);
                }
            } catch (Exception e) {
                startForeground(NOTIFICATION_ID, n);
            }
        } else {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) nm.notify(NOTIFICATION_ID, n);
        }
        return START_STICKY;
    }

    private Notification buildNotification() {
        Context ctx = getApplicationContext();

        // Tapping the notification body → open the app back to the call UI.
        Intent openIntent = new Intent(ctx, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        openIntent.setAction(Intent.ACTION_VIEW);
        openIntent.setData(Uri.parse("https://www.vibtribe.in/?call=" + safe(callId)
                + (chatId != null && !chatId.isEmpty() ? "&chat=" + chatId : "")));
        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        PendingIntent openPI = PendingIntent.getActivity(ctx, 1001, openIntent, piFlags);

        Intent muteIntent = new Intent(ctx, MainActivity.class);
        muteIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        muteIntent.setAction(Intent.ACTION_VIEW);
        muteIntent.setData(Uri.parse("https://www.vibtribe.in/?muteCall=" + safe(callId)));
        PendingIntent mutePI = PendingIntent.getActivity(ctx, 1002, muteIntent, piFlags);

        Intent endIntent = new Intent(ctx, MainActivity.class);
        endIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        endIntent.setAction(Intent.ACTION_VIEW);
        endIntent.setData(Uri.parse("https://www.vibtribe.in/?endCall=" + safe(callId)));
        PendingIntent endPI = PendingIntent.getActivity(ctx, 1003, endIntent, piFlags);

        String title = ("video".equals(callType) ? "VibTribe video call" : "VibTribe voice call");
        String body  = (callerName == null || callerName.isEmpty()) ? "Ongoing call" : callerName;

        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, CHANNEL_ID)
                .setSmallIcon(getApplicationInfo().icon)
                .setContentTitle(title)
                .setContentText(body)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setUsesChronometer(true)
                .setContentIntent(openPI)
                .addAction(
                        muted ? android.R.drawable.ic_lock_silent_mode_off
                              : android.R.drawable.ic_lock_silent_mode,
                        muted ? "Unmute" : "Mute",
                        mutePI)
                .addAction(android.R.drawable.ic_menu_close_clear_cancel, "End", endPI);
        return b.build();
    }

    private static String safe(String s) { return s == null ? "" : s; }

    private void createChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null || nm.getNotificationChannel(CHANNEL_ID) != null) return;
        NotificationChannel ch = new NotificationChannel(
                CHANNEL_ID, "Ongoing calls", NotificationManager.IMPORTANCE_LOW);
        ch.setDescription("Persistent notification for active VibTribe calls");
        ch.setShowBadge(false);
        ch.setSound(null, null);
        nm.createNotificationChannel(ch);
    }
}