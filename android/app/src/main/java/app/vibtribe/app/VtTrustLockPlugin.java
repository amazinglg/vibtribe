package app.vibtribe.app;

import android.util.Log;
import android.view.WindowManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "VtTrustLock")
public class VtTrustLockPlugin extends Plugin {
    private static final String TAG = "VibTribeTrustLock";
    private boolean secureEnabled = false;

    @PluginMethod
    public void enable(PluginCall call) {
        getBridge().executeOnMainThread(() -> {
            try {
                Log.i(TAG, "VtTrustLockPlugin.enable() called");
                secureEnabled = true;
                getActivity().getWindow().setFlags(
                    WindowManager.LayoutParams.FLAG_SECURE,
                    WindowManager.LayoutParams.FLAG_SECURE
                );
                boolean active = isWindowSecure();
                if (!active) secureEnabled = false;
                JSObject ret = new JSObject();
                ret.put("enabled", active);
                Log.i(TAG, "VtTrustLockPlugin.enable() returning { enabled: " + active + " }");
                call.resolve(ret);
            } catch (Exception e) {
                Log.w(TAG, "VtTrustLockPlugin.enable() failed", e);
                call.reject("Could not enable Trust Lock");
            }
        });
    }

    @PluginMethod
    public void disable(PluginCall call) {
        getBridge().executeOnMainThread(() -> {
            try {
                Log.i(TAG, "VtTrustLockPlugin.disable() called");
                secureEnabled = false;
                getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
                boolean active = isWindowSecure();
                JSObject ret = new JSObject();
                ret.put("enabled", active);
                Log.i(TAG, "VtTrustLockPlugin.disable() returning { enabled: " + active + " }");
                call.resolve(ret);
            } catch (Exception e) {
                Log.w(TAG, "VtTrustLockPlugin.disable() failed", e);
                call.reject("Could not disable Trust Lock");
            }
        });
    }

    @PluginMethod
    public void isActive(PluginCall call) {
        getBridge().executeOnMainThread(() -> {
            Log.i(TAG, "VtTrustLockPlugin.isActive() called");
            boolean active = isWindowSecure();
            JSObject ret = new JSObject();
            ret.put("active", active);
            Log.i(TAG, "VtTrustLockPlugin.isActive() returning { active: " + active + " }");
            call.resolve(ret);
        });
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        if (secureEnabled) {
            Log.i(TAG, "VtTrustLockPlugin.handleOnResume(): re-applying FLAG_SECURE");
            getBridge().executeOnMainThread(() -> getActivity().getWindow().setFlags(
                WindowManager.LayoutParams.FLAG_SECURE,
                WindowManager.LayoutParams.FLAG_SECURE
            ));
        }
    }

    private boolean isWindowSecure() {
        int flags = getActivity().getWindow().getAttributes().flags;
        boolean active = (flags & WindowManager.LayoutParams.FLAG_SECURE) != 0;
        Log.i(TAG, "VtTrustLockPlugin.isWindowSecure(): flags=" + flags + ", FLAG_SECURE active=" + active);
        return active;
    }
}