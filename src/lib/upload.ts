// Image upload to nostr.build (free, no auth required)

const UPLOAD_ENDPOINT = 'https://nostr.build/api/v2/upload/files'

export interface UploadResult {
  url: string
  mimeType?: string
  sha256?: string
  size?: number
  dimensions?: string
  blurhash?: string
}

export async function uploadImage(file: File): Promise<UploadResult> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch(UPLOAD_ENDPOINT, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()

  // nostr.build returns { status: 'success', data: [{ url, ... }] }
  if (data.status !== 'success' || !data.data?.[0]) {
    throw new Error(data.message || 'Upload failed')
  }

  const result = data.data[0]
  return {
    url: result.url,
    mimeType: result.mime,
    sha256: result.sha256,
    size: result.size,
    dimensions: result.dimensions,
    blurhash: result.blurhash,
  }
}

// Upload from a paste/drop blob
export async function uploadBlob(blob: Blob, filename?: string): Promise<UploadResult> {
  const file = new File([blob], filename || `image-${Date.now()}.png`, { type: blob.type })
  return uploadImage(file)
}
