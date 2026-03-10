/**
 * NIP-55 Android Signer Integration
 * 
 * Uses Android's intent system to communicate with signer apps (Amber, etc.)
 * No relays needed — communication is direct via URI scheme callbacks.
 * 
 * Flow:
 * 1. Open nostrsigner: URI with type + callbackUrl
 * 2. Android shows app chooser if multiple signers installed  
 * 3. User approves in their signer app
 * 4. Signer opens callbackUrl with result params
 * 5. Our deep link handler catches it
 * 
 * Supports: get_public_key, sign_event, nip04_encrypt/decrypt, nip44_encrypt/decrypt
 */

import { Capacitor } from '@capacitor/core'

const CALLBACK_SCHEME = 'samizdat://signer-result'

/** Pending request that's waiting for a signer callback */
interface PendingRequest {
  id: string
  type: string
  resolve: (result: SignerResult) => void
  reject: (error: Error) => void
  timeout: ReturnType<typeof setTimeout>
}

export interface SignerResult {
  result: string
  id?: string
  event?: string  // signed event JSON for sign_event
  package?: string // signer package name
}

// Single pending request at a time
let pendingRequest: PendingRequest | null = null
// Saved signer package name (set after first successful interaction)
let signerPackage: string | null = null

/** Check if we're running as a native Android app */
export function isNativeAndroid(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
}

/** Check if Android signer flow is available */
export function androidSignerAvailable(): boolean {
  return isNativeAndroid()
}

/** Set up the deep link listener for signer callbacks */
export async function initSignerListener(): Promise<void> {
  if (!isNativeAndroid()) return

  const { App } = await import('@capacitor/app')
  
  await App.addListener('appUrlOpen', ({ url }) => {
    if (!url.startsWith('samizdat://signer-result')) return
    if (!pendingRequest) return

    try {
      // Parse result from URL params
      // Format: samizdat://signer-result?result=<value>&id=<id>&package=<pkg>&event=<json>
      const paramStr = url.includes('?') ? url.split('?')[1] : ''
      const params = new URLSearchParams(paramStr)

      const result: SignerResult = {
        result: params.get('result') || '',
        id: params.get('id') || undefined,
        event: params.get('event') || undefined,
        package: params.get('package') || undefined,
      }

      // Save signer package for future requests
      if (result.package) {
        signerPackage = result.package
        localStorage.setItem('samizdat_signer_package', result.package)
      }

      if (result.result) {
        clearTimeout(pendingRequest.timeout)
        pendingRequest.resolve(result)
      } else {
        clearTimeout(pendingRequest.timeout)
        pendingRequest.reject(new Error('Signer returned empty result'))
      }
    } catch (e) {
      if (pendingRequest) {
        clearTimeout(pendingRequest.timeout)
        pendingRequest.reject(e as Error)
      }
    } finally {
      pendingRequest = null
    }
  })

  // Restore saved package name
  signerPackage = localStorage.getItem('samizdat_signer_package')
}

/** Send a request to the Android signer and wait for callback */
function sendSignerRequest(
  type: string,
  content: string = '',
  extras: Record<string, string> = {},
  timeoutMs: number = 120000
): Promise<SignerResult> {
  return new Promise((resolve, reject) => {
    const id = Math.random().toString(36).slice(2, 10)
    
    // Cancel any existing pending request
    if (pendingRequest) {
      clearTimeout(pendingRequest.timeout)
      pendingRequest.reject(new Error('Cancelled by new request'))
      pendingRequest = null
    }

    const timeout = setTimeout(() => {
      pendingRequest = null
      reject(new Error('Signer request timed out'))
    }, timeoutMs)

    pendingRequest = { id, type, resolve, reject, timeout }

    // Build the nostrsigner: URI
    const params = new URLSearchParams()
    params.set('type', type)
    params.set('callbackUrl', CALLBACK_SCHEME)
    params.set('id', id)
    
    // Add extras (current_user, pubkey, etc.)
    for (const [key, value] of Object.entries(extras)) {
      params.set(key, value)
    }

    // Build URI: nostrsigner:<content>?type=...&callbackUrl=...
    const encodedContent = content ? encodeURIComponent(content) : ''
    const uri = `nostrsigner:${encodedContent}?${params.toString()}`

    // Open the intent — Android shows app chooser if multiple signers
    // Don't set package so user can choose their preferred signer
    window.open(uri, '_blank')
  })
}

/**
 * Get public key from Android signer.
 * This is the login flow — opens signer app chooser.
 */
export async function getPublicKey(): Promise<{ pubkey: string; package?: string }> {
  const result = await sendSignerRequest('get_public_key', '', {}, 120000)
  
  if (!result.result || !/^[0-9a-f]{64}$/i.test(result.result)) {
    throw new Error('Invalid public key from signer')
  }
  
  return { pubkey: result.result, package: result.package }
}

/**
 * Sign a nostr event using the Android signer.
 * Returns the signature (or full signed event JSON).
 */
export async function signEvent(eventJson: string, pubkey: string): Promise<{ signature: string; signedEvent?: string }> {
  const result = await sendSignerRequest('sign_event', eventJson, {
    current_user: pubkey,
    id: JSON.parse(eventJson).id || '',
  })

  return {
    signature: result.result,
    signedEvent: result.event,
  }
}

/**
 * Get the saved signer package name.
 */
export function getSignerPackage(): string | null {
  return signerPackage
}
