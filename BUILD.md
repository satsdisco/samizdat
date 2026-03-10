# Samizdat Android APK — Build Guide

## Prerequisites

### Required Tools
- **Android Studio** (Ladybug or later) — provides the Android SDK and build tools
- **JDK 21** — Gradle uses Java 21 (`brew install openjdk@21`)
- **Node.js 22+** and **npm**

### Environment Setup
After installing Android Studio, set these in your shell profile:
```sh
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$ANDROID_HOME/tools:$ANDROID_HOME/platform-tools:$PATH"
# If using Homebrew OpenJDK:
export JAVA_HOME="$(brew --prefix openjdk@21)"
export PATH="$JAVA_HOME/bin:$PATH"
```

---

## Quick Build (Debug APK)

```sh
# 1. Build the web app
npm run build

# 2. Sync to Android
npx cap sync android

# 3. Build debug APK
cd android && ./gradlew assembleDebug

# Output: android/app/build/outputs/apk/debug/app-debug.apk
```

---

## Release Build

### Step 1 — Generate a Signing Keystore
Run this **once** and store the keystore securely (never commit to git):

```sh
keytool -genkeypair -v \
  -storetype PKCS12 \
  -keystore samizdat-release.keystore \
  -alias samizdat \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -dname "CN=Samizdat, OU=Android, O=Samizdat Press, L=Unknown, ST=Unknown, C=US"
```

Keep `samizdat-release.keystore` somewhere safe — if you lose it you cannot update the app on the Play Store.

### Step 2 — Set Environment Variables
```sh
export SAMIZDAT_KEYSTORE_PATH="/path/to/samizdat-release.keystore"
export SAMIZDAT_KEYSTORE_PASSWORD="your_keystore_password"
export SAMIZDAT_KEY_ALIAS="samizdat"
export SAMIZDAT_KEY_PASSWORD="your_key_password"
```

### Step 3 — Build the Release APK
```sh
# From project root:
npm run build
npx cap sync android
cd android && ./gradlew assembleRelease

# Output: android/app/build/outputs/apk/release/app-release.apk
```

### Step 4 — Build Release AAB (for Play Store)
```sh
cd android && ./gradlew bundleRelease

# Output: android/app/build/outputs/bundle/release/app-release.aab
```

---

## Version Bumping

Edit `android/app/build.gradle`:
```groovy
versionCode 2          // increment for every release
versionName "1.1.0"    // semantic version shown in the store
```

---

## Capacitor Plugin Summary

All 10 plugins registered and synced:

| Plugin | Purpose |
|--------|---------|
| `@capacitor/app` | Deep links, back button, lifecycle |
| `@capacitor/camera` | Native photo capture / gallery |
| `@capacitor/clipboard` | Native clipboard for npub/naddr copy |
| `@capacitor/haptics` | Haptic feedback on key actions |
| `@capacitor/preferences` | General key-value storage |
| `@capacitor/share` | Android share sheet |
| `@capacitor/splash-screen` | Splash screen with Samizdat branding |
| `@capacitor/status-bar` | Dark status bar for dark theme |
| `@aparajita/capacitor-biometric-auth` | Biometric gate before nsec decryption |
| `capacitor-secure-storage-plugin` | Android Keystore-backed nsec storage |

---

## Security Notes

- The nsec (private key) is stored via `capacitor-secure-storage-plugin` which encrypts it using Android KeyStore before writing to SharedPreferences.
- Biometric authentication is required before the key is decrypted and loaded into memory.
- The nsec is **never** written to localStorage, sessionStorage, or any plaintext storage.
- The signing keystore must be stored outside the repository and never committed.

---

## Android SDK Versions

Set in `android/variables.gradle`:
```
minSdkVersion    = 24   (Android 7.0, covers ~95% of active devices)
compileSdkVersion = 36
targetSdkVersion  = 36
```

---

## Deep Link Setup

To enable Android App Links (`https://samizdat.press/*`), you need to host an
`assetlinks.json` file at `https://samizdat.press/.well-known/assetlinks.json`:

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "press.samizdat.app",
    "sha256_cert_fingerprints": ["YOUR_CERT_FINGERPRINT_HERE"]
  }
}]
```

Get the fingerprint:
```sh
keytool -list -v -keystore samizdat-release.keystore -alias samizdat | grep SHA256
```

---

## Troubleshooting

**`SDK location not found`**
→ Set `ANDROID_HOME` env var or create `android/local.properties` with `sdk.dir=/path/to/sdk`

**`JAVA_HOME not found`**
→ Install JDK 17: `brew install openjdk@17` and set `JAVA_HOME`

**`Biometric not available`**
→ On devices without fingerprint/face unlock, the app falls back to allowing access (no credential gate). For stricter security, set `allowDeviceCredential: false` in `secureStorage.ts`.

**Build succeeds but APK crashes**
→ Check ProGuard rules in `android/app/proguard-rules.pro`. Add `-keep` rules for any new native plugins.
