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
 * Uses DUAL approach:
 * 1. startActivityForResult — if the signer returns via setResult(), we get it directly
 * 2. callbackUrl fallback — the signer opens samizdat://signer-result with the result
 *    (handled by deep link listener on the JS side)
 *
 * Amber checks `callingPackage` first. If it's set (native startActivityForResult),
 * it returns via setResult(). If null (which can happen with Capacitor's
 * ActivityResultLauncher), it falls through to callbackUrl.
 */
@CapacitorPlugin(name = "NostrSigner")
public class NostrSignerPlugin extends Plugin {

    private static final String CALLBACK_URL = "samizdat://signer-result?result=";

    @PluginMethod()
    public void getPublicKey(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("nostrsigner:"));
        intent.putExtra("type", "get_public_key");
        // Callback URL as fallback — Amber will use this if callingPackage is null
        intent.putExtra("callbackUrl", CALLBACK_URL);
        intent.putExtra("returnType", "signature");
        intent.putExtra("appName", "Samizdat");

        String permissions = call.getString("permissions", "");
        if (!permissions.isEmpty()) {
            intent.putExtra("permissions", permissions);
        }

        try {
            startActivityForResult(call, intent, "handleSignerResult");
        } catch (Exception e) {
            call.reject("No signer app found. Install Amber or another NIP-55 signer.", "NO_SIGNER", e);
        }
    }

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
        intent.putExtra("callbackUrl", CALLBACK_URL);
        intent.putExtra("returnType", "event");
        intent.putExtra("appName", "Samizdat");

        if (!id.isEmpty()) {
            intent.putExtra("id", id);
        }
        if (!currentUser.isEmpty()) {
            intent.putExtra("current_user", currentUser);
        }

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

    @PluginMethod()
    public void nip04Encrypt(PluginCall call) {
        genericCryptoRequest(call, "nip04_encrypt", "plaintext");
    }

    @PluginMethod()
    public void nip04Decrypt(PluginCall call) {
        genericCryptoRequest(call, "nip04_decrypt", "ciphertext");
    }

    @PluginMethod()
    public void nip44Encrypt(PluginCall call) {
        genericCryptoRequest(call, "nip44_encrypt", "plaintext");
    }

    @PluginMethod()
    public void nip44Decrypt(PluginCall call) {
        genericCryptoRequest(call, "nip44_decrypt", "ciphertext");
    }

    private void genericCryptoRequest(PluginCall call, String type, String dataKey) {
        String data = call.getString(dataKey, "");
        String pubkey = call.getString("pubkey", "");
        String currentUser = call.getString("currentUser", "");

        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("nostrsigner:" + Uri.encode(data)));
        intent.putExtra("type", type);
        intent.putExtra("pubKey", pubkey);
        intent.putExtra("current_user", currentUser);
        intent.putExtra("callbackUrl", CALLBACK_URL);
        intent.putExtra("returnType", "signature");
        intent.putExtra("appName", "Samizdat");

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
     * Handle the result from the signer app (path 1: setResult).
     * If Amber returns via setResult(RESULT_OK, intent), we get it here.
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
            // Might have been handled via callbackUrl instead
            call.reject("No data returned — check if signer used callback URL", "NO_DATA");
            return;
        }

        JSObject result = new JSObject();

        // Amber sends both "result" and "signature" extras
        String resultStr = data.getStringExtra("result");
        if (resultStr == null) {
            resultStr = data.getStringExtra("signature");
        }
        if (resultStr != null) {
            result.put("result", resultStr);
        }

        // Check for rejection
        String rejected = data.getStringExtra("rejected");
        if (rejected != null) {
            call.reject("Signer rejected the request", "REJECTED");
            return;
        }

        String pkg = data.getStringExtra("package");
        if (pkg != null) {
            result.put("package", pkg);
        }

        String id = data.getStringExtra("id");
        if (id != null) {
            result.put("id", id);
        }

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
