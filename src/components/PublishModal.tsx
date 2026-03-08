import { useState } from 'react'
import './PublishModal.css'

interface PublishModalProps {
  title: string
  onPublish: (options: {
    summary: string
    tags: string[]
    image: string
  }) => void
  onClose: () => void
  isPublishing: boolean
}

export function PublishModal({ title, onPublish, onClose, isPublishing }: PublishModalProps) {
  const [summary, setSummary] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [image, setImage] = useState('')

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

  const handlePublish = () => {
    onPublish({ summary, tags, image })
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
