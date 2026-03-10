# ── Samizdat ProGuard / R8 rules ─────────────────────────────────────────────

# Keep line numbers for crash reporting
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# ── Capacitor / WebView bridge ────────────────────────────────────────────────
# Capacitor's JS bridge communicates over a WebView; keep all bridge members.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keepclassmembers class com.getcapacitor.** { *; }
-keep class com.getcapacitor.** { *; }
-keep interface com.getcapacitor.** { *; }

# ── Plugin: Secure Storage ────────────────────────────────────────────────────
-keep class com.whitestein.securestorage.** { *; }

# ── Plugin: Biometric Auth ────────────────────────────────────────────────────
-keep class com.aparajita.capacitor.biometricauth.** { *; }

# ── Plugin: Camera ────────────────────────────────────────────────────────────
-keep class com.capacitorjs.plugins.camera.** { *; }

# ── Plugin: Share ─────────────────────────────────────────────────────────────
-keep class com.capacitorjs.plugins.share.** { *; }

# ── Plugin: Clipboard ────────────────────────────────────────────────────────
-keep class com.capacitorjs.plugins.clipboard.** { *; }

# ── Plugin: Haptics ──────────────────────────────────────────────────────────
-keep class com.capacitorjs.plugins.haptics.** { *; }

# ── Plugin: Status Bar ───────────────────────────────────────────────────────
-keep class com.capacitorjs.plugins.statusbar.** { *; }

# ── Plugin: Splash Screen ────────────────────────────────────────────────────
-keep class com.capacitorjs.plugins.splashscreen.** { *; }

# ── Plugin: App ──────────────────────────────────────────────────────────────
-keep class com.capacitorjs.plugins.app.** { *; }

# ── Plugin: Preferences ──────────────────────────────────────────────────────
-keep class com.capacitorjs.plugins.preferences.** { *; }

# ── AndroidX Security (EncryptedSharedPreferences / Keystore) ────────────────
-keep class androidx.security.crypto.** { *; }

# ── AndroidX Biometric ───────────────────────────────────────────────────────
-keep class androidx.biometric.** { *; }

# ── Nostr-tools runs entirely in the WebView JS engine; no native rules needed.
# The WebView itself handles all JS execution — R8 will not touch JS assets.

# ── General Android safety ───────────────────────────────────────────────────
# Keep native methods
-keepclasseswithmembernames class * {
    native <methods>;
}
# Keep Parcelable implementations (used by intents, deep links)
-keep class * implements android.os.Parcelable {
    public static final android.os.Parcelable$Creator *;
}
# Keep Serializable (used by Capacitor plugin config)
-keepclassmembers class * implements java.io.Serializable {
    static final long serialVersionUID;
    private static final java.io.ObjectStreamField[] serialPersistentFields;
    private void writeObject(java.io.ObjectOutputStream);
    private void readObject(java.io.ObjectInputStream);
    java.lang.Object writeReplace();
    java.lang.Object readResolve();
}
