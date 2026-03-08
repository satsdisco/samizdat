import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { SimplePool } from 'nostr-tools'
import { nip19 } from 'nostr-tools'
import { DEFAULT_RELAYS, fetchProfile } from '../lib/nostr'
import './Press.css'

// Fallback curated authors (used when no curation list found on nostr)
const FALLBACK_AUTHORS = [
  '6e468422dfb74a5738702a8823b9b28168abab8655faacb6853cd0ee15deee93', // dergigi
  '04c915daefee38317fa734444acee390a8269fe5810b2241e5e6dd343dfbecc9', // ODELL
  '84dee6e676e5bb67b4ad4e042cf70cbd8681155db535942fcc6a0533858a7240', // Snowden
  '472f440f29ef996e92a186b8d320ff180c855903882e59d50de1b8571a76b032', // Marty Bent
  'e88a691e98d9987c964521dff60025f60700378a4879180dcbbb4a5027850411', // NVK
  '7bdef7be22dd8e59f4600e044aa53a1cf975a9dc7d27df5833bc77db784a5805', // hzrd149
  'd61f3bc5b3eb4400efdae6169a5c17cabf3246b514361de939ce4a1a0da6ef4a', // miljan
  '82341f882b6eabcd2ba7f1ef90aad961cf074af15b9ef44a09f9d2a8fbfbe6a2', // jack
]

// NIP-51 list identifier for Samizdat curation
const CURATION_LIST_D_TAG = 'samizdat-editors-picks'

// Fetch curation list (kind 30001) from any pubkey
async function fetchCurationList(pool: SimplePool, relays: string[]): Promise<{ authors: string[]; curatorPubkey?: string; curatorName?: string } | null> {
  // First, check if we have a saved curator pubkey
  const savedCurator = localStorage.getItem('samizdat_curator_pubkey')

  // Try to find any samizdat curation list
  const filter: any = {
    kinds: [30001],
    '#d': [CURATION_LIST_D_TAG],
    limit: 10,
  }
  if (savedCurator) {
    filter.authors = [savedCurator]
  }

  const events = await pool.querySync(relays, filter)
  if (events.length === 0) return null

  // Pick the most recent one
  const latest = events.sort((a, b) => b.created_at - a.created_at)[0]
  const authors = latest.tags
    .filter(t => t[0] === 'p')
    .map(t => t[1])

  return { authors, curatorPubkey: latest.pubkey }
}

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
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function ArticleCard({ article }: { article: PressArticle }) {
  return (
    <Link to={`/a/${article.naddr}`} className="press-card">
      {article.image && (
        <div className="press-card-thumb">
          <img src={article.image} alt="" loading="lazy" />
        </div>
      )}
      <div className="press-card-text">
        <h3 className="press-card-title">{article.title}</h3>
        {article.summary && (
          <p className="press-card-summary">{article.summary}</p>
        )}
        <div className="press-card-meta">
          {article.author?.picture && (
            <img src={article.author.picture} alt="" className="press-card-avatar" />
          )}
          <span className="press-card-author">
            {article.author?.name || article.pubkey.slice(0, 12) + '…'}
          </span>
          <span className="press-card-dot">·</span>
          <span className="press-card-date">{formatDate(article.publishedAt)}</span>
          {article.zapGated && <span className="press-zap-badge">⚡</span>}
          {(article.reactions || 0) > 0 && (
            <span className="press-reactions">♡ {article.reactions}</span>
          )}
        </div>
      </div>
    </Link>
  )
}

export function Press() {
  const [curatedArticles, setCuratedArticles] = useState<PressArticle[]>([])
  const [trendingArticles, setTrendingArticles] = useState<PressArticle[]>([])
  const [exclusiveArticles, setExclusiveArticles] = useState<PressArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [curatorName, setCuratorName] = useState<string | null>(null)
  const [showCurate, setShowCurate] = useState(false)
  const [curateInput, setCurateInput] = useState('')
  const [curateStatus, setCurateStatus] = useState('')
  const [curatedPubkeys, setCuratedPubkeys] = useState<string[]>([])
  const [curatedProfiles, setCuratedProfiles] = useState<Map<string, { name?: string; picture?: string }>>(new Map())

  // Check if user is logged in (has NIP-07 extension)
  const hasExtension = typeof window !== 'undefined' && !!window.nostr

  // Add author to curation list
  const handleAddAuthor = useCallback(async () => {
    if (!curateInput.trim()) return
    setCurateStatus('Looking up…')
    try {
      let hex = curateInput.trim()
      // Try to decode npub
      if (hex.startsWith('npub')) {
        const decoded = nip19.decode(hex)
        if (decoded.type === 'npub') hex = decoded.data as string
      }
      // Validate hex
      if (!/^[0-9a-f]{64}$/.test(hex)) {
        setCurateStatus('Invalid npub or hex pubkey')
        return
      }
      if (curatedPubkeys.includes(hex)) {
        setCurateStatus('Already in list')
        return
      }

      const updated = [...curatedPubkeys, hex]
      setCuratedPubkeys(updated)
      setCurateInput('')
      setCurateStatus('')

      // Fetch profile for the new author
      const profile = await fetchProfile(hex, DEFAULT_RELAYS)
      if (profile) {
        setCuratedProfiles(prev => new Map(prev).set(hex, profile))
      }
    } catch {
      setCurateStatus('Failed to look up')
    }
  }, [curateInput, curatedPubkeys])

  // Remove author from curation list
  const handleRemoveAuthor = useCallback((hex: string) => {
    setCuratedPubkeys(prev => prev.filter(p => p !== hex))
  }, [])

  // Publish curation list to nostr
  const handlePublishList = useCallback(async () => {
    if (!window.nostr || curatedPubkeys.length === 0) return
    setCurateStatus('Signing…')
    try {
      const event = {
        kind: 30001,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['d', CURATION_LIST_D_TAG],
          ['title', "Samizdat Editor's Picks"],
          ['description', 'Curated long-form writers for the Samizdat press'],
          ...curatedPubkeys.map(pk => ['p', pk]),
        ],
        content: '',
      }
      const signed = await window.nostr.signEvent(event)

      const pool = new SimplePool()
      const { publishToRelays } = await import('../lib/nostr')
      const results = await publishToRelays(signed, DEFAULT_RELAYS)
      pool.close(DEFAULT_RELAYS)

      const ok = results.filter(r => r.ok).length
      setCurateStatus(`Published to ${ok} relays ✓`)

      // Save curator pubkey for future loads
      const pubkey = await window.nostr.getPublicKey()
      localStorage.setItem('samizdat_curator_pubkey', pubkey)

      setTimeout(() => setCurateStatus(''), 3000)
    } catch (e: any) {
      setCurateStatus(e.message || 'Failed to publish')
    }
  }, [curatedPubkeys])

  useEffect(() => {
    async function loadArticles() {
      const pool = new SimplePool()
      try {
        // Try to fetch curation list from nostr
        const curation = await fetchCurationList(pool, DEFAULT_RELAYS)
        const curatedAuthors = curation?.authors?.length ? curation.authors : FALLBACK_AUTHORS

        // Set curated pubkeys for the editor UI
        setCuratedPubkeys(curatedAuthors)

        if (curation?.curatorPubkey) {
          const profile = await fetchProfile(curation.curatorPubkey, DEFAULT_RELAYS).catch(() => null)
          setCuratorName(profile?.name || null)
        }

        const [curatedEvents, recentEvents] = await Promise.all([
          pool.querySync(DEFAULT_RELAYS, {
            kinds: [30023],
            authors: curatedAuthors,
            limit: 20,
          }),
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

        const curated = dedup(curatedEvents)
          .map(toArticle)
          .filter((a): a is PressArticle => a !== null)
          .slice(0, 8)

        const curatedIds = new Set(curated.map(a => a.id))
        const recent = dedup(recentEvents)
          .map(toArticle)
          .filter((a): a is PressArticle => a !== null && !curatedIds.has(a.id))

        // Separate zapwalled articles
        const exclusive = recent.filter(a => a.zapGated)
        const nonExclusive = recent.filter(a => !a.zapGated)

        // Count reactions for trending
        if (nonExclusive.length > 0) {
          const articleIds = nonExclusive.slice(0, 20).map(a => a.id)
          try {
            const reactions = await pool.querySync(DEFAULT_RELAYS, {
              kinds: [7, 9735],
              '#e': articleIds,
              limit: 200,
            })
            const counts = new Map<string, number>()
            for (const r of reactions) {
              for (const tag of r.tags) {
                if (tag[0] === 'e' && articleIds.includes(tag[1])) {
                  counts.set(tag[1], (counts.get(tag[1]) || 0) + (r.kind === 9735 ? 3 : 1))
                }
              }
            }
            for (const art of nonExclusive) {
              art.reactions = counts.get(art.id) || 0
            }
          } catch { /* reaction counting failed */ }
        }

        const trending = nonExclusive
          .sort((a, b) => (b.reactions || 0) - (a.reactions || 0) || b.publishedAt - a.publishedAt)
          .slice(0, 12)

        // Fetch profiles
        const allArts = [...curated, ...exclusive, ...trending]
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
        setExclusiveArticles(exclusive)
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
        <div className="press-nav-right">
          <span className="press-subtitle">the press</span>
          <Link to="/" className="press-write-link">Start Writing →</Link>
        </div>
      </nav>

      <header className="press-header">
        <div className="press-rule-heavy" />
        <div className="press-dateline">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </div>
        <div className="press-rule-light" />
      </header>

      {loading ? (
        <div className="press-loading">
          <span className="press-loading-text">Tuning into relays…</span>
        </div>
      ) : (
        <main className="press-content">
          {/* Editor's Picks */}
          {curatedArticles.length > 0 && (
            <section className="press-section">
              <div className="press-section-header">
                <h2 className="press-section-label">
                  Editor's Picks
                  {curatorName && <span className="press-curator-name">curated by {curatorName}</span>}
                </h2>
                {hasExtension && (
                  <button
                    className="press-curate-btn"
                    onClick={() => setShowCurate(!showCurate)}
                  >
                    {showCurate ? 'Close' : '✎ Curate'}
                  </button>
                )}
              </div>

              {/* Curate panel */}
              {showCurate && (
                <div className="press-curate-panel">
                  <p className="press-curate-desc">
                    Add or remove authors. Changes are published as a NIP-51 list to your relays.
                  </p>
                  <div className="press-curate-authors">
                    {curatedPubkeys.map(pk => (
                      <div key={pk} className="press-curate-author">
                        {curatedProfiles.get(pk)?.picture && (
                          <img src={curatedProfiles.get(pk)!.picture} alt="" className="press-curate-avatar" />
                        )}
                        <span className="press-curate-author-name">
                          {curatedProfiles.get(pk)?.name || pk.slice(0, 16) + '…'}
                        </span>
                        <button className="press-curate-remove" onClick={() => handleRemoveAuthor(pk)}>×</button>
                      </div>
                    ))}
                  </div>
                  <div className="press-curate-add">
                    <input
                      type="text"
                      placeholder="npub1... or hex pubkey"
                      value={curateInput}
                      onChange={e => setCurateInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddAuthor()}
                      className="press-curate-input"
                    />
                    <button className="press-curate-add-btn" onClick={handleAddAuthor}>Add</button>
                  </div>
                  {curateStatus && <span className="press-curate-status">{curateStatus}</span>}
                  <button className="press-curate-publish" onClick={handlePublishList}>
                    Sign & Publish List
                  </button>
                </div>
              )}
              <div className="press-grid">
                {curatedArticles.map(article => (
                  <ArticleCard key={article.id} article={article} />
                ))}
              </div>
            </section>
          )}

          {/* Samizdat Exclusives (zapwalled) */}
          {exclusiveArticles.length > 0 && (
            <section className="press-section">
              <h2 className="press-section-label">⚡ Samizdat Exclusives</h2>
              <div className="press-grid">
                {exclusiveArticles.map(article => (
                  <ArticleCard key={article.id} article={article} />
                ))}
              </div>
            </section>
          )}

          {/* Placeholder when no exclusives yet */}
          {exclusiveArticles.length === 0 && (
            <section className="press-section press-exclusives-promo">
              <div className="press-promo-card">
                <span className="press-promo-icon">⚡</span>
                <h3>Samizdat Exclusives</h3>
                <p>Premium zap-gated articles from independent writers. Coming soon.</p>
                <Link to="/" className="press-promo-cta">Publish yours →</Link>
              </div>
            </section>
          )}

          {/* Fresh Off the Press */}
          {trendingArticles.length > 0 && (
            <section className="press-section">
              <h2 className="press-section-label">Fresh Off the Press</h2>
              <div className="press-grid">
                {trendingArticles.map(article => (
                  <ArticleCard key={article.id} article={article} />
                ))}
              </div>
            </section>
          )}

          {curatedArticles.length === 0 && trendingArticles.length === 0 && (
            <div className="press-empty">
              The underground press awaits its first publication.
            </div>
          )}
        </main>
      )}

      <footer className="press-footer">
        <div className="press-rule-heavy" />
        <div className="press-footer-content">
          <span className="press-footer-tagline">Uncensorable publishing on nostr</span>
          <Link to="/" className="press-footer-link">← Back to Samizdat</Link>
        </div>
      </footer>
    </div>
  )
}
