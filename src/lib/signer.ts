/**
 * Shared signing module for Samizdat.
 * 
 * SECURITY:
 * - The secret key (nsec) is held in a module-scoped closure — no export, no getter.
 * - It is NEVER persisted to localStorage, sessionStorage, cookies, or anywhere on disk.
 * - It is NEVER sent over the network — only used locally inside finalizeEvent().
 * - It is NEVER logged, serialized, or exposed to the DOM.
 * - On page reload the key is gone — user must re-enter it (by design).
 * - The only way to set it is via setSecretKey(), called once during nsec login.
 * - The only way to use it is via signEvent(), which returns a signed event (not the key).
 */

// Module-scoped — not exported, not accessible from outside
let _secretKey: Uint8Array | null = null

/**
 * Store the secret key in memory. Called once during nsec login.
 * Pass null to clear (on logout).
 */
export function setSecretKey(sk: Uint8Array | null) {
  _secretKey = sk
}

// No getSecretKey export — the raw key never leaves this module.

function getAuthMethod(): string | null {
  return localStorage.getItem('samizdat_auth_method')
}

/**
 * Sign a nostr event using whatever auth method is available.
 * Returns a signed event — never exposes the key itself.
 * Priority: extension > nsec (in-memory) > fallback extension > error
 */
export async function signEvent(event: any): Promise<any> {
  const method = getAuthMethod()

  // NIP-07 browser extension
  if (method === 'extension' && window.nostr) {
    return await window.nostr.signEvent(event)
  }

  // nsec — key lives only in memory, used only for signing
  if (method === 'nsec' && _secretKey) {
    const { finalizeEvent } = await import('nostr-tools/pure')
    return finalizeEvent(event as any, _secretKey) as any
  }

  // Fallback: try extension even if auth method doesn't match
  if (window.nostr) {
    return await window.nostr.signEvent(event)
  }

  throw new Error('No signer available. If you logged in with a private key, the session may have expired — sign in again.')
}

/**
 * Check if signing is possible (without signing anything).
 */
export function canSign(): boolean {
  const method = getAuthMethod()
  if (method === 'extension' && window.nostr) return true
  if (method === 'nsec' && _secretKey) return true
  if (window.nostr) return true
  return false
}
