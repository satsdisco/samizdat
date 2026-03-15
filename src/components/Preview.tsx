import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import './Preview.css'

interface PreviewProps {
  title: string
  bannerImage?: string
  html: string
  profile?: { name?: string; picture?: string; nip05?: string } | null
  npubShort?: string | null
  onClose: () => void
}

export function Preview({ title, bannerImage, html, profile, npubShort, onClose }: PreviewProps) {
  const now = new Date()
  const dateStr = now.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  // Handle hardware back button on Android
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    const handleBack = (e: Event) => {
      e.preventDefault()
      onClose()
    }
    document.addEventListener('backbutton', handleBack)
    return () => document.removeEventListener('backbutton', handleBack)
  }, [onClose])

  return (
    <div className="preview-overlay">
      <div className="preview-toolbar">
        <button className="preview-close" onClick={onClose}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to editing
        </button>
        <span className="preview-label">Preview</span>
        <div style={{ width: 120 }} />
      </div>

      <article className="preview-article">
        {bannerImage && (
          <div className="preview-banner">
            <img src={bannerImage} alt="" />
          </div>
        )}

        <div className="preview-content">
          <h1 className="preview-title">{title || 'Untitled'}</h1>

          <div className="preview-meta">
            {profile?.picture && (
              <img src={profile.picture} alt="" className="preview-avatar" />
            )}
            <div className="preview-meta-text">
              <span className="preview-author">
                {profile?.name || npubShort || 'Anonymous'}
              </span>
              {profile?.nip05 && (
                <span className="preview-nip05">{profile.nip05}</span>
              )}
              <span className="preview-date">{dateStr}</span>
            </div>
          </div>

          <div
            className="preview-body samizdat-editor"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </article>
    </div>
  )
}
