import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { SimplePool } from 'nostr-tools'
import { nip19 } from 'nostr-tools'
import { DEFAULT_RELAYS, fetchProfile } from '../lib/nostr'
import './Press.css'

// Curated writers — hex pubkeys of known quality NIP-23 authors
const CURATED_AUTHORS = [
  '6e468422dfb74a5738702a8823b9b28168abab8655faacb6853cd0ee15deee93', // dergigi
  '04c915daefee38317fa734444acee390a8269fe5810b2241e5e6dd343dfbecc9', // ODELL
  '84dee6e676e5bb67b4ad4e042cf70cbd8681155db535942fcc6a0533858a7240', // Snowden
  '472f440f29ef996e92a186b8d320ff180c855903882e59d50de1b8571a76b032', // Marty Bent
  'e88a691e98d9987c964521dff60025f60700378a4879180dcbbb4a5027850411', // NVK
  '7bdef7be22dd8e59f4600e044aa53a1cf975a9dc7d27df5833bc77db784a5805', // hzrd149 (nostr dev)
  'd61f3bc5b3eb4400efdae6169a5c17cabf3246b514361de939ce4a1a0da6ef4a', // miljan
  '82341f882b6eabcd2ba7f1ef90aad961cf074af15b9ef44a09f9d2a8fbfbe6a2', // jack (dorsey)
]

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
  reactions?: number
}

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export function Press() {
  const [curatedArticles, setCuratedArticles] = useState<PressArticle[]>([])
  const [trendingArticles, setTrendingArticles] = useState<PressArticle[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadArticles() {
      const pool = new SimplePool()
      try {
        // Fetch curated authors + recent articles in parallel
        const [curatedEvents, recentEvents] = await Promise.all([
          // Curated: specific authors
          pool.querySync(DEFAULT_RELAYS, {
            kinds: [30023],
            authors: CURATED_AUTHORS,
            limit: 20,
          }),
          // Recent: anyone
          pool.querySync(DEFAULT_RELAYS, {
            kinds: [30023],
            limit: 60,
          }),
        ])

        const toArticle = (e: typeof curatedEvents[0]): PressArticle | null => {
          const getTag = (name: string) => e.tags.find(t => t[0] === name)?.[1]
          const title = getTag('title')
          if (!title || title.trim().length < 5 || title.toLowerCase() === 'untitled') return null
          if (e.content.length < 200) return null

          const slug = getTag('d') || ''
          return {
            id: e.id,
            pubkey: e.pubkey,
            title,
            summary: getTag('summary'),
            image: getTag('image'),
            slug,
            publishedAt: getTag('published_at') ? parseInt(getTag('published_at')!) : e.created_at,
            tags: e.tags.filter(t => t[0] === 't').map(t => t[1]),
            zapGated: e.tags.some(t => t[0] === 'zap_gate'),
            naddr: nip19.naddrEncode({
              kind: 30023, pubkey: e.pubkey, identifier: slug,
              relays: DEFAULT_RELAYS.slice(0, 2),
            }),
          }
        }

        // Deduplicate helper
        const dedup = (events: typeof curatedEvents) => {
          const seen = new Map<string, typeof events[0]>()
          for (const e of events) {
            const d = e.tags.find(t => t[0] === 'd')?.[1] || ''
            const key = `${e.pubkey}:${d}`
            const existing = seen.get(key)
            if (!existing || e.created_at > existing.created_at) seen.set(key, e)
          }
          return Array.from(seen.values()).sort((a, b) => b.created_at - a.created_at)
        }

        // Build curated list
        const curated = dedup(curatedEvents)
          .map(toArticle)
          .filter((a): a is PressArticle => a !== null)
          .slice(0, 8)

        // Build trending: recent articles NOT from curated authors
        const curatedIds = new Set(curated.map(a => a.id))
        const recent = dedup(recentEvents)
          .map(toArticle)
          .filter((a): a is PressArticle => a !== null && !curatedIds.has(a.id))

        // Count reactions for trending scoring
        if (recent.length > 0) {
          const articleIds = recent.slice(0, 20).map(a => a.id)
          try {
            const reactions = await pool.querySync(DEFAULT_RELAYS, {
              kinds: [7, 9735], // likes + zaps
              '#e': articleIds,
              limit: 200,
            })

            // Count per article
            const counts = new Map<string, number>()
            for (const r of reactions) {
              for (const tag of r.tags) {
                if (tag[0] === 'e' && articleIds.includes(tag[1])) {
                  counts.set(tag[1], (counts.get(tag[1]) || 0) + (r.kind === 9735 ? 3 : 1)) // zaps worth 3x
                }
              }
            }

            // Attach counts and sort
            for (const art of recent) {
              art.reactions = counts.get(art.id) || 0
            }
          } catch {
            // Reaction counting failed, just use recency
          }
        }

        // Sort trending: reactions first, then recency
        const trending = recent
          .sort((a, b) => (b.reactions || 0) - (a.reactions || 0) || b.publishedAt - a.publishedAt)
          .slice(0, 10)

        // Fetch profiles for all unique pubkeys
        const allArts = [...curated, ...trending]
        const pubkeys = [...new Set(allArts.map(a => a.pubkey))]
        const profiles = new Map<string, PressArticle['author']>()

        await Promise.allSettled(
          pubkeys.slice(0, 15).map(async pk => {
            const p = await fetchProfile(pk, DEFAULT_RELAYS)
            if (p) profiles.set(pk, p)
          })
        )

        for (const art of allArts) {
          art.author = profiles.get(art.pubkey) || undefined
        }

        setCuratedArticles(curated)
        setTrendingArticles(trending)
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
          {/* Editor's Picks — curated authors */}
          {curatedArticles.length > 0 && (
            <section className="press-section">
              <h2 className="press-section-title">Editor's Picks</h2>
              <div className="press-section-rule" />

              {/* Featured: first curated article with an image */}
              {curatedArticles[0] && (
                <Link to={`/a/${curatedArticles[0].naddr}`} className="press-featured">
                  {curatedArticles[0].image && (
                    <div className="press-featured-image">
                      <img src={curatedArticles[0].image} alt="" />
                    </div>
                  )}
                  <div className="press-featured-text">
                    <h2 className="press-featured-title">{curatedArticles[0].title}</h2>
                    {curatedArticles[0].summary && (
                      <p className="press-featured-summary">{curatedArticles[0].summary}</p>
                    )}
                    <div className="press-featured-meta">
                      <span className="press-article-author">
                        {curatedArticles[0].author?.name || curatedArticles[0].pubkey.slice(0, 12) + '…'}
                      </span>
                      <span className="press-article-date">{formatDate(curatedArticles[0].publishedAt)}</span>
                    </div>
                  </div>
                </Link>
              )}

              {/* Rest of curated */}
              <div className="press-list">
                {curatedArticles.slice(1).map((article, i) => (
                  <Link key={article.id} to={`/a/${article.naddr}`} className="press-item">
                    <span className="press-item-num">{String(i + 1).padStart(2, '0')}</span>
                    <div className="press-item-content">
                      <h3 className="press-item-title">{article.title}</h3>
                      {article.summary && <p className="press-item-summary">{article.summary}</p>}
                      <div className="press-item-meta">
                        <span className="press-article-author">{article.author?.name || article.pubkey.slice(0, 12) + '…'}</span>
                        <span className="press-article-date">{formatDate(article.publishedAt)}</span>
                        {article.zapGated && <span className="press-zap-badge">⚡</span>}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Trending / Fresh — engagement-ranked */}
          {trendingArticles.length > 0 && (
            <section className="press-section">
              <h2 className="press-section-title">Fresh Off the Press</h2>
              <div className="press-section-rule" />
              <div className="press-list">
                {trendingArticles.map((article, i) => (
                  <Link key={article.id} to={`/a/${article.naddr}`} className="press-item">
                    <span className="press-item-num">{String(i + 1).padStart(2, '0')}</span>
                    <div className="press-item-content">
                      <h3 className="press-item-title">{article.title}</h3>
                      {article.summary && <p className="press-item-summary">{article.summary}</p>}
                      <div className="press-item-meta">
                        <span className="press-article-author">{article.author?.name || article.pubkey.slice(0, 12) + '…'}</span>
                        <span className="press-article-date">{formatDate(article.publishedAt)}</span>
                        {article.zapGated && <span className="press-zap-badge">⚡</span>}
                        {(article.reactions || 0) > 0 && (
                          <span className="press-reactions">♡ {article.reactions}</span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {curatedArticles.length === 0 && trendingArticles.length === 0 && (
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
