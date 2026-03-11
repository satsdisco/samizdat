import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { npubEncode } from 'nostr-tools/nip19'
import type { NostrState } from '../hooks/useNostr'
import './Settings.css'

interface SettingsProps {
  profile: NostrState['profile']
  pubkey: string | null
  authMethod: string | null
  onLogout: () => void
}

export function Settings({ profile, pubkey, authMethod, onLogout }: SettingsProps) {
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)

  const npub = pubkey ? (() => {
    try {
      return npubEncode(pubkey)
    } catch { return pubkey }
  })() : ''

  const npubShort = npub ? `${npub.slice(0, 12)}…${npub.slice(-8)}` : ''

  const handleCopyNpub = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        const { Clipboard } = await import('@capacitor/clipboard')
        const { Haptics, ImpactStyle } = await import('@capacitor/haptics')
        await Clipboard.write({ string: npub })
        await Haptics.impact({ style: ImpactStyle.Light }).catch(() => {})
      } else {
        await navigator.clipboard.writeText(npub)
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (e) {
      console.error('Copy failed:', e)
    }
  }

  const handleLogout = () => {
    onLogout()
    navigate('/read', { replace: true })
  }

  return (
    <div className="settings-page">
      <div className="settings-header">
        <button className="settings-back" onClick={() => navigate(-1)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 className="settings-title">Settings</h1>
        <div style={{ width: 40 }} />
      </div>

      {/* Profile card */}
      <div className="settings-profile">
        {profile?.picture ? (
          <img src={profile.picture} alt="" className="settings-avatar" />
        ) : (
          <div className="settings-avatar-placeholder">
            {(profile?.name || 'A')[0].toUpperCase()}
          </div>
        )}
        <div className="settings-profile-info">
          <span className="settings-name">{profile?.name || 'Anonymous'}</span>
          {profile?.nip05 && (
            <span className="settings-nip05">{profile.nip05}</span>
          )}
          <span className="settings-npub">{npubShort}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="settings-section">
        <div className="settings-section-title">Account</div>

        <button className="settings-row" onClick={handleCopyNpub}>
          <div className="settings-row-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          </div>
          <div className="settings-row-content">
            <span className="settings-row-label">{copied ? 'Copied!' : 'Copy public key'}</span>
            <span className="settings-row-sub">{npubShort}</span>
          </div>
          <svg className="settings-row-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>

        <a
          className="settings-row"
          href={`https://njump.me/${npub}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <div className="settings-row-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <div className="settings-row-content">
            <span className="settings-row-label">View profile</span>
            <span className="settings-row-sub">Open on njump.me</span>
          </div>
          <svg className="settings-row-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </a>

        <div className="settings-row-info">
          <span className="settings-row-info-label">Login method</span>
          <span className="settings-row-info-value">{authMethod === 'android-signer' ? 'Signer app' : authMethod || 'Unknown'}</span>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">About</div>

        <a
          className="settings-row"
          href="https://samizdat.press"
          target="_blank"
          rel="noopener noreferrer"
        >
          <div className="settings-row-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
          </div>
          <div className="settings-row-content">
            <span className="settings-row-label">samizdat.press</span>
            <span className="settings-row-sub">Website</span>
          </div>
          <svg className="settings-row-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </a>

        <div className="settings-row-info">
          <span className="settings-row-info-label">Version</span>
          <span className="settings-row-info-value">1.0.0-alpha</span>
        </div>
      </div>

      {/* Sign out */}
      <div className="settings-section">
        <button className="settings-signout" onClick={handleLogout}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Sign out
        </button>
      </div>
    </div>
  )
}
