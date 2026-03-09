// Nostr protocol utilities using nostr-tools

import { Relay } from 'nostr-tools/relay'
import { SimplePool } from 'nostr-tools'
import { nip19 } from 'nostr-tools'
import type { Article, NostrEvent, RelayInfo } from '../types/nostr'

// Event kinds
export const KIND_ARTICLE = 30023
export const KIND_DRAFT = 30024
export const KIND_RELAY_LIST = 10002
export const KIND_METADATA = 0
export const KIND_BLOSSOM_SERVERS = 10063

// Default relays for bootstrap (before we know user's relay list)
export const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.primal.net',
  'wss://relay.nostr.band',
]

// Generate a URL-friendly slug from title
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
    .replace(/^-+|-+$/g, '')
}

// Build a NIP-23 event (unsigned) from an Article
export function buildArticleEvent(article: Article): NostrEvent {
  const kind = article.isDraft ? KIND_DRAFT : KIND_ARTICLE
  const now = Math.floor(Date.now() / 1000)

  const tags: string[][] = [
    ['d', article.slug],
    ['title', article.title],
  ]

  if (article.summary) tags.push(['summary', article.summary])
  if (article.image) tags.push(['image', article.image])

  // published_at: first publish time (preserve if exists)
  if (!article.isDraft) {
    const pubTime = article.publishedAt || now
    tags.push(['published_at', String(pubTime)])
  }

  // Hashtags
  for (const tag of article.tags) {
    tags.push(['t', tag.toLowerCase()])
  }

  return {
    kind,
    created_at: now,
    tags,
    content: article.content, // markdown
  }
}

// Sign an event using NIP-07 browser extension
export async function signWithExtension(event: NostrEvent): Promise<NostrEvent> {
  if (!window.nostr) {
    throw new Error('No nostr extension found. Install Alby or nos2x.')
  }
  return window.nostr.signEvent(event)
}

// Fetch user's relay list (NIP-65 kind:10002)
export async function fetchRelayList(pubkey: string, relayUrls: string[]): Promise<RelayInfo[]> {
  const relays: RelayInfo[] = []

  for (const url of relayUrls) {
    let relay: Relay | null = null
    try {
      relay = await Relay.connect(url)

      const events = await new Promise<NostrEvent[]>((resolve) => {
        const collected: NostrEvent[] = []
        const sub = relay!.subscribe(
          [{ kinds: [KIND_RELAY_LIST], authors: [pubkey], limit: 1 }],
          {
            onevent(event: NostrEvent) {
              collected.push(event)
            },
            oneose() {
              sub.close()
              resolve(collected)
            },
          }
        )
        // Timeout after 5s
        setTimeout(() => { sub.close(); resolve(collected) }, 5000)
      })

      if (events.length > 0) {
        // Use the most recent
        const latest = events.sort((a, b) => (b.created_at || 0) - (a.created_at || 0))[0]
        for (const tag of latest.tags) {
          if (tag[0] === 'r' && tag[1]) {
            const marker = tag[2]
            relays.push({
              url: tag[1],
              read: !marker || marker === 'read',
              write: !marker || marker === 'write',
            })
          }
        }
        relay.close()
        break // Got the relay list, done
      }
      relay.close()
    } catch {
      relay?.close()
      continue
    }
  }

  return relays.length > 0 ? relays : DEFAULT_RELAYS.map(url => ({ url, read: true, write: true }))
}

// Fetch user profile metadata (kind:0)
export async function fetchProfile(pubkey: string, relayUrls: string[]): Promise<{ name?: string; picture?: string; nip05?: string; lud16?: string } | null> {
  for (const url of relayUrls) {
    let relay: Relay | null = null
    try {
      relay = await Relay.connect(url)

      const events = await new Promise<NostrEvent[]>((resolve) => {
        const collected: NostrEvent[] = []
        const sub = relay!.subscribe(
          [{ kinds: [KIND_METADATA], authors: [pubkey], limit: 1 }],
          {
            onevent(event: NostrEvent) {
              collected.push(event)
            },
            oneose() {
              sub.close()
              resolve(collected)
            },
          }
        )
        setTimeout(() => { sub.close(); resolve(collected) }, 5000)
      })

      if (events.length > 0) {
        relay.close()
        try {
          return JSON.parse(events[0].content)
        } catch {
          return null
        }
      }
      relay.close()
    } catch {
      relay?.close()
      continue
    }
  }
  return null
}

// Publish a signed event to multiple relays
export async function publishToRelays(event: NostrEvent, relayUrls: string[]): Promise<{ url: string; ok: boolean; error?: string }[]> {
  const pool = new SimplePool()

  const promises = relayUrls.map(async (url) => {
    try {
      // Race between publish and timeout
      await Promise.race([
        pool.publish([url], event as any),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000))
      ])
      return { url, ok: true }
    } catch (e: any) {
      return { url, ok: false, error: e.message || 'Failed' }
    }
  })

  const settled = await Promise.allSettled(promises)
  const results: { url: string; ok: boolean; error?: string }[] = []
  for (const result of settled) {
    if (result.status === 'fulfilled') {
      results.push(result.value)
    }
  }

  pool.close(relayUrls)
  return results
}

// Fetch user's articles from relays
export async function fetchArticles(pubkey: string, relayUrls: string[], drafts = false): Promise<Article[]> {
  const kind = drafts ? KIND_DRAFT : KIND_ARTICLE
  const articles: Article[] = []
  const seen = new Set<string>()

  for (const url of relayUrls) {
    let relay: Relay | null = null
    try {
      relay = await Relay.connect(url)

      const events = await new Promise<NostrEvent[]>((resolve) => {
        const collected: NostrEvent[] = []
        const sub = relay!.subscribe(
          [{ kinds: [kind], authors: [pubkey], limit: 50 }],
          {
            onevent(event: NostrEvent) {
              collected.push(event)
            },
            oneose() {
              sub.close()
              resolve(collected)
            },
          }
        )
        setTimeout(() => { sub.close(); resolve(collected) }, 8000)
      })

      for (const event of events) {
        const dTag = event.tags.find(t => t[0] === 'd')?.[1]
        if (!dTag || seen.has(dTag)) continue
        seen.add(dTag)

        const title = event.tags.find(t => t[0] === 'title')?.[1] || 'Untitled'
        const summary = event.tags.find(t => t[0] === 'summary')?.[1]
        const image = event.tags.find(t => t[0] === 'image')?.[1]
        const publishedAt = event.tags.find(t => t[0] === 'published_at')?.[1]
        const hashtags = event.tags.filter(t => t[0] === 't').map(t => t[1])

        articles.push({
          id: event.id,
          pubkey: event.pubkey,
          slug: dTag,
          title,
          content: event.content,
          summary,
          image,
          tags: hashtags,
          publishedAt: publishedAt ? parseInt(publishedAt) : undefined,
          createdAt: event.created_at,
          isDraft: drafts,
        })
      }

      relay.close()
      if (articles.length > 0) break // Got articles from one relay, good enough
    } catch {
      relay?.close()
      continue
    }
  }

  // Sort by most recent
  return articles.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
}

// Generate naddr for sharing an article
export function encodeArticleAddress(pubkey: string, slug: string, relays: string[]): string {
  return nip19.naddrEncode({
    identifier: slug,
    pubkey,
    kind: KIND_ARTICLE,
    relays: relays.slice(0, 3), // Max 3 relay hints
  })
}

// Format npub for display
export function npubEncode(pubkey: string): string {
  return nip19.npubEncode(pubkey)
}

// Shorten npub for display: npub1abc...xyz
export function shortenNpub(npub: string): string {
  if (npub.length < 20) return npub
  return `${npub.slice(0, 12)}...${npub.slice(-4)}`
}
