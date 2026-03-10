package press.samizdat.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import press.samizdat.app.plugins.NostrSignerPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register NIP-55 signer plugin before super.onCreate
        registerPlugin(NostrSignerPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
