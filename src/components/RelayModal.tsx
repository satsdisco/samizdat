import { useState } from 'react'
import { Capacitor } from '@capacitor/core'
import type { RelayInfo } from '../types/nostr'
import './RelayModal.css'

interface RelayModalProps {
  relays: RelayInfo[]
  isConnected: boolean
  onToggle: (url: string, field: 'read' | 'write') => void
  onAdd: (url: string) => void
  onRemove: (url: string) => void
  onClose: () => void
}

export function RelayModal({ relays, isConnected, onToggle, onAdd, onRemove, onClose }: RelayModalProps) {
  const [newUrl, setNewUrl] = useState('')
  const isNative = Capacitor.isNativePlatform()

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    const url = newUrl.trim()
    if (!url) return
    const full = url.startsWith('wss://') || url.startsWith('ws://') ? url : `wss://${url}`
    if (!relays.some(r => r.url === full)) onAdd(full)
    setNewUrl('')
  }

  const writeCount = relays.filter(r => r.write).length
  const readCount = relays.filter(r => r.read).length

  return (
    <div className={`relay-modal-overlay ${isNative ? 'native' : ''}`} onClick={onClose}>
      <div className={`relay-modal ${isNative ? 'native' : ''}`} onClick={e => e.stopPropagation()}>

        {/* Handle bar (native only) */}
        {isNative && <div className="relay-modal-handle" />}

        <div className="relay-modal-header">
          <div className="relay-modal-title">
            <span className={`relay-modal-dot ${isConnected ? 'connected' : ''}`} />
            Relays
          </div>
          <div className="relay-modal-counts">{writeCount} write · {readCount} read</div>
            <button className="relay-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="relay-modal-list">
          {relays.length === 0 && (
            <div className="relay-modal-empty">No relays. Add one below.</div>
          )}
          {relays.map(relay => {
            const host = relay.url.replace(/^wss?:\/\//, '').replace(/\/$/, '')
            return (
              <div key={relay.url} className="relay-modal-row">
                <div className="relay-modal-host">{host}</div>
                <div className="relay-modal-actions">
                  <button
                    className={`relay-modal-pill ${relay.read ? 'on' : ''}`}
                    onClick={() => onToggle(relay.url, 'read')}
                  >read</button>
                  <button
                    className={`relay-modal-pill ${relay.write ? 'on' : ''}`}
                    onClick={() => onToggle(relay.url, 'write')}
                  >write</button>
                  <button className="relay-modal-remove" onClick={() => onRemove(relay.url)}>✕</button>
                </div>
              </div>
            )
          })}
        </div>

        <form className="relay-modal-add" onSubmit={handleAdd}>
          <input
            className="relay-modal-input"
            type="text"
            placeholder="wss://relay.example.com"
            value={newUrl}
            onChange={e => setNewUrl(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
          />
          <button className="relay-modal-add-btn" type="submit" disabled={!newUrl.trim()}>
            Add
          </button>
        </form>
      </div>
    </div>
  )
}
