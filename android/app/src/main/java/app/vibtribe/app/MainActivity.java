package app.vibtribe.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Safe-area insets are handled entirely on the web side via
        // `env(safe-area-inset-*)` in src/styles.css. The StatusBar plugin
        // sets overlaysWebView=true so the WebView receives the real
        // insets. Do NOT pad the root view here — that produced a double
        // status-bar gap on top of the CSS padding.
    }
}
