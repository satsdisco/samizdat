/**
 * Deep link handler for native Android.
 *
 * Handles:
 * - nostr:naddr1...  → navigate to /a/<naddr>
 * - https://samizdat.press/a/<naddr> → navigate to /a/<naddr>
 * - https://samizdat.press/* → navigate to the same path in-app
 *
 * On web this is a no-op since the browser router handles URL navigation.
 */

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'

export function useDeepLinks() {
  const navigate = useNavigate()

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    let cleanup: (() => void) | undefined

    const init = async () => {
      const { App } = await import('@capacitor/app')

      const handleUrl = (url: string) => {
        // nostr: URI scheme
        if (url.startsWith('nostr:')) {
          const entity = url.replace(/^nostr:/, '')
          if (entity.startsWith('naddr') || entity.startsWith('note') || entity.startsWith('nevent')) {
            navigate(`/a/${entity}`)
          }
          return
        }

        // https://samizdat.press/a/<naddr>
        try {
          const parsed = new URL(url)
          if (parsed.hostname === 'samizdat.press') {
            // Forward the path + search into the in-app router
            navigate(parsed.pathname + parsed.search + parsed.hash)
          }
        } catch {
          // Not a valid URL — ignore
        }
      }

      // Handle links that open the app (cold start via intent)
      const launchUrl = await App.getLaunchUrl()
      if (launchUrl?.url) {
        handleUrl(launchUrl.url)
      }

      // Handle links while app is already running
      const { remove } = await App.addListener('appUrlOpen', ({ url }) => {
        handleUrl(url)
      })
      cleanup = remove
    }

    init().catch(console.warn)
    return () => { cleanup?.() }
  }, [navigate])
}
