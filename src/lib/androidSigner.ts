/**
 * NIP-55 Android Signer Integration
 *
 * Uses a native Capacitor plugin (NostrSignerPlugin.java) to send proper
 * Android intents with extras to signer apps (Amber, etc.)
 *
 * This is the only way NIP-55 works correctly — WebView's window.open()
 * can't pass intent extras, so the native plugin uses startActivityForResult.
 *
 * Flow:
 * 1. JS calls NostrSigner.getPublicKey()
 * 2. Native plugin creates Intent with nostrsigner: URI + type extra
 * 3. Android shows app chooser (Amber, Primal, etc.)
 * 4. User approves in their signer app
 * 5. Plugin receives result via onActivityResult
 * 6. JS gets the pubkey/signature back as a promise resolution
 */

import { Capacitor, registerPlugin } from '@capacitor/core'


// Type definition for the native plugin
interface NostrSignerPluginType {
  getPublicKey(options?: { permissions?: string }): Promise<{
    result: string  // hex pubkey
    package?: string  // signer package name
  }>
  signEvent(options: {
    event: string  // event JSON
    currentUser?: string  // hex pubkey
    id?: string
    package?: string  // target signer package
  }): Promise<{
    result: string  // signature
    id?: string
    event?: string  // full signed event JSON
    package?: string
  }>
  nip04Encrypt(options: {
    plaintext: string
    pubkey: string
    currentUser: string
    package?: string
  }): Promise<{ result: string }>
  nip04Decrypt(options: {
    ciphertext: string
    pubkey: string
    currentUser: string
    package?: string
  }): Promise<{ result: string }>
  nip44Encrypt(options: {
    plaintext: string
    pubkey: string
    currentUser: string
    package?: string
  }): Promise<{ result: string }>
  nip44Decrypt(options: {
    ciphertext: string
    pubkey: string
    currentUser: string
    package?: string
  }): Promise<{ result: string }>
}

// Register the native plugin
const NostrSigner = registerPlugin<NostrSignerPluginType>('NostrSigner')

// Pending callback resolver — used when Amber returns via callbackUrl instead of setResult
let pendingCallbackResolve: ((result: string) => void) | null = null
let deepLinkListenerInitialized = false

/**
 * Initialize the deep link listener as a fallback for when Amber uses
 * the callbackUrl path instead of setResult(). This catches
 * samizdat://signer-result?result=<value> URLs.
 */
export async function initDeepLinkFallback(): Promise<void> {
  if (deepLinkListenerInitialized || !isNativeAndroid()) return
  deepLinkListenerInitialized = true

  try {
    const { App } = await import('@capacitor/app')
    await App.addListener('appUrlOpen', ({ url }) => {
      if (!url.startsWith('samizdat://signer-result')) return

      const paramStr = url.includes('?') ? url.split('?').slice(1).join('?') : ''
      const params = new URLSearchParams(paramStr)
      const result = params.get('result') || ''

      if (result && pendingCallbackResolve) {
        const resolve = pendingCallbackResolve
        pendingCallbackResolve = null
        resolve(result)
      }
    })
  } catch (e) {
    console.warn('[AndroidSigner] Deep link fallback init failed:', e)
  }
}

/** Check if we're running as a native Android app */
export function isNativeAndroid(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
}

/** Check if Android signer flow is available */
export function androidSignerAvailable(): boolean {
  return isNativeAndroid()
}

/** Get saved signer package name */
export function getSignerPackage(): string | null {
  return localStorage.getItem('samizdat_signer_package')
}

/** Save signer package for future calls (skip app chooser) */
function saveSignerPackage(pkg: string) {
  localStorage.setItem('samizdat_signer_package', pkg)
}

/**
 * Get public key from Android signer.
 * Opens the native app chooser — user picks Amber, Primal, etc.
 * Returns the hex pubkey.
 *
 * Uses a dual approach:
 * 1. Native startActivityForResult — if Amber returns via setResult(), the plugin promise resolves
 * 2. callbackUrl fallback — if Amber opens samizdat://signer-result?result=<pubkey>, deep link catches it
 * Whichever fires first wins.
 */
export async function getPublicKey(): Promise<{ pubkey: string; package?: string }> {
  // Make sure the deep link fallback is ready
  await initDeepLinkFallback()

  // Race: native plugin result vs callback URL deep link
  const result = await Promise.race([
    // Path 1: Native setResult (works if callingPackage is set)
    NostrSigner.getPublicKey().catch((e: any) => {
      console.warn('[AndroidSigner] Native getPublicKey failed/rejected:', e?.message || e)
      // Don't throw — let the callback URL path have a chance
      return null
    }),
    // Path 2: Callback URL deep link (fallback if callingPackage is null)
    new Promise<{ result: string; package?: string }>((resolve) => {
      pendingCallbackResolve = (pubkey: string) => {
        resolve({ result: pubkey })
      }
      // Timeout after 2 minutes
      setTimeout(() => {
        if (pendingCallbackResolve) {
          pendingCallbackResolve = null
          // Don't resolve — let native path handle it or both timeout
        }
      }, 120000)
    }),
  ])

  // Clean up
  pendingCallbackResolve = null

  if (!result || !result.result) {
    throw new Error('No response from signer app')
  }

  // Amber returns npub for web clients (no package), hex for native. Handle both.
  let pubkey = result.result
  if (pubkey.startsWith('npub1')) {
    // Decode bech32 npub to hex
    const { decode } = await import('nostr-tools/nip19')
    const decoded = decode(pubkey)
    if (decoded.type === 'npub') {
      pubkey = decoded.data
    }
  }

  if (!/^[0-9a-f]{64}$/i.test(pubkey)) {
    throw new Error('Invalid public key from signer: ' + pubkey)
  }

  if (result.package) {
    saveSignerPackage(result.package)
  }

  return { pubkey, package: result.package }
}

/**
 * Sign a nostr event using the Android signer.
 * If we know the signer package, it opens directly. Otherwise shows chooser.
 */
export async function signEvent(eventJson: string, pubkey: string): Promise<{ signature: string; signedEvent?: string }> {
  const pkg = getSignerPackage()

  const result = await NostrSigner.signEvent({
    event: eventJson,
    currentUser: pubkey,
    id: (() => { try { return JSON.parse(eventJson).id || '' } catch { return '' } })(),
    ...(pkg ? { package: pkg } : {}),
  })

  return {
    signature: result.result,
    signedEvent: result.event,
  }
}

/**
 * NIP-04 encrypt using Android signer.
 */
export async function nip04Encrypt(plaintext: string, recipientPubkey: string, currentUserPubkey: string): Promise<string> {
  const pkg = getSignerPackage()
  const result = await NostrSigner.nip04Encrypt({
    plaintext,
    pubkey: recipientPubkey,
    currentUser: currentUserPubkey,
    ...(pkg ? { package: pkg } : {}),
  })
  return result.result
}

/**
 * NIP-04 decrypt using Android signer.
 */
export async function nip04Decrypt(ciphertext: string, senderPubkey: string, currentUserPubkey: string): Promise<string> {
  const pkg = getSignerPackage()
  const result = await NostrSigner.nip04Decrypt({
    ciphertext,
    pubkey: senderPubkey,
    currentUser: currentUserPubkey,
    ...(pkg ? { package: pkg } : {}),
  })
  return result.result
}

/**
 * NIP-44 encrypt using Android signer.
 */
export async function nip44Encrypt(plaintext: string, recipientPubkey: string, currentUserPubkey: string): Promise<string> {
  const pkg = getSignerPackage()
  const result = await NostrSigner.nip44Encrypt({
    plaintext,
    pubkey: recipientPubkey,
    currentUser: currentUserPubkey,
    ...(pkg ? { package: pkg } : {}),
  })
  return result.result
}

/**
 * NIP-44 decrypt using Android signer.
 */
export async function nip44Decrypt(ciphertext: string, senderPubkey: string, currentUserPubkey: string): Promise<string> {
  const pkg = getSignerPackage()
  const result = await NostrSigner.nip44Decrypt({
    ciphertext,
    pubkey: senderPubkey,
    currentUser: currentUserPubkey,
    ...(pkg ? { package: pkg } : {}),
  })
  return result.result
}
