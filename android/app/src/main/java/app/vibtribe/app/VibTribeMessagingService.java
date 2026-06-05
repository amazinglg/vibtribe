package app.vibtribe.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import androidx.core.app.NotificationCompat;

import com.capacitorjs.plugins.pushnotifications.MessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

/**
 * Replaces the Capacitor push-notifications service so we can intercept
 * data-only incoming-call payloads and trigger a full-screen ringer (system
 * default ringtone). Non-call payloads are delegated to the base Capacitor
 * service so regular JS push events still fire.
 */
public class VibTribeMessagingService extends MessagingService {

    public static final String CALL_CHANNEL_ID = "vibtribe_incoming_calls";

    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        Map<String, String> data = remoteMessage.getData();
        String type = data.get("type");
        if ("incoming_call".equals(type)) {
            String callId = data.get("callId");
            String callerName = data.get("callerName");
            String callerAvatar = data.get("callerAvatar");
            String callType = data.get("callType");
            String chatId = data.get("chatId");
            if (callId == null || callId.isEmpty()) return;
            showIncomingCall(callId, callerName, callerAvatar, callType, chatId);
            return;
        }
        super.onMessageReceived(remoteMessage);
    }

    private void showIncomingCall(String callId, String callerName, String callerAvatar,
                                  String callType, String chatId) {
        Context ctx = getApplicationContext();
        createCallChannel(ctx);

        Intent fullScreenIntent = new Intent(ctx, IncomingCallActivity.class);
        fullScreenIntent.setAction(IncomingCallActivity.ACTION_INCOMING);
        fullScreenIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        fullScreenIntent.putExtra("callId", callId);
        fullScreenIntent.putExtra("callerName", callerName);
        fullScreenIntent.putExtra("callerAvatar", callerAvatar);
        fullScreenIntent.putExtra("callType", callType);
        fullScreenIntent.putExtra("chatId", chatId);

        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        PendingIntent fullScreenPI = PendingIntent.getActivity(ctx, callId.hashCode(),
                fullScreenIntent, piFlags);

        Intent acceptIntent = new Intent(ctx, IncomingCallActivity.class);
        acceptIntent.setAction(IncomingCallActivity.ACTION_ACCEPT);
        acceptIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        acceptIntent.putExtras(fullScreenIntent);
        PendingIntent acceptPI = PendingIntent.getActivity(ctx, callId.hashCode() + 1,
                acceptIntent, piFlags);

        Intent declineIntent = new Intent(ctx, IncomingCallActivity.class);
        declineIntent.setAction(IncomingCallActivity.ACTION_DECLINE);
        declineIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        declineIntent.putExtras(fullScreenIntent);
        PendingIntent declinePI = PendingIntent.getActivity(ctx, callId.hashCode() + 2,
                declineIntent, piFlags);

        String title = "Incoming " + ("video".equals(callType) ? "video" : "voice") + " call";
        String body = (callerName == null || callerName.isEmpty()) ? "Unknown caller" : callerName;

        NotificationCompat.Builder builder = new NotificationCompat.Builder(ctx, CALL_CHANNEL_ID)
                .setSmallIcon(getApplicationInfo().icon)
                .setContentTitle(title)
                .setContentText(body)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setOngoing(true)
                .setAutoCancel(true)
                .setFullScreenIntent(fullScreenPI, true)
                .setContentIntent(fullScreenPI)
                .addAction(android.R.drawable.ic_menu_call, "Accept", acceptPI)
                .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Decline", declinePI);

        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        nm.notify(callId.hashCode(), builder.build());
    }

    private void createCallChannel(Context ctx) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm.getNotificationChannel(CALL_CHANNEL_ID) != null) return;
        NotificationChannel channel = new NotificationChannel(
                CALL_CHANNEL_ID, "Incoming Calls", NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription("Ringer for incoming VibTribe calls");
        channel.enableVibration(true);
        channel.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);
        Uri ringtone = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
        AudioAttributes attrs = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();
        channel.setSound(ringtone, attrs);
        nm.createNotificationChannel(channel);
    }
}