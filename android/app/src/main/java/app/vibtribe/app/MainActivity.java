package app.vibtribe.app;

import android.os.Bundle;
import androidx.activity.EdgeToEdge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Enable Android edge-to-edge and let @capacitor-community/safe-area
        // read real WindowInsets/display-cutout values natively. The web layer
        // only consumes the single global --safe-* variables.
        EdgeToEdge.enable(this);
    }
}
