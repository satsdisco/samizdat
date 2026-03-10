/**
 * Android Signer Integration
 * 
 * On Android (Capacitor native), we can use intent-based signing
 * which lets the OS show a chooser between installed signer apps
 * (Amber, Primal, etc.) via Android's intent system.
 * 
 * This uses the `nostr:` URI scheme which Amber and other Android
 * signers register as intent handlers. When multiple apps handle
 * the scheme, Android shows the native app chooser.
 * 
 * On web, this falls back to the existing NIP-46 QR flow.
 */

import { Capacitor } from '@capacitor/core'

/** Check if we're running as a native Android app */
export function isNativeAndroid(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
}

/**
 * Get the public key from an Android signer app via intent.
 * Uses the `nostrsigner:` scheme that Amber registers.
 * 
 * Flow:
 * 1. We send an intent with `nostrsigner:` URI
 * 2. Android shows app chooser if multiple signers installed
 * 3. User picks their signer, grants permission
 * 4. Signer returns the pubkey via callback
 */
export async function getPublicKeyFromAndroidSigner(): Promise<string | null> {
  if (!isNativeAndroid()) return null

  try {
    // Use the App plugin to handle the deep link flow
    const { App } = await import('@capacitor/app')
    
    // Create a promise that resolves when we get the callback
    return new Promise<string | null>((resolve, _reject) => {
      const timeout = setTimeout(() => {
        resolve(null) // Timeout — user cancelled or no signer
      }, 60000)

      // Listen for the return intent
      const listener = App.addListener('appUrlOpen', (data) => {
        clearTimeout(timeout)
        listener.then(l => l.remove())
        
        try {
          const url = new URL(data.url)
          const pubkey = url.searchParams.get('pubkey') || url.searchParams.get('result')
          if (pubkey && /^[0-9a-f]{64}$/.test(pubkey)) {
            resolve(pubkey)
          } else {
            resolve(null)
          }
        } catch {
          resolve(null)
        }
      })

      // Launch the signer intent
      // The `nostrsigner:` scheme is what Amber uses
      // `callbackUrl` tells the signer where to return
      const callbackUrl = 'press.samizdat.app://callback'
      const intentUri = `nostrsigner:?compressionType=none&returnType=signature&type=get_public_key&callbackUrl=${encodeURIComponent(callbackUrl)}`
      
      window.open(intentUri, '_system')
    })
  } catch (e) {
    console.error('Android signer intent failed:', e)
    return null
  }
}

/**
 * Sign an event using an Android signer app via intent.
 * 
 * @param eventJson - JSON string of the unsigned event
 * @returns Signed event JSON or null if cancelled
 */
export async function signWithAndroidSigner(eventJson: string): Promise<string | null> {
  if (!isNativeAndroid()) return null

  try {
    const { App } = await import('@capacitor/app')

    return new Promise<string | null>((resolve, _reject) => {
      const timeout = setTimeout(() => {
        resolve(null)
      }, 60000)

      const listener = App.addListener('appUrlOpen', (data) => {
        clearTimeout(timeout)
        listener.then(l => l.remove())

        try {
          const url = new URL(data.url)
          const result = url.searchParams.get('result') || url.searchParams.get('signature')
          resolve(result)
        } catch {
          resolve(null)
        }
      })

      const callbackUrl = 'press.samizdat.app://callback'
      const intentUri = `nostrsigner:${encodeURIComponent(eventJson)}?compressionType=none&returnType=signature&type=sign_event&callbackUrl=${encodeURIComponent(callbackUrl)}`
      
      window.open(intentUri, '_system')
    })
  } catch (e) {
    console.error('Android signer sign failed:', e)
    return null
  }
}

/**
 * Check if any Android signer apps are likely available.
 * We can't truly detect installed apps, but we can check if
 * we're on Android and provide the option.
 */
export function androidSignerAvailable(): boolean {
  return isNativeAndroid()
}
