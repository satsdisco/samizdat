// NIP-07: window.nostr browser extension interface

export interface NostrEvent {
  id?: string
  pubkey?: string
  created_at: number
  kind: number
  tags: string[][]
  content: string
  sig?: string
}

export interface WindowNostr {
  getPublicKey(): Promise<string>
  signEvent(event: NostrEvent): Promise<NostrEvent>
  nip04?: {
    encrypt(pubkey: string, plaintext: string): Promise<string>
    decrypt(pubkey: string, ciphertext: string): Promise<string>
  }
  nip44?: {
    encrypt(pubkey: string, plaintext: string): Promise<string>
    decrypt(pubkey: string, ciphertext: string): Promise<string>
  }
}

declare global {
  interface Window {
    nostr?: WindowNostr
  }
}

// NIP-23: Long-form content
export interface Article {
  id?: string
  pubkey?: string
  slug: string           // d-tag identifier
  title: string
  content: string        // markdown
  summary?: string
  image?: string         // cover image URL
  tags: string[]         // hashtags
  publishedAt?: number   // unix timestamp
  createdAt?: number     // last updated
  isDraft: boolean       // kind 30024 vs 30023
}

// NIP-65: Relay list
export interface RelayInfo {
  url: string
  read: boolean
  write: boolean
}

// Relay connection state
export type RelayStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

export interface RelayConnection {
  url: string
  status: RelayStatus
  ws?: WebSocket
}
