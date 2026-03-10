import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { SimplePool } from 'nostr-tools'
import { nip19 } from 'nostr-tools'
import { DEFAULT_RELAYS, fetchProfile, publishToRelays } from '../lib/nostr'
import { signEvent, canSign } from '../lib/signer'
import { useLoadingMessage } from '../hooks/useLoadingMessage'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import './Press.css'

// Default editor — satsdisco's pubkey (site creator)
const EDITOR_PUBKEY = '47276eb163fc54b3733930ab5cfd5fa94687a1953871a873ad4faee91e8a5f38'

// Fallback curated authors (used when editor hasn't published a list yet)
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

const CURATION_LIST_D_TAG = 'samizdat-editors-picks'

// Press relay management — persisted to localStorage
const PRESS_RELAYS_KEY = 'samizdat_press_relays'

function getPressRelays(): string[] {
  try {
    const saved = localStorage.getItem(PRESS_RELAYS_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch {}
  return [...DEFAULT_RELAYS]
}

function savePressRelays(relays: string[]) {
  localStorage.setItem(PRESS_RELAYS_KEY, JSON.stringify(relays))
}

// Fetch a NIP-51 curation list (kind 30001) from a specific pubkey
interface CurationData {
  authors: string[]
  pinnedArticles: { kind: number; pubkey: string; identifier: string }[]
}

async function fetchCurationList(pool: SimplePool, relays: string[], authorPubkey: string): Promise<CurationData> {
  try {
    const events = await pool.querySync(relays, {
      kinds: [30001],
      authors: [authorPubkey],
      '#d': [CURATION_LIST_D_TAG],
      limit: 1,
    })
    if (events.length === 0) return { authors: [], pinnedArticles: [] }
    const latest = events.sort((a, b) => b.created_at - a.created_at)[0]
    const authors = latest.tags.filter(t => t[0] === 'p').map(t => t[1])
    // Parse 'a' tags: "30023:pubkey:identifier"
    const pinnedArticles = latest.tags
      .filter(t => t[0] === 'a')
      .map(t => {
        const parts = t[1].split(':')
        if (parts.length >= 3) {
          return { kind: parseInt(parts[0]), pubkey: parts[1], identifier: parts.slice(2).join(':') }
        }
        return null
      })
      .filter((a): a is { kind: number; pubkey: string; identifier: string } => a !== null)
    return { authors, pinnedArticles }
  } catch {
    return { authors: [], pinnedArticles: [] }
  }
}

// Fetch user's follow list (kind 3)
async function fetchFollowList(pool: SimplePool, relays: string[], pubkey: string): Promise<string[]> {
  try {
    const events = await pool.querySync(relays, {
      kinds: [3],
      authors: [pubkey],
      limit: 1,
    })
    if (events.length === 0) return []
    const latest = events.sort((a, b) => b.created_at - a.created_at)[0]
    return latest.tags.filter(t => t[0] === 'p').map(t => t[1])
  } catch {
    return []
  }
}

// Fetch user's bookmarks (NIP-51 kind 10003)
async function fetchBookmarks(pool: SimplePool, relays: string[], pubkey: string): Promise<string[]> {
  try {
    const events = await pool.querySync(relays, {
      kinds: [10003],
      authors: [pubkey],
      limit: 1,
    })
    if (events.length === 0) return []
    const latest = events.sort((a, b) => b.created_at - a.created_at)[0]
    // Return 'e' tagged event ids (bookmarked articles)
    return latest.tags.filter(t => t[0] === 'e').map(t => t[1])
  } catch {
    return []
  }
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
  bookmarked?: boolean
}

type Profile = { name?: string; picture?: string; nip05?: string }

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function ArticleCard({ article, onBookmark }: { article: PressArticle; onBookmark?: (id: string) => void }) {
  return (
    <div className="press-card-wrap">
      <Link to={`/a/${article.naddr}`} className="press-card">
        <div className="press-card-thumb">
          <img src={article.image || '/placeholder.jpg'} alt="" loading="lazy" />
        </div>
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
      {onBookmark && (
        <button
          className={`press-card-bookmark ${article.bookmarked ? 'bookmarked' : ''}`}
          onClick={(e) => { e.preventDefault(); onBookmark(article.id) }}
          title={article.bookmarked ? 'Bookmarked' : 'Bookmark'}
        >
          {article.bookmarked ? '★' : '☆'}
        </button>
      )}
    </div>
  )
}

// Loading messages moved to shared hook: useLoadingMessage

type TabView = 'press' | 'feed' | 'bookmarks'

export function Press() {
  // Tabs & auth
  const [activeTab, setActiveTab] = useState<TabView>('press')
  const [loggedInPubkey, setLoggedInPubkey] = useState<string | null>(null)

  // Press (editor's curation)
  const [curatedArticles, setCuratedArticles] = useState<PressArticle[]>([])
  const [trendingArticles, setTrendingArticles] = useState<PressArticle[]>([])
  const [exclusiveArticles, setExclusiveArticles] = useState<PressArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [editorProfile, setEditorProfile] = useState<Profile | null>(null)
  // Pull-to-refresh: increment to force the press useEffect to re-run
  const [pressRefreshKey, setPressRefreshKey] = useState(0)

  // My Feed (follow list articles)
  const [feedArticles, setFeedArticles] = useState<PressArticle[]>([])
  const [feedLoading, setFeedLoading] = useState(false)
  const [feedLoaded, setFeedLoaded] = useState(false)

  // Bookmarks
  const [bookmarkedArticles, setBookmarkedArticles] = useState<PressArticle[]>([])
  const [bookmarksLoading, setBookmarksLoading] = useState(false)
  const [bookmarksLoaded, setBookmarksLoaded] = useState(false)
  const [bookmarkIds, setBookmarkIds] = useState<Set<string>>(new Set())

  // Section expansion
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
  const toggleSection = useCallback((section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev)
      next.has(section) ? next.delete(section) : next.add(section)
      return next
    })
  }, [])
  const COLLAPSED_COUNT = 6

  // Curation editor
  const [showCurate, setShowCurate] = useState(false)
  const [curateInput, setCurateInput] = useState('')
  const [curateStatus, setCurateStatus] = useState('')
  const [curatedPubkeys, setCuratedPubkeys] = useState<string[]>([])
  const [curatedProfiles, setCuratedProfiles] = useState<Map<string, Profile>>(new Map())

  // Fetch profiles for curated authors when panel opens
  useEffect(() => {
    if (!showCurate || curatedPubkeys.length === 0) return
    const missing = curatedPubkeys.filter(pk => !curatedProfiles.has(pk))
    if (missing.length === 0) return
    const relays = getPressRelays()
    Promise.all(missing.map(pk =>
      fetchProfile(pk, relays).then(p => [pk, p] as const).catch(() => [pk, null] as const)
    )).then(results => {
      setCuratedProfiles(prev => {
        const next = new Map(prev)
        for (const [pk, p] of results) { if (p) next.set(pk, p) }
        return next
      })
    })
  }, [showCurate, curatedPubkeys])

  const loadingMsg = useLoadingMessage()

  // Pull-to-refresh: clears cache and reloads the press
  usePullToRefresh({
    onRefresh: () => {
      sessionStorage.removeItem('samizdat_press_cache')
      setLoading(true)
      setPressRefreshKey(k => k + 1)
    },
    disabled: activeTab !== 'press',
  })

  // Check login on mount
  useEffect(() => {
    const saved = localStorage.getItem('samizdat_pubkey')
    if (saved) setLoggedInPubkey(saved)
    // Also try NIP-07
    if (!saved && window.nostr) {
      window.nostr.getPublicKey().then(pk => setLoggedInPubkey(pk)).catch(() => {})
    }
  }, [])

  // Check if current user is the editor
  const isEditor = loggedInPubkey === EDITOR_PUBKEY

  // === PRESS TAB (default, always loads) ===
  useEffect(() => {
    // Try sessionStorage cache first (survives back-navigation)
    const cached = sessionStorage.getItem('samizdat_press_cache')
    if (cached) {
      try {
        const data = JSON.parse(cached)
        const age = Date.now() - (data.ts || 0)
        if (age < 5 * 60 * 1000) { // 5 min cache
          setCuratedArticles(data.curated || [])
          setExclusiveArticles(data.exclusive || [])
          setTrendingArticles(data.trending || [])
          setCuratedPubkeys(data.pubkeys || FALLBACK_AUTHORS)
          if (data.editorProfile) setEditorProfile(data.editorProfile)
          setLoading(false)
          return
        }
      } catch { /* cache corrupt, reload */ }
    }

    async function loadPress() {
      const pool = new SimplePool()
      try {
        // Fetch editor's curation list
        const relays = getPressRelays()
        const curationData = await fetchCurationList(pool, relays, EDITOR_PUBKEY)
        const authors = curationData.authors.length > 0 ? curationData.authors : FALLBACK_AUTHORS
        setCuratedPubkeys(authors)

        // Fetch editor profile
        const ep = await fetchProfile(EDITOR_PUBKEY, relays).catch(() => null)
        setEditorProfile(ep)

        const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60

        // Fetch pinned articles specifically (by author+identifier)
        const pinnedFetches = curationData.pinnedArticles.map(a =>
          pool.querySync(relays, {
            kinds: [30023],
            authors: [a.pubkey],
            '#d': [a.identifier],
            limit: 1,
          }).catch(() => [])
        )

        const [curatedEvents, recentEvents, ...pinnedResults] = await Promise.all([
          pool.querySync(relays, { kinds: [30023], authors, limit: 30 }),
          pool.querySync(relays, { kinds: [30023], limit: 80, since: thirtyDaysAgo }),
          ...pinnedFetches,
        ])

        // Build pinned articles (in curation order) then fill with one-per-author
        const pinnedEvents = pinnedResults.flat()
        const pinnedArticles = eventsToArticles(pinnedEvents, true)
        // Sort pinned articles in the order they appear in the curation list
        const pinnedOrder = curationData.pinnedArticles.map(a => `${a.pubkey}:${a.identifier}`)
        pinnedArticles.sort((a, b) => {
          const aIdx = pinnedOrder.findIndex(key => key === `${a.pubkey}:${a.slug}`)
          const bIdx = pinnedOrder.findIndex(key => key === `${b.pubkey}:${b.slug}`)
          return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx)
        })
        const pinnedIds = new Set(pinnedArticles.map(a => a.id))

        const allArticles = processEvents(curatedEvents, recentEvents, authors)

        // Editor's Picks: pinned first, then one-per-author round-robin (no author domination)
        const unpinned = allArticles.curated.filter(a => !pinnedIds.has(a.id))
        const onePerAuthor: PressArticle[] = []
        const seenAuthors = new Set(pinnedArticles.map(a => a.pubkey))
        for (const article of unpinned) {
          if (!seenAuthors.has(article.pubkey)) {
            seenAuthors.add(article.pubkey)
            onePerAuthor.push(article)
          }
        }
        allArticles.curated = [...pinnedArticles, ...onePerAuthor]

        // Count reactions for Fresh Off the Press — filter out zero-engagement spam
        const freshCandidates = allArticles.trending
        if (freshCandidates.length > 0) {
          const articleIds = freshCandidates.map(a => a.id)
          try {
            const reactions = await pool.querySync(relays, {
              kinds: [7, 9735], // likes + zaps
              '#e': articleIds,
              limit: 300,
            })
            const counts = new Map<string, number>()
            for (const r of reactions) {
              for (const tag of r.tags) {
                if (tag[0] === 'e' && articleIds.includes(tag[1])) {
                  counts.set(tag[1], (counts.get(tag[1]) || 0) + (r.kind === 9735 ? 3 : 1))
                }
              }
            }
            for (const art of freshCandidates) {
              art.reactions = counts.get(art.id) || 0
            }
          } catch { /* reaction counting failed, keep all */ }
        }

        // Sort by engagement, prefer articles with reactions but backfill with recent if needed
        const withEngagement = freshCandidates
          .filter(a => (a.reactions || 0) >= 1)
          .sort((a, b) => (b.reactions || 0) - (a.reactions || 0))
        const withoutEngagement = freshCandidates
          .filter(a => (a.reactions || 0) < 1)
          .sort((a, b) => b.publishedAt - a.publishedAt)

        // Engaged articles first, then backfill with recent — keep more for pagination
        allArticles.trending = [...withEngagement, ...withoutEngagement].slice(0, 24)

        // Fetch profiles
        const allArts = [...allArticles.curated, ...allArticles.exclusive, ...allArticles.trending]
        await attachProfiles(pool, allArts)

        setCuratedArticles(allArticles.curated)
        setExclusiveArticles(allArticles.exclusive)
        setTrendingArticles(allArticles.trending)

        // Cache to sessionStorage
        try {
          sessionStorage.setItem('samizdat_press_cache', JSON.stringify({
            ts: Date.now(),
            curated: allArticles.curated,
            exclusive: allArticles.exclusive,
            trending: allArticles.trending,
            pubkeys: authors,
            editorProfile: ep,
          }))
        } catch { /* storage full, ignore */ }
      } catch (e) {
        console.error('Failed to load press:', e)
      } finally {
        pool.close(getPressRelays())
        setLoading(false)
      }
    }
    loadPress()
  }, [pressRefreshKey])

  // === MY FEED TAB (loads on demand) ===
  useEffect(() => {
    if (activeTab !== 'feed' || !loggedInPubkey || feedLoaded) return

    async function loadFeed() {
      setFeedLoading(true)
      const pool = new SimplePool()
      try {
        const follows = await fetchFollowList(pool, getPressRelays(), loggedInPubkey!)
        if (follows.length === 0) {
          setFeedArticles([])
          setFeedLoaded(true)
          setFeedLoading(false)
          return
        }

        // Fetch articles from followed authors (batch in chunks to avoid huge queries)
        const chunk = follows.slice(0, 50) // first 50 follows
        const events = await pool.querySync(getPressRelays(), {
          kinds: [30023],
          authors: chunk,
          limit: 40,
        })

        const articles = eventsToArticles(events)
        await attachProfiles(pool, articles)
        setFeedArticles(articles)
        setFeedLoaded(true)
      } catch (e) {
        console.error('Failed to load feed:', e)
      } finally {
        pool.close(getPressRelays())
        setFeedLoading(false)
      }
    }
    loadFeed()
  }, [activeTab, loggedInPubkey, feedLoaded])

  // === BOOKMARKS TAB (loads on demand) ===
  useEffect(() => {
    if (activeTab !== 'bookmarks' || !loggedInPubkey || bookmarksLoaded) return

    async function loadBookmarks() {
      setBookmarksLoading(true)
      const pool = new SimplePool()
      try {
        const ids = await fetchBookmarks(pool, getPressRelays(), loggedInPubkey!)
        setBookmarkIds(new Set(ids))

        if (ids.length === 0) {
          setBookmarkedArticles([])
          setBookmarksLoaded(true)
          setBookmarksLoading(false)
          return
        }

        const events = await pool.querySync(getPressRelays(), {
          kinds: [30023],
          ids: ids.slice(0, 20),
        })

        const articles = eventsToArticles(events).map(a => ({ ...a, bookmarked: true }))
        await attachProfiles(pool, articles)
        setBookmarkedArticles(articles)
        setBookmarksLoaded(true)
      } catch (e) {
        console.error('Failed to load bookmarks:', e)
      } finally {
        pool.close(getPressRelays())
        setBookmarksLoading(false)
      }
    }
    loadBookmarks()
  }, [activeTab, loggedInPubkey, bookmarksLoaded])

  // === BOOKMARK AN ARTICLE ===
  const handleBookmark = useCallback(async (articleId: string) => {
    if (!canSign() || !loggedInPubkey) return

    const newIds = new Set(bookmarkIds)
    const isRemoving = newIds.has(articleId)
    if (isRemoving) {
      newIds.delete(articleId)
    } else {
      newIds.add(articleId)
    }
    setBookmarkIds(newIds)

    // Update bookmarked state in all article lists
    const updateBookmark = (articles: PressArticle[]) =>
      articles.map(a => a.id === articleId ? { ...a, bookmarked: !isRemoving } : a)

    setCuratedArticles(updateBookmark)
    setTrendingArticles(updateBookmark)
    setFeedArticles(updateBookmark)
    setBookmarkedArticles(prev => isRemoving ? prev.filter(a => a.id !== articleId) : prev)

    try {
      const event = {
        kind: 10003,
        created_at: Math.floor(Date.now() / 1000),
        tags: [...newIds].map(id => ['e', id]),
        content: '',
      }
      const signed = await signEvent(event)
      await publishToRelays(signed, getPressRelays())
    } catch (e) {
      console.error('Failed to publish bookmark:', e)
      // Revert on failure
      if (isRemoving) newIds.add(articleId); else newIds.delete(articleId)
      setBookmarkIds(newIds)
    }
  }, [loggedInPubkey, bookmarkIds])

  // Relay settings
  const [pressRelays, setPressRelays] = useState<string[]>(getPressRelays)
  const [showRelaySettings, setShowRelaySettings] = useState(false)
  const [relayInput, setRelayInput] = useState('')

  const handleAddRelay = useCallback(() => {
    let url = relayInput.trim()
    if (!url) return
    if (!url.startsWith('wss://') && !url.startsWith('ws://')) url = 'wss://' + url
    if (pressRelays.includes(url)) { setRelayInput(''); return }
    const updated = [...pressRelays, url]
    setPressRelays(updated)
    savePressRelays(updated)
    setRelayInput('')
    // Clear cache to refetch with new relay
    sessionStorage.removeItem('samizdat_press_cache')
  }, [relayInput, pressRelays])

  const handleRemoveRelay = useCallback((url: string) => {
    const updated = pressRelays.filter(r => r !== url)
    if (updated.length === 0) return // don't allow empty
    setPressRelays(updated)
    savePressRelays(updated)
    sessionStorage.removeItem('samizdat_press_cache')
  }, [pressRelays])

  const handleResetRelays = useCallback(() => {
    setPressRelays([...DEFAULT_RELAYS])
    savePressRelays([...DEFAULT_RELAYS])
    sessionStorage.removeItem('samizdat_press_cache')
  }, [])

  // Curated articles (by naddr)
  const [curatedArticleAddrs, setCuratedArticleAddrs] = useState<{ kind: number; pubkey: string; identifier: string; naddr: string }[]>([])

  // === CURATION EDITOR ===
  const handleAddCuration = useCallback(async () => {
    if (!curateInput.trim()) return
    let input = curateInput.trim()
    // Strip nostr: URI prefix (clients like Primal copy links this way)
    if (input.startsWith('nostr:')) input = input.slice(6)
    setCurateStatus('Looking up…')
    try {
      // Try naddr (specific article)
      if (input.startsWith('naddr')) {
        const decoded = nip19.decode(input)
        if (decoded.type === 'naddr') {
          const data = decoded.data as { kind: number; pubkey: string; identifier: string; relays?: string[] }
          // Check if already added
          if (curatedArticleAddrs.some(a => a.pubkey === data.pubkey && a.identifier === data.identifier)) {
            setCurateStatus('Article already in list')
            return
          }
          setCuratedArticleAddrs(prev => [...prev, { ...data, naddr: input }])
          // Also add author if not already there
          if (!curatedPubkeys.includes(data.pubkey)) {
            setCuratedPubkeys(prev => [...prev, data.pubkey])
            const profile = await fetchProfile(data.pubkey, getPressRelays())
            if (profile) setCuratedProfiles(prev => new Map(prev).set(data.pubkey, profile))
          }
          setCurateInput('')
          setCurateStatus('Article added ✓')
          setTimeout(() => setCurateStatus(''), 2000)
          return
        }
      }

      // Try samizdat.press/a/naddr... URL
      if (input.includes('/a/naddr')) {
        const naddrMatch = input.match(/naddr1[a-z0-9]+/)
        if (naddrMatch) {
          // Recurse with just the naddr
          setCurateInput(naddrMatch[0])
          setTimeout(() => handleAddCuration(), 50)
          return
        }
      }

      // Try npub (author)
      let hex = input
      if (hex.startsWith('nostr:')) hex = hex.slice(6)
      if (hex.startsWith('npub')) {
        const decoded = nip19.decode(hex)
        if (decoded.type === 'npub') hex = decoded.data as string
      }
      if (!/^[0-9a-f]{64}$/.test(hex)) {
        setCurateStatus('Paste npub, naddr, or article link')
        return
      }
      if (curatedPubkeys.includes(hex)) {
        setCurateStatus('Already in list')
        return
      }
      setCuratedPubkeys(prev => [...prev, hex])
      setCurateInput('')
      setCurateStatus('')
      const profile = await fetchProfile(hex, getPressRelays())
      if (profile) setCuratedProfiles(prev => new Map(prev).set(hex, profile))
    } catch (e: any) {
      setCurateStatus('Invalid input — use npub, naddr, or article link')
    }
  }, [curateInput, curatedPubkeys, curatedArticleAddrs])

  const handleRemoveAuthor = useCallback((hex: string) => {
    setCuratedPubkeys(prev => prev.filter(p => p !== hex))
  }, [])

  const handleRemoveArticle = useCallback((naddr: string) => {
    setCuratedArticleAddrs(prev => prev.filter(a => a.naddr !== naddr))
  }, [])

  const handlePublishList = useCallback(async () => {
    if (!canSign()) {
      setCurateStatus('No signer available — sign in first')
      return
    }
    if (curatedPubkeys.length === 0 && curatedArticleAddrs.length === 0) return
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
          ...curatedArticleAddrs.map(a => ['a', `30023:${a.pubkey}:${a.identifier}`]),
        ],
        content: '',
      }
      const signed = await signEvent(event)
      setCurateStatus('Publishing…')

      const results = await publishToRelays(signed, getPressRelays())
      const ok = results.filter(r => r.ok).length
      if (ok > 0) {
        setCurateStatus(`Published to ${ok} relay${ok > 1 ? 's' : ''} ✓`)
      } else {
        setCurateStatus('Signed ✓ — relays are slow, try refreshing in a minute')
      }
      // Clear cache so press reloads with new curation
      sessionStorage.removeItem('samizdat_press_cache')
      setTimeout(() => setCurateStatus(''), 4000)
    } catch (e: any) {
      console.error('Publish failed:', e)
      setCurateStatus(e.message || 'Failed to sign — check your extension')
    }
  }, [curatedPubkeys, curatedArticleAddrs])

  return (
    <div className="press">
      <nav className="press-nav">
        <Link to="/" className="press-wordmark">samizdat</Link>
        <div className="press-nav-right">
          {/* Tab switcher */}
          <div className="press-tabs">
            <button
              className={`press-tab ${activeTab === 'press' ? 'active' : ''}`}
              onClick={() => setActiveTab('press')}
            >
              The Press
            </button>
            {loggedInPubkey && (
              <>
                <button
                  className={`press-tab ${activeTab === 'feed' ? 'active' : ''}`}
                  onClick={() => setActiveTab('feed')}
                >
                  My Feed
                </button>
                <button
                  className={`press-tab ${activeTab === 'bookmarks' ? 'active' : ''}`}
                  onClick={() => setActiveTab('bookmarks')}
                >
                  Bookmarks
                </button>
              </>
            )}
          </div>
          <button
            className="press-relay-btn"
            onClick={() => setShowRelaySettings(!showRelaySettings)}
            title="Relay settings"
          >
            ⚡ {pressRelays.length}
          </button>
          <Link to="/write" className="press-write-link">Start Writing →</Link>
        </div>
      </nav>

      {/* Relay settings panel */}
      {showRelaySettings && (
        <div className="press-relay-panel">
          <div className="press-relay-panel-inner">
            <div className="press-relay-header">
              <h3>Relay Settings</h3>
              <button className="press-relay-close" onClick={() => setShowRelaySettings(false)}>×</button>
            </div>
            <p className="press-relay-desc">
              These relays are used for reading articles on the Press page. Add your own relay to see content from it.
            </p>
            <div className="press-relay-list">
              {pressRelays.map(url => (
                <div key={url} className="press-relay-item">
                  <span className="press-relay-url">{url.replace('wss://', '')}</span>
                  {pressRelays.length > 1 && (
                    <button className="press-relay-remove" onClick={() => handleRemoveRelay(url)}>×</button>
                  )}
                </div>
              ))}
            </div>
            <div className="press-relay-add">
              <input
                type="text"
                placeholder="wss://relay.example.com"
                value={relayInput}
                onChange={e => setRelayInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddRelay()}
                className="press-relay-input"
              />
              <button className="press-relay-add-btn" onClick={handleAddRelay}>Add</button>
            </div>
            <button className="press-relay-reset" onClick={handleResetRelays}>
              Reset to defaults
            </button>
          </div>
        </div>
      )}

      <header className="press-header">
        <div className="press-rule-heavy" />
        <div className="press-dateline">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </div>
        <div className="press-rule-light" />
      </header>

      {/* === THE PRESS TAB === */}
      {activeTab === 'press' && (
        loading ? (
          <div className="press-loading">
            <span className="press-loading-text">{loadingMsg}</span>
          </div>
        ) : (
          <main className="press-content">
            {/* Editor's Picks */}
            {(curatedArticles.length > 0 || isEditor) && (
              <section className="press-section">
                <div className="press-section-header">
                  <h2 className="press-section-label">
                    Editor's Picks
                    {editorProfile?.name && (
                      <span className="press-curator-name">curated by {editorProfile.name}</span>
                    )}
                  </h2>
                  {isEditor && (
                    <button
                      className="press-curate-btn"
                      onClick={() => setShowCurate(!showCurate)}
                    >
                      {showCurate ? 'Close' : '✎ Curate'}
                    </button>
                  )}
                </div>

                {showCurate && (
                  <div className="press-curate-panel">
                    <div className="press-curate-section">
                      <span className="press-curate-section-label">Curated Authors</span>
                      <div className="press-curate-authors">
                        {curatedPubkeys.map(pk => {
                          const profile = curatedProfiles.get(pk)
                          return (
                            <div key={pk} className="press-curate-author-card">
                              <div className="press-curate-author-info">
                                {profile?.picture ? (
                                  <img src={profile.picture} alt="" className="press-curate-avatar" />
                                ) : (
                                  <div className="press-curate-avatar-placeholder" />
                                )}
                                <div className="press-curate-author-meta">
                                  <span className="press-curate-author-name">
                                    {profile?.name || 'Loading…'}
                                  </span>
                                  {profile?.nip05 && (
                                    <span className="press-curate-author-nip05">{profile.nip05}</span>
                                  )}
                                </div>
                              </div>
                              <button className="press-curate-remove" onClick={() => handleRemoveAuthor(pk)} title="Remove author">×</button>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {curatedArticleAddrs.length > 0 && (
                      <div className="press-curate-section">
                        <span className="press-curate-section-label">Pinned Articles</span>
                        <div className="press-curate-articles-list">
                          {curatedArticleAddrs.map(a => (
                            <div key={a.naddr} className="press-curate-article-card">
                              <span className="press-curate-article-title">
                                📌 {a.identifier.replace(/-/g, ' ')}
                              </span>
                              <button className="press-curate-remove" onClick={() => handleRemoveArticle(a.naddr)} title="Unpin article">×</button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="press-curate-add">
                      <input
                        type="text"
                        placeholder="npub, naddr, or article link"
                        value={curateInput}
                        onChange={e => setCurateInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAddCuration()}
                        className="press-curate-input"
                      />
                      <button className="press-curate-add-btn" onClick={handleAddCuration}>Add</button>
                    </div>
                    {curateStatus && <span className="press-curate-status">{curateStatus}</span>}
                    <button className="press-curate-publish" onClick={handlePublishList}>
                      Sign & Publish List
                    </button>
                  </div>
                )}

                <div className="press-grid">
                  {(expandedSections.has('curated') ? curatedArticles : curatedArticles.slice(0, COLLAPSED_COUNT)).map(article => (
                    <ArticleCard
                      key={article.id}
                      article={article}
                      onBookmark={loggedInPubkey ? handleBookmark : undefined}
                    />
                  ))}
                </div>
                {curatedArticles.length > COLLAPSED_COUNT && (
                  <button className="press-show-more" onClick={() => toggleSection('curated')}>
                    {expandedSections.has('curated')
                      ? 'Show less'
                      : `See all ${curatedArticles.length} →`}
                  </button>
                )}
              </section>
            )}

            {/* Samizdat Exclusives */}
            {exclusiveArticles.length > 0 ? (
              <section className="press-section">
                <h2 className="press-section-label">⚡ Samizdat Exclusives</h2>
                <div className="press-grid">
                  {(expandedSections.has('exclusive') ? exclusiveArticles : exclusiveArticles.slice(0, COLLAPSED_COUNT)).map(article => (
                    <ArticleCard
                      key={article.id}
                      article={article}
                      onBookmark={loggedInPubkey ? handleBookmark : undefined}
                    />
                  ))}
                </div>
                {exclusiveArticles.length > COLLAPSED_COUNT && (
                  <button className="press-show-more" onClick={() => toggleSection('exclusive')}>
                    {expandedSections.has('exclusive')
                      ? 'Show less'
                      : `See all ${exclusiveArticles.length} →`}
                  </button>
                )}
              </section>
            ) : (
              <section className="press-section press-exclusives-promo">
                <div className="press-promo-card">
                  <span className="press-promo-icon">⚡</span>
                  <h3>Samizdat Exclusives</h3>
                  <p>Premium zap-gated articles from independent writers. Coming soon.</p>
                  <Link to="/write" className="press-promo-cta">Publish yours →</Link>
                </div>
              </section>
            )}

            {/* Fresh Off the Press */}
            {trendingArticles.length > 0 && (
              <section className="press-section">
                <h2 className="press-section-label">Fresh Off the Press</h2>
                <div className="press-grid">
                  {(expandedSections.has('trending') ? trendingArticles : trendingArticles.slice(0, COLLAPSED_COUNT)).map(article => (
                    <ArticleCard
                      key={article.id}
                      article={article}
                      onBookmark={loggedInPubkey ? handleBookmark : undefined}
                    />
                  ))}
                </div>
                {trendingArticles.length > COLLAPSED_COUNT && (
                  <button className="press-show-more" onClick={() => toggleSection('trending')}>
                    {expandedSections.has('trending')
                      ? 'Show less'
                      : `See all ${trendingArticles.length} →`}
                  </button>
                )}
              </section>
            )}

            {curatedArticles.length === 0 && trendingArticles.length === 0 && (
              <div className="press-empty">
                The underground press awaits its first publication.
              </div>
            )}
          </main>
        )
      )}

      {/* === MY FEED TAB === */}
      {activeTab === 'feed' && (
        feedLoading ? (
          <div className="press-loading">
            <span className="press-loading-text">{loadingMsg}</span>
          </div>
        ) : (
          <main className="press-content">
            {feedArticles.length > 0 ? (
              <section className="press-section">
                <h2 className="press-section-label">From Your People</h2>
                <div className="press-grid">
                  {(expandedSections.has('feed') ? feedArticles : feedArticles.slice(0, COLLAPSED_COUNT)).map(article => (
                    <ArticleCard
                      key={article.id}
                      article={article}
                      onBookmark={handleBookmark}
                    />
                  ))}
                </div>
                {feedArticles.length > COLLAPSED_COUNT && (
                  <button className="press-show-more" onClick={() => toggleSection('feed')}>
                    {expandedSections.has('feed')
                      ? 'Show less'
                      : `See all ${feedArticles.length} →`}
                  </button>
                )}
              </section>
            ) : (
              <div className="press-empty-state">
                <p className="press-empty-title">Your feed is empty</p>
                <p className="press-empty-desc">
                  Articles from people you follow on nostr will appear here.
                  Follow writers on any nostr client and their long-form posts show up automatically.
                </p>
              </div>
            )}
          </main>
        )
      )}

      {/* === BOOKMARKS TAB === */}
      {activeTab === 'bookmarks' && (
        bookmarksLoading ? (
          <div className="press-loading">
            <span className="press-loading-text">{loadingMsg}</span>
          </div>
        ) : (
          <main className="press-content">
            {bookmarkedArticles.length > 0 ? (
              <section className="press-section">
                <h2 className="press-section-label">Saved for Later</h2>
                <div className="press-grid">
                  {(expandedSections.has('bookmarks') ? bookmarkedArticles : bookmarkedArticles.slice(0, COLLAPSED_COUNT)).map(article => (
                    <ArticleCard
                      key={article.id}
                      article={article}
                      onBookmark={handleBookmark}
                    />
                  ))}
                </div>
                {bookmarkedArticles.length > COLLAPSED_COUNT && (
                  <button className="press-show-more" onClick={() => toggleSection('bookmarks')}>
                    {expandedSections.has('bookmarks')
                      ? 'Show less'
                      : `See all ${bookmarkedArticles.length} →`}
                  </button>
                )}
              </section>
            ) : (
              <div className="press-empty-state">
                <p className="press-empty-title">No bookmarks yet</p>
                <p className="press-empty-desc">
                  Star articles to save them. Bookmarks are stored on nostr
                  and follow you across any client.
                </p>
              </div>
            )}
          </main>
        )
      )}

      {/* Login prompt for non-logged-in users */}
      {!loggedInPubkey && activeTab === 'press' && (
        <div className="press-login-prompt">
          <p>
            <Link to="/write" className="press-login-link">Sign in with nostr</Link> to unlock
            your personal feed, bookmarks, and curation.
          </p>
        </div>
      )}

      <footer className="press-footer">
        <div className="press-rule-heavy" />
        <div className="press-footer-content">
          <span className="press-footer-tagline">Uncensorable publishing on nostr</span>
          <Link to="/write" className="press-footer-link">← Write</Link>
        </div>
      </footer>

      {/* Mobile bottom tab bar */}
      <nav className="press-bottom-tabs">
        <button
          className={`press-bottom-tab ${activeTab === 'press' ? 'active' : ''}`}
          onClick={() => setActiveTab('press')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2" />
          </svg>
          Press
        </button>
        {loggedInPubkey && (
          <button
            className={`press-bottom-tab ${activeTab === 'feed' ? 'active' : ''}`}
            onClick={() => setActiveTab('feed')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
            </svg>
            Feed
          </button>
        )}
        {loggedInPubkey && (
          <button
            className={`press-bottom-tab ${activeTab === 'bookmarks' ? 'active' : ''}`}
            onClick={() => setActiveTab('bookmarks')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
            </svg>
            Saved
          </button>
        )}
        <Link to="/write" className="press-bottom-tab">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          Write
        </Link>
      </nav>
    </div>
  )
}

// === HELPER FUNCTIONS ===

function eventsToArticles(events: any[], skipBotFilter = false): PressArticle[] {
  const seen = new Map<string, any>()
  for (const e of events) {
    const d = e.tags.find((t: string[]) => t[0] === 'd')?.[1] || ''
    const key = `${e.pubkey}:${d}`
    const existing = seen.get(key)
    if (!existing || e.created_at > existing.created_at) seen.set(key, e)
  }

  const mapped: (PressArticle | null)[] = Array.from(seen.values())
    .sort((a, b) => b.created_at - a.created_at)
    .map(e => {
      const getTag = (name: string) => e.tags.find((t: string[]) => t[0] === name)?.[1]
      const title = getTag('title')
      if (!title || title.trim().length < 5 || title.toLowerCase() === 'untitled') return null
      if (e.content.length < 200) return null
      // Filter bot spam: if same author has >5 articles in this batch, likely a bot
      // Skip for curated authors — they were explicitly chosen by the editor
      if (!skipBotFilter) {
        const authorCount = events.filter((ev: any) => ev.pubkey === e.pubkey).length
        if (authorCount > 5) return null
      }

      const slug = getTag('d') || ''
      return {
        id: e.id,
        pubkey: e.pubkey,
        title,
        summary: getTag('summary'),
        image: getTag('image'),
        slug,
        publishedAt: getTag('published_at') ? parseInt(getTag('published_at')!) : e.created_at,
        tags: e.tags.filter((t: string[]) => t[0] === 't').map((t: string[]) => t[1]),
        zapGated: e.tags.some((t: string[]) => t[0] === 'zap_gate'),
        naddr: nip19.naddrEncode({
          kind: 30023, pubkey: e.pubkey, identifier: slug,
          relays: getPressRelays().slice(0, 2),
        }),
      } as PressArticle
    })
  return mapped.filter((a): a is PressArticle => a !== null)
}

function processEvents(
  curatedEvents: any[],
  recentEvents: any[],
  _curatedAuthors: string[]
): { curated: PressArticle[]; exclusive: PressArticle[]; trending: PressArticle[] } {
  const curated = eventsToArticles(curatedEvents, true).slice(0, 12)
  const curatedIds = new Set(curated.map(a => a.id))

  const recent = eventsToArticles(recentEvents)
    .filter(a => !curatedIds.has(a.id))

  const exclusive = recent.filter(a => a.zapGated)
  // Return more candidates — actual filtering happens after reaction counting
  const trending = recent
    .filter(a => !a.zapGated)
    .slice(0, 30)

  return { curated, exclusive, trending }
}

async function attachProfiles(_pool: SimplePool, articles: PressArticle[]) {
  const pubkeys = [...new Set(articles.map(a => a.pubkey))]
  const profiles = new Map<string, PressArticle['author']>()
  await Promise.allSettled(
    pubkeys.slice(0, 15).map(async pk => {
      const p = await fetchProfile(pk, getPressRelays())
      if (p) profiles.set(pk, p)
    })
  )
  for (const art of articles) {
    art.author = profiles.get(art.pubkey) || undefined
  }
}
