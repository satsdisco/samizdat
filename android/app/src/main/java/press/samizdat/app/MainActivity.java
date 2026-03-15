package press.samizdat.app;

import android.content.Intent;
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

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        // Forward new intents (e.g. deep links from Amber callback) to the Capacitor bridge
        setIntent(intent);
        getBridge().onNewIntent(intent);
    }
}
