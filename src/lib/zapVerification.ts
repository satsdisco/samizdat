// Automatic zap verification for seamless unlock experience
import { SimplePool } from 'nostr-tools'
import { DEFAULT_RELAYS } from './nostr'

export interface ZapVerificationConfig {
  authorPubkey: string
  articleEventId: string
  readerPubkey?: string
  zapAmount: number // minimum sats required
  maxAge?: number // max age in minutes (default 60)
}

export interface ZapReceipt {
  id: string
  zapRequest: string
  amount: number // millisats
  comment?: string
  timestamp: number
}

/**
 * Search for valid zap receipts for an article
 */
export async function findZapReceipts(config: ZapVerificationConfig): Promise<ZapReceipt[]> {
  const pool = new SimplePool()
  const maxAge = config.maxAge || 60 // default 1 hour
  const since = Math.floor(Date.now() / 1000) - (maxAge * 60)

  try {
    // Query for zap receipts (kind 9735) mentioning the article
    const zapReceipts = await pool.querySync(DEFAULT_RELAYS, {
      kinds: [9735],
      '#e': [config.articleEventId],
      '#p': [config.authorPubkey],
      since,
      limit: 50
    })

    const receipts: ZapReceipt[] = []

    for (const receipt of zapReceipts) {
      try {
        // Parse bolt11 invoice from receipt
        const bolt11Tag = receipt.tags.find(tag => tag[0] === 'bolt11')
        if (!bolt11Tag?.[1]) continue

        // Parse zap request from receipt  
        const descriptionTag = receipt.tags.find(tag => tag[0] === 'description')
        if (!descriptionTag?.[1]) continue

        const zapRequest = JSON.parse(descriptionTag[1])
        
        // Verify zap request mentions our article
        const eventTags = zapRequest.tags?.filter((t: string[]) => t[0] === 'e') || []
        if (!eventTags.some((t: string[]) => t[1] === config.articleEventId)) continue

        // Extract amount from bolt11 (simplified - could use a proper parser)
        const amountMatch = bolt11Tag[1].match(/(\d+)[mn]?/)
        if (!amountMatch) continue

        const amountSats = parseInt(amountMatch[1])
        if (amountSats < config.zapAmount) continue

        // If reader pubkey specified, verify it matches
        if (config.readerPubkey) {
          const fromPubkey = zapRequest.pubkey
          if (fromPubkey !== config.readerPubkey) continue
        }

        receipts.push({
          id: receipt.id,
          zapRequest: zapRequest.content || '',
          amount: amountSats * 1000, // convert to millisats
          comment: zapRequest.content,
          timestamp: receipt.created_at
        })

      } catch (e) {
        // Skip malformed receipts
        continue
      }
    }

    return receipts.sort((a, b) => b.timestamp - a.timestamp)

  } finally {
    pool.close(DEFAULT_RELAYS)
  }
}

/**
 * Check if reader has valid zap for article
 */
export async function verifyReaderZap(config: ZapVerificationConfig): Promise<boolean> {
  if (!config.readerPubkey) {
    // Can't verify without reader's pubkey
    return false
  }

  const receipts = await findZapReceipts(config)
  return receipts.length > 0
}

/**
 * Simplified check - any valid zap in recent timeframe
 */
export async function hasRecentZap(config: Omit<ZapVerificationConfig, 'readerPubkey'>): Promise<boolean> {
  const receipts = await findZapReceipts({
    ...config,
    maxAge: 30 // recent = last 30 minutes
  })
  return receipts.length > 0
}