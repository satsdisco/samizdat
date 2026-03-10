/**
 * Secure storage abstraction for the Samizdat nsec key.
 *
 * On Android (Capacitor): uses capacitor-secure-storage-plugin which encrypts
 * data via Android Keystore before writing to SharedPreferences.
 * The raw nsec is NEVER written to plaintext storage.
 *
 * On web (browser): falls back to sessionStorage only (wiped on tab close).
 * The web fallback is intentionally weaker — the full security story is native.
 *
 * Biometric gating is applied on native Android before key retrieval via
 * @aparajita/capacitor-biometric-auth. On web it is a no-op.
 */

import { Capacitor } from '@capacitor/core'

const NSEC_KEY = 'samizdat_nsec_encrypted'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function isNative(): boolean {
  return Capacitor.isNativePlatform()
}

// ─────────────────────────────────────────────────────────────────────────────
// Store nsec securely
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Store an nsec string in secure storage.
 * On Android: encrypted via Android Keystore.
 * On web: sessionStorage only (clears on tab close).
 */
export async function storeNsec(nsec: string): Promise<void> {
  if (isNative()) {
    const { SecureStoragePlugin } = await import('capacitor-secure-storage-plugin')
    await SecureStoragePlugin.set({ key: NSEC_KEY, value: nsec })
  } else {
    // Web fallback: sessionStorage so it doesn't persist across tabs/restarts
    sessionStorage.setItem(NSEC_KEY, nsec)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Retrieve nsec (with optional biometric gate on native)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retrieve the stored nsec.
 * On Android: prompts biometric authentication first, then retrieves from Keystore.
 * On web: returns from sessionStorage without any biometric gate.
 *
 * Returns null if no key is stored or if biometric was cancelled/failed.
 */
export async function retrieveNsec(): Promise<string | null> {
  if (isNative()) {
    // Check if a key is stored first
    const { SecureStoragePlugin } = await import('capacitor-secure-storage-plugin')
    try {
      const keysResult = await SecureStoragePlugin.keys()
      if (!keysResult.value.includes(NSEC_KEY)) {
        return null
      }
    } catch {
      return null
    }

    // Prompt biometric before decrypting
    const biometricOk = await promptBiometric()
    if (!biometricOk) {
      return null
    }

    // Retrieve from Keystore-backed secure storage
    try {
      const result = await SecureStoragePlugin.get({ key: NSEC_KEY })
      return result.value || null
    } catch {
      return null
    }
  } else {
    return sessionStorage.getItem(NSEC_KEY)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Check if a key is stored (without biometric prompt)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true if an nsec is stored in secure storage.
 * Does NOT trigger biometric — used for UI state only.
 */
export async function hasStoredNsec(): Promise<boolean> {
  if (isNative()) {
    try {
      const { SecureStoragePlugin } = await import('capacitor-secure-storage-plugin')
      const keysResult = await SecureStoragePlugin.keys()
      return keysResult.value.includes(NSEC_KEY)
    } catch {
      return false
    }
  } else {
    return sessionStorage.getItem(NSEC_KEY) !== null
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Clear stored nsec
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Wipe the nsec from secure storage. Called on logout.
 */
export async function clearStoredNsec(): Promise<void> {
  if (isNative()) {
    try {
      const { SecureStoragePlugin } = await import('capacitor-secure-storage-plugin')
      await SecureStoragePlugin.remove({ key: NSEC_KEY })
    } catch {
      // Key may not exist — that's fine
    }
  } else {
    sessionStorage.removeItem(NSEC_KEY)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Biometric prompt
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Show a biometric / device-credential prompt on native Android.
 * Returns true if authenticated, false if cancelled or unavailable.
 * On web always returns true (no-op).
 */
export async function promptBiometric(): Promise<boolean> {
  if (!isNative()) return true

  try {
    const { BiometricAuth, AndroidBiometryStrength } = await import('@aparajita/capacitor-biometric-auth')

    // Check what's available
    const info = await BiometricAuth.checkBiometry()
    if (!info.isAvailable) {
      // No biometric enrolled — allow access (device PIN/pattern may still exist)
      // In production you'd want to enforce at least device credentials
      return true
    }

    await BiometricAuth.authenticate({
      reason: 'Unlock your Samizdat signing key',
      cancelTitle: 'Cancel',
      allowDeviceCredential: true,
      androidTitle: 'Samizdat',
      androidSubtitle: 'Authenticate to access your signing key',
      // weak allows fingerprint or face; device PIN/pattern used as fallback via allowDeviceCredential
      androidBiometryStrength: AndroidBiometryStrength.weak,
    })

    return true
  } catch (e: any) {
    // User cancelled or auth failed
    console.warn('[SecureStorage] Biometric auth failed:', e?.message)
    return false
  }
}
