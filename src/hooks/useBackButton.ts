/**
 * Android hardware back button handler.
 *
 * Priority stack:
 * 1. If a modal/overlay is open → close it
 * 2. If there's browser history to go back to → go back
 * 3. Otherwise → minimize app (App.minimizeApp)
 *
 * On web this is a no-op.
 */

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'

interface BackButtonOptions {
  /** Called when back is pressed and nothing else handled it. Return true to prevent default minimize. */
  onBack?: () => boolean
}

export function useBackButton(options?: BackButtonOptions) {
  const navigate = useNavigate()

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    let cleanup: (() => void) | undefined

    const init = async () => {
      const { App } = await import('@capacitor/app')

      const { remove } = await App.addListener('backButton', ({ canGoBack }) => {
        // Let the caller intercept first (e.g. to close a modal)
        if (options?.onBack?.()) return

        if (canGoBack) {
          navigate(-1)
        } else {
          // No history — minimize the app (Android convention)
          App.minimizeApp()
        }
      })
      cleanup = remove
    }

    init().catch(console.warn)
    return () => { cleanup?.() }
  }, [navigate, options?.onBack])
}
