import { useState } from 'react'
import { Capacitor } from '@capacitor/core'
import './PublishModal.css'

interface PublishModalProps {
  title: string
  onPublish: (options: {
    summary: string
    tags: string[]
    image: string
    zapGate?: { amount: number; previewEnd: number }
  }) => void
  onClose: () => void
  isPublishing: boolean
  paragraphCount: number
}

export function PublishModal({ title, onPublish, onClose, isPublishing, paragraphCount }: PublishModalProps) {
  const [summary, setSummary] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [image, setImage] = useState('')
  const [zapGated, setZapGated] = useState(false)
  const [zapAmount, setZapAmount] = useState(1000)
  const [previewEnd, setPreviewEnd] = useState(Math.max(1, Math.floor(paragraphCount / 3)))

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      const tag = tagInput.trim().toLowerCase().replace(/^#/, '')
      if (tag && !tags.includes(tag)) {
        setTags([...tags, tag])
        setTagInput('')
      }
    }
  }

  const removeTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag))
  }

  const handlePublish = async () => {
    // Haptic feedback on publish tap (native Android only)
    if (Capacitor.isNativePlatform()) {
      const { Haptics, ImpactStyle } = await import('@capacitor/haptics')
      await Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {})
    }
    onPublish({
      summary,
      tags,
      image,
      zapGate: zapGated ? { amount: zapAmount, previewEnd } : undefined,
    })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Publish to Nostr</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="modal-title-preview">
            <span className="label">Title</span>
            <p>{title || 'Untitled'}</p>
          </div>

          <div className="modal-field">
            <label htmlFor="summary">Summary</label>
            <textarea
              id="summary"
              value={summary}
              onChange={e => setSummary(e.target.value)}
              placeholder="Brief description of your article..."
              rows={3}
              maxLength={300}
            />
            <span className="char-count">{summary.length}/300</span>
          </div>

          <div className="modal-field">
            <label htmlFor="cover-image">Cover Image URL</label>
            <input
              id="cover-image"
              type="url"
              value={image}
              onChange={e => setImage(e.target.value)}
              placeholder="https://..."
            />
          </div>

          <div className="modal-field">
            <label htmlFor="tags">Tags</label>
            <input
              id="tags"
              type="text"
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={handleAddTag}
              placeholder="Type a tag and press Enter"
            />
            {tags.length > 0 && (
              <div className="tag-list">
                {tags.map(tag => (
                  <span key={tag} className="tag">
                    #{tag}
                    <button onClick={() => removeTag(tag)}>×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Zap Gate */}
          <div className="modal-divider" />
          <div className="zap-gate-section">
            <div className="zap-gate-toggle">
              <div className="zap-gate-label">
                <span className="zap-gate-icon">⚡</span>
                <div>
                  <span className="zap-gate-title">Zap-gated</span>
                  <span className="zap-gate-desc">Require a zap to read the full article</span>
                </div>
              </div>
              <button
                className={`toggle-switch ${zapGated ? 'on' : ''}`}
                onClick={() => setZapGated(!zapGated)}
                type="button"
              >
                <span className="toggle-knob" />
              </button>
            </div>

            {zapGated && (
              <div className="zap-gate-options">
                <div className="zap-gate-field">
                  <label>Zap amount (sats)</label>
                  <div className="zap-amount-row">
                    {[100, 500, 1000, 5000, 10000].map(amt => (
                      <button
                        key={amt}
                        className={`zap-preset ${zapAmount === amt ? 'active' : ''}`}
                        onClick={() => setZapAmount(amt)}
                        type="button"
                      >
                        {amt >= 1000 ? `${amt / 1000}k` : amt}
                      </button>
                    ))}
                    <input
                      type="number"
                      className="zap-custom"
                      value={zapAmount}
                      onChange={e => setZapAmount(Math.max(1, parseInt(e.target.value) || 0))}
                      min={1}
                    />
                  </div>
                </div>
                <div className="zap-gate-field">
                  <label>Free preview: first {previewEnd} of {paragraphCount} paragraphs</label>
                  <input
                    type="range"
                    min={1}
                    max={Math.max(1, paragraphCount - 1)}
                    value={previewEnd}
                    onChange={e => setPreviewEnd(parseInt(e.target.value))}
                    className="preview-slider"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="modal-cancel" onClick={onClose}>Cancel</button>
          <button
            className="modal-publish"
            onClick={handlePublish}
            disabled={isPublishing}
          >
            {isPublishing ? 'Signing & Publishing…' : 'Sign & Publish'}
          </button>
        </div>
      </div>
    </div>
  )
}
