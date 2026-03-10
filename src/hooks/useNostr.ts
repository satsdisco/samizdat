// Core nostr authentication and state hook
// Supports NIP-07 (browser extension), NIP-46 (remote signer/bunker), and nsec login

import { useState, useCallback, useEffect, useRef } from 'react'
import type { Article, RelayInfo, NostrEvent } from '../types/nostr'
import { setSecretKey as setSharedSecretKey } from '../lib/signer'
import { storeNsec, retrieveNsec, clearStoredNsec, hasStoredNsec } from '../lib/secureStorage'
import {
  fetchRelayList,
  fetchProfile,
  fetchArticles,
  buildArticleEvent,
  signWithExtension,
  publishToRelays,
  npubEncode,
  shortenNpub,
  DEFAULT_RELAYS,
} from '../lib/nostr'
import { htmlToMarkdown } from '../lib/markdown'

export type AuthMethod = 'extension' | 'bunker' | 'nsec' | 'android-signer' | null

interface NostrState {
  // Auth
  pubkey: string | null
  npub: string | null
  npubShort: string | null
  profile: { name?: string; picture?: string; nip05?: string } | null
  isLoggingIn: boolean
  loginError: string | null
  authMethod: AuthMethod

  // Relays
  relays: RelayInfo[]
  isConnected: boolean

  // Articles
  articles: Article[]
  drafts: Article[]
  isLoadingArticles: boolean

  // Publishing
  isPublishing: boolean
  publishResult: { success: boolean; message: string; relays?: string[]; naddr?: string } | null
}

interface NostrActions {
  loginWithExtension: () => Promise<void>
  loginWithBunker: (bunkerInput: string) => Promise<void>
  loginWithNsec: (nsec: string) => Promise<void>
  initiateQrLogin: () => Promise<{ uri: string; waitForConnection: () => Promise<void> } | null>
  logout: () => void
  publish: (title: string, html: string, options?: {
    summary?: string
    image?: string
    tags?: string[]
    slug?: string
    isDraft?: boolean
    existingPublishedAt?: number
    zapGate?: { amount: number; previewEnd: number }
  }) => Promise<void>
  loadArticles: () => Promise<void>
  clearPublishResult: () => void
  signEvent: (event: any) => Promise<any>
  toggleRelay: (url: string, field: 'read' | 'write') => void
  addRelay: (url: string) => void
  removeRelay: (url: string) => void
  deleteArticle: (article: Article) => Promise<void>
}

const STORAGE_KEY = 'samizdat_pubkey'
const AUTH_METHOD_KEY = 'samizdat_auth_method'

export function useNostr(): [NostrState, NostrActions] {
  const [pubkey, setPubkey] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY))
  const [authMethod, setAuthMethod] = useState<AuthMethod>(() => localStorage.getItem(AUTH_METHOD_KEY) as AuthMethod)
  const [profile, setProfile] = useState<NostrState['profile']>(null)
  const [relays, setRelays] = useState<RelayInfo[]>([])
  const [articles, setArticles] = useState<Article[]>([])
  const [drafts, setDrafts] = useState<Article[]>([])
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [isLoadingArticles, setIsLoadingArticles] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const [publishResult, setPublishResult] = useState<NostrState['publishResult']>(null)

  // Store nsec-derived secret key for signing (kept in memory only, never persisted)
  const secretKeyRef = useRef<Uint8Array | null>(null)
  // Store bunker signer instance
  const bunkerSignerRef = useRef<any>(null)

  const npub = pubkey ? npubEncode(pubkey) : null
  const npubShort = npub ? shortenNpub(npub) : null
  const isConnected = relays.length > 0 && pubkey !== null

  const saveAuth = (pk: string, method: AuthMethod) => {
    setPubkey(pk)
    setAuthMethod(method)
    localStorage.setItem(STORAGE_KEY, pk)
    localStorage.setItem(AUTH_METHOD_KEY, method || '')
  }

  const clearAuth = () => {
    setPubkey(null)
    setAuthMethod(null)
    setProfile(null)
    setRelays([])
    setArticles([])
    setDrafts([])
    setPublishResult(null)
    setLoginError(null)
    secretKeyRef.current = null
    setSharedSecretKey(null)
    if (bunkerSignerRef.current) {
      bunkerSignerRef.current.close?.()
      bunkerSignerRef.current = null
    }
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(AUTH_METHOD_KEY)
    // Clear window.nostr.js widget state so re-login gets a fresh QR/session
    localStorage.removeItem('wnj:bunkerPointer')
    localStorage.removeItem('wnj:clientSecret')
    // Wipe nsec from Keystore-backed secure storage
    clearStoredNsec().catch(() => {})
    // Reload to fully reset the widget's in-memory NIP-46 connection
    window.location.reload()
  }

  const fetchUserData = async (pk: string) => {
    const [relayList, prof] = await Promise.all([
      fetchRelayList(pk, DEFAULT_RELAYS),
      fetchProfile(pk, DEFAULT_RELAYS),
    ])
    setRelays(relayList)
    setProfile(prof)
  }

  // Login with NIP-07 browser extension (Alby, nos2x, etc.)
  const loginWithExtension = useCallback(async () => {
    if (!window.nostr) {
      setLoginError('No nostr extension found. Install Alby or nos2x.')
      return
    }
    setIsLoggingIn(true)
    setLoginError(null)
    try {
      const pk = await window.nostr.getPublicKey()
      if (pk) {
        saveAuth(pk, 'extension')
        await fetchUserData(pk)
      }
    } catch (e: any) {
      setLoginError(e.message || 'Extension login failed')
    } finally {
      setIsLoggingIn(false)
    }
  }, [])



  // Login with NIP-46 remote signer (bunker:// URL or nip05)
  const loginWithBunker = useCallback(async (bunkerInput: string) => {
    setIsLoggingIn(true)
    setLoginError(null)
    try {
      const { parseBunkerInput, BunkerSigner } = await import('nostr-tools/nip46')
      const { generateSecretKey } = await import('nostr-tools/pure')

      const bp = await parseBunkerInput(bunkerInput)
      if (!bp) {
        throw new Error('Invalid bunker link. Expected bunker://... or user@domain.com')
      }

      const clientSk = generateSecretKey()
      const signer = BunkerSigner.fromBunker(clientSk, bp)
      await signer.connect()
      const pk = await signer.getPublicKey()

      bunkerSignerRef.current = signer
      saveAuth(pk, 'bunker')
      await fetchUserData(pk)
    } catch (e: any) {
      setLoginError(e.message || 'Failed to connect to remote signer')
    } finally {
      setIsLoggingIn(false)
    }
  }, [])

  // Login with nsec private key
  const loginWithNsec = useCallback(async (nsecInput: string) => {
    setIsLoggingIn(true)
    setLoginError(null)
    try {
      const { nip19 } = await import('nostr-tools')
      const { getPublicKey } = await import('nostr-tools/pure')

      let sk: Uint8Array
      if (nsecInput.startsWith('nsec1')) {
        const decoded = nip19.decode(nsecInput)
        if (decoded.type !== 'nsec') throw new Error('Invalid nsec')
        sk = decoded.data
      } else {
        // Assume hex
        const hexBytes = nsecInput.match(/.{1,2}/g)?.map(b => parseInt(b, 16)) || []
        sk = new Uint8Array(hexBytes)
      }

      const pk = getPublicKey(sk)
      secretKeyRef.current = sk
      setSharedSecretKey(sk)
      saveAuth(pk, 'nsec')

      // Store nsec in Keystore-backed secure storage (encrypted at rest on Android)
      // Never goes to localStorage or plaintext SharedPreferences
      const hexFallback = Array.from(sk).map(b => b.toString(16).padStart(2, '0')).join('')
      await storeNsec(nsecInput.startsWith('nsec1') ? nsecInput : hexFallback)
        .catch(e => console.warn('[SecureStorage] Failed to store nsec:', e))

      await fetchUserData(pk)
    } catch (e: any) {
      setLoginError(e.message || 'Invalid private key')
    } finally {
      setIsLoggingIn(false)
    }
  }, [])

  // Login with QR code (NIP-46 client-initiated nostrconnect://)
  // Simplified: let BunkerSigner.fromURI handle EVERYTHING — subscription, decryption, handshake.
  // We just generate the URI, show it as QR, and let nostr-tools do the rest.
  const initiateQrLogin = useCallback(async (): Promise<{ uri: string; waitForConnection: () => Promise<void> } | null> => {
    setLoginError(null)
    try {
      const { generateSecretKey, getPublicKey } = await import('nostr-tools/pure')
      const clientSk = generateSecretKey()
      const clientPk = getPublicKey(clientSk)

      const connectRelay = 'wss://relay.nsec.app'
      const secret = Math.random().toString(36).slice(2, 10)
      const perms = 'sign_event:30023,sign_event:30024,sign_event:27235,sign_event:30001,sign_event:10003,sign_event:1,sign_event:7,sign_event:5,get_public_key'

      // Build the nostrconnect:// URI
      const uri = `nostrconnect://${clientPk}?relay=${encodeURIComponent(connectRelay)}&secret=${secret}&perms=${encodeURIComponent(perms)}&name=${encodeURIComponent('Samizdat')}&url=${encodeURIComponent(window.location.origin)}`

      // Store for mobile callback page
      localStorage.setItem('samizdat_nip46_clientsk', Array.from(clientSk).map(b => b.toString(16).padStart(2, '0')).join(''))
      localStorage.setItem('samizdat_nip46_secret', secret)

      setIsLoggingIn(true)

      const waitForConnection = async () => {
        try {
          // Let BunkerSigner.fromURI handle everything:
          // - connects to relay
          // - subscribes to kind:24133
          // - decrypts the signer's connect response
          // - sets up the conversation key
          // - keeps the connection alive for subsequent RPC calls
          const { BunkerSigner } = await import('nostr-tools/nip46')
          console.log('[NIP-46] Waiting for signer via fromURI on', connectRelay)
          const signer = await BunkerSigner.fromURI(clientSk, uri, {}, 120000)
          console.log('[NIP-46] Signer connected! Getting public key...')
          const pk = await signer.getPublicKey()
          console.log('[NIP-46] Got public key:', pk.slice(0, 12) + '...')
          bunkerSignerRef.current = signer
          saveAuth(pk, 'bunker')
          await fetchUserData(pk)
        } catch (e: any) {
          console.error('[NIP-46] Connection failed:', e)
          setLoginError(e.message || 'Connection failed')
          setIsLoggingIn(false)
        }
      }

      return { uri, waitForConnection }
    } catch (e: any) {
      setLoginError(e.message || 'Failed to generate QR code')
      setIsLoggingIn(false)
      return null
    }
  }, [])

  // Handle NIP-46 callback return (mobile redirect from Primal etc.)
  useEffect(() => {
    const bunkerUri = localStorage.getItem('samizdat_nip46_bunker')
    const clientSkHex = localStorage.getItem('samizdat_nip46_clientsk')
    if (bunkerUri && clientSkHex) {
      // Clean up immediately
      localStorage.removeItem('samizdat_nip46_bunker')
      localStorage.removeItem('samizdat_nip46_clientsk')
      localStorage.removeItem('samizdat_nip46_secret')
      localStorage.removeItem('samizdat_nip46_callback_received')
      // Complete the bunker login
      loginWithBunker(bunkerUri).catch(console.error)
    }
  }, [])

  // Auto-reconnect on mount
  useEffect(() => {
    if (pubkey && relays.length === 0 && !isLoggingIn) {
      fetchUserData(pubkey).catch(console.error)
    }
  }, [pubkey])

  // On app launch: if user previously logged in with nsec and a stored key exists,
  // prompt biometric and restore the signing key into memory.
  // This means the user won't have to re-enter their nsec on every app open.
  useEffect(() => {
    if (authMethod !== 'nsec' || secretKeyRef.current) return
    // Only attempt auto-restore if we think the user is logged in with nsec
    hasStoredNsec().then(async (stored) => {
      if (!stored) return
      const nsec = await retrieveNsec() // triggers biometric prompt on native
      if (!nsec) return // user cancelled biometric or no key found
      try {
        const { nip19 } = await import('nostr-tools')
        const { getPublicKey } = await import('nostr-tools/pure')
        let sk: Uint8Array
        if (nsec.startsWith('nsec1')) {
          const decoded = nip19.decode(nsec)
          if (decoded.type !== 'nsec') return
          sk = decoded.data
        } else {
          const hexBytes = nsec.match(/.{1,2}/g)?.map(b => parseInt(b, 16)) || []
          sk = new Uint8Array(hexBytes)
        }
        // Validate key matches stored pubkey
        const pk = getPublicKey(sk)
        if (pubkey && pk !== pubkey) {
          // Key mismatch — clear stale data
          clearStoredNsec().catch(() => {})
          return
        }
        secretKeyRef.current = sk
        setSharedSecretKey(sk)
      } catch (e) {
        console.warn('[SecureStorage] Failed to restore nsec from secure storage:', e)
      }
    }).catch(console.warn)
  }, [authMethod])

  // Sign an event based on auth method
  const signEvent = async (event: NostrEvent): Promise<NostrEvent> => {
    let signed: NostrEvent

    if (authMethod === 'extension') {
      signed = await signWithExtension(event)
    } else if (authMethod === 'bunker' && bunkerSignerRef.current) {
      signed = await bunkerSignerRef.current.signEvent(event)
    } else if (authMethod === 'nsec' && secretKeyRef.current) {
      const { finalizeEvent } = await import('nostr-tools/pure')
      signed = finalizeEvent(event as any, secretKeyRef.current) as any
    } else {
      // Auth method saved but signer lost (e.g., page reload with bunker)
      throw new Error('Session expired. Please sign in again.')
    }

    // Ensure signed event has all required fields
    if (!signed.id || !signed.sig || !signed.pubkey) {
      console.error('signEvent returned incomplete event:', signed)
      throw new Error('Signer returned an incomplete event (missing id/sig/pubkey)')
    }

    return signed
  }

  // Publish an article
  const publish = useCallback(async (
    title: string,
    html: string,
    options: {
      summary?: string
      image?: string
      tags?: string[]
      slug?: string
      isDraft?: boolean
      existingPublishedAt?: number
      zapGate?: { amount: number; previewEnd: number }
    } = {}
  ) => {
    if (!pubkey) {
      setLoginError('Please sign in first.')
      return
    }

    setIsPublishing(true)
    setPublishResult(null)

    try {
      const markdown = htmlToMarkdown(html)
      const slug = options.slug || title.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').slice(0, 80)

      const article: Article = {
        slug,
        title,
        content: markdown,
        summary: options.summary,
        image: options.image,
        tags: options.tags || [],
        isDraft: options.isDraft ?? false,
        publishedAt: options.existingPublishedAt,
      }

      const event = buildArticleEvent(article)

      // Zap-gated: split publish (preview to public, full to private relay)
      if (options.zapGate) {
        event.tags.push(['zap_gate', String(options.zapGate.amount)])
        event.tags.push(['preview_end', String(options.zapGate.previewEnd)])

        // Build preview-only version for public relays
        const paragraphs = markdown.split(/\n\n+/)
        const previewMd = paragraphs.slice(0, options.zapGate.previewEnd).join('\n\n')
        const previewArticle: Article = {
          ...article,
          content: previewMd + '\n\n---\n\n*This article is zap-gated. Read the full version on [Samizdat](https://samizdat.press).*',
        }
        const previewEvent = buildArticleEvent(previewArticle)
        previewEvent.tags.push(['zap_gate', String(options.zapGate.amount)])
        previewEvent.tags.push(['preview_end', String(options.zapGate.previewEnd)])

        // Sign both events
        const signedPreview = await signEvent(previewEvent)
        const signedFull = await signEvent(event)

        // Publish preview to user's write relays + default relays for maximum reach
        const writeRelays = relays.filter(r => r.write).map(r => r.url)
        const publicRelays = [...new Set([...writeRelays, ...DEFAULT_RELAYS])]
        const publicResults = await publishToRelays(signedPreview, publicRelays)

        // Publish full to private Samizdat relay
        const SAMIZDAT_RELAY = 'wss://relay.samizdat.press'
        const privateResults = await publishToRelays(signedFull, [SAMIZDAT_RELAY]).catch(() => [{ url: SAMIZDAT_RELAY, ok: false, error: 'Private relay unavailable' }])

        const successful = [...publicResults, ...privateResults].filter(r => r.ok)

        if (successful.length > 0) {
          const { nip19 } = await import('nostr-tools')
          const naddr = nip19.naddrEncode({
            kind: 30023,
            pubkey: pubkey!,
            identifier: slug,
            relays: publicRelays.slice(0, 2),
          })
          setPublishResult({
            success: true,
            message: `Preview → ${publicResults.filter(r => r.ok).length} public relays, Full → ${privateResults.filter((r: any) => r.ok).length > 0 ? 'private relay' : 'pending (relay not yet configured)'}`,
            relays: successful.map(r => r.url),
            naddr,
          })
        } else {
          setPublishResult({
            success: false,
            message: 'Failed to publish to any relay.',
          })
        }

        setIsPublishing(false)
        return
      }

      const signed = await signEvent(event)

      // Always publish to user's write relays AND default relays for maximum reach
      const writeRelays = relays.filter(r => r.write).map(r => r.url)
      const targetRelays = [...new Set([...writeRelays, ...DEFAULT_RELAYS])]

      const results = await publishToRelays(signed, targetRelays)
      const successful = results.filter(r => r.ok)

      if (successful.length > 0) {
        const { nip19 } = await import('nostr-tools')
        // Use successful relays for naddr hints (prefer well-known ones)
        const successUrls = successful.map(r => r.url)
        const preferredOrder = DEFAULT_RELAYS.filter(r => successUrls.includes(r))
        const naddrRelays = preferredOrder.length > 0
          ? preferredOrder.slice(0, 2)
          : successUrls.slice(0, 2)
        const naddr = options.isDraft ? undefined : nip19.naddrEncode({
          kind: 30023,
          pubkey: pubkey!,
          identifier: slug,
          relays: naddrRelays,
        })
        const failed = results.filter(r => !r.ok)
        const failedNote = failed.length > 0
          ? ` (failed: ${failed.map(r => r.url.replace('wss://', '')).join(', ')})`
          : ''
        setPublishResult({
          success: true,
          message: `Published to ${successful.length}/${results.length} relays${failedNote}`,
          naddr,
          relays: successUrls,
        })
      } else {
        setPublishResult({
          success: false,
          message: 'Failed to publish to any relay. Check your connection.',
        })
      }
    } catch (e: any) {
      setPublishResult({
        success: false,
        message: e.message || 'Publishing failed',
      })
    } finally {
      setIsPublishing(false)
    }
  }, [pubkey, relays, authMethod])

  // Load user's articles
  const loadArticles = useCallback(async () => {
    if (!pubkey) return
    setIsLoadingArticles(true)
    try {
      const readRelays = relays.filter(r => r.read).map(r => r.url)
      const targetRelays = readRelays.length > 0 ? readRelays : DEFAULT_RELAYS

      const [arts, drfts] = await Promise.all([
        fetchArticles(pubkey, targetRelays, false),
        fetchArticles(pubkey, targetRelays, true),
      ])
      setArticles(arts)
      setDrafts(drfts)
    } catch (e) {
      console.error('Failed to load articles:', e)
    } finally {
      setIsLoadingArticles(false)
    }
  }, [pubkey, relays])

  const clearPublishResult = useCallback(() => setPublishResult(null), [])

  const toggleRelay = useCallback((url: string, field: 'read' | 'write') => {
    setRelays(prev => prev.map(r =>
      r.url === url ? { ...r, [field]: !r[field] } : r
    ))
  }, [])

  const addRelay = useCallback((url: string) => {
    setRelays(prev => {
      if (prev.some(r => r.url === url)) return prev
      return [...prev, { url, read: true, write: true }]
    })
  }, [])

  const removeRelay = useCallback((url: string) => {
    setRelays(prev => prev.filter(r => r.url !== url))
  }, [])

  // Delete an article (NIP-09 deletion event)
  const deleteArticle = useCallback(async (article: Article) => {
    if (!pubkey) return

    try {
      // Build kind 5 deletion event referencing the article's 'a' tag
      const kind = article.isDraft ? 30024 : 30023
      const event = {
        kind: 5,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['a', `${kind}:${pubkey}:${article.slug}`],
        ],
        content: 'Article deleted via Samizdat',
      }

      const signed = await signEvent(event)

      const writeRelays = relays.filter(r => r.write).map(r => r.url)
      const targetRelays = [...new Set([...writeRelays, ...DEFAULT_RELAYS])]
      await publishToRelays(signed, targetRelays)

      // Remove from local state
      if (article.isDraft) {
        setDrafts(prev => prev.filter(d => d.slug !== article.slug))
      } else {
        setArticles(prev => prev.filter(a => a.slug !== article.slug))
      }

      setPublishResult({ success: true, message: 'Deletion request sent to relays' })
    } catch (e: any) {
      setPublishResult({ success: false, message: e.message || 'Delete failed' })
    }
  }, [pubkey, relays, authMethod])

  const state: NostrState = {
    pubkey,
    npub,
    npubShort,
    profile,
    isLoggingIn,
    loginError,
    authMethod,
    relays,
    isConnected,
    articles,
    drafts,
    isLoadingArticles,
    isPublishing,
    publishResult,
  }

  const actions: NostrActions = {
    loginWithExtension,
    loginWithBunker,
    loginWithNsec,
    initiateQrLogin,
    logout: clearAuth,
    signEvent,
    toggleRelay,
    addRelay,
    removeRelay,
    deleteArticle,
    publish,
    loadArticles,
    clearPublishResult,
  }

  return [state, actions]
}
