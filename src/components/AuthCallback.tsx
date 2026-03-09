import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * NIP-46 mobile callback handler.
 * Primal opens this URL (plain, no params) after granting permissions.
 * The actual NIP-46 response went through the relay while we were backgrounded.
 * We need to reconnect to the relay and complete the handshake.
 */
export function AuthCallback() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('Completing login...')

  useEffect(() => {
    const completeLogin = async () => {
      const clientSkHex = sessionStorage.getItem('samizdat_nip46_clientsk')
      const secret = sessionStorage.getItem('samizdat_nip46_secret')

      if (!clientSkHex || !secret) {
        setStatus('No pending login session. Redirecting...')
        setTimeout(() => navigate('/', { replace: true }), 1000)
        return
      }

      try {
        setStatus('Reconnecting to relay...')

        // Reconstruct client secret key
        const clientSk = new Uint8Array(clientSkHex.match(/.{1,2}/g)!.map((b: string) => parseInt(b, 16)))

        const { SimplePool } = await import('nostr-tools/pool')
        const { getPublicKey } = await import('nostr-tools/pure')
        const { decrypt, getConversationKey } = await import('nostr-tools/nip44')

        const clientPk = getPublicKey(clientSk)
        const connectRelays = ['wss://relay.nsec.app', 'wss://relay.primal.net', 'wss://nos.lol', 'wss://relay.damus.io']
        const pool = new SimplePool()

        setStatus('Waiting for signer response...')

        // Subscribe and wait for the NIP-46 connect response
        // Primal already sent it while we were backgrounded — it should be on the relay
        const bunkerPubkey = await new Promise<string>((resolve, reject) => {
          const timeout = setTimeout(() => {
            sub?.close()
            reject(new Error('timeout'))
          }, 30000) // 30s — response should already be there

          const sub = pool.subscribeMany(
            connectRelays,
            { kinds: [24133], '#p': [clientPk], limit: 1 } as any,
            {
              onevent: async (event: any) => {
                try {
                  // Try NIP-44 first
                  const conversationKey = getConversationKey(clientSk, event.pubkey)
                  const decrypted = decrypt(event.content, conversationKey)
                  const parsed = JSON.parse(decrypted)
                  if (parsed.result === secret || parsed.result === 'ack') {
                    clearTimeout(timeout)
                    sub.close()
                    resolve(event.pubkey)
                    return
                  }
                } catch {
                  // Try NIP-04 fallback
                  try {
                    const nip04 = await import('nostr-tools/nip04')
                    const decrypted = await nip04.decrypt(clientSk, event.pubkey, event.content)
                    const parsed = JSON.parse(decrypted)
                    if (parsed.result === secret || parsed.result === 'ack') {
                      clearTimeout(timeout)
                      sub.close()
                      resolve(event.pubkey)
                      return
                    }
                  } catch { /* not our event */ }
                }
              },
              oneose: () => { /* keep listening */ }
            }
          )
        })

        setStatus('Connected! Setting up signer...')

        // Now create the BunkerSigner for ongoing use
        const { BunkerSigner } = await import('nostr-tools/nip46')
        const bunkerUri = `bunker://${bunkerPubkey}?${connectRelays.map(r => `relay=${encodeURIComponent(r)}`).join('&')}&secret=${secret}`
        const signer = await BunkerSigner.fromURI(clientSk, bunkerUri, {}, 30000)
        const pk = await signer.getPublicKey()

        // Store auth info for the main app
        localStorage.setItem('samizdat_pubkey', pk)
        localStorage.setItem('samizdat_auth_method', 'bunker')
        // Store bunker details so main app can reconnect
        sessionStorage.setItem('samizdat_callback_bunker_pubkey', bunkerPubkey)

        // Clean up
        sessionStorage.removeItem('samizdat_nip46_clientsk')
        sessionStorage.removeItem('samizdat_nip46_secret')

        setStatus('Logged in! Redirecting...')
        setTimeout(() => {
          // Force reload to pick up the new auth state
          window.location.href = '/'
        }, 500)

      } catch (e: any) {
        console.error('Callback login failed:', e)
        if (e.message === 'timeout') {
          setStatus('Signer response not found. Try logging in again.')
        } else {
          setStatus(`Login failed: ${e.message}`)
        }
        setTimeout(() => navigate('/', { replace: true }), 3000)
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
      fontFamily: "'Source Serif 4', Georgia, serif",
      fontSize: '1.2rem',
      color: '#2d2d2d',
      background: '#f5f0e1',
      padding: '2rem',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⏳</div>
      <p>{status}</p>
    </div>
  )
}
