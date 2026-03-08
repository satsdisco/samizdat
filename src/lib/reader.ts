// Fetch articles and comments for the reader view
import { SimplePool } from 'nostr-tools'
import { nip19 } from 'nostr-tools'
import { DEFAULT_RELAYS, fetchProfile } from './nostr'

export { fetchProfile }

export interface ArticleData {
  id: string
  pubkey: string
  title: string
  content: string // markdown
  summary?: string
  image?: string
  tags: string[]
  publishedAt?: number
  createdAt: number
  slug: string
}

export interface CommentData {
  id: string
  pubkey: string
  content: string
  createdAt: number
  author?: { name?: string; picture?: string; nip05?: string } | null
}

export async function fetchArticleByNaddr(naddrStr: string): Promise<ArticleData | null> {
  let decoded: nip19.AddressPointer
  try {
    const result = nip19.decode(naddrStr)
    if (result.type !== 'naddr') throw new Error('Not an naddr')
    decoded = result.data as nip19.AddressPointer
  } catch {
    throw new Error('Invalid article address')
  }

  const pool = new SimplePool()
  const relays = decoded.relays?.length ? decoded.relays : DEFAULT_RELAYS

  try {
    const event = await pool.get(relays, {
      kinds: [decoded.kind],
      authors: [decoded.pubkey],
      '#d': [decoded.identifier],
    })

    if (!event) return null

    const getTag = (name: string) => event.tags.find(t => t[0] === name)?.[1]
    const getTags = (name: string) => event.tags.filter(t => t[0] === name).map(t => t[1])

    return {
      id: event.id,
      pubkey: event.pubkey,
      title: getTag('title') || 'Untitled',
      content: event.content,
      summary: getTag('summary'),
      image: getTag('image'),
      tags: getTags('t'),
      publishedAt: getTag('published_at') ? parseInt(getTag('published_at')!) : undefined,
      createdAt: event.created_at,
      slug: getTag('d') || '',
    }
  } finally {
    pool.close(relays)
  }
}

export async function fetchComments(articleEventId: string, relays: string[]): Promise<CommentData[]> {
  const pool = new SimplePool()

  try {
    const events = await pool.querySync(relays, {
      kinds: [1],
      '#e': [articleEventId],
      limit: 50,
    })

    // Sort newest first
    events.sort((a, b) => b.created_at - a.created_at)

    // Fetch author profiles for all unique pubkeys
    const pubkeys = [...new Set(events.map(e => e.pubkey))]
    const profiles = new Map<string, { name?: string; picture?: string; nip05?: string } | null>()

    await Promise.all(
      pubkeys.map(async (pk) => {
        try {
          const p = await fetchProfile(pk, relays)
          profiles.set(pk, p)
        } catch {
          profiles.set(pk, null)
        }
      })
    )

    return events.map(e => ({
      id: e.id,
      pubkey: e.pubkey,
      content: e.content,
      createdAt: e.created_at,
      author: profiles.get(e.pubkey),
    }))
  } finally {
    pool.close(relays)
  }
}
