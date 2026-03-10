package press.samizdat.app.plugins;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * NIP-55 Android Signer Plugin for Capacitor.
 *
 * Bridges Capacitor JS → native Android intents for communicating
 * with nostr signer apps (Amber, etc.) via the nostrsigner: scheme.
 *
 * Uses startActivityForResult to properly receive results back from
 * the signer app — something WebView's window.open() can't do.
 */
@CapacitorPlugin(name = "NostrSigner")
public class NostrSignerPlugin extends Plugin {

    /**
     * Get the user's public key from a signer app.
     * Opens the Android app chooser if multiple signers are installed.
     */
    @PluginMethod()
    public void getPublicKey(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("nostrsigner:"));
        intent.putExtra("type", "get_public_key");

        // Optional: request default permissions
        String permissions = call.getString("permissions", "");
        if (!permissions.isEmpty()) {
            intent.putExtra("permissions", permissions);
        }

        try {
            startActivityForResult(call, intent, "handleSignerResult");
        } catch (Exception e) {
            call.reject("No signer app found. Install Amber or another NIP-55 compatible signer.", "NO_SIGNER", e);
        }
    }

    /**
     * Sign a nostr event.
     * The event JSON is passed as content in the nostrsigner: URI.
     */
    @PluginMethod()
    public void signEvent(PluginCall call) {
        String eventJson = call.getString("event", "");
        String currentUser = call.getString("currentUser", "");
        String id = call.getString("id", "");

        if (eventJson.isEmpty()) {
            call.reject("Event JSON is required");
            return;
        }

        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("nostrsigner:" + Uri.encode(eventJson)));
        intent.putExtra("type", "sign_event");

        if (!id.isEmpty()) {
            intent.putExtra("id", id);
        }
        if (!currentUser.isEmpty()) {
            intent.putExtra("current_user", currentUser);
        }

        // Set package if we know the signer (avoids chooser on subsequent calls)
        String signerPackage = call.getString("package", "");
        if (!signerPackage.isEmpty()) {
            intent.setPackage(signerPackage);
        }

        try {
            startActivityForResult(call, intent, "handleSignerResult");
        } catch (Exception e) {
            call.reject("Failed to open signer app", "SIGNER_ERROR", e);
        }
    }

    /**
     * NIP-04 encrypt.
     */
    @PluginMethod()
    public void nip04Encrypt(PluginCall call) {
        String plaintext = call.getString("plaintext", "");
        String pubkey = call.getString("pubkey", "");
        String currentUser = call.getString("currentUser", "");

        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("nostrsigner:" + Uri.encode(plaintext)));
        intent.putExtra("type", "nip04_encrypt");
        intent.putExtra("pubkey", pubkey);
        intent.putExtra("current_user", currentUser);

        String signerPackage = call.getString("package", "");
        if (!signerPackage.isEmpty()) {
            intent.setPackage(signerPackage);
        }

        try {
            startActivityForResult(call, intent, "handleSignerResult");
        } catch (Exception e) {
            call.reject("Failed to open signer app", "SIGNER_ERROR", e);
        }
    }

    /**
     * NIP-04 decrypt.
     */
    @PluginMethod()
    public void nip04Decrypt(PluginCall call) {
        String ciphertext = call.getString("ciphertext", "");
        String pubkey = call.getString("pubkey", "");
        String currentUser = call.getString("currentUser", "");

        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("nostrsigner:" + Uri.encode(ciphertext)));
        intent.putExtra("type", "nip04_decrypt");
        intent.putExtra("pubkey", pubkey);
        intent.putExtra("current_user", currentUser);

        String signerPackage = call.getString("package", "");
        if (!signerPackage.isEmpty()) {
            intent.setPackage(signerPackage);
        }

        try {
            startActivityForResult(call, intent, "handleSignerResult");
        } catch (Exception e) {
            call.reject("Failed to open signer app", "SIGNER_ERROR", e);
        }
    }

    /**
     * NIP-44 encrypt.
     */
    @PluginMethod()
    public void nip44Encrypt(PluginCall call) {
        String plaintext = call.getString("plaintext", "");
        String pubkey = call.getString("pubkey", "");
        String currentUser = call.getString("currentUser", "");

        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("nostrsigner:" + Uri.encode(plaintext)));
        intent.putExtra("type", "nip44_encrypt");
        intent.putExtra("pubkey", pubkey);
        intent.putExtra("current_user", currentUser);

        String signerPackage = call.getString("package", "");
        if (!signerPackage.isEmpty()) {
            intent.setPackage(signerPackage);
        }

        try {
            startActivityForResult(call, intent, "handleSignerResult");
        } catch (Exception e) {
            call.reject("Failed to open signer app", "SIGNER_ERROR", e);
        }
    }

    /**
     * NIP-44 decrypt.
     */
    @PluginMethod()
    public void nip44Decrypt(PluginCall call) {
        String ciphertext = call.getString("ciphertext", "");
        String pubkey = call.getString("pubkey", "");
        String currentUser = call.getString("currentUser", "");

        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("nostrsigner:" + Uri.encode(ciphertext)));
        intent.putExtra("type", "nip44_decrypt");
        intent.putExtra("pubkey", pubkey);
        intent.putExtra("current_user", currentUser);

        String signerPackage = call.getString("package", "");
        if (!signerPackage.isEmpty()) {
            intent.setPackage(signerPackage);
        }

        try {
            startActivityForResult(call, intent, "handleSignerResult");
        } catch (Exception e) {
            call.reject("Failed to open signer app", "SIGNER_ERROR", e);
        }
    }

    /**
     * Handle the result from the signer app.
     * All NIP-55 methods return the same structure.
     */
    @ActivityCallback
    private void handleSignerResult(PluginCall call, ActivityResult activityResult) {
        if (call == null) return;

        if (activityResult.getResultCode() != Activity.RESULT_OK) {
            call.reject("Signer request was rejected or cancelled", "REJECTED");
            return;
        }

        Intent data = activityResult.getData();
        if (data == null) {
            call.reject("No data returned from signer", "NO_DATA");
            return;
        }

        JSObject result = new JSObject();

        // Result string (pubkey for get_public_key, signature for sign_event, etc.)
        String resultStr = data.getStringExtra("result");
        if (resultStr != null) {
            result.put("result", resultStr);
        }

        // Signer package name (returned on get_public_key)
        String pkg = data.getStringExtra("package");
        if (pkg != null) {
            result.put("package", pkg);
        }

        // Event ID (for sign_event)
        String id = data.getStringExtra("id");
        if (id != null) {
            result.put("id", id);
        }

        // Signed event JSON (for sign_event)
        String event = data.getStringExtra("event");
        if (event != null) {
            result.put("event", event);
        }

        if (resultStr == null || resultStr.isEmpty()) {
            call.reject("Signer returned empty result", "EMPTY_RESULT");
            return;
        }

        call.resolve(result);
    }
}
