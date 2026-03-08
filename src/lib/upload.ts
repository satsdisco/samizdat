// Image upload to nostr.build with NIP-98 auth
// Falls back to nip96 endpoint which requires a signed auth event

const UPLOAD_ENDPOINT = 'https://nostr.build/api/v2/nip96/upload'

export interface UploadResult {
  url: string
  mimeType?: string
  sha256?: string
  size?: number
  dimensions?: string
  blurhash?: string
}

export type SignEventFn = (event: {
  kind: number
  created_at: number
  tags: string[][]
  content: string
}) => Promise<{ id: string; pubkey: string; created_at: number; kind: number; tags: string[][]; content: string; sig: string }>

// Build a NIP-98 auth header event (kind 27235)
async function buildNip98Auth(url: string, method: string, signEvent: SignEventFn): Promise<string> {
  const event = {
    kind: 27235,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['u', url],
      ['method', method.toUpperCase()],
    ],
    content: '',
  }

  const signed = await signEvent(event)
  return btoa(JSON.stringify(signed))
}

export async function uploadImage(file: File, signEvent?: SignEventFn): Promise<UploadResult> {
  const formData = new FormData()
  formData.append('file', file)

  const headers: Record<string, string> = {}

  // Add NIP-98 auth if we have a signer
  if (signEvent) {
    try {
      const authToken = await buildNip98Auth(UPLOAD_ENDPOINT, 'POST', signEvent)
      headers['Authorization'] = `Nostr ${authToken}`
    } catch (e) {
      console.warn('NIP-98 auth failed, trying without:', e)
    }
  }

  const response = await fetch(UPLOAD_ENDPOINT, {
    method: 'POST',
    headers,
    body: formData,
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`Upload failed: ${response.status}${text ? ` — ${text}` : ''}`)
  }

  const data = await response.json()

  if (data.status !== 'success') {
    throw new Error(data.message || 'Upload failed')
  }

  // NIP-96 returns nip94_event with tags
  const nip94 = data.nip94_event
  if (nip94?.tags) {
    const getTag = (name: string) => nip94.tags.find((t: string[]) => t[0] === name)?.[1]
    return {
      url: getTag('url') || '',
      mimeType: getTag('m'),
      sha256: getTag('x'),
      size: getTag('size') ? parseInt(getTag('size')) : undefined,
      dimensions: getTag('dim'),
      blurhash: getTag('blurhash'),
    }
  }

  // Fallback: old format
  const result = data.data?.[0] || data
  return {
    url: result.url || '',
    mimeType: result.mime,
    sha256: result.sha256,
    size: result.size,
    dimensions: result.dimensions,
    blurhash: result.blurhash,
  }
}
