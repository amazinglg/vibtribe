package app.vibtribe.app;

import android.app.Activity;
import android.app.KeyguardManager;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.TextView;

public class IncomingCallActivity extends Activity {
    public static final String ACTION_INCOMING = "app.vibtribe.app.INCOMING_CALL";
    public static final String ACTION_ACCEPT   = "app.vibtribe.app.ACCEPT_CALL";
    public static final String ACTION_DECLINE  = "app.vibtribe.app.DECLINE_CALL";

    private Ringtone ringtone;
    private String callId;
    private String chatId;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
            KeyguardManager km = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
            if (km != null) km.requestDismissKeyguard(this, null);
        } else {
            getWindow().addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
              | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
              | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
              | WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD);
        }
        setContentView(R.layout.activity_incoming_call);
        handleIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIntent(intent);
    }

    private void handleIntent(Intent intent) {
        if (intent == null) return;
        callId = intent.getStringExtra("callId");
        chatId = intent.getStringExtra("chatId");
        String callerName = intent.getStringExtra("callerName");
        String callType = intent.getStringExtra("callType");
        String action = intent.getAction();

        TextView nameView = findViewById(R.id.caller_name);
        TextView typeView = findViewById(R.id.call_type);
        if (nameView != null) nameView.setText(callerName == null ? "Unknown" : callerName);
        if (typeView != null) typeView.setText("video".equals(callType) ? "Incoming video call" : "Incoming voice call");

        Button accept = findViewById(R.id.btn_accept);
        Button decline = findViewById(R.id.btn_decline);
        if (accept != null) accept.setOnClickListener(v -> openAppForCall(true));
        if (decline != null) decline.setOnClickListener(v -> openAppForCall(false));

        if (ACTION_ACCEPT.equals(action)) { openAppForCall(true); return; }
        if (ACTION_DECLINE.equals(action)) { openAppForCall(false); return; }
        startRingtone();
    }

    private void startRingtone() {
        if (ringtone != null && ringtone.isPlaying()) return;
        try {
            Uri uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
            ringtone = RingtoneManager.getRingtone(getApplicationContext(), uri);
            if (ringtone != null) ringtone.play();
        } catch (Exception ignored) {}
    }

    private void stopRingtone() {
        try { if (ringtone != null && ringtone.isPlaying()) ringtone.stop(); } catch (Exception ignored) {}
        ringtone = null;
    }

    private void openAppForCall(boolean accept) {
        stopRingtone();
        try {
            NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            if (nm != null && callId != null) nm.cancel(callId.hashCode());
        } catch (Exception ignored) {}

        Intent intent = new Intent(this, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        Uri data = Uri.parse("https://www.vibtribe.in/?"
                + (accept ? "call=" : "declineCall=") + (callId == null ? "" : callId)
                + (chatId != null && !chatId.isEmpty() ? "&chat=" + chatId : ""));
        intent.setData(data);
        intent.setAction(Intent.ACTION_VIEW);
        startActivity(intent);
        finish();
    }

    @Override
    protected void onDestroy() { stopRingtone(); super.onDestroy(); }

    @Override
    public void onBackPressed() { openAppForCall(false); }
}