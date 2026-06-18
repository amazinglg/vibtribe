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
    private boolean secureEnabled = false;

    @PluginMethod
    public void enable(PluginCall call) {
        getBridge().executeOnMainThread(() -> {
            try {
                secureEnabled = true;
                getActivity().getWindow().setFlags(
                    WindowManager.LayoutParams.FLAG_SECURE,
                    WindowManager.LayoutParams.FLAG_SECURE
                );
                JSObject ret = new JSObject();
                ret.put("enabled", true);
                call.resolve(ret);
            } catch (Exception e) {
                Log.w("VibTribe", "VtTrustLock.enable failed", e);
                call.reject("Could not enable Trust Lock");
            }
        });
    }

    @PluginMethod
    public void disable(PluginCall call) {
        getBridge().executeOnMainThread(() -> {
            try {
                secureEnabled = false;
                getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
                JSObject ret = new JSObject();
                ret.put("enabled", false);
                call.resolve(ret);
            } catch (Exception e) {
                Log.w("VibTribe", "VtTrustLock.disable failed", e);
                call.reject("Could not disable Trust Lock");
            }
        });
    }

    @PluginMethod
    public void isActive(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("active", isWindowSecure());
        call.resolve(ret);
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        if (secureEnabled) {
            getBridge().executeOnMainThread(() -> getActivity().getWindow().setFlags(
                WindowManager.LayoutParams.FLAG_SECURE,
                WindowManager.LayoutParams.FLAG_SECURE
            ));
        }
    }

    private boolean isWindowSecure() {
        return (getActivity().getWindow().getAttributes().flags
            & WindowManager.LayoutParams.FLAG_SECURE) != 0;
    }
}