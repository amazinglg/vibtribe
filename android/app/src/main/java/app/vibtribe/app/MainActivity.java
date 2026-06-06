package app.vibtribe.app;

import android.os.Bundle;
import android.webkit.WebView;
import android.webkit.WebChromeClient;
import android.webkit.PermissionRequest;
import android.view.View;
import androidx.activity.EdgeToEdge;
import androidx.core.graphics.Insets;
import androidx.core.splashscreen.SplashScreen;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

public class MainActivity extends BridgeActivity {
    private int safeTop = 0;
    private int safeBottom = 0;
    private int safeLeft = 0;
    private int safeRight = 0;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        SplashScreen.installSplashScreen(this);
        super.onCreate(savedInstanceState);
        // Single Android safe-area source: real WindowInsets/display-cutout
        // values are injected into the existing global --safe-* CSS variables.
        // The web layer no longer depends on Android WebView env() support.
        EdgeToEdge.enable(this);
        installSafeAreaInsetsBridge();
    }

    private void installSafeAreaInsetsBridge() {
        View decorView = getWindow().getDecorView();
        ViewCompat.setOnApplyWindowInsetsListener(decorView, (view, windowInsets) -> {
            Insets systemInsets = windowInsets.getInsets(
                WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
            );
            safeTop = systemInsets.top;
            safeBottom = systemInsets.bottom;
            safeLeft = systemInsets.left;
            safeRight = systemInsets.right;
            injectSafeAreaCssVars();
            return windowInsets;
        });
        ViewCompat.requestApplyInsets(decorView);

        if (getBridge() != null) {
            getBridge().addWebViewListener(new WebViewListener() {
                @Override
                public void onPageCommitVisible(WebView view, String url) {
                    injectSafeAreaCssVars();
                    ViewCompat.requestApplyInsets(decorView);
                }

                @Override
                public void onPageLoaded(WebView webView) {
                    injectSafeAreaCssVars();
                    // Auto-grant in-WebView mic/camera permission requests.
                    // The OS-level RECORD_AUDIO / CAMERA permission is requested
                    // separately via the Capacitor plugins (see usePermissions).
                    // Without this delegation, getUserMedia() inside the WebView
                    // is silently denied even after the OS permission is granted.
                    webView.setWebChromeClient(new WebChromeClient() {
                        @Override
                        public void onPermissionRequest(final PermissionRequest request) {
                            runOnUiThread(() -> request.grant(request.getResources()));
                        }
                    });
                }
            });
        }
    }

    private void injectSafeAreaCssVars() {
        if (getBridge() == null || getBridge().getWebView() == null) return;
        String script = "(function(){var r=document.documentElement;if(!r)return;"
            + "r.style.setProperty('--safe-top','" + safeTop + "px');"
            + "r.style.setProperty('--safe-bottom','" + safeBottom + "px');"
            + "r.style.setProperty('--safe-left','" + safeLeft + "px');"
            + "r.style.setProperty('--safe-right','" + safeRight + "px');"
            + "r.setAttribute('data-safe-area-source','android-window-insets');"
            + "})();";
        runOnUiThread(() -> getBridge().getWebView().evaluateJavascript(script, null));
    }
}
