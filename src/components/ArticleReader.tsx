import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { markdownToHtml } from '../lib/markdown'
import { fetchArticleByNaddr, fetchProfile, fetchComments, type ArticleData, type CommentData } from '../lib/reader'
import { DEFAULT_RELAYS } from '../lib/nostr'
import './ArticleReader.css'

function timeAgo(ts: number): string {
  const diff = Math.floor(Date.now() / 1000) - ts
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`
  return new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export function ArticleReader() {
  const { naddr } = useParams<{ naddr: string }>()
  const [article, setArticle] = useState<ArticleData | null>(null)
  const [author, setAuthor] = useState<{ name?: string; picture?: string; nip05?: string } | null>(null)
  const [comments, setComments] = useState<CommentData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [commentText, setCommentText] = useState('')
  const [isCommenting, setIsCommenting] = useState(false)

  useEffect(() => {
    if (!naddr) return
    setLoading(true)
    setError(null)

    fetchArticleByNaddr(naddr)
      .then(async (art) => {
        if (!art) {
          setError('Article not found')
          return
        }
        setArticle(art)

        // Fetch author profile and comments in parallel
        const [profile, cmts] = await Promise.all([
          fetchProfile(art.pubkey, DEFAULT_RELAYS).catch(() => null),
          fetchComments(art.id, DEFAULT_RELAYS).catch(() => []),
        ])
        setAuthor(profile)
        setComments(cmts)
      })
      .catch((e) => setError(e.message || 'Failed to load article'))
      .finally(() => setLoading(false))
  }, [naddr])

  const handleComment = useCallback(async () => {
    if (!commentText.trim() || !article) return
    // Check for NIP-07 extension
    if (!window.nostr) {
      alert('Install a nostr extension (Alby, nos2x) to comment.')
      return
    }
    setIsCommenting(true)
    try {
      const pubkey = await window.nostr.getPublicKey()
      const event = {
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['e', article.id, '', 'root'],
          ['p', article.pubkey],
          ['K', '30023'],
          ['k', '1'],
        ],
        content: commentText.trim(),
      }
      const signed = await window.nostr.signEvent(event)

      // Publish to default relays
      const { publishToRelays } = await import('../lib/nostr')
      await publishToRelays(signed, DEFAULT_RELAYS)

      // Add to local list
      const profile = await fetchProfile(pubkey, DEFAULT_RELAYS).catch(() => null)
      setComments(prev => [{
        id: signed.id!,
        pubkey,
        content: commentText.trim(),
        createdAt: signed.created_at,
        author: profile,
      }, ...prev])
      setCommentText('')
    } catch (e: any) {
      console.error('Comment failed:', e)
    } finally {
      setIsCommenting(false)
    }
  }, [commentText, article])

  if (loading) {
    return (
      <div className="reader-page">
        <div className="reader-loading">
          <div className="reader-loading-pulse" />
          <span>Fetching from relays…</span>
        </div>
      </div>
    )
  }

  if (error || !article) {
    return (
      <div className="reader-page">
        <div className="reader-error">
          <h1>404</h1>
          <p>{error || 'Article not found on any relay.'}</p>
          <a href="/" className="reader-home-link">← Back to Samizdat</a>
        </div>
      </div>
    )
  }

  const bodyHtml = markdownToHtml(article.content)

  return (
    <div className="reader-page">
      {/* Minimal nav */}
      <nav className="reader-nav">
        <a href="/" className="reader-wordmark">samizdat</a>
        <a href="/" className="reader-write-btn">Start writing</a>
      </nav>

      <article className="reader-article">
        {/* Banner */}
        {article.image && (
          <div className="reader-banner">
            <img src={article.image} alt="" />
          </div>
        )}

        {/* Header */}
        <header className="reader-header">
          <h1 className="reader-title">{article.title}</h1>

          {article.summary && (
            <p className="reader-summary">{article.summary}</p>
          )}

          <div className="reader-meta">
            <div className="reader-author">
              {author?.picture && (
                <img src={author.picture} alt="" className="reader-author-pic" />
              )}
              <div className="reader-author-info">
                <span className="reader-author-name">{author?.name || article.pubkey.slice(0, 12) + '…'}</span>
                {author?.nip05 && <span className="reader-author-nip05">{author.nip05}</span>}
              </div>
            </div>
            <div className="reader-date">
              {article.publishedAt ? formatDate(article.publishedAt) : 'Undated'}
            </div>
          </div>

          {article.tags.length > 0 && (
            <div className="reader-tags">
              {article.tags.map(tag => (
                <span key={tag} className="reader-tag">#{tag}</span>
              ))}
            </div>
          )}
        </header>

        {/* Body */}
        <div
          className="reader-body"
          dangerouslySetInnerHTML={{ __html: bodyHtml }}
        />

        {/* Footer */}
        <footer className="reader-footer">
          <div className="reader-footer-divider" />
          <div className="reader-footer-meta">
            Published via <a href="/" className="reader-samizdat-link">Samizdat</a>
            {' · '}
            <a
              href={`https://njump.me/${naddr}`}
              target="_blank"
              rel="noopener noreferrer"
              className="reader-nostr-link"
            >
              View on nostr ↗
            </a>
          </div>
        </footer>
      </article>

      {/* Comments */}
      <section className="reader-comments">
        <h2 className="comments-heading">
          Comments
          {comments.length > 0 && <span className="comments-count">{comments.length}</span>}
        </h2>

        {/* Comment input */}
        <div className="comment-compose">
          <textarea
            className="comment-input"
            placeholder="Share your thoughts…"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            rows={3}
          />
          <div className="comment-compose-footer">
            <span className="comment-hint">Requires a nostr extension to sign</span>
            <button
              className="comment-submit"
              onClick={handleComment}
              disabled={!commentText.trim() || isCommenting}
            >
              {isCommenting ? 'Posting…' : 'Comment'}
            </button>
          </div>
        </div>

        {/* Comment list */}
        {comments.length === 0 ? (
          <div className="comments-empty">
            No comments yet. Be the first to respond.
          </div>
        ) : (
          <div className="comments-list">
            {comments.map(comment => (
              <div key={comment.id} className="comment">
                <div className="comment-header">
                  {comment.author?.picture && (
                    <img src={comment.author.picture} alt="" className="comment-avatar" />
                  )}
                  <span className="comment-author">
                    {comment.author?.name || comment.pubkey.slice(0, 12) + '…'}
                  </span>
                  <span className="comment-time">{timeAgo(comment.createdAt)}</span>
                </div>
                <p className="comment-body">{comment.content}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
