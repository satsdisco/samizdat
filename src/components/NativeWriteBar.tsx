/**
 * NativeWriteBar — bottom action bar for the write screen on Android.
 * Replaces the crowded TitleBar buttons with a clean native-feeling bar.
 */
import { useState } from 'react'
import { RelayModal } from './RelayModal'
import type { RelayInfo } from '../types/nostr'
import './NativeWriteBar.css'

interface NativeWriteBarProps {
  wordCount: number
  isConnected: boolean
  isPublishing: boolean
  relays: RelayInfo[]
  onPublish: () => void
  onSaveDraft?: () => void
  onPreview: () => void
  onRelayToggle: (url: string, field: 'read' | 'write') => void
  onRelayAdd: (url: string) => void
  onRelayRemove: (url: string) => void
  onBack: () => void
}

export function NativeWriteBar({
  wordCount,
  isConnected,
  isPublishing,
  relays,
  onPublish,
  onPreview,
  onRelayToggle,
  onRelayAdd,
  onRelayRemove,
  onBack,
}: NativeWriteBarProps) {
  const [showRelays, setShowRelays] = useState(false)
  const writeRelayCount = relays.filter(r => r.write).length

  return (
    <>
      <div className="native-write-bar">
        {/* Left: Back */}
        <button className="nwb-back" onPointerUp={onBack}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        {/* Center: word count + relay indicator */}
        <button
          className="nwb-center"
          onPointerUp={() => setShowRelays(true)}
          title="Manage relays"
        >
          <span className={`nwb-dot ${isConnected ? 'connected' : ''}`} />
          <span className="nwb-words">{wordCount > 0 ? `${wordCount} words` : 'Write...'}</span>
          <span className="nwb-relay-count">{writeRelayCount}R</span>
        </button>

        {/* Right: actions */}
        <div className="nwb-actions">
          <button
            className="nwb-preview"
            onPointerUp={onPreview}
            disabled={wordCount === 0}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
          <button
            className={`nwb-publish ${isPublishing ? 'publishing' : ''}`}
            onPointerUp={onPublish}
            disabled={!isConnected || isPublishing || wordCount === 0}
          >
            {isPublishing ? '…' : 'Publish'}
          </button>
        </div>
      </div>

      {showRelays && (
        <RelayModal
          relays={relays}
          isConnected={isConnected}
          onToggle={onRelayToggle}
          onAdd={onRelayAdd}
          onRemove={onRelayRemove}
          onClose={() => setShowRelays(false)}
        />
      )}
    </>
  )
}
