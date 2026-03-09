import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * NIP-46 mobile callback handler.
 * When Primal (or another signer) redirects back after granting permissions,
 * this page catches the bunker:// URI from the URL fragment or query params,
 * stores it, and redirects to the main app to complete login.
 */
export function AuthCallback() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('Completing login...')

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const hash = window.location.hash

      // Primal may pass bunker URI as a query param or in the hash
      // Common patterns: ?bunker=bunker://... or #bunker://...
      let bunkerUri = params.get('bunker') || params.get('uri') || ''

      // Check hash fragment
      if (!bunkerUri && hash) {
        const hashContent = hash.slice(1) // remove #
        if (hashContent.startsWith('bunker://')) {
          bunkerUri = hashContent
        } else {
          // Try parsing hash as query params
          const hashParams = new URLSearchParams(hashContent)
          bunkerUri = hashParams.get('bunker') || hashParams.get('uri') || ''
        }
      }

      // Also check if the whole search string has the bunker URI encoded differently
      if (!bunkerUri) {
        const fullUrl = window.location.href
        const bunkerMatch = fullUrl.match(/bunker:\/\/[^\s&]+/)
        if (bunkerMatch) {
          bunkerUri = decodeURIComponent(bunkerMatch[0])
        }
      }

      if (bunkerUri) {
        // Store bunker URI for the main app to pick up
        sessionStorage.setItem('samizdat_nip46_bunker', bunkerUri)
        setStatus('Connected! Redirecting...')
        // Redirect to main app — useNostr will detect the stored bunker URI
        setTimeout(() => navigate('/', { replace: true }), 500)
      } else {
        // Maybe the callback just confirms the connection was accepted
        // and the relay flow will work now. Just redirect back.
        sessionStorage.setItem('samizdat_nip46_callback_received', 'true')
        setStatus('Permission granted. Redirecting...')
        setTimeout(() => navigate('/', { replace: true }), 500)
      }
    } catch (e: any) {
      setStatus(`Login error: ${e.message}`)
      setTimeout(() => navigate('/', { replace: true }), 2000)
    }
  }, [navigate])

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      fontFamily: "'Source Serif 4', Georgia, serif",
      fontSize: '1.2rem',
      color: '#2d2d2d',
      background: '#f5f0e1',
    }}>
      <p>{status}</p>
    </div>
  )
}
