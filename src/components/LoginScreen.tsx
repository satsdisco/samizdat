import { useState, useRef, useCallback, useEffect } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import './LoginScreen.css'

export type LoginMethod = 'extension' | 'bunker' | 'nsec'

interface LoginScreenProps {
  onExtensionLogin: () => void
  onBunkerLogin: (bunkerUrl: string) => void
  onNsecLogin: (nsec: string) => void
  onQrLogin: () => Promise<{ uri: string; waitForConnection: () => Promise<void> } | null>
  isLoggingIn: boolean
  loginError: string | null
}

export function LoginScreen({
  onExtensionLogin,
  onBunkerLogin,
  onNsecLogin,
  onQrLogin,
  isLoggingIn,
  loginError,
}: LoginScreenProps) {
  const [view, setView] = useState<'main' | 'bunker' | 'nsec' | 'qr'>('main')
  const [bunkerInput, setBunkerInput] = useState('')
  const [nsecInput, setNsecInput] = useState('')
  const [qrUri, setQrUri] = useState<string | null>(null)
  const [qrWaiting, setQrWaiting] = useState(false)
  const abortRef = useRef(false)
  const [showNstart, setShowNstart] = useState(false)
  const [nstartLoaded, setNstartLoaded] = useState(false)
  const [nstartError, setNstartError] = useState(false)

  const nstartParams = new URLSearchParams({
    an: 'Samizdat',
    at: 'modal',
    ac: 'modal',
    aa: 'c0392b',
    am: 'dark',
    aac: 'yes',
    arr: 'wss://relay.damus.io,wss://nos.lol,wss://relay.primal.net,wss://relay.nostr.band',
    awr: 'wss://relay.damus.io,wss://nos.lol,wss://relay.primal.net,wss://relay.nostr.band',
  })
  const nstartUrl = `https://nstart.me?${nstartParams.toString()}`

  const nstartRedirectUrl = (() => {
    const p = new URLSearchParams({
      an: 'Samizdat',
      at: 'web',
      ac: window.location.origin,
      aa: 'c0392b',
      am: 'dark',
      aac: 'yes',
      arr: 'wss://relay.damus.io,wss://nos.lol,wss://relay.primal.net,wss://relay.nostr.band',
      awr: 'wss://relay.damus.io,wss://nos.lol,wss://relay.primal.net,wss://relay.nostr.band',
    })
    return `https://nstart.me?${p.toString()}`
  })()

  // Listen for nstart postMessage completion
  useEffect(() => {
    if (!showNstart) return
    const handler = (event: MessageEvent) => {
      if (event.origin !== 'https://nstart.me') return
      if (event.data?.type === 'WIZARD_COMPLETE') {
        const cred = event.data.result?.nostrLogin
        if (cred) {
          setShowNstart(false)
          if (cred.startsWith('bunker://')) onBunkerLogin(cred)
          else if (cred.startsWith('nsec1')) onNsecLogin(cred)
        }
      } else if (event.data?.type === 'WIZARD_CANCEL') {
        setShowNstart(false)
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [showNstart, onBunkerLogin, onNsecLogin])

  // Detect if iframe failed to load (timeout)
  useEffect(() => {
    if (!showNstart) return
    setNstartLoaded(false)
    setNstartError(false)
    const timeout = setTimeout(() => {
      if (!nstartLoaded) setNstartError(true)
    }, 5000)
    return () => clearTimeout(timeout)
  }, [showNstart])

  const handleCreateAccount = useCallback(() => {
    setShowNstart(true)
  }, [])

  const handleBunkerSubmit = () => {
    const input = bunkerInput.trim()
    if (!input) return
    onBunkerLogin(input)
  }

  const handleNsecSubmit = () => {
    const input = nsecInput.trim()
    if (!input) return
    // Clear the input immediately — don't keep the key in DOM state longer than needed
    setNsecInput('')
    onNsecLogin(input)
  }

  const startQrFlow = async () => {
    setView('qr')
    setQrUri(null)
    setQrWaiting(true)
    abortRef.current = false

    try {
      const result = await onQrLogin()
      if (!result || abortRef.current) return

      setQrUri(result.uri)
      // Wait for the signer to connect
      await result.waitForConnection()
    } catch {
      // Error will be shown via loginError
    } finally {
      setQrWaiting(false)
    }
  }

  const handleQrBack = () => {
    abortRef.current = true
    setQrUri(null)
    setQrWaiting(false)
    setView('main')
  }

  // nstart onboarding overlay
  if (showNstart) {
    return (
      <div className="login-overlay">
        <div className="nstart-container">
          <div className="nstart-header">
            <h2>Create Your Nostr Identity</h2>
            <button className="nstart-close" onClick={() => setShowNstart(false)}>×</button>
          </div>
          <div className="nstart-iframe-wrap">
            <iframe
              src={nstartUrl}
              className="nstart-iframe"
              onLoad={() => setNstartLoaded(true)}
              allow="clipboard-write"
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-top-navigation"
            />
            {!nstartLoaded && !nstartError && (
              <div className="nstart-loading">Loading onboarding wizard…</div>
            )}
          </div>
          {nstartError && (
            <div className="nstart-fallback">
              <p>Wizard blocked by your browser?</p>
              <a href={nstartRedirectUrl} className="nstart-fallback-link">
                Open nstart.me in a new tab →
              </a>
            </div>
          )}
          <button className="nstart-back" onClick={() => setShowNstart(false)}>
            ‹ Back to login
          </button>
        </div>
      </div>
    )
  }

  // QR code scan view
  if (view === 'qr') {
    return (
      <div className="login-overlay">
        <div className="login-card">
          <h1>Scan with Signer</h1>
          <p className="login-subtitle">
            Open your signing app (Amber, Nostrsigner) and scan this QR code
            to connect securely.
          </p>

          <div className="qr-container">
            {qrUri ? (
              <>
                <div className="qr-code">
                  <QRCodeSVG
                    value={qrUri}
                    size={220}
                    level="M"
                    bgColor="transparent"
                    fgColor="currentColor"
                  />
                </div>
                <div className="qr-status">
                  <span className="qr-pulse" />
                  Waiting for signer…
                </div>

                {/* On mobile, offer a direct deep link to open signer app */}
                {/iPhone|iPad|iPod|Android/i.test(navigator.userAgent) && (
                  <a
                    href={qrUri}
                    className="login-method-btn featured"
                    style={{ textDecoration: 'none', textAlign: 'center', marginTop: '0.5rem', display: 'block' }}
                  >
                    Open in Signer App
                  </a>
                )}

                <button
                  className="qr-copy-btn"
                  onClick={() => navigator.clipboard.writeText(qrUri)}
                  title="Copy connection URI"
                >
                  Copy link instead
                </button>
              </>
            ) : qrWaiting ? (
              <div className="qr-generating">Generating connection…</div>
            ) : null}
          </div>

          {loginError && <div className="login-error">{loginError}</div>}

          <div className="login-divider">
            <span>or paste a bunker link</span>
          </div>

          <div className="login-field compact">
            <div className="input-with-icon">
              <svg className="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <input
                type="text"
                value={bunkerInput}
                onChange={e => setBunkerInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleBunkerSubmit()}
                placeholder="bunker://..."
                disabled={isLoggingIn}
              />
            </div>
            {bunkerInput.trim() && (
              <button
                className="inline-connect-btn"
                onClick={handleBunkerSubmit}
                disabled={isLoggingIn}
              >
                Connect
              </button>
            )}
          </div>

          <div className="login-nav">
            <button className="login-back" onClick={handleQrBack}>
              ‹ Back
            </button>
          </div>
        </div>
      </div>
    )
  }

  // nsec view
  if (view === 'nsec') {
    return (
      <div className="login-overlay">
        <div className="login-card">
          <h1>Log In with Key</h1>
          <p className="login-subtitle">
            Paste your private key (nsec). It stays in your browser
            and is never sent to any server.
          </p>

          <div className="login-warning">
            ⚠️ For better security, use a browser extension or remote signer instead.
          </div>

          <div className="login-field">
            <label htmlFor="nsec-input">Private Key</label>
            <div className="input-with-icon">
              <svg className="input-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
              </svg>
              <input
                id="nsec-input"
                type="password"
                value={nsecInput}
                onChange={e => setNsecInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleNsecSubmit()}
                placeholder="nsec1..."
                autoFocus
                disabled={isLoggingIn}
              />
            </div>
          </div>

          {loginError && <div className="login-error">{loginError}</div>}

          <button
            className="login-action-btn primary"
            onClick={handleNsecSubmit}
            disabled={isLoggingIn || !nsecInput.trim()}
          >
            {isLoggingIn ? 'Signing in…' : 'Sign In'}
          </button>

          <div className="login-nav">
            <button className="login-back" onClick={() => setView('main')}>
              ‹ Back
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Main view
  return (
    <div className="login-overlay">
      <div className="login-card">
        <h1>Log in with Nostr</h1>
        <p className="login-subtitle">
          samizdat is built on the{' '}
          <a href="https://nostr.com" target="_blank" rel="noopener noreferrer">nostr protocol</a>,
          which lets you own your identity and your words.
        </p>

        {loginError && <div className="login-error">{loginError}</div>}

        <div className="login-methods">
          {/* Extension — desktop users with Alby/nos2x */}
          {typeof window !== 'undefined' && !!window.nostr && (
            <button
              className="login-method-btn featured"
              onClick={onExtensionLogin}
              disabled={isLoggingIn}
            >
              <svg className="method-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              {isLoggingIn ? 'Connecting…' : 'Log in with Extension'}
            </button>
          )}

          {/* QR / Remote signer */}
          <button
            className={`login-method-btn${typeof window === 'undefined' || !window.nostr ? ' featured' : ''}`}
            onClick={startQrFlow}
            disabled={isLoggingIn}
          >
            <svg className="method-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="3" height="3" />
              <rect x="18" y="14" width="3" height="3" />
              <rect x="14" y="18" width="3" height="3" />
              <rect x="18" y="18" width="3" height="3" />
            </svg>
            {isLoggingIn ? 'Connecting…' : 'Scan QR / Remote Signer'}
          </button>

          <button
            className="login-method-btn"
            onClick={() => setView('nsec')}
            disabled={isLoggingIn}
          >
            <svg className="method-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
            </svg>
            Log in with Key
          </button>
        </div>

        <div className="login-create-section">
          <div className="login-divider">
            <span>new to nostr?</span>
          </div>
          <button
            className="login-create-btn"
            onClick={handleCreateAccount}
            disabled={isLoggingIn}
          >
            Create an Account
          </button>
          <p className="login-footer">
            <a href="https://nostr.how" target="_blank" rel="noopener noreferrer">What is nostr?</a>
          </p>
        </div>
      </div>
    </div>
  )
}
