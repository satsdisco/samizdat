import { useState, useRef, useCallback } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { androidSignerAvailable } from '../lib/androidSigner'
import './LoginScreen.css'

export type LoginMethod = 'extension' | 'bunker' | 'nsec' | 'android-signer'

interface LoginScreenProps {
  onExtensionLogin: () => void
  onBunkerLogin: (bunkerUrl: string) => void
  onNsecLogin: (nsec: string) => void
  onAndroidSignerLogin?: () => void
  onQrLogin: () => Promise<{ uri: string; waitForConnection: () => Promise<void> } | null>
  isLoggingIn: boolean
  loginError: string | null
}

const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
const isAndroidNative = androidSignerAvailable()

export function LoginScreen({
  onExtensionLogin,
  onBunkerLogin,
  onNsecLogin,
  onAndroidSignerLogin,
  onQrLogin,
  isLoggingIn,
  loginError,
}: LoginScreenProps) {
  const [view, setView] = useState<'main' | 'bunker' | 'nsec' | 'qr'>('main')
  const [bunkerInput, setBunkerInput] = useState('')
  const [nsecInput, setNsecInput] = useState('')
  const [qrUri, setQrUri] = useState<string | null>(null)
  const [qrWaiting, setQrWaiting] = useState(false)
  const [bunkerConnecting, setBunkerConnecting] = useState(false)
  const [copied, setCopied] = useState(false)
  const abortRef = useRef(false)

  const handleBunkerSubmit = () => {
    const input = bunkerInput.trim()
    if (!input) return
    setBunkerConnecting(true)
    onBunkerLogin(input)
  }

  const handleNsecSubmit = () => {
    const input = nsecInput.trim()
    if (!input) return
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
      await result.waitForConnection()
    } catch {
      // Error shown via loginError
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

  const handleCreateAccount = useCallback(() => {
    const params = new URLSearchParams({
      an: 'Samizdat',
      at: 'web',
      ac: window.location.origin,
      aa: 'c0392b',
      am: 'dark',
      aac: 'yes',
      arr: 'wss://relay.damus.io,wss://nos.lol,wss://relay.primal.net,wss://relay.nostr.band',
      awr: 'wss://relay.damus.io,wss://nos.lol,wss://relay.primal.net,wss://relay.nostr.band',
    })
    window.location.href = `https://nstart.me?${params.toString()}`
  }, [])

  // QR / Signer connect view
  if (view === 'qr') {
    return (
      <div className="login-overlay">
        <div className="login-card">
          {isMobile ? (
            // Mobile: QR code + copy link + instructions
            <>
              <h1>Connect Signer</h1>

              {qrUri ? (
                <>
                  <p className="login-subtitle">
                    Scan this code from another device, or copy the link and paste it into your signer app.
                  </p>

                  <div className="qr-container">
                    <div className="qr-code" style={{ maxWidth: '180px', margin: '0 auto' }}>
                      <QRCodeSVG
                        value={qrUri}
                        size={180}
                        level="M"
                        bgColor="transparent"
                        fgColor="currentColor"
                      />
                    </div>
                    <div className="qr-status">
                      <span className="qr-pulse" />
                      Listening for signer…
                    </div>
                  </div>

                  <button
                    className="login-action-btn primary"
                    onClick={() => {
                      navigator.clipboard.writeText(qrUri)
                        .then(() => setCopied(true))
                        .catch(() => {})
                      setTimeout(() => setCopied(false), 2000)
                    }}
                    style={{ marginTop: '0.5rem' }}
                  >
                    {copied ? '✓ Copied!' : 'Copy Connection Link'}
                  </button>

                  <p className="login-hint" style={{ marginTop: '0.8rem' }}>
                    Open <strong>Amber</strong> or your signer app → paste the link → approve.
                    This page will detect the connection automatically.
                  </p>
                </>
              ) : qrWaiting ? (
                <div className="qr-generating">Preparing connection…</div>
              ) : null}
            </>
          ) : (
            // Desktop: show QR code
            <>
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
            </>
          )}

          {loginError && <div className="login-error">{loginError}</div>}

          <div className="login-divider">
            <span>or paste a bunker link</span>
          </div>

          <form className="login-field compact" onSubmit={e => { e.preventDefault(); handleBunkerSubmit() }}>
            <div className="input-with-icon">
              <svg className="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <input
                type="text"
                value={bunkerInput}
                onChange={e => setBunkerInput(e.target.value)}
                placeholder="bunker://..."
                disabled={bunkerConnecting}
                autoComplete="off"
                autoCapitalize="off"
              />
            </div>
            <button
              type="submit"
              className="inline-connect-btn"
              disabled={bunkerConnecting || !bunkerInput.trim()}
            >
              {bunkerConnecting ? 'Connecting…' : 'Connect'}
            </button>
          </form>

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
          {/* Android native: "Open Signer App" — launches Android app chooser (Amber, Primal, etc.) */}
          {isAndroidNative && onAndroidSignerLogin && (
            <button
              className="login-method-btn featured"
              onClick={onAndroidSignerLogin}
              disabled={isLoggingIn}
            >
              <svg className="method-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              {isLoggingIn ? 'Connecting…' : 'Open Signer App'}
            </button>
          )}

          {/* Extension — desktop users with Alby/nos2x */}
          {!isMobile && typeof window !== 'undefined' && !!window.nostr && (
            <button
              className={`login-method-btn${!isAndroidNative ? ' featured' : ''}`}
              onClick={onExtensionLogin}
              disabled={isLoggingIn}
            >
              <svg className="method-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              {isLoggingIn ? 'Connecting…' : 'Log in with Extension'}
            </button>
          )}

          {/* Signer connect — on native Android this is hidden (NIP-55 button above handles it),
              on desktop shows QR, on mobile web shows deep link */}
          {!isAndroidNative && (
            <button
              className={`login-method-btn${isMobile || !window.nostr ? ' featured' : ''}`}
              onClick={startQrFlow}
              disabled={isLoggingIn}
            >
              <svg className="method-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                {isMobile ? (
                  <>
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                  </>
                ) : (
                  <>
                    <rect x="3" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" />
                    <rect x="14" y="14" width="3" height="3" />
                    <rect x="18" y="14" width="3" height="3" />
                    <rect x="14" y="18" width="3" height="3" />
                    <rect x="18" y="18" width="3" height="3" />
                  </>
                )}
              </svg>
              {isLoggingIn ? 'Connecting…' : isMobile ? 'Connect via QR / Link' : 'Scan QR / Remote Signer'}
            </button>
          )}

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
