/**
 * Shared signing module for Samizdat.
 * Handles NIP-07 extension, nsec (in-memory), and future bunker signing.
 * The nsec key is stored in memory only — lost on page reload (by design).
 */

let storedSecretKey: Uint8Array | null = null

export function setSecretKey(sk: Uint8Array | null) {
  storedSecretKey = sk
}

export function getSecretKey(): Uint8Array | null {
  return storedSecretKey
}

export function getAuthMethod(): string | null {
  return localStorage.getItem('samizdat_auth_method')
}

/**
 * Sign a nostr event using whatever auth method is available.
 * Priority: extension > nsec > error
 */
export async function signEvent(event: any): Promise<any> {
  const method = getAuthMethod()

  // Try extension first (NIP-07)
  if (method === 'extension' && window.nostr) {
    return await window.nostr.signEvent(event)
  }

  // Try nsec (in-memory key)
  if (method === 'nsec' && storedSecretKey) {
    const { finalizeEvent } = await import('nostr-tools/pure')
    return finalizeEvent(event as any, storedSecretKey) as any
  }

  // Fallback: try extension even if method doesn't match (user may have installed one)
  if (window.nostr) {
    return await window.nostr.signEvent(event)
  }

  throw new Error('No signer available. If you logged in with a private key, the session may have expired — try signing in again.')
}

/**
 * Check if signing is available (without actually signing)
 */
export function canSign(): boolean {
  const method = getAuthMethod()
  if (method === 'extension' && window.nostr) return true
  if (method === 'nsec' && storedSecretKey) return true
  if (window.nostr) return true
  return false
}
