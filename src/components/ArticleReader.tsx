import { useState, useEffect, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { markdownToHtml } from '../lib/markdown'
import { fetchArticleByNaddr, fetchProfile, fetchComments, type ArticleData, type CommentData } from '../lib/reader'
import { DEFAULT_RELAYS } from '../lib/nostr'
import { useLoadingMessage } from '../hooks/useLoadingMessage'
import { useAutoZapVerification } from '../hooks/useAutoZapVerification'
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

interface ArticleReaderProps {
  currentUserPubkey?: string | null
  onDeleteArticle?: (article: any) => Promise<void>
}

export function ArticleReader({ currentUserPubkey, onDeleteArticle }: ArticleReaderProps = {}) {
  const { naddr } = useParams<{ naddr: string }>()
  const [article, setArticle] = useState<ArticleData | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [author, setAuthor] = useState<{ name?: string; picture?: string; nip05?: string; lud16?: string } | null>(null)
  const [comments, setComments] = useState<CommentData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [commentText, setCommentText] = useState('')
  const [isCommenting, setIsCommenting] = useState(false)
  const [unlocking, setUnlocking] = useState(false)
  const [forceUnlocked, setForceUnlocked] = useState(false)
  const loadingMsg = useLoadingMessage()
  const navigate = useNavigate()

  const isOwnArticle = article && currentUserPubkey && article.pubkey === currentUserPubkey

  const handleDelete = async () => {
    if (!article || !onDeleteArticle) return
    setDeleting(true)
    try {
      await onDeleteArticle(article)
      navigate(-1)
    } catch (e) {
      console.error('Delete failed:', e)
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  // Auto-verification for seamless zap experience
  const zapVerification = useAutoZapVerification(
    {
      authorPubkey: article?.pubkey || '',
      articleEventId: article?.id || '',
      zapAmount: article?.zapGate || 21
    },
    {
      enabled: !!article?.zapGate && !forceUnlocked,
      readerPubkey: undefined, // TODO: get from current user session
      checkInterval: 60000, // check every 60 seconds (less aggressive)
      onUnlock: () => {
        console.log('🎉 Auto-unlocked via zap verification!')
        setForceUnlocked(true)
        handleUnlock()
      }
    }
  )
  


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
  }, [commentText])

  // Compute derived state (must be after hooks, before returns)
  const zapGateAmount = article?.zapGate
  const previewEnd = article?.previewEnd
  const isGated = !!zapGateAmount && !!previewEnd
  
  // Zap gate detection working ✅

  let bodyHtml = ''
  let isUnlocked = false

  if (article) {
    if (isGated) {
      const zapKey = `samizdat_zapped_${article.id}`
      isUnlocked = !!localStorage.getItem(zapKey) || forceUnlocked

      
      // Unlock state detection working ✅

      if (isUnlocked) {
        bodyHtml = markdownToHtml(article.content)
      } else {
        const paragraphs = article.content.split(/\n\n+/)
        const previewMd = paragraphs.slice(0, previewEnd).join('\n\n')
        bodyHtml = markdownToHtml(previewMd)
      }
    } else {
      bodyHtml = markdownToHtml(article.content)
    }
  }

  if (loading) {
    return (
      <div className="reader-page">
        <div className="reader-loading">
          <div className="reader-loading-pulse" />
          <span>{loadingMsg}</span>
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

  const handleUnlock = async () => {
    if (!article) return
    setUnlocking(true)
    try {
      // Try to fetch the full article from the Samizdat private relay
      const { fetchArticleFromRelay } = await import('../lib/reader')
      const fullArticle = await fetchArticleFromRelay(
        article.pubkey,
        article.slug,
        'wss://relay.samizdat.press'
      )
      if (fullArticle && fullArticle.content.length > article.content.length) {
        // Got the full content — save unlock state and reload with full content
        const zapKey = `samizdat_zapped_${article.id}`
        localStorage.setItem(zapKey, '1')
        setArticle(fullArticle)
        setForceUnlocked(true)
      } else {
        // Fallback: honor system unlock
        const zapKey = `samizdat_zapped_${article.id}`
        localStorage.setItem(zapKey, '1')
        window.location.reload()
      }
    } catch (e) {
      // Relay not available yet — honor system fallback
      const zapKey = `samizdat_zapped_${article.id}`
      localStorage.setItem(zapKey, '1')
      window.location.reload()
    } finally {
      setUnlocking(false)
    }
  }

  return (
    <div className="reader-page">
      {/* Minimal nav */}
      <nav className="reader-nav">
        <Link to="/read" className="reader-wordmark">samizdat</Link>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {isOwnArticle && onDeleteArticle && (
            confirmDelete ? (
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem', background: '#c0392b', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', minHeight: '36px' }}
                >
                  {deleting ? 'Deleting…' : 'Confirm delete'}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem', background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', minHeight: '36px' }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem', background: 'transparent', color: '#c0392b', border: '1px solid #c0392b', borderRadius: '6px', cursor: 'pointer', minHeight: '36px' }}
              >
                Delete
              </button>
            )
          )}
          <a href="/" className="reader-write-btn">Start writing</a>
        </div>
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
          className={`reader-body ${isGated && !isUnlocked ? 'gated' : ''}`}
          dangerouslySetInnerHTML={{ __html: bodyHtml }}
        />

        {/* Paywall */}
        {isGated && !isUnlocked && (
          <div className="paywall">
            <div className="paywall-fade" />
            <div className="paywall-content">
              <span className="paywall-icon">⚡</span>
              <h3>This article is zap-gated</h3>
              <p>The author requires a zap of <strong>{zapGateAmount} sats</strong> to read the full article.</p>
              
              {author?.lud16 && (
                <div className="paywall-zap-section">
                  <button
                    className="paywall-zap-button"
                    onClick={() => {
                      // Try to open lightning wallet
                      const lightningUrl = `lightning:${author.lud16}?amount=${(zapGateAmount || 21) * 1000}&comment=Zap%20for%20article%20unlock`
                      
                      // For mobile - try to open lightning URL
                      if (Capacitor.isNativePlatform()) {
                        window.open(lightningUrl, '_system')
                      } else {
                        // For web - try lightning URL, fallback to copy
                        const linkEl = document.createElement('a')
                        linkEl.href = lightningUrl
                        linkEl.click()
                        
                        // Also copy to clipboard as fallback
                        if (author.lud16) {
                          navigator.clipboard?.writeText(author.lud16).catch(() => {
                            // Fallback: show address in alert
                            alert(`Lightning Address: ${author.lud16}\n\nZap ${zapGateAmount || 21} sats to unlock this article.`)
                          })
                        }
                      }
                    }}
                    title={`Zap ${author.name || 'author'} ${zapGateAmount} sats`}
                  >
                    ⚡ Zap {zapGateAmount} sats
                  </button>
                  
                  <div className="paywall-address">
                    <code>{author.lud16}</code>
                    <button 
                      className="copy-btn"
                      onClick={() => {
                        if (author.lud16) {
                          navigator.clipboard?.writeText(author.lud16).then(() => {
                            // TODO: show toast
                            alert('Lightning address copied!')
                          }).catch(() => {
                            alert(`Lightning Address: ${author.lud16}`)
                          })
                        }
                      }}
                    >
                      📋
                    </button>
                  </div>
                  
                  <p className="paywall-hint">
                    Zap {zapGateAmount} sats, then return here — the article will unlock automatically!
                  </p>
                </div>
              )}

              {/* Auto-verification status - only show during manual checks */}
              {zapVerification.isVerifying && zapVerification.lastCheckTime && (
                <div className="paywall-verification">
                  <div className="verification-spinner"></div>
                  <span>Checking for zap receipt...</span>
                </div>
              )}

              {zapVerification.error && (
                <div className="paywall-error">
                  <span>⚠️ Verification error: {zapVerification.error}</span>
                </div>
              )}

              {/* Fallback manual unlock */}
              <div className="paywall-actions">
                <button 
                  className="paywall-unlock secondary" 
                  onClick={handleUnlock} 
                  disabled={unlocking || zapVerification.isVerifying}
                >
                  {unlocking ? 'Checking…' : 'Manual unlock'}
                </button>
                {zapVerification.lastCheckTime && (
                  <button 
                    className="paywall-recheck" 
                    onClick={zapVerification.manualCheck}
                    disabled={zapVerification.isVerifying}
                  >
                    ↻ Check again
                  </button>
                )}
              </div>

              <p className="paywall-note">
                ✨ Auto-verification enabled — zap and return for instant unlock!
              </p>
            </div>
          </div>
        )}

        {/* Zap / Share Bar */}
        <div className="reader-actions">
          {author?.lud16 && (
            <a
              href={`lightning:${author.lud16}`}
              className="reader-zap-btn"
              title={`Zap ${author.name || 'author'}`}
            >
              ⚡ Zap
            </a>
          )}
          <button
            className="reader-share-btn"
            onClick={async () => {
              const url = `https://samizdat.press/a/${naddr}`
              if (Capacitor.isNativePlatform()) {
                // Native Android share sheet
                const { Share } = await import('@capacitor/share')
                const { Haptics, ImpactStyle } = await import('@capacitor/haptics')
                await Haptics.impact({ style: ImpactStyle.Light }).catch(() => {})
                await Share.share({
                  title: article?.title || 'Samizdat Article',
                  text: article?.summary || article?.title || '',
                  url,
                  dialogTitle: 'Share article',
                })
              } else {
                // Web fallback: try native share, then clipboard
                if (navigator.share) {
                  await navigator.share({ title: article?.title, url }).catch(() => {
                    navigator.clipboard.writeText(url)
                  })
                } else {
                  navigator.clipboard.writeText(url)
                  alert('Link copied!')
                }
              }
            }}
          >
            🔗 Share
          </button>
          <a
            href={`https://njump.me/${naddr}`}
            target="_blank"
            rel="noopener noreferrer"
            className="reader-njump-btn"
          >
            ↗ View on nostr
          </a>
        </div>

        {/* Footer */}
        <footer className="reader-footer">
          <div className="reader-footer-divider" />
          <div className="reader-footer-meta">
            Published via <a href="/" className="reader-samizdat-link">Samizdat</a>
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
