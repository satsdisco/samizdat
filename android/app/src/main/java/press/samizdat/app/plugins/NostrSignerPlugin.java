package press.samizdat.app.plugins;

import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;

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
 * Strategy:
 * 1. For get_public_key: use intent extras (confirmed working).
 * 2. For sign_event: try Content Resolver first (background, no app-switch needed).
 *    If Content Resolver returns null (no "Always" permission saved), fall back to Intent.
 */
@CapacitorPlugin(name = "NostrSigner")
public class NostrSignerPlugin extends Plugin {

    private static final String CALLBACK_URL = "samizdat://signer-result?result=";

    // ─── get_public_key ───────────────────────────────────────────────────────

    @PluginMethod()
    public void getPublicKey(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("nostrsigner:"));
        intent.putExtra("type", "get_public_key");
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

    // ─── sign_event ───────────────────────────────────────────────────────────

    @PluginMethod()
    public void signEvent(PluginCall call) {
        String eventJson = call.getString("event", "");
        String currentUser = call.getString("currentUser", "");
        String id = call.getString("id", "samizdat-sign");
        String signerPackage = call.getString("package", "");

        if (eventJson.isEmpty()) {
            call.reject("Event JSON is required");
            return;
        }

        // Try Content Resolver first — works silently if "Always" permission was granted.
        // Must run off main thread.
        String finalEventJson = eventJson;
        String finalCurrentUser = currentUser;
        String finalId = id;
        String finalSignerPackage = signerPackage;

        new Thread(() -> {
            try {
                String contentUri = "content://" + (finalSignerPackage.isEmpty() ? "com.greenart7c3.nostrsigner" : finalSignerPackage) + ".SIGN_EVENT";
                Cursor cursor = getContext().getContentResolver().query(
                    Uri.parse(contentUri),
                    new String[]{ finalEventJson, finalId, finalCurrentUser },
                    null, null, null
                );

                if (cursor != null) {
                    try {
                        if (cursor.getColumnIndex("rejected") > -1) {
                            new Handler(Looper.getMainLooper()).post(() ->
                                call.reject("Signer rejected the request", "REJECTED")
                            );
                            return;
                        }
                        if (cursor.moveToFirst()) {
                            int sigIdx = cursor.getColumnIndex("result");
                            int eventIdx = cursor.getColumnIndex("event");
                            String sig = sigIdx >= 0 ? cursor.getString(sigIdx) : null;
                            String signedEvent = eventIdx >= 0 ? cursor.getString(eventIdx) : null;

                            if (sig != null && !sig.isEmpty()) {
                                JSObject result = new JSObject();
                                result.put("result", sig);
                                if (signedEvent != null) result.put("event", signedEvent);
                                new Handler(Looper.getMainLooper()).post(() -> call.resolve(result));
                                return;
                            }
                        }
                    } finally {
                        cursor.close();
                    }
                }
            } catch (Exception e) {
                // Content Resolver failed — fall through to Intent
            }

            // Content Resolver returned nothing — fall back to Intent
            new Handler(Looper.getMainLooper()).post(() -> {
                String encodedEvent = Uri.encode(finalEventJson);
                String callbackUrlEncoded = Uri.encode(CALLBACK_URL);
                String uriStr = "nostrsigner:" + encodedEvent
                        + "?type=sign_event"
                        + "&returnType=signature"
                        + "&compressionType=none"
                        + "&callbackUrl=" + callbackUrlEncoded
                        + "&id=" + Uri.encode(finalId)
                        + "&appName=Samizdat";

                if (!finalCurrentUser.isEmpty()) {
                    uriStr += "&current_user=" + Uri.encode(finalCurrentUser);
                }

                Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(uriStr));
                if (!finalSignerPackage.isEmpty()) {
                    intent.setPackage(finalSignerPackage);
                }

                try {
                    startActivityForResult(call, intent, "handleSignerResult");
                } catch (Exception ex) {
                    call.reject("Failed to open signer app", "SIGNER_ERROR", ex);
                }
            });
        }).start();
    }

    // ─── crypto ops ──────────────────────────────────────────────────────────

    @PluginMethod()
    public void nip04Encrypt(PluginCall call) { cryptoContentResolver(call, "NIP04_ENCRYPT", "nip04_encrypt", "plaintext"); }

    @PluginMethod()
    public void nip04Decrypt(PluginCall call) { cryptoContentResolver(call, "NIP04_DECRYPT", "nip04_decrypt", "ciphertext"); }

    @PluginMethod()
    public void nip44Encrypt(PluginCall call) { cryptoContentResolver(call, "NIP44_ENCRYPT", "nip44_encrypt", "plaintext"); }

    @PluginMethod()
    public void nip44Decrypt(PluginCall call) { cryptoContentResolver(call, "NIP44_DECRYPT", "nip44_decrypt", "ciphertext"); }

    private void cryptoContentResolver(PluginCall call, String crMethod, String intentType, String dataKey) {
        String data = call.getString(dataKey, "");
        String pubkey = call.getString("pubkey", "");
        String currentUser = call.getString("currentUser", "");
        String signerPackage = call.getString("package", "");

        new Thread(() -> {
            try {
                String pkg = signerPackage.isEmpty() ? "com.greenart7c3.nostrsigner" : signerPackage;
                Cursor cursor = getContext().getContentResolver().query(
                    Uri.parse("content://" + pkg + "." + crMethod),
                    new String[]{ data, pubkey, currentUser },
                    null, null, null
                );
                if (cursor != null) {
                    try {
                        if (cursor.getColumnIndex("rejected") > -1) {
                            new Handler(Looper.getMainLooper()).post(() -> call.reject("Rejected", "REJECTED"));
                            return;
                        }
                        if (cursor.moveToFirst()) {
                            int idx = cursor.getColumnIndex("result");
                            String result = idx >= 0 ? cursor.getString(idx) : null;
                            if (result != null) {
                                JSObject res = new JSObject();
                                res.put("result", result);
                                new Handler(Looper.getMainLooper()).post(() -> call.resolve(res));
                                return;
                            }
                        }
                    } finally {
                        cursor.close();
                    }
                }
            } catch (Exception e) { /* fall through to intent */ }

            // Fallback: intent-based
            new Handler(Looper.getMainLooper()).post(() -> {
                String encoded = Uri.encode(data);
                String callbackEncoded = Uri.encode(CALLBACK_URL);
                String uriStr = "nostrsigner:" + encoded
                        + "?type=" + intentType
                        + "&pubkey=" + Uri.encode(pubkey)
                        + "&current_user=" + Uri.encode(currentUser)
                        + "&callbackUrl=" + callbackEncoded
                        + "&returnType=signature"
                        + "&appName=Samizdat";

                Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(uriStr));
                if (!signerPackage.isEmpty()) intent.setPackage(signerPackage);

                try {
                    startActivityForResult(call, intent, "handleSignerResult");
                } catch (Exception ex) {
                    call.reject("Failed to open signer app", "SIGNER_ERROR", ex);
                }
            });
        }).start();
    }

    // ─── result handler ──────────────────────────────────────────────────────

    @ActivityCallback
    private void handleSignerResult(PluginCall call, ActivityResult activityResult) {
        if (call == null) return;

        if (activityResult.getResultCode() != Activity.RESULT_OK) {
            call.reject("Signer request rejected or cancelled", "REJECTED");
            return;
        }

        Intent data = activityResult.getData();
        if (data == null) {
            call.reject("No data returned from signer", "NO_DATA");
            return;
        }

        String rejected = data.getStringExtra("rejected");
        if (rejected != null) {
            call.reject("Signer rejected the request", "REJECTED");
            return;
        }

        JSObject result = new JSObject();

        String resultStr = data.getStringExtra("result");
        if (resultStr == null) resultStr = data.getStringExtra("signature");
        if (resultStr != null) result.put("result", resultStr);

        String pkg = data.getStringExtra("package");
        if (pkg != null) result.put("package", pkg);

        String id = data.getStringExtra("id");
        if (id != null) result.put("id", id);

        String event = data.getStringExtra("event");
        if (event != null) result.put("event", event);

        if (resultStr == null || resultStr.isEmpty()) {
            call.reject("Signer returned empty result", "EMPTY_RESULT");
            return;
        }

        call.resolve(result);
    }
}
