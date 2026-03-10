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
 */
export async function getPublicKey(): Promise<{ pubkey: string; package?: string }> {
  const result = await NostrSigner.getPublicKey()

  if (!result.result || !/^[0-9a-f]{64}$/i.test(result.result)) {
    throw new Error('Invalid public key from signer: ' + (result.result || '(empty)'))
  }

  // Save the signer package so future sign requests skip the chooser
  if (result.package) {
    saveSignerPackage(result.package)
  }

  return { pubkey: result.result, package: result.package }
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
