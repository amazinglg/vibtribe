package app.vibtribe.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.webkit.PermissionRequest;
import android.webkit.WebView;
import android.webkit.WebChromeClient;
import android.view.View;
import androidx.activity.EdgeToEdge;
import androidx.core.app.ActivityCompat;
import androidx.core.graphics.Insets;
import androidx.core.splashscreen.SplashScreen;
import androidx.core.content.ContextCompat;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;
import java.util.ArrayList;
import java.util.List;

public class MainActivity extends BridgeActivity {
    private static final int MEDIA_PERMISSION_REQUEST = 8101;
    private int safeTop = 0;
    private int safeBottom = 0;
    private int safeLeft = 0;
    private int safeRight = 0;
    private PermissionRequest pendingMediaRequest = null;

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
                            runOnUiThread(() -> grantWebRtcPermissions(request));
                        }
                    });
                }
            });
        }
    }

    private void grantWebRtcPermissions(final PermissionRequest request) {
        List<String> needed = new ArrayList<>();
        for (String resource : request.getResources()) {
            if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)
                    && ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                needed.add(Manifest.permission.RECORD_AUDIO);
            }
            if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)
                    && ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
                needed.add(Manifest.permission.CAMERA);
            }
        }
        if (needed.isEmpty()) {
            request.grant(request.getResources());
            return;
        }
        pendingMediaRequest = request;
        ActivityCompat.requestPermissions(this, needed.toArray(new String[0]), MEDIA_PERMISSION_REQUEST);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != MEDIA_PERMISSION_REQUEST || pendingMediaRequest == null) return;
        PermissionRequest request = pendingMediaRequest;
        pendingMediaRequest = null;
        for (int result : grantResults) {
            if (result != PackageManager.PERMISSION_GRANTED) {
                request.deny();
                return;
            }
        }
        request.grant(request.getResources());
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
