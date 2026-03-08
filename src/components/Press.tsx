import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { SimplePool } from 'nostr-tools'
import { nip19 } from 'nostr-tools'
import { DEFAULT_RELAYS, fetchProfile } from '../lib/nostr'
import './Press.css'

interface PressArticle {
  id: string
  pubkey: string
  title: string
  summary?: string
  image?: string
  slug: string
  publishedAt: number
  tags: string[]
  zapGated: boolean
  naddr: string
  author?: { name?: string; picture?: string; nip05?: string }
}

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export function Press() {
  const [articles, setArticles] = useState<PressArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [featured, setFeatured] = useState<PressArticle | null>(null)

  useEffect(() => {
    async function loadArticles() {
      const pool = new SimplePool()
      try {
        const events = await pool.querySync(DEFAULT_RELAYS, {
          kinds: [30023],
          limit: 30,
        })

        // Deduplicate by pubkey+slug (keep latest)
        const seen = new Map<string, typeof events[0]>()
        for (const e of events) {
          const d = e.tags.find(t => t[0] === 'd')?.[1] || ''
          const key = `${e.pubkey}:${d}`
          const existing = seen.get(key)
          if (!existing || e.created_at > existing.created_at) {
            seen.set(key, e)
          }
        }

        const unique = Array.from(seen.values())
          .sort((a, b) => b.created_at - a.created_at)
          .slice(0, 15)

        // Build article list
        const arts: PressArticle[] = unique.map(e => {
          const getTag = (name: string) => e.tags.find(t => t[0] === name)?.[1]
          const title = getTag('title') || 'Untitled'
          const slug = getTag('d') || ''
          const summary = getTag('summary')
          const image = getTag('image')
          const publishedAt = getTag('published_at')
            ? parseInt(getTag('published_at')!)
            : e.created_at
          const tags = e.tags.filter(t => t[0] === 't').map(t => t[1])
          const zapGated = e.tags.some(t => t[0] === 'zap_gate')

          const naddr = nip19.naddrEncode({
            kind: 30023,
            pubkey: e.pubkey,
            identifier: slug,
            relays: DEFAULT_RELAYS.slice(0, 2),
          })

          return {
            id: e.id,
            pubkey: e.pubkey,
            title,
            summary,
            image,
            slug,
            publishedAt,
            tags,
            zapGated,
            naddr,
          }
        })

        // Fetch unique author profiles
        const pubkeys = [...new Set(arts.map(a => a.pubkey))]
        const profiles = new Map<string, PressArticle['author']>()

        await Promise.allSettled(
          pubkeys.map(async pk => {
            const p = await fetchProfile(pk, DEFAULT_RELAYS)
            if (p) profiles.set(pk, p)
          })
        )

        // Attach profiles
        for (const art of arts) {
          art.author = profiles.get(art.pubkey) || undefined
        }

        // Pick featured: first article with an image
        const feat = arts.find(a => a.image) || arts[0]
        setFeatured(feat || null)
        setArticles(feat ? arts.filter(a => a.id !== feat.id) : arts)
      } catch (e) {
        console.error('Failed to load press:', e)
      } finally {
        pool.close(DEFAULT_RELAYS)
        setLoading(false)
      }
    }

    loadArticles()
  }, [])

  return (
    <div className="press">
      <nav className="press-nav">
        <Link to="/" className="press-wordmark">samizdat</Link>
        <span className="press-subtitle">the press</span>
      </nav>

      <header className="press-header">
        <div className="press-rule" />
        <h1 className="press-title">The Latest</h1>
        <p className="press-description">Long-form writing from across the nostr network</p>
        <div className="press-rule" />
      </header>

      {loading ? (
        <div className="press-loading">
          <span className="press-loading-text">Tuning into relays…</span>
        </div>
      ) : (
        <>
          {/* Featured article */}
          {featured && (
            <Link to={`/a/${featured.naddr}`} className="press-featured">
              {featured.image && (
                <div className="press-featured-image">
                  <img src={featured.image} alt="" />
                </div>
              )}
              <div className="press-featured-text">
                <h2 className="press-featured-title">{featured.title}</h2>
                {featured.summary && (
                  <p className="press-featured-summary">{featured.summary}</p>
                )}
                <div className="press-featured-meta">
                  <span className="press-article-author">
                    {featured.author?.name || featured.pubkey.slice(0, 12) + '…'}
                  </span>
                  <span className="press-article-date">{formatDate(featured.publishedAt)}</span>
                  {featured.zapGated && <span className="press-zap-badge">⚡ Zap-gated</span>}
                </div>
              </div>
            </Link>
          )}

          {/* Article list */}
          <div className="press-list">
            {articles.map((article, i) => (
              <Link
                key={article.id}
                to={`/a/${article.naddr}`}
                className="press-item"
              >
                <span className="press-item-num">{String(i + 1).padStart(2, '0')}</span>
                <div className="press-item-content">
                  <h3 className="press-item-title">{article.title}</h3>
                  {article.summary && (
                    <p className="press-item-summary">{article.summary}</p>
                  )}
                  <div className="press-item-meta">
                    <span className="press-article-author">
                      {article.author?.name || article.pubkey.slice(0, 12) + '…'}
                    </span>
                    <span className="press-article-date">{formatDate(article.publishedAt)}</span>
                    {article.zapGated && <span className="press-zap-badge">⚡</span>}
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {articles.length === 0 && !featured && (
            <div className="press-empty">
              No articles found. The underground press awaits its first publication.
            </div>
          )}
        </>
      )}

      <footer className="press-footer">
        <div className="press-rule" />
        <div className="press-footer-content">
          <Link to="/" className="press-footer-link">← Write something</Link>
          <span className="press-footer-tagline">Uncensorable publishing on nostr</span>
        </div>
      </footer>
    </div>
  )
}
