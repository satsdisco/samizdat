import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * NIP-46 mobile callback handler.
 * 
 * When Primal/signer redirects back after granting permissions,
 * we land here. The actual NIP-46 response was sent to the relay.
 * 
 * Strategy: reconnect to the relay, find the response, complete login.
 * If that fails within 15s, offer a retry or manual fallback.
 */
export function AuthCallback() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('Completing login...')
  const [failed, setFailed] = useState(false)
  const [debugLog, setDebugLog] = useState<string[]>([])
  const addDebug = (msg: string) => setDebugLog(prev => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`])

  useEffect(() => {
    const completeLogin = async () => {
      const clientSkHex = localStorage.getItem('samizdat_nip46_clientsk')
      const secret = localStorage.getItem('samizdat_nip46_secret')

      addDebug(`clientSk: ${clientSkHex ? 'found (' + clientSkHex.length + ' chars)' : 'MISSING'}`)
      addDebug(`secret: ${secret ? 'found' : 'MISSING'}`)

      if (!clientSkHex || !secret) {
        setStatus('No pending login session. Redirecting...')
        addDebug('localStorage empty — handshake data lost during redirect')
        setTimeout(() => navigate('/write', { replace: true }), 3000)
        return
      }

      try {
        setStatus('Reconnecting to relay...')

        const clientSk = new Uint8Array(clientSkHex.match(/.{1,2}/g)!.map((b: string) => parseInt(b, 16)))

        const { SimplePool } = await import('nostr-tools/pool')
        const { getPublicKey } = await import('nostr-tools/pure')

        const clientPk = getPublicKey(clientSk)
        const connectRelays = ['wss://relay.nsec.app']
        const pool = new SimplePool()

        addDebug(`clientPk: ${clientPk.slice(0, 12)}...`)
        addDebug(`querying ${connectRelays.length} relays...`)
        setStatus('Waiting for signer response...')

        // Query for existing events first (Primal may have already sent it)
        const events = await pool.querySync(connectRelays, {
          kinds: [24133],
          '#p': [clientPk],
          limit: 5,
        })

        addDebug(`found ${events.length} kind:24133 events`)
        let bunkerPubkey: string | null = null

        // Try to decrypt each event — one of them should be our connect response
        for (const event of events) {
          try {
            const { decrypt, getConversationKey } = await import('nostr-tools/nip44')
            const conversationKey = getConversationKey(clientSk, event.pubkey)
            const decrypted = decrypt(event.content, conversationKey)
            const parsed = JSON.parse(decrypted)
            if (parsed.result === secret || parsed.result === 'ack' || parsed.id) {
              bunkerPubkey = event.pubkey
              break
            }
          } catch {
            // Try NIP-04
            try {
              const nip04 = await import('nostr-tools/nip04')
              const decrypted = await nip04.decrypt(clientSk, event.pubkey, event.content)
              const parsed = JSON.parse(decrypted)
              if (parsed.result === secret || parsed.result === 'ack' || parsed.id) {
                bunkerPubkey = event.pubkey
                break
              }
            } catch { /* not our event */ }
          }
        }

        // If not found in existing events, subscribe and wait up to 15s
        if (!bunkerPubkey) {
          setStatus('Listening for signer...')
          bunkerPubkey = await new Promise<string | null>((resolve) => {
            const timeout = setTimeout(() => {
              sub?.close()
              resolve(null)
            }, 15000)

            const sub = pool.subscribeMany(
              connectRelays,
              { kinds: [24133], '#p': [clientPk] } as any,
              {
                onevent: async (event: any) => {
                  try {
                    const { decrypt, getConversationKey } = await import('nostr-tools/nip44')
                    const conversationKey = getConversationKey(clientSk, event.pubkey)
                    const decrypted = decrypt(event.content, conversationKey)
                    const parsed = JSON.parse(decrypted)
                    if (parsed.result === secret || parsed.result === 'ack' || parsed.id) {
                      clearTimeout(timeout)
                      sub.close()
                      resolve(event.pubkey)
                    }
                  } catch {
                    try {
                      const nip04 = await import('nostr-tools/nip04')
                      const decrypted = await nip04.decrypt(clientSk, event.pubkey, event.content)
                      const parsed = JSON.parse(decrypted)
                      if (parsed.result === secret || parsed.result === 'ack' || parsed.id) {
                        clearTimeout(timeout)
                        sub.close()
                        resolve(event.pubkey)
                      }
                    } catch { /* not ours */ }
                  }
                },
                oneose: () => { /* keep waiting */ }
              }
            )
          })
        }

        if (!bunkerPubkey) {
          pool.close(connectRelays)
          setFailed(true)
          addDebug('no matching signer response found after query + 15s subscribe')
          setStatus('Could not find signer response.')
          return
        }
        addDebug(`bunker pubkey: ${bunkerPubkey.slice(0, 12)}...`)

        setStatus('Connected! Setting up...')

        // Create BunkerSigner — use fromBunker, NOT fromURI
        // fromURI waits for a new connect response, but we already consumed it
        const { BunkerSigner } = await import('nostr-tools/nip46')
        const signer = BunkerSigner.fromBunker(clientSk, {
          pubkey: bunkerPubkey,
          relays: connectRelays,
          secret: secret!,
        })
        const pk = await signer.getPublicKey()

        // Store auth
        localStorage.setItem('samizdat_pubkey', pk)
        localStorage.setItem('samizdat_auth_method', 'bunker')
        localStorage.setItem('samizdat_callback_bunker_pubkey', bunkerPubkey)
        localStorage.removeItem('samizdat_nip46_clientsk')
        localStorage.removeItem('samizdat_nip46_secret')

        pool.close(connectRelays)

        setStatus('Logged in! ✓')
        setTimeout(() => {
          window.location.href = '/write'
        }, 500)

      } catch (e: any) {
        console.error('Callback login failed:', e)
        setFailed(true)
        setStatus(`Login failed: ${e.message || 'Unknown error'}`)
      }
    }

    completeLogin()
  }, [navigate])

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      fontFamily: "'Inter', -apple-system, sans-serif",
      color: '#e8e6e1',
      background: '#0a0a0a',
      padding: '2rem',
      textAlign: 'center',
      gap: '1.5rem',
    }}>
      {!failed && <div style={{ fontSize: '2rem' }}>⏳</div>}
      {failed && <div style={{ fontSize: '2rem' }}>⚠️</div>}
      <p style={{ fontSize: '1.1rem' }}>{status}</p>
      {failed && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', width: '100%', maxWidth: '300px' }}>
          <button
            onClick={() => {
              setFailed(false)
              setStatus('Retrying...')
              window.location.reload()
            }}
            style={{
              padding: '0.8rem 1.5rem',
              background: '#c0392b',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1rem',
              cursor: 'pointer',
              fontFamily: "'Inter', sans-serif",
            }}
          >
            Try Again
          </button>
          <button
            onClick={() => navigate('/write', { replace: true })}
            style={{
              padding: '0.8rem 1.5rem',
              background: 'transparent',
              color: '#999',
              border: '1px solid #333',
              borderRadius: '8px',
              fontSize: '0.9rem',
              cursor: 'pointer',
              fontFamily: "'Inter', sans-serif",
            }}
          >
            Back to Login
          </button>
        </div>
      )}
      {debugLog.length > 0 && (
        <div style={{
          marginTop: '1.5rem',
          padding: '1rem',
          background: '#111',
          borderRadius: '8px',
          width: '100%',
          maxWidth: '400px',
          textAlign: 'left',
          fontSize: '0.65rem',
          fontFamily: "'JetBrains Mono', monospace",
          color: '#666',
          maxHeight: '200px',
          overflow: 'auto',
        }}>
          {debugLog.map((line, i) => <div key={i}>{line}</div>)}
        </div>
      )}
    </div>
  )
}
