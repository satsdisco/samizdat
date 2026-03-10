import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import './Toast.css'

interface ToastProps {
  message: string
  type: 'success' | 'error'
  onClose: () => void
  naddr?: string
}

export function Toast({ message, type, onClose, naddr }: ToastProps) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    // Don't auto-dismiss if there's an naddr link to interact with
    if (naddr) return
    const timer = setTimeout(onClose, 5000)
    return () => clearTimeout(timer)
  }, [onClose, naddr])

  const readerUrl = naddr ? `https://samizdat.press/a/${naddr}` : null

  const handleCopy = async () => {
    if (!readerUrl) return
    if (Capacitor.isNativePlatform()) {
      const { Clipboard } = await import('@capacitor/clipboard')
      const { Haptics, ImpactStyle } = await import('@capacitor/haptics')
      await Clipboard.write({ string: readerUrl })
      await Haptics.impact({ style: ImpactStyle.Light }).catch(() => {})
    } else {
      navigator.clipboard.writeText(readerUrl)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={`toast toast-${type} ${naddr ? 'toast-with-link' : ''}`}>
      <div className="toast-main">
        <span className="toast-icon">{type === 'success' ? '✓' : '✕'}</span>
        <span className="toast-message">{message}</span>
        <button className="toast-close" onClick={onClose}>×</button>
      </div>
      {readerUrl && (
        <div className="toast-link-row">
          <a href={readerUrl} target="_blank" rel="noopener noreferrer" className="toast-reader-link">
            View article →
          </a>
          <button className="toast-copy" onClick={handleCopy}>
            {copied ? 'Copied!' : 'Copy link'}
          </button>
        </div>
      )}
    </div>
  )
}
