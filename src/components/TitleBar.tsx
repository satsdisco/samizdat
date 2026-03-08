import { useState, useRef, useEffect } from 'react'
import type { RelayInfo } from '../types/nostr'
import './TitleBar.css'

interface TitleBarProps {
  wordCount: number
  onPublish: () => void
  onSaveDraft: () => void
  onPreview: () => void
  isConnected: boolean
  isPublishing: boolean
  pubkey: string | null
  npubShort: string | null
  profile: { name?: string; picture?: string; nip05?: string } | null
  onLogin: () => void
  onLogout: () => void
  isLoggingIn: boolean
  relayCount: number
  relays: RelayInfo[]
  onRelayToggle: (url: string, field: 'read' | 'write') => void
  onToggleSidebar: () => void
}

export function TitleBar({
  wordCount,
  onPublish,
  onSaveDraft,
  onPreview,
  isConnected,
  isPublishing,
  pubkey,
  npubShort,
  profile,
  onLogin,
  onLogout,
  isLoggingIn,
  relays,
  onRelayToggle,
  onToggleSidebar,
}: TitleBarProps) {
  const [showRelays, setShowRelays] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    if (!showRelays) return
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowRelays(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showRelays])

  const writeRelays = relays.filter(r => r.write)
  const readRelays = relays.filter(r => r.read)

  return (
    <header className="titlebar">
      <div className="titlebar-left">
        {pubkey && (
          <button className="sidebar-toggle" onClick={onToggleSidebar} title="My articles">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        )}
        <span className="titlebar-logo">samizdat</span>
      </div>

      <div className="titlebar-center">
        <span className="word-count">{wordCount} words</span>
      </div>

      <div className="titlebar-right">
        {pubkey ? (
          <>
            <div className="relay-status-wrapper" ref={dropdownRef}>
              <button
                className="relay-status"
                onClick={() => setShowRelays(!showRelays)}
                title={`Publishing to ${writeRelays.length} relays`}
              >
                <span className={`connection-dot ${isConnected ? 'connected' : ''}`} />
                <span className="relay-count">{writeRelays.length}</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`relay-chevron ${showRelays ? 'open' : ''}`}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {showRelays && (
                <div className="relay-dropdown">
                  <div className="relay-dropdown-header">
                    <span>Relays</span>
                    <span className="relay-dropdown-sub">{writeRelays.length} write · {readRelays.length} read</span>
                  </div>
                  <div className="relay-dropdown-list">
                    {relays.map(relay => {
                      const host = relay.url.replace('wss://', '').replace('ws://', '').replace(/\/$/, '')
                      return (
                        <div key={relay.url} className="relay-row">
                          <span className="relay-host" title={relay.url}>{host}</span>
                          <div className="relay-toggles">
                            <button
                              className={`relay-toggle ${relay.read ? 'active' : ''}`}
                              onClick={() => onRelayToggle(relay.url, 'read')}
                              title="Read from this relay"
                            >
                              R
                            </button>
                            <button
                              className={`relay-toggle ${relay.write ? 'active' : ''}`}
                              onClick={() => onRelayToggle(relay.url, 'write')}
                              title="Write to this relay"
                            >
                              W
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {relays.length === 0 && (
                    <div className="relay-empty">No relays found. Using defaults.</div>
                  )}
                </div>
              )}
            </div>

            <button
              className="preview-btn"
              onClick={onPreview}
              disabled={wordCount === 0}
              title="Preview article"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>

            <button
              className="draft-btn"
              onClick={onSaveDraft}
              disabled={isPublishing || wordCount === 0}
              title="Save as draft (kind:30024)"
            >
              Draft
            </button>

            <button
              className="publish-btn"
              onClick={onPublish}
              disabled={!isConnected || isPublishing || wordCount === 0}
            >
              {isPublishing ? 'Publishing…' : 'Publish'}
            </button>

            <button className="user-btn" onClick={onLogout} title={`Signed in as ${profile?.name || npubShort}`}>
              {profile?.picture ? (
                <img src={profile.picture} alt="" className="user-avatar" />
              ) : (
                <span className="user-initial">{(profile?.name || '?')[0]}</span>
              )}
            </button>
          </>
        ) : (
          <button className="login-btn" onClick={onLogin} disabled={isLoggingIn}>
            {isLoggingIn ? 'Connecting…' : 'Sign in'}
          </button>
        )}
      </div>
    </header>
  )
}
