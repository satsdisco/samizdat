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

  return (
    <div className="preview-overlay">
      <div className="preview-toolbar">
        <span className="preview-label">Preview</span>
        <button className="preview-close" onClick={onClose}>
          ← Back to editing
        </button>
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
